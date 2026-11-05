import { encodeFunctionData, getAddress, type Address } from 'viem';
import { clientFor } from '../engine';
import { ensAbi } from './abi';
import { inspectName, dns, setupRecordValue, equal, type SetupAction } from './protocol';
import { resolverResource, SET_TEXT } from './roles';

export type RecordRequest={name:string;key:string;value:string;actor:Address};
export type RecordWrite=SetupAction&RecordRequest&{block:bigint};
export async function prepareRecordWrite(input:RecordRequest,rpc:string):Promise<RecordWrite>{
  const key=input.key.trim();setupRecordValue({key,textValue:input.value});
  const identity=await inspectName(input.name,rpc,key);
  if(!identity.resolverVerified)throw new Error('A supported Permissioned Resolver is required.');
  const actor=getAddress(input.actor),resource=resolverResource('text',key);
  const permitted=await clientFor(rpc).readContract({address:identity.resolver,abi:ensAbi,functionName:'hasRoles',args:[resource,SET_TEXT,actor],blockNumber:identity.block});
  if(!permitted)throw new Error('This wallet has no effective permission to edit this text key. No transaction was sent.');
  return {id:'write-record',label:`Update ${key} as ${actor.slice(0,6)}…${actor.slice(-4)}`,explanation:`Update ${identity.name} on Sepolia. The text-key role applies across names served by this resolver.`,name:identity.name,key,value:input.value,actor,block:identity.block,to:identity.resolver,data:encodeFunctionData({abi:ensAbi,functionName:'setText',args:[dns(identity.name),key,input.value]})};
}
export function sameRecordWrite(reviewed:RecordWrite,fresh:RecordWrite):boolean{
  return equal(reviewed.actor,fresh.actor)&&equal(reviewed.to,fresh.to)&&reviewed.data===fresh.data&&reviewed.name===fresh.name&&reviewed.key===fresh.key&&reviewed.value===fresh.value;
}
