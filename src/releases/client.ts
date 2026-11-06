import {decodeFunctionResult,encodeFunctionData,getAddress,isAddress,keccak256,toHex,type Abi,type Address,type Hex} from 'viem';
import {isRateLimited,isBlockUnavailable} from '../rpc';
import {packetToBytes} from 'viem/ens';
import gateArtifact from './ENSReleaseGate.json';
import consumerArtifact from './ReleaseLPVault.json';
import {clientFor,same,type Config} from '../engine';
import {inspectName,verifyFactoryProxy,contract,type SetupAction} from '../ens/protocol';
import {ensAbi} from '../ens/abi';
import {inspectReleasePublisher,releaseSetter} from './ens-policy';
import {POSITION_MANAGER,positionAbi} from '../uniswap/contracts';
import {configurationProblems,encodeConfiguration,affectedNames,type ReleaseConfiguration,type ImpactIdentity} from './model';

export const gateAbi=gateArtifact.abi as Abi,consumerAbi=consumerArtifact.abi as Abi;
export function matchesReleaseCode(code:Hex,kind:'gate'|'consumer'){
  const a=kind==='gate'?gateArtifact:consumerArtifact;
  if(code.length!==a.runtime.length)return false;
  const chars=code.toLowerCase().split('');
  for(const refs of Object.values(a.immutableReferences))for(const r of refs)chars.fill('0',2+r.start*2,2+(r.start+r.length)*2);
  return chars.join('')===a.runtime.toLowerCase();
}
export async function releaseDeployment(config:Config,name:string,forwarder:string,author:string,workflowId:string){
  if(!isAddress(forwarder)||!isAddress(author)||!/^0x[\da-f]{64}$/i.test(workflowId))throw new Error('Enter forwarder, workflow owner and 0x workflow ID.');
  const n=await inspectName(name,config.rpc),leaf=n.entries.at(-1);
  if(!leaf||leaf.name!==n.name||!same(leaf.owner,config.owner)||!n.resolverVerified||!same(leaf.resolver,n.resolver))throw new Error('Use an owned ENSv2 name with its own Permissioned Resolver.');
  const c=clientFor(config.rpc);
  await verifyFactoryProxy(c,leaf.registry,contract('UserRegistryImpl'),n.block);
  if(!(await inspectReleasePublisher(config.rpc,n.resolver,config.owner,n.block)).canPublish)throw new Error('Owner must hold SET_DATA for afterkey.release before deploying a release gate.');
  if(!await c.getCode({address:getAddress(forwarder)}))throw new Error('Forwarder has no deployed code.');
  return {name:n.name,args:[getAddress(config.owner),POSITION_MANAGER,leaf.registry,n.resolver,leaf.label,toHex(packetToBytes(n.name)),getAddress(forwarder),getAddress(author),workflowId as Hex]};
}
export async function readRelease(config:Config,address:string){
  if(!isAddress(address))throw new Error('Enter a release gate address.');
  const c=clientFor(config.rpc),gate=getAddress(address);
  if(await c.getChainId()!==11155111)throw new Error('Use Sepolia.');
  const block=await c.getBlock({blockTag:'latest'}),height=block.number;
  const code=await c.getCode({address:gate,blockNumber:height});
  if(!code||!matchesReleaseCode(code,'gate'))throw new Error('Gate does not match the compiled release contract.');
  const read=(fn:string,args:readonly unknown[]=[])=>c.readContract({address:gate,abi:gateAbi,functionName:fn,args,blockNumber:height} as never) as Promise<any>;
  // One pinned multicall avoids bursting public RPCs with 21 independent eth_calls.
  const fields=['owner','manager','treasury','epoch','coverageHash','activeDigest','active','checkedDigest','checkedUntil','checkedPassed','consumerCount','resolver','dnsName','identityValid','workflowId','workflowOwner','forwarder','paused','checkedEpoch','checkedCoverage','activeCoverage'];
  const values=await c.multicall({contracts:fields.map(functionName=>({address:gate,abi:gateAbi,functionName})),allowFailure:false,blockNumber:height});
  const [owner,manager,treasury,epoch,coverage,activeDigest,active,checkedDigest,checkedUntil,checkedPassed,count,resolver,dns,identityValid,workflowId,workflowOwner,forwarder,paused,checkedEpoch,checkedCoverage,activeCoverage]=values as any[];
  if(!same(owner,config.owner)||!same(manager,POSITION_MANAGER)||!same(treasury,config.owner))throw new Error('Release policy differs from workspace.');
  let candidate:ReleaseConfiguration|undefined,digest:Hex|undefined,candidateError='';
  try{[candidate,digest]=await read('candidate');}catch(error){if(isRateLimited(error)||isBlockUnavailable(error))throw error;candidateError='Publish a valid candidate in the ENS data record first.';}
  const consumers=[];
  if(Number(count)>16)throw new Error('Unsupported consumer count.');
  const addresses=count?await c.multicall({contracts:Array.from({length:Number(count)},(_,i)=>({address:gate,abi:gateAbi,functionName:'consumers',args:[BigInt(i)]})),allowFailure:false,blockNumber:height}) as Address[]:[];
  const tokens=addresses.length?await c.multicall({contracts:addresses.map(address=>({address,abi:consumerAbi,functionName:'tokenId'})),allowFailure:false,blockNumber:height}) as bigint[]:[];
  const holders=tokens.length?await c.multicall({contracts:tokens.map(tokenId=>({address:POSITION_MANAGER,abi:positionAbi,functionName:'ownerOf',args:[tokenId]})),allowFailure:false,blockNumber:height}):[];
  for(let i=0;i<addresses.length;i++){
    const address=addresses[i];
    const code=await c.getCode({address,blockNumber:height});
    if(!code||!matchesReleaseCode(code,'consumer'))throw new Error('Registered consumer has unsupported code.');
    const tokenId=tokens[i];
    const custodian=holders[i] as Address;
    consumers.push({address,tokenId,custodian,deposited:same(address,custodian)});
  }
  return {gate,block:height,now:block.timestamp,owner,epoch:epoch as bigint,coverage,activeDigest,active:active as readonly [Address,Address,Address,bigint],checkedDigest,checkedUntil:checkedUntil as bigint,checkedPassed:checkedPassed as boolean,paused:paused as boolean,checkedEpoch:checkedEpoch as bigint,checkedCoverage,activeCoverage,consumers,resolver:resolver as Address,dns:dns as Hex,identityValid:identityValid as boolean,workflowId,workflowOwner,forwarder,candidate,digest,candidateError,issues:candidate?configurationProblems(candidate,config.owner,POSITION_MANAGER,block.timestamp):[candidateError]};
}
export type ReleaseState=Awaited<ReturnType<typeof readRelease>>;
export type ReleaseAction={operation:'candidate'|'register'|'deposit'|'activate'|'collect'|'pause'|'resume'|'release';gate:string;consumer:string;candidate:ReleaseConfiguration};
export async function prepareReleaseAction(config:Config,request:ReleaseAction):Promise<SetupAction&{actor:string}>{
  const s=await readRelease(config,request.gate),c=clientFor(config.rpc);
  let to=s.gate,data:Hex,label='',actor=config.owner;
  const encode=(fn:string,args:readonly unknown[]=[])=>encodeFunctionData({abi:gateAbi,functionName:fn,args} as never);
  if(request.operation==='candidate'){
    const problems=configurationProblems(request.candidate,config.owner,POSITION_MANAGER,s.now);
    if(problems.length)throw new Error(problems.join('; '));
    const {canPublish}=await inspectReleasePublisher(config.rpc,s.resolver,config.owner,s.block);
    if(!canPublish)throw new Error('Owner lacks ENS SET_DATA permission for afterkey.release. This resolver needs a permission-capable migration; do not retry publication. Existing deposits remain in their consumers and owner recovery is available.');
    to=s.resolver;data=releaseSetter(s.dns,encodeConfiguration(request.candidate));label='Publish ENS candidate';
  }else if(request.operation==='register'){
    to=s.gate;data=encode('registerConsumer',[getAddress(request.consumer)]);label='Register LP consumer';
  }else if(request.operation==='activate'){
    if(!s.digest||s.issues.length)throw new Error(s.issues.join('; '));
    data=encode('activate',[s.digest,s.epoch]);label='Activate checked configuration';
  }else if(request.operation==='pause'||request.operation==='resume'){data=encode('setPaused',[request.operation==='pause']);label=request.operation==='pause'?'Pause release consumers':'Resume release consumers';}
  else{
    const consumer=s.consumers.find(v=>same(v.address,request.consumer));if(!consumer)throw new Error('Choose a registered consumer.');
    to=consumer.address;
    if(request.operation==='deposit'){
      if(!same(consumer.custodian,config.owner))throw new Error('Owner must hold this position.');
      to=POSITION_MANAGER;data=encodeFunctionData({abi:[{type:'function',name:'safeTransferFrom',stateMutability:'nonpayable',inputs:[{type:'address'},{type:'address'},{type:'uint256'}],outputs:[]}],functionName:'safeTransferFrom',args:[getAddress(config.owner),consumer.address,consumer.tokenId]});label='Deposit LP consumer position';
    }else if(request.operation==='collect'){
      actor=s.active[0];if(!same(actor,config.owner)&&!same(actor,config.subject))throw new Error('Active operator differs from workspace wallets.');
      data=encodeFunctionData({abi:consumerAbi,functionName:'collect',args:[s.activeDigest,s.epoch]});label='Collect using approved version';
    }else{data=encodeFunctionData({abi:consumerAbi,functionName:'release'});label='Return position to owner';}
  }
  await c.call({account:getAddress(actor),to,data});
  return {id:`release:${request.operation}`,to,data,label,actor,explanation:'Review this exact Sepolia operation. Candidate publication is separate from activation.'};
}
export async function inspectImpact(config:Config,names:string[]){
  if(!names.length||names.length>16)throw new Error('Enter 1–16 known ENS names.');
  const reads=await Promise.all(names.map(name=>inspectName(name,config.rpc)));
  const c=clientFor(config.rpc);
  const identities:ImpactIdentity[]=await Promise.all(reads.map(async n=>{
    if(n.recordId===null||!n.resolverVerified)throw new Error(`${n.name}: supported Permissioned Resolver required for bundle inspection.`);
    let recordId=BigInt(n.recordId);
    if(recordId===0n)recordId=await c.readContract({address:n.resolver,abi:ensAbi,functionName:'getRecordId',args:['0x'+'00'.repeat(32) as Hex],blockNumber:n.block});
    return {name:n.name,resolver:n.resolver,recordId:String(recordId)};
  }));
  return identities.map((n,i)=>({...n,affected:affectedNames(n,identities),block:String(reads[i].block)}));
}
