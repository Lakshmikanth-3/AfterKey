import { HTTPCapability, EVMClient, getNetwork, encodeCallMsg, bytesToHex, handler, blockNumber, protoBigIntToBigint, decodeJson, Runner, type Runtime, type HTTPPayload } from '@chainlink/cre-sdk';
import { encodeFunctionData, decodeFunctionResult, parseAbi, isAddress, zeroAddress, type Address } from 'viem';

type Config={authorizedEVMAddress:string; owner:string; ensTargets:{label:string;address:string;resource:string;kind:'registry'|'resolver'}[];maxPositions:number};
type Departure={eventId:string;event:'departure'|'recheck';subject:string};
const manager='0x1238536071E1c677A632429e3655c799b22cDA52' as Address;
const abi=parseAbi(['function balanceOf(address) view returns (uint256)','function tokenOfOwnerByIndex(address,uint256) view returns (uint256)','function ownerOf(uint256) view returns (address)','function getApproved(uint256) view returns (address)','function isApprovedForAll(address,address) view returns (bool)','function roles(uint256,address) view returns (uint256)']);
const eq=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
function onDeparture(runtime:Runtime<Config>,payload:HTTPPayload):string {
  if(payload.input.length>16000)throw new Error('Departure payload exceeds 16 KB.');
  const request=decodeJson(payload.input) as unknown as Departure;
  if(!request||typeof request!=='object'||typeof request.eventId!=='string'||typeof request.subject!=='string')throw new Error('Invalid departure payload.');
  if(!request.eventId||request.eventId.length>128||!['departure','recheck'].includes(request.event))throw new Error('Invalid departure event.');
  if(!isAddress(request.subject)||eq(request.subject,zeroAddress)||eq(request.subject,runtime.config.owner))throw new Error('Invalid departing wallet.');
  const network=getNetwork({chainFamily:'evm',chainSelectorName:'ethereum-testnet-sepolia'});
  if(!network)throw new Error('Sepolia not supported by the selected CRE network.');
  const evm=new EVMClient(network.chainSelector.selector);
  const header=evm.headerByNumber(runtime,{}).result();
  if(!header.header?.blockNumber)throw new Error('No block header returned.');
  const height=protoBigIntToBigint(header.header.blockNumber);
  const owner=runtime.config.owner as Address,subject=request.subject as Address;
  const read=(address:Address,fn:string,args:readonly unknown[]):any=>{
    const data=encodeFunctionData({abi,functionName:fn,args} as never);
    const response=evm.callContract(runtime,{call:encodeCallMsg({from:zeroAddress,to:address,data}),blockNumber:blockNumber(height)}).result();
    return decodeFunctionResult({abi,functionName:fn,data:bytesToHex(response.data)} as never);
  };
  const operator=read(manager,'isApprovedForAll',[owner,subject]) as boolean;
  const total=read(manager,'balanceOf',[owner]) as bigint;
  const limit=BigInt(runtime.config.maxPositions);
  const count=Number(total>limit?limit:total);
  const findings:{protocol:string;kind:string;contract:string;resource?:string;roles?:string;tokenId?:string;label?:string}[]=[];
  if(operator)findings.push({protocol:'Uniswap v3',kind:'operator-wide',contract:manager});
  const positions:{tokenId:string;owner:string;approved:string}[]=[];
  for(let i=0;i<count;i++){
    const id=read(manager,'tokenOfOwnerByIndex',[owner,BigInt(i)]) as bigint;
    const approved=read(manager,'getApproved',[id]) as string;
    const actualOwner=read(manager,'ownerOf',[id]) as string;
    if(!eq(actualOwner,owner))throw new Error('Position ownership mismatch.');
    positions.push({tokenId:String(id),owner:actualOwner,approved});
    if(eq(approved,subject))findings.push({protocol:'Uniswap v3',kind:'token-approval',contract:manager,tokenId:String(id)});
  }
  const seenRoots=new Set<string>();
  const seenOperators=new Set<string>();
  const ens=runtime.config.ensTargets.map(target=>{
    const address=target.address as Address,key=address.toLowerCase();
    const root=read(address,'roles',[0n,subject]) as bigint;
    const local=read(address,'roles',[BigInt(target.resource),subject]) as bigint;
    const ownerRoot=read(address,'roles',[0n,owner]) as bigint;
    const ownerLocal=read(address,'roles',[BigInt(target.resource),owner]) as bigint;
    const approved=target.kind==='registry'?read(address,'isApprovedForAll',[owner,subject]) as boolean:null;
    if(root&&!seenRoots.has(key)){seenRoots.add(key);findings.push({protocol:'ENSv2',kind:'root-roles',contract:address,roles:String(root),label:target.label});}
    if(local)findings.push({protocol:'ENSv2',kind:'resource-roles',contract:address,resource:target.resource,roles:String(local),label:target.label});
    if(approved&&!seenOperators.has(key)){seenOperators.add(key);findings.push({protocol:'ENSv2',kind:'registry-operator',contract:address,label:target.label});}
    return {...target,root:String(root),local:String(local),ownerRoot:String(ownerRoot),ownerLocal:String(ownerLocal),operator:approved};
  });
  const result={source:'Chainlink CRE',method:'permission-state reads',eventId:request.eventId,event:request.event,chainId:11155111,block:String(height),owner,subject,positionCount:String(total),positions,ens,operator,findings,complete:total<=limit,scope:'Uniswap v3 positions and configured ENSv2 resources only'};
  runtime.log(JSON.stringify({eventId:request.eventId,block:String(height),remainingPaths:findings.length,complete:result.complete}));
  return JSON.stringify(result);
}
function initWorkflow(config:Config){
  for(const address of [config.owner,config.authorizedEVMAddress])if(!isAddress(address)||eq(address,zeroAddress))throw new Error('Set owner and authorizedEVMAddress to valid nonzero public addresses before deployment.');
  if(!Number.isInteger(config.maxPositions)||config.maxPositions<1||config.maxPositions>20)throw new Error('maxPositions must be 1–20 to bound CRE execution cost.');
  if(!Array.isArray(config.ensTargets)||config.ensTargets.length>10)throw new Error('At most 10 ENS targets are supported per workflow.');
  for(const target of config.ensTargets){if(!isAddress(target.address)||eq(target.address,zeroAddress)||BigInt(target.resource)<=0n||BigInt(target.resource)>=2n**256n||!['registry','resolver'].includes(target.kind))throw new Error('Invalid configured ENS target.');}
  const http=new HTTPCapability();
  return [handler(http.trigger({authorizedKeys:[{type:'KEY_TYPE_ECDSA_EVM',publicKey:config.authorizedEVMAddress}]}),onDeparture)];
}
export async function main(){const runner=await Runner.newRunner<Config>();await runner.run(initWorkflow);}
