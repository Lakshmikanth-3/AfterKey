import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyDepartureCase } from '../cre/case-policy';
import { compareSnapshots, type PermissionSnapshot } from '../cre/model';
const subject='0x2222222222222222222222222222222222222222';
const policy={repository:'team/cases',approver:'owner'};
const issue=()=>({number:7,state:'closed',state_reason:'completed',closed_by:{login:'owner'},html_url:'https://github.com/team/cases/issues/7',labels:[{name:'afterkey-departure'}],body:`AfterKey-Subject: ${subject}`,updated_at:'2026-11-06T00:00:00Z',closed_at:'2026-11-06T00:00:00Z'});
test('external departure case requires matching repository, exact subject, label and configured completing actor',()=>{
  assert.equal(verifyDepartureCase(issue(),policy,7,subject).issueNumber,7);
  for(const change of [{state:'open'},{state_reason:'not_planned'},{pull_request:{}},{labels:[]},{closed_by:{login:'attacker'}},{html_url:'https://github.com/attacker/cases/issues/7'},{body:`AfterKey-Subject: ${subject}\nAfterKey-Subject: ${subject}`},{body:'AfterKey-Subject: 0x1111111111111111111111111111111111111111'}])assert.throws(()=>verifyDepartureCase({...issue(),...change},policy,7,subject));
});
test('CRE preservation distinguishes removed access from changed principal or missing identity',()=>{
  const a:PermissionSnapshot={block:'1',blockHash:'0x01',owner:'0x11',subject,positionCount:'1',uniswapIncluded:true,operator:true,complete:true,findings:[],positions:[{tokenId:'7',owner:'0x11',approved:subject,token0:'0xa',token1:'0xb',fee:3000,tickLower:-60,tickUpper:60,liquidity:'100',tokensOwed0:'0',tokensOwed1:'0'}],ens:[{address:'0x33',resource:'1',root:'16',local:'0',ownerRoot:'16',ownerLocal:'0',nameOwner:null,operator:null,identity:{textValue:'Keep'},ownerCanWrite:true}]};
  const b=structuredClone(a);b.block='2';b.operator=false;b.positions[0].approved='0x00';b.ens[0].root='0';
  assert.deepEqual(compareSnapshots(a,b),[]);
  b.positions[0].liquidity='99';b.ens[0].identity=undefined;
  assert.equal(compareSnapshots(a,b).length,2);
});

test('external approval rejects edited or invalid-timestamp departure issues',()=>{
  assert.throws(()=>verifyDepartureCase({...issue(),updated_at:'2026-11-06T00:00:01Z'},policy,7,subject),/changed after approval/);
  assert.throws(()=>verifyDepartureCase({...issue(),updated_at:'invalid'},policy,7,subject),/invalid update/);
  assert.throws(()=>verifyDepartureCase({...issue(),closed_at:undefined},policy,7,subject),/invalid update/);
});
