import { createPublicClient, http, parseAbi, getAddress, isAddress, encodeFunctionData, zeroAddress, type Address, type Hash, type Hex } from 'viem';
import { sepolia } from 'viem/chains';

export const POSITION_MANAGER: Address = '0x1238536071E1c677A632429e3655c799b22cDA52';
export const DEFAULT_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
export const nftAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner,uint256 index) view returns (uint256)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function isApprovedForAll(address owner,address operator) view returns (bool)',
  'function approve(address spender,uint256 tokenId)',
  'function setApprovalForAll(address operator,bool approved)',
]);
export const eacAbi = parseAbi([
  'function roles(uint256 resource,address account) view returns (uint256)',
  'function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns (bool)',
  'function revokeRootRoles(uint256 roleBitmap,address account) returns (bool)',
  'function revokeRoles(uint256 resource,uint256 roleBitmap,address account) returns (bool)',
  'function isApprovedForAll(address owner,address operator) view returns (bool)',
  'function setApprovalForAll(address operator,bool approved)',
]);
export type Target = { label: string; address: Address; resource: string; kind: 'registry' | 'resolver' };
export type Config = { owner: string; subject: string; rpc: string; targets: Target[] };
export type Finding = { id: string; protocol: 'Uniswap v3' | 'ENSv2'; title: string; detail: string; scope: string; broad: boolean; address: Address; fn: 'setApprovalForAll' | 'approve' | 'revokeRootRoles' | 'revokeRoles'; args: readonly unknown[]; data: Hex; executable: boolean; blockedReason?: string };
export type EnsState = { target: Target; root: bigint; local: bigint; ownerRoot: bigint; ownerLocal: bigint; operator: boolean | null };
export type Snapshot = { block: bigint; blockHash: Hash; timestamp: string; config: Config; owner: Address; subject: Address; operator: boolean; positions: { id: bigint; approved: Address; owner: Address }[]; positionCount: bigint; complete: boolean; ens: EnsState[]; findings: Finding[]; errors: string[] };
export const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const errorText = (error: unknown): string => error && typeof error === 'object' && 'shortMessage' in error ? String(error.shortMessage) : error instanceof Error ? error.message : String(error);
export const short = (s: string) => s.length > 16 ? `${s.slice(0,6)}…${s.slice(-4)}` : s;
export const clientFor = (rpc: string) => createPublicClient({ chain: sepolia, transport: http(rpc, { timeout: 20000, retryCount: 1 }) });
export function validateConfig(c: Config): void {
  if (!isAddress(c.owner) || !isAddress(c.subject)) throw new Error('Enter valid owner and departing wallet addresses.');
  if (same(c.owner, c.subject)) throw new Error('The owner and departing wallet must be different.');
  if (same(c.owner, zeroAddress) || same(c.subject, zeroAddress)) throw new Error('The zero address cannot be an owner or departing wallet.');
  const url = new URL(c.rpc);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('RPC must be an HTTP or HTTPS endpoint.');
  const seen = new Set<string>();
  for (const t of c.targets) {
    if (!t.label.trim() || !isAddress(t.address) || same(t.address,zeroAddress)) throw new Error('Every ENS target needs a label and valid nonzero contract address.');
    const resource = BigInt(t.resource);
    if (resource <= 0n || resource >= 2n ** 256n) throw new Error('ENS resource must be a nonzero uint256; root is scanned automatically.');
    if (!['registry','resolver'].includes(t.kind)) throw new Error('ENS target kind must be registry or resolver.');
    const key = `${t.address.toLowerCase()}:${resource}`;
    if (seen.has(key)) throw new Error('Remove duplicate ENS contract/resource targets.');
    seen.add(key);
  }
}
// EAC encodes one role bit in each four-bit slot, not consecutive bits.
export function adminMask(roles: bigint): bigint {
  const lower = roles & ((1n << 128n) - 1n);
  return (lower << 128n) | (roles & (((1n << 256n) - 1n) ^ ((1n << 128n) - 1n)));
}
export function orderFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a,b) => Number(b.broad)-Number(a.broad) || a.id.localeCompare(b.id));
}
export function deriveFindings(s: Omit<Snapshot,'findings'>, canRevoke: Record<string,boolean> = {}): Finding[] {
  const f: Finding[] = [];
  const add = (item: Omit<Finding,'data'>) => f.push({...item, data: encodeFunctionData({abi:item.protocol === 'Uniswap v3' ? nftAbi : eacAbi,functionName:item.fn,args:item.args} as never)});
  if(s.operator) add({id:'uni:operator',protocol:'Uniswap v3',title:'Portfolio-wide operator access',detail:'Removing a single position approval leaves this permission active. It also covers future positions held in this position manager.',scope:`${s.positionCount} positions · current and future`,broad:true,address:POSITION_MANAGER,fn:'setApprovalForAll',args:[s.subject,false],executable:true});
  for(const p of s.positions) if(same(p.approved,s.subject)) add({id:`uni:${p.id}`,protocol:'Uniswap v3',title:`Position #${p.id} approval`,detail:'This wallet can manage this position through its individual NFT approval.',scope:`Position #${p.id}`,broad:false,address:POSITION_MANAGER,fn:'approve',args:[zeroAddress,p.id],executable:true});
  const roots = new Set<string>();
  const operators = new Set<string>();
  for(const e of s.ens) {
    const addr=e.target.address.toLowerCase();
    if(e.operator && !operators.has(addr)) {
      operators.add(addr);
      add({id:`ens:${addr}:operator`,protocol:'ENSv2',title:'Registry operator access',detail:'The departing wallet inherits the owner’s registry token permissions through ERC-1155 operator approval.',scope:e.target.label,broad:true,address:e.target.address,fn:'setApprovalForAll',args:[s.subject,false],executable:true});
    }
    if(e.root && !roots.has(addr)) {
      roots.add(addr);
      const id=`ens:${addr}:root`;
      add({id,protocol:'ENSv2',title:'Contract-wide ENS roles survive',detail:'Root roles apply to resources in this contract. Admin roles may allow permissions to be granted again within their supported scope.',scope:e.target.label,broad:true,address:e.target.address,fn:'revokeRootRoles',args:[e.root,s.subject],executable:canRevoke[id] === true,blockedReason:'Owner lacks the required admin roles, or authority could not be verified.'});
    }
    if(e.local) {
      const id=`ens:${addr}:${BigInt(e.target.resource)}`;
      add({id,protocol:'ENSv2',title:'Resource-level ENS roles remain',detail:'Remove remaining roles on this specific resource. Registry and resolver permissions are checked separately.',scope:e.target.label,broad:false,address:e.target.address,fn:'revokeRoles',args:[BigInt(e.target.resource),e.local,s.subject],executable:canRevoke[id] === true,blockedReason:'Owner lacks the required admin roles, or authority could not be verified.'});
    }
  }
  return orderFindings(f);
}
export async function scan(config: Config): Promise<Snapshot> {
  validateConfig(config);
  const client = clientFor(config.rpc);
  if(await client.getChainId() !== sepolia.id) throw new Error('RPC is not connected to Ethereum Sepolia (11155111).');
  const owner=getAddress(config.owner),subject=getAddress(config.subject);
  const block=await client.getBlockNumber({cacheTime:0});
  const blockInfo=await client.getBlock({blockNumber:block});
  const read = (address: Address, abi: typeof nftAbi | typeof eacAbi, functionName: string, args: unknown[]) => client.readContract({address,abi,functionName,args,blockNumber:block} as never) as Promise<any>;
  const errors: string[]=[];
  const [operator,positionCount]=await Promise.all([read(POSITION_MANAGER,nftAbi,'isApprovedForAll',[owner,subject]) as Promise<boolean>,read(POSITION_MANAGER,nftAbi,'balanceOf',[owner]) as Promise<bigint>]);
  const cap=200n;
  const count=Number(positionCount > cap ? cap : positionCount);
  const positions: Snapshot['positions']=[];
  for(let offset=0;offset<count;offset+=10) {
    const batch=await Promise.allSettled(Array.from({length:Math.min(10,count-offset)},async (_,i)=>{
      const id:bigint=await read(POSITION_MANAGER,nftAbi,'tokenOfOwnerByIndex',[owner,BigInt(offset+i)]);
      const [approved,currentOwner]=await Promise.all([read(POSITION_MANAGER,nftAbi,'getApproved',[id]),read(POSITION_MANAGER,nftAbi,'ownerOf',[id])]);
      if(!same(currentOwner,owner)) throw new Error(`Position #${id} ownership mismatch.`);
      return {id,approved:getAddress(approved),owner:getAddress(currentOwner)};
    }));
    for(const r of batch) if(r.status==='fulfilled') positions.push(r.value); else errors.push(`Position read failed: ${errorText(r.reason)}`);
  }
  if(positionCount>cap) errors.push('Portfolio exceeds the 200-position scan limit. Coverage is incomplete.');
  const ens: EnsState[]=[];const authority:Record<string,boolean>={};
  for(const target of config.targets) {
    try {
      if(!await client.getCode({address:target.address,blockNumber:block})) throw new Error('No contract at this address.');
      const resource=BigInt(target.resource);
      const [root,local,ownerRoot,ownerLocal]=await Promise.all([read(target.address,eacAbi,'roles',[0n,subject]),read(target.address,eacAbi,'roles',[resource,subject]),read(target.address,eacAbi,'roles',[0n,owner]),read(target.address,eacAbi,'roles',[resource,owner])]) as bigint[];
      let registryOperator: boolean|null=null;
      if(target.kind==='registry') registryOperator=await read(target.address,eacAbi,'isApprovedForAll',[owner,subject]);
      const e={target,root,local,ownerRoot,ownerLocal,operator:registryOperator};ens.push(e);
      if(root) authority[`ens:${target.address.toLowerCase()}:root`]=await read(target.address,eacAbi,'hasRoles',[0n,adminMask(root),owner]);
      if(local) authority[`ens:${target.address.toLowerCase()}:${resource}`]=await read(target.address,eacAbi,'hasRoles',[resource,adminMask(local),owner]);
    } catch(error) {errors.push(`${target.label}: ${errorText(error)}`);}
  }
  const s={block,blockHash:blockInfo.hash,timestamp:new Date(Number(blockInfo.timestamp)*1000).toISOString(),config:structuredClone(config),owner,subject,operator,positions,positionCount,ens,complete:errors.length===0,errors};
  return {...s,findings:deriveFindings(s,authority)};
}
export function compareOwner(before: Snapshot,after: Snapshot): string[] {
  const problems:string[]=[];
  if(!same(before.owner,after.owner)||!same(before.subject,after.subject)) problems.push('Wallet pair changed.');
  if(before.positionCount!==after.positionCount || before.positions.some(p=>!after.positions.some(q=>p.id===q.id && same(q.owner,p.owner)))) problems.push('Position ownership changed between checks.');
  for(const e of before.ens) {
    const a=after.ens.find(q=>same(q.target.address,e.target.address)&&BigInt(q.target.resource)===BigInt(e.target.resource));
    if(!a || (a.ownerRoot & e.ownerRoot)!==e.ownerRoot || (a.ownerLocal & e.ownerLocal)!==e.ownerLocal) problems.push(`Owner roles changed: ${e.target.label}`);
  }
  return problems;
}
export function serialize(value: unknown): string {return JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2);}
