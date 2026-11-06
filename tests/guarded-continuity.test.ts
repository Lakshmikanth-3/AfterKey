import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vaultContinuity, type VaultState } from '../src/guarded/model';
import { compareSnapshots, type PermissionSnapshot } from '../cre/model';
import { deriveFindings, type Snapshot } from '../src/engine';
import { evidenceReport } from '../src/evidence';
import { decodeFunctionData, type Address, type Hash } from 'viem';
import { vaultAbi } from '../src/guarded/model';
const state:VaultState={address:'0x11',owner:'0x22',treasury:'0x22',manager:'0x33',registry:'0x44',resolver:'0x55',tokenId:'7',nameResource:'1',capabilityResource:'2',capabilityKey:'key',label:'agent',operator:'0x66',mandateExpiry:'100',epoch:'2',paused:false,custodian:'0x11',subjectCanCollect:true,operatorCanCollect:true};
test('handover allows replacing operator while binding custody, treasury and ENS authority',()=>{
  const after={...state,operator:'0x77',epoch:'3',subjectCanCollect:false};
  assert.deepEqual(vaultContinuity(state,after),[]);
  for(const field of ['treasury','custodian','resolver','registry','nameResource','capabilityResource','tokenId'] as const)assert.equal(vaultContinuity(state,{...after,[field]:'999'}).length,1);
  assert.equal(vaultContinuity(state,{...after,epoch:'1'}).length,1);
});
test('CRE preservation includes vault-owned positions absent from owner wallet enumeration',()=>{
  const before:PermissionSnapshot={block:'1',blockHash:'0x01',owner:'0x22',subject:'0x66',positionCount:'0',uniswapIncluded:true,operator:false,positions:[],ens:[],findings:[],complete:true,guarded:[{state,economics:{token0:'0xaa',token1:'0xbb',fee:3000,tickLower:-60,tickUpper:60,liquidity:'50',tokensOwed0:'0',tokensOwed1:'0'}}]};
  const after=structuredClone(before);after.block='2';after.guarded![0].state={...state,operator:'0x77',epoch:'3',subjectCanCollect:false};
  assert.deepEqual(compareSnapshots(before,after),[]);
  after.guarded![0].economics.liquidity='49';assert.match(compareSnapshots(before,after).join(' '),/economics/);
  after.guarded=[];assert.match(compareSnapshots(before,after).join(' '),/coverage changed/);
});
test('browser offboarding prepares a real owner pause and evidence rejects changed vault coverage',()=>{
  const owner='0x1111111111111111111111111111111111111111' as Address,subject='0x2222222222222222222222222222222222222222' as Address,address='0x3333333333333333333333333333333333333333' as Address;
  const snapshot:Snapshot={block:1n,blockHash:`0x${'0'.repeat(64)}` as Hash,timestamp:'2026-11-07',owner,subject,config:{owner,subject,rpc:'https://example.com',targets:[],guardedVaults:[address]},operator:false,positions:[],positionCount:0n,ens:[],findings:[],complete:true,errors:[],guarded:[{state:{...state,address,owner,treasury:owner},economics:{token0:owner,token1:subject,fee:3000,tickLower:-60,tickUpper:60,liquidity:50n,tokensOwed0:0n,tokensOwed1:0n}}]};
  const findings=deriveFindings(snapshot);assert.equal(findings.length,1);
  assert.equal(findings[0].address,address);assert.equal(findings[0].fn,'setPaused');
  assert.deepEqual(decodeFunctionData({abi:vaultAbi,data:findings[0].data}).args,[true]);
  const after=structuredClone(snapshot);after.block=2n;after.guarded![0].state.subjectCanCollect=false;
  assert.equal(deriveFindings(after).length,0);
  after.config.guardedVaults=[];
  assert.equal(evidenceReport({before:snapshot,after,verified:true,transactions:[],ownerProblems:[]}).permissionStateVerified,false);
});
