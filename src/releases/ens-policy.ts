import {encodeFunctionData,getAddress,type Address,type Hex} from 'viem';
import {ensAbi,factoryAbi} from '../ens/abi';
import {contract,dns} from '../ens/protocol';
import {resolverResource,SET_DATA} from '../ens/roles';
import {clientFor,same} from '../engine';

export const RELEASE_RECORD_KEY='afterkey.release';
export const releaseDataAbi=[{type:'function',name:'setData',stateMutability:'nonpayable',inputs:[{name:'name',type:'bytes'},{name:'key',type:'string'},{name:'value',type:'bytes'}],outputs:[]}] as const;
export function releaseSetter(name:Hex,value:Hex){return encodeFunctionData({abi:releaseDataAbi,functionName:'setData',args:[name,RELEASE_RECORD_KEY,value]});}
export function checkReleaseSetter(resource:bigint,role:bigint){
  if(resource!==resolverResource('data',RELEASE_RECORD_KEY)||role!==SET_DATA)throw new Error('Resolver SET_DATA resource mapping differs from the supported ENSv2 deployment.');
}
// Interface support alone is not provenance. Verify the current implementation
// and the live setter mapping at the same pinned block before preparing a write.
export async function inspectReleasePublisher(rpc:string,resolver:Address,owner:string,block:bigint){
  const c=clientFor(rpc),resource=resolverResource('data',RELEASE_RECORD_KEY);
  const setter=releaseSetter(dns('afterkey.eth'),'0x');
  const [implementation,decoded,canPublish]=await c.multicall({contracts:[
    {address:contract('VerifiableFactory'),abi:factoryAbi,functionName:'verifyContract',args:[resolver]},
    {address:resolver,abi:ensAbi,functionName:'decodeSetter',args:[setter]},
    {address:resolver,abi:ensAbi,functionName:'hasRoles',args:[resource,SET_DATA,getAddress(owner)]},
  ],allowFailure:false,blockNumber:block});
  if(!same(implementation,contract('PermissionedResolverImpl')))throw new Error('Release resolver implementation changed. Review the ENS deployment before preparing a transaction.');
  checkReleaseSetter(decoded[1],decoded[2]);
  return {implementation,resource,role:SET_DATA,canPublish,block};
}
