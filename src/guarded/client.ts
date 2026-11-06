import { encodeFunctionData, getAddress, isAddress, keccak256, toHex, zeroAddress, type Address, type Hex } from 'viem';
import { normalize } from 'viem/ens';
import artifact from './artifact.json';
import { clientFor, same, type Config } from '../engine';
import { inspectName, type SetupAction } from '../ens/protocol';
import { ensAbi } from '../ens/abi';
import { SET_TEXT } from '../ens/roles';
import { POSITION_MANAGER } from '../uniswap/contracts';
import { vaultAbi, vaultFields, type VaultState } from './model';

export function matchesVaultCode(code:Hex):boolean{
  if(code.length!==artifact.runtime.length)return false;
  const chars=code.toLowerCase().split('');
  for(const references of Object.values(artifact.immutableReferences))for(const ref of references)
    chars.fill('0',2+ref.start*2,2+(ref.start+ref.length)*2);
  return chars.join('')===artifact.runtime.toLowerCase();
}
export async function prepareVaultDeployment(config:Config,nameInput:string,idInput:string){
  if(!/^\d+$/.test(idInput)||BigInt(idInput)>=2n**256n)throw new Error('Enter a position token ID.');
  const name=normalize(nameInput.trim()),inspection=await inspectName(name,config.rpc,'agent-context');
  const leaf=inspection.entries.at(-1);
  if(!leaf||!same(leaf.owner,config.owner)||!inspection.resolverVerified||!same(leaf.resolver,inspection.resolver))throw new Error('Use an owned name with its own supported Permissioned Resolver.');
  const c=clientFor(config.rpc),id=BigInt(idInput);
  const owner=await c.readContract({address:POSITION_MANAGER,abi:parsePositionAbi,functionName:'ownerOf',args:[id],blockNumber:inspection.block});
  if(!same(owner,config.owner))throw new Error('Position must currently belong to the workspace owner.');
  const key=`afterkey.lp.collect.${keccak256(toHex(`${name}:${id}`)).slice(2)}`;
  return {name,key,args:[getAddress(config.owner),getAddress(config.owner),POSITION_MANAGER,leaf.registry,inspection.resolver,id,leaf.label,key] as const};
}
import { parseAbi } from 'viem';
const parsePositionAbi=parseAbi(['function ownerOf(uint256 id) view returns (address)','function safeTransferFrom(address from,address to,uint256 id)']);
export async function readVault(config:Config,address:string,height?:bigint):Promise<{block:bigint;blockHash:Hex;state:VaultState}>{
  if(!isAddress(address)||same(address,zeroAddress))throw new Error('Enter a vault address.');
  const c=clientFor(config.rpc);if(await c.getChainId()!==11155111)throw new Error('Use Sepolia.');
  const block=height??await c.getBlockNumber({cacheTime:0}),header=await c.getBlock({blockNumber:block});
  const code=await c.getCode({address,blockNumber:block});
  if(!code||!matchesVaultCode(code))throw new Error('Vault does not match the compiled AfterKey contract.');
  const read=(functionName:string,args:readonly unknown[]=[])=>c.readContract({address,abi:vaultAbi,functionName,args,blockNumber:block} as never) as Promise<any>;
  const values=await Promise.all(vaultFields.map(f=>read(f))),raw=Object.fromEntries(vaultFields.map((f,i)=>[f,typeof values[i]==='bigint'?String(values[i]):values[i]]));
  if(!same(raw.owner,config.owner)||!same(raw.manager,POSITION_MANAGER)||!same(raw.treasury,config.owner))throw new Error('Vault owner, treasury or manager differs from this workspace.');
  const [custodian,subjectCanCollect,operatorCanCollect]=await Promise.all([
    c.readContract({address:POSITION_MANAGER,abi:parsePositionAbi,functionName:'ownerOf',args:[BigInt(raw.tokenId)],blockNumber:block}),
    read('canCollect',[getAddress(config.subject)]),read('canCollect',[raw.operator]),
  ]);
  return {block,blockHash:header.hash,state:{...raw,address,custodian,subjectCanCollect,operatorCanCollect} as VaultState};
}
export type VaultOperation='deposit'|'grant'|'revoke'|'activate'|'pause'|'collect'|'release';
export async function prepareVaultAction(config:Config,address:string,operation:VaultOperation,next:string,expiry:string):Promise<SetupAction&{actor:string}>{
  const {state:s}=await readVault(config,address),vault=getAddress(address),owner=getAddress(config.owner);
  const action=(to:Address,data:Hex,label:string,explanation:string,actor:string=owner)=>({id:`vault:${operation}`,to,data,label,explanation,actor});
  const encode=(fn:string,args:readonly unknown[]=[])=>encodeFunctionData({abi:vaultAbi,functionName:fn,args} as never);
  if(operation==='deposit'){
    if(!same(s.custodian,owner))throw new Error('The owner must hold this NFT before deposit.');
    return action(POSITION_MANAGER,encodeFunctionData({abi:parsePositionAbi,functionName:'safeTransferFrom',args:[owner,vault,BigInt(s.tokenId)]}),'Deposit protected position',`Transfer NFT #${s.tokenId} into this owner-controlled contract. Wallet portfolio scans will no longer enumerate it; keep the vault in CRE coverage.`);
  }
  if(operation==='grant'||operation==='revoke'){
    if(!isAddress(next)||same(next,zeroAddress)||same(next,owner))throw new Error('Enter a nonzero operator other than the owner.');
    // ENS decodeSetter derives authority from the key argument; name/value are ignored.
    const setter=encodeFunctionData({abi:ensAbi,functionName:'setText',args:['0x',s.capabilityKey,'']});
    const data=operation==='grant'?encodeFunctionData({abi:ensAbi,functionName:'grantSetterRoles',args:[setter,getAddress(next)]}):encodeFunctionData({abi:ensAbi,functionName:'revokeRoles',args:[BigInt(s.capabilityResource),SET_TEXT,getAddress(next)]});
    return action(getAddress(s.resolver),data,operation==='grant'?'Grant ENS collection capability':'Revoke ENS collection capability','The vault also requires an active matching operator mandate. Root SET_TEXT can still authorize collection until revoked; recheck effective access.');
  }
  if(operation==='activate'){
    if(!isAddress(next)||same(next,zeroAddress)||same(next,owner))throw new Error('Enter a replacement operator other than the owner.');
    const end=BigInt(expiry),now=BigInt(Math.floor(Date.now()/1000));
    if(end<=now||end>now+30n*86400n)throw new Error('Mandate expiry must be within 30 days.');
    return action(vault,encode('setOperator',[getAddress(next),end]),'Replace active operator','Invalidates the previous operator at the vault, even if its ENS role survives. ENS authority is checked on every collection.');
  }
  if(operation==='pause')return action(vault,encode('setPaused',[true]),'Pause operator collection','Owner recovery remains available.');
  if(operation==='release')return action(vault,encode('release'),'Return position to owner','Disables the mandate and returns the NFT to the owner.');
  if(!s.operatorCanCollect)throw new Error('Active operator has no effective live collection authority.');
  if(!same(s.operator,config.owner)&&!same(s.operator,config.subject))throw new Error('Update the workspace operator before signing as the replacement.');
  return action(vault,encode('collect'),'Collect to fixed treasury',`All owed tokens go to ${s.treasury}. Collection may include removed principal.`,s.operator);
}
