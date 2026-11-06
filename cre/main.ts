import { HTTPCapability, CronCapability, handler, logTriggerConfig, bytesToHex, protoBigIntToBigint, decodeJson, Runner, type Runtime, type HTTPPayload, type CronPayload, type EVMLog } from '@chainlink/cre-sdk';
import { isAddress, zeroAddress, toEventSelector, pad, sha256, stringToHex } from 'viem';
import { POSITION_MANAGER } from '../src/uniswap/contracts';
import { compareSnapshots, type Config } from './model';
import { readState, evmClient } from './reader';
import { readDepartureCase } from './external-case';
import { validateCasePolicy } from './case-policy';
import type { Workflow } from '@chainlink/cre-sdk';
import { evidenceLogFrames } from '../src/cre/chunks';
const eq=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
type Request={eventId:string;event:'departure'|'recheck'|'verify';subject:string;beforeBlock?:string;issueNumber?:number};
function result(runtime:Runtime<Config>,trigger:string,eventId:string,beforeBlock?:string,departureCase?:unknown,triggerContext?:unknown){
  const after=readState(runtime);
  if(beforeBlock!==undefined&&(typeof beforeBlock!=='string'||!/^\d+$/.test(beforeBlock)||BigInt(beforeBlock)<=0n||BigInt(beforeBlock)>=BigInt(after.block)))throw new Error('Baseline must be a positive Sepolia block before the current snapshot.');
  const before=beforeBlock?readState(runtime,BigInt(beforeBlock)):undefined;
  const changes=before?compareSnapshots(before,after):[];
  const permissionStateVerified=after.complete&&after.findings.length===0;
  const output={schemaVersion:2,source:'Chainlink CRE',trigger,eventId,triggerContext:triggerContext??null,chainId:11155111,departureCase:departureCase??null,before:before??null,after,preservation:before?{checked:true,changes,passed:before.complete&&after.complete&&!changes.length}:{checked:false},permissionStateVerified,ownerSignedRevocationsVerified:false,status:!after.complete||(before&&!before.complete)?'incomplete':changes.length?'assets_changed':after.findings.length?'access_remaining':before?'permissions_absent_assets_preserved':'permissions_absent'};
  const encoded=JSON.stringify(output);
  // CLI/platform log fields are truncated. Frame the output in short, hash-bound chunks.
  const frames=evidenceLogFrames(encoded),digest=sha256(stringToHex(encoded)),total=frames.length;
  runtime.log(JSON.stringify({source:'AfterKey CRE summary',eventId,trigger,block:after.block,complete:after.complete,remainingPaths:after.findings.length,digest,total}));
  for(const frame of frames)runtime.log(frame);
  return encoded;
}
function onHttp(runtime:Runtime<Config>,payload:HTTPPayload):string{
  if(payload.input.length>16000)throw new Error('Request exceeds 16 KB.');
  const request=decodeJson(payload.input) as unknown as Request;
  if(!request||typeof request.eventId!=='string'||!request.eventId||request.eventId.length>128||!['departure','recheck','verify'].includes(request.event)||typeof request.subject!=='string'||!eq(request.subject,runtime.config.subject))throw new Error('Invalid event or subject outside the deployed workspace.');
  if(request.event==='verify'&&!request.beforeBlock)throw new Error('Verification requires a beforeBlock baseline.');
  let departureCase:unknown;
  if(request.event==='departure'){
    if(!runtime.config.github)throw new Error('Configure a GitHub case source before using the departure trigger.');
    const issueNumber=request.issueNumber??runtime.config.github.issueNumber;
    if(!Number.isSafeInteger(issueNumber)||!issueNumber||issueNumber<1)throw new Error('A positive GitHub departure issue number is required.');
    departureCase=readDepartureCase(runtime,runtime.config.github,issueNumber,request.subject);
  }
  return result(runtime,`http:${request.event}`,request.eventId,request.beforeBlock,departureCase);
}
function onCron(runtime:Runtime<Config>,payload:CronPayload):string{
  return result(runtime,'cron:monitor',`monitor:${payload.scheduledExecutionTime?.seconds??'scheduled'}`);
}
function onApproval(runtime:Runtime<Config>,log:EVMLog):string{
  if(log.removed)throw new Error('Approval log was removed by a reorganization.');
  if(!eq(bytesToHex(log.address),POSITION_MANAGER)||!log.blockNumber)throw new Error('Unexpected approval event.');
  if(!log.topics[1]||!eq(bytesToHex(log.topics[1]),pad(runtime.config.owner as `0x${string}`)))throw new Error('Approval event belongs to another owner.');
  return result(runtime,'evm:approval',`${bytesToHex(log.txHash)}:${log.index}`,undefined,undefined,{transactionHash:bytesToHex(log.txHash),eventBlock:String(protoBigIntToBigint(log.blockNumber))});
}
function initWorkflow(config:Config){
  for(const a of [config.owner,config.subject,config.authorizedEVMAddress])if(!isAddress(a)||eq(a,zeroAddress))throw new Error('Use valid nonzero workspace addresses.');
  if(eq(config.owner,config.subject))throw new Error('Owner and operator must differ.');
  if(!Number.isInteger(config.maxPositions)||config.maxPositions<1||config.maxPositions>20)throw new Error('maxPositions must be 1–20.');
  if(!Array.isArray(config.ensTargets)||config.ensTargets.length>10)throw new Error('At most 10 ENS targets supported.');
  for(const t of config.ensTargets)if(!isAddress(t.address)||eq(t.address,zeroAddress)||BigInt(t.resource)<=0n||BigInt(t.resource)>=2n**256n||!['registry','resolver'].includes(t.kind))throw new Error('Invalid ENS target.');
  if(config.github)validateCasePolicy(config.github);
  const triggers:Array<Workflow<Config>[number]>=[handler(new HTTPCapability().trigger({authorizedKeys:[{type:'KEY_TYPE_ECDSA_EVM',publicKey:config.authorizedEVMAddress}]}),onHttp)];
  if(config.monitorSchedule){if(!/^0 \*\/(5|10|15|30) \* \* \* \*$/.test(config.monitorSchedule))throw new Error('Monitor schedule must run every 5, 10, 15 or 30 minutes.');triggers.push(handler(new CronCapability().trigger({schedule:config.monitorSchedule}),onCron));}
  if(config.watchApprovals&&config.scanUniswap!==false)triggers.push(handler(evmClient().logTrigger(logTriggerConfig({addresses:[POSITION_MANAGER],topics:[[toEventSelector('Approval(address,address,uint256)'),toEventSelector('ApprovalForAll(address,address,bool)')],[pad(config.owner as `0x${string}`)]],confidence:'SAFE'})),onApproval));
  return triggers;
}
export async function main(){const runner=await Runner.newRunner<Config>();await runner.run(initWorkflow);}
