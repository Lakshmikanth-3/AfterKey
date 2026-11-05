import { createPublicClient, http, getAddress, isAddress, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { clientFor, errorText } from '../engine';

export const AGENT_KEYS=['agent-context','agent-endpoint[mcp]','agent-endpoint[a2a]','agent-endpoint[web]'] as const;
export type ReadNetwork='mainnet'|'sepolia';
export type AgentRecord={key:string;value:string|null;status:'present'|'missing'|'error';error?:string;urlValid?:boolean};
export type AgentProfile={name:string;chainId:1|11155111;block:bigint;address:Address|null;expectedMatch:boolean|null;records:AgentRecord[];complete:boolean};
export const profileClient=(network:ReadNetwork,rpc:string)=>network==='sepolia'?clientFor(rpc):createPublicClient({chain:mainnet,transport:http('https://ethereum-rpc.publicnode.com',{timeout:20000,retryCount:1})});
export function validAgentUrl(value:string):boolean{try{return ['https:','http:','ipfs:'].includes(new URL(value).protocol);}catch{return false;}}
export async function readAgentProfile(nameInput:string,network:ReadNetwork,rpc:string,expected?:string):Promise<AgentProfile>{
  const name=normalize(nameInput.trim());if(!name)throw new Error('Enter an ENS name.');
  const client=profileClient(network,rpc),chainId=network==='mainnet'?1:11155111;
  if(await client.getChainId()!==chainId)throw new Error('The RPC network does not match the selected network.');
  const block=await client.getBlockNumber({cacheTime:0});
  const address=await client.getEnsAddress({name,blockNumber:block});
  const records=await Promise.all(AGENT_KEYS.map(async (key):Promise<AgentRecord>=>{
    try{const value=await client.getEnsText({name,key,blockNumber:block});return {key,value,status:value?.length?'present':'missing',...(key!=='agent-context'&&value?{urlValid:validAgentUrl(value)}:{})};}
    catch(error){return {key,value:null,status:'error',error:errorText(error)};}
  }));
  return {name,chainId,block,address,expectedMatch:expected&&isAddress(expected)?Boolean(address&&address.toLowerCase()===expected.toLowerCase()):null,records,complete:records.every(r=>r.status!=='error')};
}
// ENSIP-25: ERC-7930 v1 interoperable EVM registry address, not a plain 20-byte address.
export function registryInteroperableAddress(chainId:bigint,address:string):string{
  if(chainId<=0n||chainId>=2n**256n)throw new Error('Registry chain ID must fit a positive uint256.');
  if(!isAddress(address))throw new Error('Enter a valid registry address.');
  let reference=chainId.toString(16);if(reference.length%2)reference='0'+reference;
  return `0x00010000${(reference.length/2).toString(16).padStart(2,'0')}${reference}14${getAddress(address).slice(2).toLowerCase()}`;
}
export function registrationKey(chainId:bigint,registry:string,agentId:string):string{
  if(!agentId.length||agentId.length>256||/[\[\]]/.test(agentId))throw new Error('Agent ID is required and cannot contain brackets.');
  return `agent-registration[${registryInteroperableAddress(chainId,registry)}][${agentId}]`;
}
export type RegistrationCheck={name:string;chainId:1|11155111;block:bigint;key:string;value:string|null;attestationPresent:boolean;registryEntryChecked:false};
export async function checkRegistration(nameInput:string,network:ReadNetwork,rpc:string,registryChain:bigint,registry:string,agentId:string):Promise<RegistrationCheck>{
  const name=normalize(nameInput.trim()),key=registrationKey(registryChain,registry,agentId),client=profileClient(network,rpc);
  const chainId=network==='mainnet'?1:11155111;
  if(await client.getChainId()!==chainId)throw new Error('RPC network mismatch.');
  const block=await client.getBlockNumber({cacheTime:0});
  const value=await client.getEnsText({name,key,blockNumber:block});
  return {name,chainId,block,key,value,attestationPresent:typeof value==='string'&&value.length>0,registryEntryChecked:false};
}
