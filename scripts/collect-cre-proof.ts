import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { sha256, stringToHex } from 'viem';
const root=resolve(import.meta.dirname,'..');
const deployment=JSON.parse(readFileSync(resolve(root,'cre/deployment.json'),'utf8'));
const config=JSON.parse(readFileSync(resolve(root,'cre/config.production.json'),'utf8'));
const id=process.argv[2];
if(!id||!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Usage: npm run proof:cre -- <execution UUID from CRE>');
function cli(args:string[]){
  const output=execFileSync('cre',[...args,'--output','json','--non-interactive'],{cwd:resolve(root,'cre'),encoding:'utf8',timeout:30000,windowsHide:true});
  const first=output.search(/[\[{]/),close=output[first]==='['?']':'}';
  if(first<0)throw new Error('CRE CLI returned no JSON.');
  return JSON.parse(output.slice(first,output.lastIndexOf(close)+1));
}
const status=cli(['execution','status',id]),logs=cli(['execution','logs',id]);
const outputs:any[]=[];
const chunks=new Map<string,Map<number,string>>();
const chunkTotals=new Map<string,number>();
function visit(v:unknown){
  if(typeof v==='string'&&v.trim().startsWith('{')){try{const p=JSON.parse(v);if(p.source==='Chainlink CRE'&&p.schemaVersion===2&&p.after?.block)outputs.push(p);if(p.source==='AfterKey CRE chunk'&&typeof p.content==='string'&&Number.isInteger(p.index)&&Number.isInteger(p.total)&&p.index>=0&&p.index<p.total&&p.total<=200){if(!chunks.has(p.digest))chunks.set(p.digest,new Map());const group=chunks.get(p.digest)!;if(group.has(p.index)&&group.get(p.index)!==p.content)throw new Error('Conflicting CRE output chunk.');group.set(p.index,p.content);chunkTotals.set(p.digest,p.total);}}catch(e){if(e instanceof Error&&e.message==='Conflicting CRE output chunk.')throw e;}}
  else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);
}
visit(logs);
for(const [digest,parts] of chunks){const total=chunkTotals.get(digest)!;if(parts.size!==total)continue;const encoded=Array.from({length:total},(_,i)=>parts.get(i)).join('');if(sha256(stringToHex(encoded))!==digest)throw new Error('CRE output digest mismatch.');const output=JSON.parse(encoded);if(output.source==='Chainlink CRE'&&output.schemaVersion===2&&output.after?.block)outputs.push(output);}
const output=outputs[0]??null;
const agrees=outputs.length>0&&outputs.every(p=>JSON.stringify(p)===JSON.stringify(output));
const deploymentTime=Date.parse(deployment.deployedAt||'');
const scope=output?.after;
const checks={executionSucceeded:status.status==='SUCCESS',workflowMatches:status.workflowName===deployment.workflowName,currentDeployment:Number.isFinite(deploymentTime)&&Date.parse(status.startedAt)>=deploymentTime,structuredOutputPresent:!!output,loggedOutputsAgree:agrees,walletsMatch:scope?.owner?.toLowerCase()===config.owner.toLowerCase()&&scope?.subject?.toLowerCase()===config.subject.toLowerCase(),ensScopeMatches:scope?.ens?.length===config.ensTargets.length&&config.ensTargets.every((t:any)=>scope.ens.some((e:any)=>e.address.toLowerCase()===t.address.toLowerCase()&&e.resource===t.resource)),uniswapScopeMatches:scope?.uniswapIncluded===(config.scanUniswap!==false)};
const executionVerified=Object.values(checks).every(Boolean);
const evidence={checkedAt:new Date().toISOString(),source:'Authenticated CRE CLI execution status and logs',workflowId:deployment.workflowId,executionId:id,executionVerified,checks,status:{status:status.status,startedAt:status.startedAt,finishedAt:status.finishedAt,errors:status.errors??[]},output,outputSha256:output?createHash('sha256').update(JSON.stringify(output)).digest('hex'):null,scopeNote:'Records CRE execution, not owner signatures, an onchain attestation, or unconfigured protocol access.'};
writeFileSync(resolve(root,'docs/cre-execution-proof.json'),JSON.stringify(evidence,null,2)+'\n');
if(executionVerified){deployment.executionVerified=true;deployment.checkedAt=evidence.checkedAt;deployment.latestExecution={executionId:id,status:status.status,trigger:output.trigger,block:scope.block};writeFileSync(resolve(root,'cre/deployment.json'),JSON.stringify(deployment,null,2)+'\n');}
console.log(JSON.stringify({executionId:id,executionVerified,checks,status:status.status,block:scope?.block},null,2));
if(!executionVerified)process.exitCode=1;
