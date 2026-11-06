import { EVMClient, getNetwork, encodeCallMsg, bytesToHex, blockNumber, protoBigIntToBigint, type Runtime } from '@chainlink/cre-sdk';
import { encodeFunctionData, decodeFunctionResult, namehash, toHex, zeroAddress, type Address } from 'viem';
import { packetToBytes } from 'viem/ens';
import { EAC_INTERFACE, REGISTRY_INTERFACE, RESOLVER_INTERFACE, SET_TEXT } from '../src/ens/roles';
import { ensAbi, profileAbi } from '../src/ens/abi';
import { POSITION_MANAGER, positionAbi, positionEconomics } from '../src/uniswap/contracts';
import type { Config, PermissionSnapshot } from './model';
const eq=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
export function evmClient(){const network=getNetwork({chainFamily:'evm',chainSelectorName:'ethereum-testnet-sepolia'});if(!network)throw new Error('Sepolia capability unavailable.');return new EVMClient(network.chainSelector.selector);}
export function readState(runtime:Runtime<Config>,height?:bigint):PermissionSnapshot{
  const evm=evmClient();
  const header=evm.headerByNumber(runtime,height===undefined?{}:{blockNumber:blockNumber(height)}).result().header;
  if(!header?.blockNumber)throw new Error('Missing Sepolia block header.');
  const block=protoBigIntToBigint(header.blockNumber),owner=runtime.config.owner as Address,subject=runtime.config.subject as Address;
  const cache=new Map<string,any>();
  const read=(address:Address,fn:string,args:readonly unknown[],abi:typeof ensAbi|typeof positionAbi=ensAbi):any=>{
    const key=JSON.stringify([address.toLowerCase(),fn,args],(_,v)=>typeof v==='bigint'?String(v):v);
    if(!cache.has(key)){const data=encodeFunctionData({abi,functionName:fn,args} as never);const result=evm.callContract(runtime,{call:encodeCallMsg({from:zeroAddress,to:address,data}),blockNumber:blockNumber(block)}).result();cache.set(key,decodeFunctionResult({abi,functionName:fn,data:bytesToHex(result.data)} as never));}return cache.get(key);
  };
  const uniswapIncluded=runtime.config.scanUniswap!==false;
  const uni=(fn:string,args:readonly unknown[])=>read(POSITION_MANAGER,fn,args,positionAbi);
  const operator=uniswapIncluded?uni('isApprovedForAll',[owner,subject]) as boolean:false;
  const total=uniswapIncluded?uni('balanceOf',[owner]) as bigint:0n,limit=BigInt(runtime.config.maxPositions);
  const findings:PermissionSnapshot['findings']=[],positions:PermissionSnapshot['positions']=[];
  if(operator)findings.push({protocol:'Uniswap v3',kind:'operator-wide',contract:POSITION_MANAGER});
  for(let i=0;i<Number(total>limit?limit:total);i++){
    const id=uni('tokenOfOwnerByIndex',[owner,BigInt(i)]) as bigint,approved=uni('getApproved',[id]) as string,actualOwner=uni('ownerOf',[id]) as string;
    if(!eq(actualOwner,owner))throw new Error('Position ownership mismatch.');
    const p=positionEconomics(uni('positions',[id]));
    positions.push({tokenId:String(id),owner:actualOwner,approved,...p,liquidity:String(p.liquidity),tokensOwed0:String(p.tokensOwed0),tokensOwed1:String(p.tokensOwed1)});
    if(eq(approved,subject))findings.push({protocol:'Uniswap v3',kind:'token-approval',contract:POSITION_MANAGER,tokenId:String(id)});
  }
  const roots=new Set<string>(),operators=new Set<string>();
  const ens=runtime.config.ensTargets.map(target=>{
    const address=target.address as Address,key=address.toLowerCase();
    if(!read(address,'supportsInterface',[EAC_INTERFACE])||!read(address,'supportsInterface',[target.kind==='registry'?REGISTRY_INTERFACE:RESOLVER_INTERFACE]))throw new Error('Unsupported ENSv2 contract interface.');
    const resource=target.kind==='registry'?read(address,'getResource',[BigInt(target.resource)]) as bigint:BigInt(target.resource);
    const root=read(address,'roles',[0n,subject]) as bigint,local=read(address,'roles',[resource,subject]) as bigint;
    const ownerRoot=read(address,'roles',[0n,owner]) as bigint,ownerLocal=read(address,'roles',[resource,owner]) as bigint;
    const nameOwner=target.kind==='registry'?read(address,'getOwner',[resource]) as string:null;
    if(nameOwner&&!eq(nameOwner,zeroAddress)&&!eq(nameOwner,owner)&&read(address,'isApprovedForAll',[nameOwner,subject]))throw new Error('Registry authority is inherited through an unconfigured owner.');
    const approved=target.kind==='registry'?read(address,'isApprovedForAll',[owner,subject]) as boolean:null;
    if(root&&!roots.has(key)){roots.add(key);findings.push({protocol:'ENSv2',kind:'root-roles',contract:address,roles:String(root),label:target.label});}
    if(local)findings.push({protocol:'ENSv2',kind:'resource-roles',contract:address,resource:String(resource),roles:String(local),label:target.label});
    if(approved&&!operators.has(key)){operators.add(key);findings.push({protocol:'ENSv2',kind:'registry-operator',contract:address,label:target.label});}
    let identity:Record<string,string>|undefined,subjectCanWrite:boolean|undefined,ownerCanWrite:boolean|undefined;
    if(target.kind==='registry'&&target.name){const label=target.name.split('.')[0];identity={resolver:read(address,'getResolver',[label]),subregistry:read(address,'getSubregistry',[label]),expiry:String(read(address,'getExpiry',[resource]))};}
    if(target.kind==='resolver'&&target.name&&target.recordType==='text'&&target.argument!==undefined){
      const node=namehash(target.name),dns=toHex(packetToBytes(target.name));
      const resolve=(fn:'text'|'addr',args:readonly unknown[])=>decodeFunctionResult({abi:profileAbi,functionName:fn,data:read(address,'resolve',[dns,encodeFunctionData({abi:profileAbi,functionName:fn,args} as never)])} as never) as string;
      identity={recordId:String(read(address,'getRecordId',[node])),textKey:target.argument,textValue:resolve('text',[node,target.argument]),ethAddress:resolve('addr',[node])};
      subjectCanWrite=read(address,'hasRoles',[resource,SET_TEXT,subject]);ownerCanWrite=read(address,'hasRoles',[resource,SET_TEXT,owner]);
      if(subjectCanWrite!==(((root|local)&SET_TEXT)===SET_TEXT)||ownerCanWrite!==(((ownerRoot|ownerLocal)&SET_TEXT)===SET_TEXT))throw new Error('Unexplained effective ENS authorization.');
    }
    return {address,resource:String(resource),root:String(root),local:String(local),ownerRoot:String(ownerRoot),ownerLocal:String(ownerLocal),nameOwner,operator:approved,...(identity?{identity}:{}),...(subjectCanWrite===undefined?{}:{subjectCanWrite,ownerCanWrite})};
  });
  return {block:String(block),blockHash:bytesToHex(header.hash),owner,subject,positionCount:String(total),uniswapIncluded,operator,positions,ens,findings,complete:total<=limit&&(uniswapIncluded||ens.length>0)};
}
