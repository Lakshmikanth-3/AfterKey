import {bytesToHex,encodeCallMsg,blockNumber,protoBigIntToBigint,hexToBase64,TxStatus,type Runtime} from '@chainlink/cre-sdk';
import {encodeFunctionData,decodeFunctionResult,encodeAbiParameters,keccak256,zeroAddress,getAddress,type Address,type Abi} from 'viem';
import gateArtifact from '../src/releases/ENSReleaseGate.json';
import vaultArtifact from '../src/releases/ReleaseLPVault.json';
import {ensAbi} from '../src/ens/abi';
import {configurationProblems,consumerCoverage,reportParams,type ReleaseConfiguration} from '../src/releases/model';
import {POSITION_MANAGER,positionAbi} from '../src/uniswap/contracts';
import {evmClient} from './reader';
import type {Config} from './model';
import {ViewBatch,type ViewCall} from './batch';
import {evidenceLogFrames} from '../src/cre/chunks';

import {releaseReadPlan} from './release-plan';
export function verifyRelease(runtime:Runtime<Config>,address:string,eventId?:string):string{
  const target=runtime.config.releases?.find(t=>t.gate.toLowerCase()===address.toLowerCase());
  if(!target)throw new Error('Release gate is outside deployed coverage.');
  const evm=evmClient(),header=evm.headerByNumber(runtime,{}).result().header;
  if(!header?.blockNumber||!header.timestamp)throw new Error('Missing release header.');
  const height=protoBigIntToBigint(header.blockNumber),now=header.timestamp;
  let capabilityReads=0;
  const batch=new ViewBatch((to,data)=>{
    if(++capabilityReads>14)throw new Error('Release verification exceeds its bounded CRE read budget.');
    return bytesToHex(evm.callContract(runtime,{call:encodeCallMsg({from:zeroAddress,to,data}),blockNumber:blockNumber(height)}).result().data);
  });
  const call=(to:string,abi:Abi,fn:string,args:readonly unknown[]=[]):ViewCall=>({address:getAddress(to),abi,fn,args});
  const read=(to:string,abi:Abi,fn:string,args:readonly unknown[]=[]):any=>{const c=call(to,abi,fn,args);batch.warm([c]);return batch.read(c);};
  const gate=getAddress(target.gate),abi=gateArtifact.abi as Abi;
  // ViewBatch chunks requests below the live payload bound and rejects partial results.
  batch.warm(releaseReadPlan(target).map(p=>call(p.to,p.abi,p.fn,p.args)));
  if(read(gate,abi,'owner').toLowerCase()!==runtime.config.owner.toLowerCase()||read(gate,abi,'treasury').toLowerCase()!==runtime.config.owner.toLowerCase()||read(gate,abi,'manager').toLowerCase()!==POSITION_MANAGER.toLowerCase())throw new Error('Gate policy differs from deployed workspace.');
  if(!read(gate,abi,'identityValid'))throw new Error('ENS identity changed or expired.');
  const [config,digest]=read(gate,abi,'candidate') as [ReleaseConfiguration,`0x${string}`];
  const epoch=read(gate,abi,'epoch') as bigint,coverage=read(gate,abi,'coverageHash') as `0x${string}`;
  const total=read(gate,abi,'consumerCount') as bigint;
  if(total!==BigInt(target.consumers.length)||total===0n||total>16n)throw new Error('Consumer coverage is incomplete.');
  batch.warm(target.consumers.map(consumer=>call(POSITION_MANAGER,positionAbi,'ownerOf',[read(consumer,vaultArtifact.abi as Abi,'tokenId')])));
  const consumers:Address[]=[],positions:unknown[]=[];
  for(let i=0;i<Number(total);i++){
    const consumer=read(gate,abi,'consumers',[BigInt(i)]) as Address;consumers.push(consumer);
    if(consumer.toLowerCase()!==target.consumers[i].toLowerCase())throw new Error('Consumer order or identity changed.');
    if(read(consumer,vaultArtifact.abi as Abi,'gate').toLowerCase()!==gate.toLowerCase()||read(consumer,vaultArtifact.abi as Abi,'manager').toLowerCase()!==POSITION_MANAGER.toLowerCase())throw new Error('Consumer is not bound to the gate and official manager.');
    const tokenId=read(consumer,vaultArtifact.abi as Abi,'tokenId') as bigint;
    if(read(POSITION_MANAGER,positionAbi,'ownerOf',[tokenId]).toLowerCase()!==consumer.toLowerCase())throw new Error('Consumer does not hold its position.');
    positions.push({consumer,tokenId:String(tokenId)});
  }
  if(consumerCoverage(consumers)!==coverage)throw new Error('Consumer coverage hash differs.');
  const issues=configurationProblems(config,runtime.config.owner,POSITION_MANAGER,now);
  // Independently reread the resolver candidate, rather than trusting only gate decoding.
  const resolver=read(gate,abi,'resolver') as Address,dns=read(gate,abi,'dnsName') as `0x${string}`;
  const profile=[{type:'function',name:'data',stateMutability:'view',inputs:[{name:'node',type:'bytes32'},{name:'key',type:'string'}],outputs:[{name:'value',type:'bytes'}]}] as const;
  const inner=encodeFunctionData({abi:profile,functionName:'data',args:['0x'+'00'.repeat(32) as `0x${string}`,'afterkey.release']});
  const resolved=read(resolver,ensAbi,'resolve',[dns,inner]);
  const payload=decodeFunctionResult({abi:profile,functionName:'data',data:resolved});
  if(keccak256(payload)!==digest)throw new Error('ENS candidate digest mismatch.');
  const until=now+600n;
  const encoded=encodeAbiParameters(reportParams,[11155111n,gate,digest,epoch,coverage,until,issues.length===0]);
  const signed=runtime.report({encodedPayload:hexToBase64(encoded),encoderName:'evm',signingAlgo:'ecdsa',hashingAlgo:'keccak256'}).result();
  const written=evm.writeReport(runtime,{receiver:gate,report:signed,gasConfig:{gasLimit:'500000'}}).result();
  if(written.txStatus!==TxStatus.SUCCESS)throw new Error(`CRE report delivery failed: ${written.txStatus}`);
  const output={schemaVersion:1,source:'Chainlink CRE',kind:'configuration-release',eventId:eventId??null,gate,block:String(height),digest,epoch:String(epoch),coverage,positions,issues,passed:issues.length===0,transactionHash:bytesToHex(written.txHash??new Uint8Array()),activation:'Owner signature required'};
  const encodedOutput=JSON.stringify(output);
  runtime.log(JSON.stringify({source:'AfterKey CRE release summary',eventId:eventId??null,gate,digest,passed:issues.length===0,capabilityReads,transactionHash:output.transactionHash}));
  for(const frame of evidenceLogFrames(encodedOutput))runtime.log(frame);
  return encodedOutput;
}
