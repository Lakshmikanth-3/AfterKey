import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionResult, zeroAddress, type Address } from 'viem';
import { readIdentity, identityChanges, assertExplainedAuthorization } from '../src/ens/preservation';
import { profileAbi } from '../src/ens/abi';
import { compareOwner, type Snapshot } from '../src/engine';

const resolver='0x3333333333333333333333333333333333333333' as Address;
const owner='0x1111111111111111111111111111111111111111' as Address;
test('identity comparison detects redirect, record-link and value changes independently of retained owner roles',()=>{
  const before={kind:'resolver' as const,name:'agent.team.eth',recordId:1n,ethAddress:owner,textKey:'agent-context',textValue:'Treasury operator'};
  assert.deepEqual(identityChanges(before,{...before}),[]);
  assert.deepEqual(identityChanges(before,{...before,recordId:2n,ethAddress:zeroAddress,textValue:'Changed'}),['Record bundle changed','ETH address record changed','Selected text record changed']);
  const registry={kind:'registry' as const,name:'team.eth',resolver,subregistry:zeroAddress};
  assert.deepEqual(identityChanges(registry,{...registry,resolver:zeroAddress,subregistry:resolver}),['Resolver pointer changed','Subregistry pointer changed']);
  assert.deepEqual(identityChanges(before,undefined),['Identity snapshot missing or changed']);
  const scope={target:{label:'agent profile',address:resolver,resource:'1',kind:'resolver' as const},root:0n,local:0n,ownerRoot:1n,ownerLocal:1n,operator:null,identity:before};
  const snapshot={owner,subject:resolver,positions:[],positionCount:0n,ens:[scope]} as unknown as Snapshot;
  const after=structuredClone(snapshot);after.ens[0].identity={...before,textValue:'Tampered'};
  assert.deepEqual(compareOwner(snapshot,after),['Selected text record changed: agent profile']);
});

test('a failed profile read cannot produce a successful preservation snapshot',async()=>{
  const scope={kind:'resolver' as const,name:'agent.team.eth',resource:'1',recordType:'text',argument:'agent-context',address:resolver};
  const read=async(_address:Address,fn:string,args:unknown[])=>{
    if(fn==='getRecordId')return 8n;
    const textData=String(args[1]).startsWith('0x59d1d43c');
    return textData?encodeFunctionResult({abi:profileAbi,functionName:'text',result:'Real context'}):encodeFunctionResult({abi:profileAbi,functionName:'addr',result:owner});
  };
  const snapshot=await readIdentity(scope,read);
  assert.equal(snapshot?.kind,'resolver');
  if(snapshot?.kind==='resolver'){assert.equal(snapshot.recordId,8n);assert.equal(snapshot.textValue,'Real context');assert.equal(snapshot.ethAddress,owner);}
  await assert.rejects(readIdentity(scope,async()=>{throw new Error('RPC read failed');}),/RPC read failed/);
});

test('unexplained effective permission blocks an otherwise clean access report',()=>{
  assert.doesNotThrow(()=>assertExplainedAuthorization(1n,0n,1n,true));
  assert.doesNotThrow(()=>assertExplainedAuthorization(0n,0n,1n,false));
  assert.throws(()=>assertExplainedAuthorization(0n,0n,1n,true),/Custom authority/);
  assert.throws(()=>assertExplainedAuthorization(1n,0n,1n,false),/disagrees/);
});
