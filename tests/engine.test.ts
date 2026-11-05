import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zeroAddress, type Address } from 'viem';
import { adminMask, compareOwner, deriveFindings, orderFindings, validateConfig, POSITION_MANAGER, type Config, type Snapshot } from '../src/engine';
const owner='0x1111111111111111111111111111111111111111' as Address;
const subject='0x2222222222222222222222222222222222222222' as Address;
const contract='0x3333333333333333333333333333333333333333' as Address;
const config:Config={owner,subject,rpc:'https://example.com',targets:[]};
const base=():Snapshot=>({block:1n,blockHash:`0x${'0'.repeat(64)}`,timestamp:'2026-11-05T00:00:00Z',config,owner,subject,operator:false,positions:[],positionCount:0n,complete:true,errors:[],ens:[],findings:[]});
test('rejects self-offboarding, zero wallets, root resource and duplicate ENS scope',()=>{
  assert.throws(()=>validateConfig({...config,subject:owner}),/different/);
  assert.throws(()=>validateConfig({...config,subject:zeroAddress}),/zero/);
  const t={label:'name',address:contract,resource:'0',kind:'registry' as const};
  assert.throws(()=>validateConfig({...config,targets:[t]}),/nonzero/);
  assert.throws(()=>validateConfig({...config,targets:[{...t,resource:'1'},{...t,resource:'0x01'}]}),/duplicate/);
});
test('operator-wide approval remains a finding without any current positions',()=>{
  const s=base();s.operator=true;
  const f=deriveFindings(s);
  assert.equal(f.length,1);assert.equal(f[0].fn,'setApprovalForAll');assert.deepEqual(f[0].args,[subject,false]);
});
test('individual and broad paths are independent; broad revocation precedes narrow cleanup',()=>{
  const s=base();s.operator=true;s.positions=[{id:7n,approved:subject,owner},{id:8n,approved:zeroAddress,owner}];s.positionCount=2n;
  const f=deriveFindings(s);assert.equal(f.length,2);assert.equal(f[0].broad,true);assert.equal(f[1].fn,'approve');assert.deepEqual(f[1].args,[zeroAddress,7n]);
  s.operator=false;assert.equal(deriveFindings(s).length,1);
});
test('admin mask respects EAC nybble layout and admin roles managing themselves',()=>{
  const regular=1n << 12n;const admin=1n << 140n;
  assert.equal(adminMask(regular),admin);assert.equal(adminMask(admin),admin);assert.equal(adminMask(regular|admin),admin);
});
test('deduplicates root revocations across resources and blocks unverified authority',()=>{
  const s=base();
  s.ens=[1,2].map(n=>({target:{label:`name ${n}`,address:contract,resource:String(n),kind:'resolver'},root:1n,local:16n,ownerRoot:0n,ownerLocal:0n,operator:null}));
  const f=deriveFindings(s);
  assert.equal(f.filter(x=>x.fn==='revokeRootRoles').length,1);assert.equal(f.length,3);assert.ok(f.every(x=>!x.executable));
  const g=deriveFindings(s,{[`ens:${contract}:root`]:true});assert.equal(g[0].executable,true);
});
test('registry operator path is detected independently of direct EAC role grants',()=>{
  const s=base();s.ens=[{target:{label:'registry',address:contract,resource:'1',kind:'registry'},root:0n,local:0n,ownerRoot:1n,ownerLocal:1n,operator:true}];
  const f=deriveFindings(s);assert.equal(f.length,1);assert.equal(f[0].fn,'setApprovalForAll');assert.equal(f[0].address,contract);
});
test('owner preservation catches role loss and position movement',()=>{
  const a=base();a.positions=[{id:1n,owner,approved:subject}];a.positionCount=1n;
  a.ens=[{target:{label:'resolver',address:contract,resource:'1',kind:'resolver'},root:0n,local:1n,ownerRoot:1n,ownerLocal:16n,operator:null}];
  const b=structuredClone(a);b.ens[0].ownerLocal=0n;b.positions=[];b.positionCount=0n;
  assert.equal(compareOwner(a,b).length,2);assert.deepEqual(compareOwner(a,structuredClone(a)),[]);
});
