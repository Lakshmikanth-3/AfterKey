import { writeFile } from 'node:fs/promises';
import { inspectName } from '../src/ens/protocol';
import { scan, compareOwner, DEFAULT_RPC, serialize } from '../src/engine';
import { WORKSPACE_OWNER, WORKSPACE_SUBJECT } from '../src/workspace';

const name=process.argv[2]||'manager.eth',key=process.argv[3]||'agent-context';
const inspection=await inspectName(name,DEFAULT_RPC,key);
const config={owner:WORKSPACE_OWNER,subject:WORKSPACE_SUBJECT,rpc:DEFAULT_RPC,targets:inspection.targets,scanUniswap:false};
const before=await scan(config),after=await scan(config);
const changes=compareOwner(before,after);
const result={checkedAt:new Date().toISOString(),method:'Two live read-only permission and identity snapshots; no transactions were submitted',name,key,beforeBlock:before.block,afterBlock:after.block,complete:before.complete&&after.complete,identityChecks:after.ens.map(e=>({label:e.target.label,identity:e.identity,owner:e.registryOwner,expiry:e.expiry,operatorCanWrite:e.subjectCanWrite,ownerCanWrite:e.ownerCanWrite})),changes,findings:after.findings.length,errors:[...before.errors,...after.errors],signedOffboardingVerified:false};
await writeFile('docs/workspace-live-check.json',serialize(result)+'\n');
console.log(serialize(result));
if(!result.complete||changes.length)process.exitCode=1;
