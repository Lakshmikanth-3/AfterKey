import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceReport, type EvidenceTransaction } from '../src/evidence';
import { deriveFindings, type Snapshot } from '../src/engine';
import type { Address, Hash } from 'viem';
const owner='0x1111111111111111111111111111111111111111' as Address,subject='0x2222222222222222222222222222222222222222' as Address,address='0x3333333333333333333333333333333333333333' as Address;
const hash=`0x${'1'.repeat(64)}` as Hash;
const snapshot=():Snapshot=>({block:10n,blockHash:hash,timestamp:'2026-11-06T00:00:00Z',config:{owner,subject,rpc:'https://rpc.example/?key=local-only',scanUniswap:false,targets:[]},owner,subject,operator:false,positions:[],positionCount:0n,ens:[],findings:[],complete:true,errors:[]});
test('a baseline export cannot imply signed revocation, Uniswap coverage or CRE execution',()=>{
  const before=snapshot(),r=evidenceReport({before,after:before,transactions:[],verified:false,ownerProblems:[]});
  assert.equal(r.status,'baseline');assert.equal(r.signedOffboardingVerified,false);assert.equal(r.permissionStateVerified,false);
  assert.equal(r.protocols.uniswapIncluded,false);assert.equal(r.protocols.chainlinkExecutionIncluded,false);
  assert.doesNotMatch(r.coverage,/Uniswap/);assert.match(r.method,/No confirmed revocation/);
  assert.equal(r.after?.config.rpc,'[not exported]');assert.equal(before.config.rpc,'https://rpc.example/?key=local-only');
});
test('permission absence and a receipt between scoped snapshots are distinct evidence',()=>{
  const before=snapshot(),after={...snapshot(),block:12n};
  before.findings=[{id:'root',protocol:'ENSv2',title:'Root access',detail:'',scope:'name',broad:true,address,fn:'revokeRootRoles',args:[16n,subject],data:'0x',executable:true}];
  const inputs={before,after,transactions:[] as EvidenceTransaction[],verified:true,ownerProblems:[]};
  assert.equal(evidenceReport(inputs).signedOffboardingVerified,false);
  const tx:EvidenceTransaction={label:'Root access',hash,status:'confirmed',to:address,functionName:'revokeRootRoles',blockNumber:11n,blockHash:hash};
  assert.equal(evidenceReport({...inputs,transactions:[tx]}).signedOffboardingVerified,true);
  assert.equal(evidenceReport({...inputs,transactions:[{...tx,blockNumber:9n}]}).signedOffboardingVerified,false);
  assert.equal(evidenceReport({...inputs,transactions:[{...tx,status:'failed'}]}).signedOffboardingVerified,false);
  assert.equal(evidenceReport({...inputs,transactions:[tx],ownerProblems:['Owner changed']}).signedOffboardingVerified,false);
});
test('an executable ENS finding cannot also carry a blocking reason',()=>{
  const s=snapshot();s.ens=[{target:{label:'resolver',kind:'resolver',address,resource:'1'},root:16n,local:0n,ownerRoot:16n<<128n,ownerLocal:0n,operator:null}];
  const allowed=deriveFindings(s,{[`ens:${address}:root`]:true});
  assert.equal(allowed[0].executable,true);assert.equal(allowed[0].blockedReason,undefined);
  assert.ok(deriveFindings(s)[0].blockedReason);
});
