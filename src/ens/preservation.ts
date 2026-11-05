import { decodeFunctionResult, encodeFunctionData, keccak256, namehash, stringToHex, toHex, type Address } from 'viem';
import { normalize, packetToBytes } from 'viem/ens';
import { profileAbi } from './abi';

type Scope={kind:'registry'|'resolver';name?:string;resource:string;recordType?:string;argument?:string;address:Address};
type Read=(address:Address,fn:string,args:unknown[])=>Promise<any>;
export type IdentityState=
  | {kind:'registry';name:string;resolver:Address;subregistry:Address}
  | {kind:'resolver';name:string;recordId:bigint;ethAddress:Address;textKey:string;textValue:string};

// The caller supplies a reader pinned to the permission snapshot's block.
export async function readIdentity(scope:Scope,read:Read):Promise<IdentityState|undefined>{
  if(!scope.name)return undefined;
  const name=normalize(scope.name),address=scope.address;
  if(scope.kind==='registry'){
    const label=name.split('.')[0];
    const currentResource=await read(address,'getResource',[BigInt(keccak256(stringToHex(label)))]);
    if(currentResource!==BigInt(scope.resource))throw new Error('Name metadata does not match the current registry resource.');
    const [resolver,subregistry]=await Promise.all([read(address,'getResolver',[label]),read(address,'getSubregistry',[label])]);
    return {kind:'registry',name,resolver,subregistry};
  }
  if(scope.recordType!=='text'||scope.argument===undefined)return undefined;
  const node=namehash(name),dnsName=toHex(packetToBytes(name));
  const [recordId,text,eth]=await Promise.all([
    read(address,'getRecordId',[node]),
    read(address,'resolve',[dnsName,encodeFunctionData({abi:profileAbi,functionName:'text',args:[node,scope.argument]})]),
    read(address,'resolve',[dnsName,encodeFunctionData({abi:profileAbi,functionName:'addr',args:[node]})]),
  ]);
  return {kind:'resolver',name,recordId,textKey:scope.argument,textValue:decodeFunctionResult({abi:profileAbi,functionName:'text',data:text}),ethAddress:decodeFunctionResult({abi:profileAbi,functionName:'addr',data:eth})};
}

export function identityChanges(before:IdentityState,after:IdentityState|undefined):string[]{
  if(!after||before.kind!==after.kind||before.name!==after.name)return ['Identity snapshot missing or changed'];
  const problems:string[]=[];
  const equal=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
  if(before.kind==='registry'&&after.kind==='registry'){
    if(!equal(before.resolver,after.resolver))problems.push('Resolver pointer changed');
    if(!equal(before.subregistry,after.subregistry))problems.push('Subregistry pointer changed');
  }
  if(before.kind==='resolver'&&after.kind==='resolver'){
    if(before.recordId!==after.recordId)problems.push('Record bundle changed');
    if(!equal(before.ethAddress,after.ethAddress))problems.push('ETH address record changed');
    if(before.textKey!==after.textKey||before.textValue!==after.textValue)problems.push('Selected text record changed');
  }
  return problems;
}

export function assertExplainedAuthorization(root:bigint,local:bigint,role:bigint,effective:boolean):void{
  if((((root|local)&role)===role)!==effective)throw new Error('Effective authorization disagrees with the reported root/resource roles. Custom authority needs separate inspection.');
}
