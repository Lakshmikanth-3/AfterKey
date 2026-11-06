import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {getAddress,parseEventLogs,type Hex} from 'viem';
import {releaseOutputFromLogs,validateReleaseOutput} from '../src/cre/release-proof';
import {clientFor,DEFAULT_RPC,serialize,same} from '../src/engine';
import {gateAbi,matchesReleaseCode} from '../src/releases/client';
import {POSITION_MANAGER,positionAbi} from '../src/uniswap/contracts';
import deployment from '../cre/deployment.json';
import config from '../cre/config.production.json';

const id=process.argv[2];if(!id||!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Pass the CRE execution UUID from cre execution list. A gateway acceptance hash is not the execution UUID.');
function cli(args:string[]){
  const text=execFileSync('cre',[...args,'--output','json','--non-interactive'],{cwd:'cre',encoding:'utf8',timeout:30000,windowsHide:true});
  const first=text.search(/[\[{]/),close=text[first]==='['?']':'}';if(first<0)throw new Error('CRE returned no JSON.');
  return JSON.parse(text.slice(first,text.lastIndexOf(close)+1));
}
const status=cli(['execution','status',id]);
if(status.status!=='SUCCESS')throw new Error(`CRE release did not succeed: ${status.status}`);
const output=releaseOutputFromLogs(cli(['execution','logs',id]));
const target=config.releases.find(t=>same(t.gate,output.gate));if(!target)throw new Error('Output gate is outside current configured coverage.');
validateReleaseOutput(output,target);
const c=clientFor(process.env.SEPOLIA_RPC_URL||DEFAULT_RPC),gate=getAddress(output.gate),hash=output.transactionHash as Hex;
if(await c.getChainId()!==11155111)throw new Error('Proof RPC must be Sepolia.');
const receipt=await c.getTransactionReceipt({hash}),header=await c.getBlock({blockNumber:receipt.blockNumber});
const code=await c.getCode({address:gate,blockNumber:receipt.blockNumber});
const names=['workflowId','workflowOwner','forwarder','owner','treasury','manager','checkedDigest','checkedEpoch','checkedCoverage','coverageHash'];
const values=await c.multicall({contracts:names.map(functionName=>({address:gate,abi:gateAbi,functionName})),allowFailure:false,blockNumber:receipt.blockNumber});
const state=Object.fromEntries(names.map((n,i)=>[n,values[i]]));
const events=parseEventLogs({abi:gateAbi,eventName:'Checked',logs:receipt.logs});
const checked=events.find(e=>same(e.address,gate)&&String(e.args.digest).toLowerCase()===output.digest.toLowerCase()&&e.args.epoch===BigInt(output.epoch)&&e.args.passed===true);
const holders=await c.multicall({contracts:output.positions.map((p:any)=>({address:POSITION_MANAGER,abi:positionAbi,functionName:'ownerOf',args:[BigInt(p.tokenId)]})),allowFailure:false,blockNumber:BigInt(output.block)});
const checks={successfulCanonicalReceipt:receipt.status==='success'&&receipt.blockHash===header.hash,compiledGateRuntime:!!code&&matchesReleaseCode(code,'gate'),workflowMatchesDeployment:String(state.workflowId).toLowerCase()==='0x'+deployment.workflowId.toLowerCase(),workflowOwnerMatches:same(String(state.workflowOwner),deployment.registryOwner),assetPolicyMatches:same(String(state.owner),config.owner)&&same(String(state.treasury),config.owner)&&same(String(state.manager),POSITION_MANAGER),passingCheckedEvent:!!checked,unexpiredAtDelivery:!!checked&&BigInt(checked.args.until as bigint)>header.timestamp,reportEpochMatches:state.checkedEpoch===BigInt(output.epoch),reportDigestMatches:String(state.checkedDigest).toLowerCase()===output.digest.toLowerCase(),coverageMatches:String(state.checkedCoverage).toLowerCase()===output.coverage.toLowerCase()&&String(state.coverageHash).toLowerCase()===output.coverage.toLowerCase(),deliveryAfterRead:receipt.blockNumber>=BigInt(output.block),custodyAtObservedBlock:holders.every((h,i)=>same(String(h),target.consumers[i]))};
const verified=Object.values(checks).every(Boolean);
const proof={checkedAt:new Date().toISOString(),executionId:id,workflowId:deployment.workflowId,releaseReportVerified:verified,checks,status,output,receipt:{hash,block:receipt.blockNumber,blockHash:receipt.blockHash},scope:'Authenticated CRE release output plus canonical onchain gate report and snapshot custody. Owner activation and operator collection require separate proof.'};
fs.writeFileSync('docs/cre-release-execution-proof.json',serialize(proof)+'\n');
if(verified){const next={...deployment,executionVerified:true,checkedAt:proof.checkedAt,latestExecution:{executionId:id,status:'SUCCESS',trigger:'http:release',block:String(receipt.blockNumber)},completion:'Release report delivered and independently verified; activation and collection require separate receipts.'};fs.writeFileSync('cre/deployment.json',JSON.stringify(next,null,2)+'\n');}
console.log(serialize({executionId:id,releaseReportVerified:verified,checks,receiptBlock:receipt.blockNumber}));if(!verified)process.exitCode=1;
