import { ensAbi } from './ens/abi';
import { POSITION_MANAGER, positionAbi, positionEconomics, economicChanges, type PositionEconomics } from './uniswap/contracts';
import { readIdentity, identityChanges, assertExplainedAuthorization, type IdentityState } from './ens/preservation';
import { parseAbi, getAddress, isAddress, encodeFunctionData, zeroAddress, type Address, type Hash, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { EAC_INTERFACE, REGISTRY_INTERFACE, RESOLVER_INTERFACE, describeRoles, resolverResource, recordRole } from './ens/roles';
import { clientFor, isBlockUnavailable, BLOCK_READ_MESSAGE, validateRpcEndpoint } from './rpc';
import { vaultAbi, vaultContinuity, type VaultState } from './guarded/model';

export { POSITION_MANAGER } from './uniswap/contracts';
export { DEFAULT_RPC, clientFor } from './rpc';
export const nftAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner,uint256 index) view returns (uint256)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function isApprovedForAll(address owner,address operator) view returns (bool)',
  'function approve(address spender,uint256 tokenId)',
  'function setApprovalForAll(address operator,bool approved)',
  'function setPaused(bool paused)',
]);
export const eacAbi = parseAbi([
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'function getResource(uint256 anyId) view returns (uint256)',
  'function getOwner(uint256 anyId) view returns (address)',
  'function getTokenId(uint256 anyId) view returns (uint256)',
  'function getExpiry(uint256 anyId) view returns (uint64)',
  'function roles(uint256 resource,address account) view returns (uint256)',
  'function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns (bool)',
  'function revokeRootRoles(uint256 roleBitmap,address account) returns (bool)',
  'function revokeRoles(uint256 resource,uint256 roleBitmap,address account) returns (bool)',
  'function isApprovedForAll(address owner,address operator) view returns (bool)',
  'function setApprovalForAll(address operator,bool approved)',
]);
export type Target = { label: string; address: Address; resource: string; kind: 'registry' | 'resolver'; name?:string; recordType?:'text'|'data'|'coin'|'abi'|'interface'; argument?:string };
export type Config = { owner: string; subject: string; rpc: string; targets: Target[]; scanUniswap?:boolean; guardedVaults?:string[] };
export type Finding = { id: string; protocol: 'Uniswap v3' | 'ENSv2'; title: string; detail: string; scope: string; broad: boolean; address: Address; fn: 'setApprovalForAll' | 'approve' | 'revokeRootRoles' | 'revokeRoles' | 'setPaused'; args: readonly unknown[]; data: Hex; executable: boolean; blockedReason?: string };
export type EnsState = { target: Target; root: bigint; local: bigint; ownerRoot: bigint; ownerLocal: bigint; operator: boolean | null; registryOwner?:Address; tokenId?:bigint; expiry?:bigint; interfaceVerified?:boolean; effective?:bigint;subjectCanWrite?:boolean;ownerCanWrite?:boolean;identity?:IdentityState };
export type Snapshot = { block: bigint; blockHash: Hash; timestamp: string; config: Config; owner: Address; subject: Address; operator: boolean; positions: { id: bigint; approved: Address; owner: Address; economics?:PositionEconomics }[]; positionCount: bigint; complete: boolean; ens: EnsState[]; findings: Finding[]; errors: string[]; guarded?:{state:VaultState;economics:PositionEconomics}[] };
export const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const errorText = (error: unknown): string => isBlockUnavailable(error) ? BLOCK_READ_MESSAGE : error && typeof error === 'object' && 'shortMessage' in error ? String(error.shortMessage) : error instanceof Error ? error.message : String(error);
export const short = (s: string) => s.length > 16 ? `${s.slice(0,6)}…${s.slice(-4)}` : s;
export function validateConfig(c: Config): void {
  if (!isAddress(c.owner) || !isAddress(c.subject)) throw new Error('Enter valid owner and departing wallet addresses.');
  if (same(c.owner, c.subject)) throw new Error('The owner and departing wallet must be different.');
  if (same(c.owner, zeroAddress) || same(c.subject, zeroAddress)) throw new Error('The zero address cannot be an owner or departing wallet.');
  validateRpcEndpoint(c.rpc);
  if(c.guardedVaults&&(!Array.isArray(c.guardedVaults)||c.guardedVaults.length>4||c.guardedVaults.some(a=>!isAddress(a)||same(a,zeroAddress))||new Set(c.guardedVaults.map(a=>a.toLowerCase())).size!==c.guardedVaults.length))throw new Error('Use at most four unique protected vault addresses.');
  const seen = new Set<string>();
  if(c.targets.length>100)throw new Error('At most 100 explicit ENS resources can be scanned at once.');
  for (const t of c.targets) {
    if (!t.label.trim() || !isAddress(t.address) || same(t.address,zeroAddress)) throw new Error('Every ENS target needs a label and valid nonzero contract address.');
    const resource = BigInt(t.resource);
    if (resource <= 0n || resource >= 2n ** 256n) throw new Error('ENS resource must be a nonzero uint256; root is scanned automatically.');
    if (!['registry','resolver'].includes(t.kind)) throw new Error('ENS target kind must be registry or resolver.');
    if(t.kind==='resolver'&&t.recordType&&t.argument!==undefined&&resolverResource(t.recordType,t.argument)!==resource)throw new Error(`Resolver resource does not match its ${t.recordType} argument: ${t.label}`);
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
  for(const {state:v} of s.guarded??[])if(v.subjectCanCollect)f.push({id:`vault:${v.address.toLowerCase()}`,protocol:'Uniswap v3',title:'Protected LP mandate remains active',detail:'The departing wallet can collect to the treasury. Pause this vault to contain access; then revoke ENS roles or replace the operator.',scope:`Protected position #${v.tokenId}`,broad:true,address:getAddress(v.address),fn:'setPaused',args:[true],data:encodeFunctionData({abi:vaultAbi,functionName:'setPaused',args:[true]}),executable:true});
  const add = (item: Omit<Finding,'data'>) => {
    const {blockedReason,...finding}=item;
    f.push({...finding,...(!item.executable&&blockedReason?{blockedReason}:{}),data:encodeFunctionData({abi:item.protocol === 'Uniswap v3' ? nftAbi : eacAbi,functionName:item.fn,args:item.args} as never)});
  };
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
      add({id,protocol:'ENSv2',title:'Contract-wide ENS roles survive',detail:`${describeRoles(e.root,e.target.kind).join(', ')}. ${e.target.kind==='resolver'?'These roles apply across all names served by this resolver.':'These roles apply across this registry.'} Only matching ADMIN roles allow regranting.`,scope:e.target.label,broad:true,address:e.target.address,fn:'revokeRootRoles',args:[e.root,s.subject],executable:canRevoke[id] === true,blockedReason:'Owner lacks the required admin roles, or authority could not be verified.'});
    }
    if(e.local) {
      const id=`ens:${addr}:${BigInt(e.target.resource)}`;
      add({id,protocol:'ENSv2',title:'Resource-level ENS roles remain',detail:`${describeRoles(e.local,e.target.kind).join(', ')}. ${e.target.kind==='resolver'?'A resolver argument scope can cover the same key across multiple names; it is not a per-name permission.':'Registry roles may include inherited operator rights; the plan refreshes after broad approvals are removed.'}`,scope:e.target.label,broad:false,address:e.target.address,fn:'revokeRoles',args:[BigInt(e.target.resource),e.local,s.subject],executable:canRevoke[id] === true,blockedReason:'Owner lacks the required admin roles, or authority could not be verified.'});
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
  const reads=new Map<string,Promise<any>>();
  const read = (address: Address, abi: typeof nftAbi | typeof eacAbi | typeof ensAbi, functionName: string, args: unknown[]):Promise<any> => {
    const key=`${address.toLowerCase()}:${functionName}:${serialize(args)}`;
    if(!reads.has(key))reads.set(key,client.readContract({address,abi,functionName,args,blockNumber:block} as never));
    return reads.get(key)!;
  };
  const errors: string[]=[];
  let operator=false,positionCount=0n;
  if(config.scanUniswap!==false){
    try{[operator,positionCount]=await Promise.all([read(POSITION_MANAGER,nftAbi,'isApprovedForAll',[owner,subject]) as Promise<boolean>,read(POSITION_MANAGER,nftAbi,'balanceOf',[owner]) as Promise<bigint>]);}
    catch(error){errors.push(`Uniswap scan incomplete: ${errorText(error)}`);}
  }
  if(config.scanUniswap===false&&!config.targets.length&&!config.guardedVaults?.length)errors.push('No ENS resources configured and Uniswap scanning is disabled. Add an ENS name before drawing a conclusion.');
  const cap=200n;
  const count=Number(positionCount > cap ? cap : positionCount);
  const positions: Snapshot['positions']=[];
  for(let offset=0;offset<count;offset+=10) {
    const batch=await Promise.allSettled(Array.from({length:Math.min(10,count-offset)},async (_,i)=>{
      const id:bigint=await read(POSITION_MANAGER,nftAbi,'tokenOfOwnerByIndex',[owner,BigInt(offset+i)]);
      const [approved,currentOwner,raw]=await Promise.all([read(POSITION_MANAGER,nftAbi,'getApproved',[id]),read(POSITION_MANAGER,nftAbi,'ownerOf',[id]),client.readContract({address:POSITION_MANAGER,abi:positionAbi,functionName:'positions',args:[id],blockNumber:block})]);
      if(!same(currentOwner,owner)) throw new Error(`Position #${id} ownership mismatch.`);
      return {id,approved:getAddress(approved),owner:getAddress(currentOwner),economics:positionEconomics(raw)};
    }));
    for(const r of batch) if(r.status==='fulfilled') positions.push(r.value); else errors.push(`Position read failed: ${errorText(r.reason)}`);
  }
  if(positionCount>cap) errors.push('Portfolio exceeds the 200-position scan limit. Coverage is incomplete.');
  const ens: EnsState[]=[];const authority:Record<string,boolean>={};
  const canonicalSeen=new Set<string>();
  for(const inputTarget of config.targets) {
    let target=inputTarget;
    try {
      if(!await client.getCode({address:target.address,blockNumber:block})) throw new Error('No contract at this address.');
      const [isEac,isKind]=await Promise.all([read(target.address,eacAbi,'supportsInterface',[EAC_INTERFACE]),read(target.address,eacAbi,'supportsInterface',[target.kind==='registry'?REGISTRY_INTERFACE:RESOLVER_INTERFACE])]);
      if(!isEac||!isKind)throw new Error('Unsupported ENSv2 EAC/contract interface. Current deployment ABIs are required.');
      if(target.kind==='registry')target={...target,resource:String(await read(target.address,eacAbi,'getResource',[BigInt(target.resource)]))};
      const resource=BigInt(target.resource);
      const canonicalKey=`${target.address.toLowerCase()}:${resource}`;
      if(canonicalSeen.has(canonicalKey))throw new Error('Duplicate canonical ENS resource. Remove duplicate scopes.');
      canonicalSeen.add(canonicalKey);
      const [root,local,ownerRoot,ownerLocal]=await Promise.all([read(target.address,eacAbi,'roles',[0n,subject]),read(target.address,eacAbi,'roles',[resource,subject]),read(target.address,eacAbi,'roles',[0n,owner]),read(target.address,eacAbi,'roles',[resource,owner])]) as bigint[];
      let registryOperator: boolean|null=null;
      if(target.kind==='registry') registryOperator=await read(target.address,eacAbi,'isApprovedForAll',[owner,subject]);
      const e:EnsState={target,root,local,ownerRoot,ownerLocal,operator:registryOperator,interfaceVerified:true,effective:root|local};
      if(target.kind==='resolver'&&target.recordType){
        [e.subjectCanWrite,e.ownerCanWrite]=await Promise.all([read(target.address,eacAbi,'hasRoles',[resource,recordRole(target.recordType),subject]),read(target.address,eacAbi,'hasRoles',[resource,recordRole(target.recordType),owner])]);
      }
      e.identity=await readIdentity(target,(address,fn,args)=>read(address,ensAbi,fn,args));
      if(e.subjectCanWrite!==undefined)assertExplainedAuthorization(root,local,recordRole(target.recordType!),e.subjectCanWrite);
      if(e.ownerCanWrite!==undefined)assertExplainedAuthorization(ownerRoot,ownerLocal,recordRole(target.recordType!),e.ownerCanWrite);
      if(target.kind==='registry'){
        const [registryOwner,tokenId,expiry]=await Promise.all([read(target.address,eacAbi,'getOwner',[resource]),read(target.address,eacAbi,'getTokenId',[resource]),read(target.address,eacAbi,'getExpiry',[resource])]);
        e.registryOwner=getAddress(registryOwner);e.tokenId=tokenId;e.expiry=expiry;
        if(!same(registryOwner,zeroAddress)&&!same(registryOwner,owner)){
          const otherOperator=await read(target.address,eacAbi,'isApprovedForAll',[registryOwner,subject]);
          if(otherOperator)errors.push(`${target.label}: subject inherits permissions from another token owner. This workspace cannot revoke that owner's approval.`);
        }
      }
      ens.push(e);
      if(root) authority[`ens:${target.address.toLowerCase()}:root`]=await read(target.address,eacAbi,'hasRoles',[0n,adminMask(root),owner]);
      if(local) authority[`ens:${target.address.toLowerCase()}:${resource}`]=await read(target.address,eacAbi,'hasRoles',[resource,adminMask(local),owner]);
    } catch(error) {errors.push(`${target.label}: ${errorText(error)}`);}
  }
  const guarded:NonNullable<Snapshot['guarded']>=[];
  for(const address of config.guardedVaults??[]){
    try{
      const {readVault}=await import('./guarded/client');
      const {state}=await readVault(config,address,block);
      if(!same(state.custodian,address))throw new Error('Protected NFT is outside its configured vault.');
      const raw=await client.readContract({address:POSITION_MANAGER,abi:positionAbi,functionName:'positions',args:[BigInt(state.tokenId)],blockNumber:block});
      guarded.push({state,economics:positionEconomics(raw)});
    }catch(error){errors.push(`Protected vault ${address}: ${errorText(error)}`);}
  }
  const s={block,blockHash:blockInfo.hash,timestamp:new Date(Number(blockInfo.timestamp)*1000).toISOString(),config:structuredClone(config),owner,subject,operator,positions,positionCount,ens,guarded,complete:errors.length===0,errors};
  return {...s,findings:deriveFindings(s,authority)};
}
export function compareOwner(before: Snapshot,after: Snapshot): string[] {
  const problems:string[]=[];
  if((before.guarded??[]).length!==(after.guarded??[]).length)problems.push('Protected vault coverage changed.');
  for(const p of before.guarded??[]){const q=after.guarded?.find(q=>same(q.state.address,p.state.address));if(!q){problems.push(`Protected vault missing: ${p.state.address}`);continue;}problems.push(...vaultContinuity(p.state,q.state),...economicChanges(p.economics,q.economics));}
  if(!same(before.owner,after.owner)||!same(before.subject,after.subject)) problems.push('Wallet pair changed.');
  if(before.positionCount!==after.positionCount || before.positions.some(p=>!after.positions.some(q=>p.id===q.id && same(q.owner,p.owner)))) problems.push('Position ownership changed between checks.');
  for(const p of before.positions)if(p.economics)problems.push(...economicChanges(p.economics,after.positions.find(q=>q.id===p.id)?.economics).map(change=>`${change}: #${p.id}`));
  for(const e of before.ens) {
    const a=after.ens.find(q=>same(q.target.address,e.target.address)&&BigInt(q.target.resource)===BigInt(e.target.resource));
    if(!a || (a.ownerRoot & e.ownerRoot)!==e.ownerRoot || (a.ownerLocal & e.ownerLocal)!==e.ownerLocal) problems.push(`Owner roles changed: ${e.target.label}`);
    if(e.registryOwner&&(!a?.registryOwner||!same(e.registryOwner,a.registryOwner)))problems.push(`ENS name ownership changed: ${e.target.label}`);
    if(e.ownerCanWrite===true&&a?.ownerCanWrite!==true)problems.push(`Owner record permission changed: ${e.target.label}`);
    if(e.identity)problems.push(...identityChanges(e.identity,a?.identity).map(change=>`${change}: ${e.target.label}`));
    if(e.expiry!==undefined&&e.expiry!==a?.expiry)problems.push(`ENS expiry changed: ${e.target.label}`);
  }
  return problems;
}
export function serialize(value: unknown): string {return JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2);}
