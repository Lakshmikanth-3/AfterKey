import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameRecordWrite, type RecordWrite } from '../src/ens/operator';

const write={id:'write-record',label:'Update',explanation:'',name:'agent.team.eth',key:'agent-context',value:'Operator context',actor:'0x1111111111111111111111111111111111111111',to:'0x2222222222222222222222222222222222222222',data:'0x1234',block:1n} as RecordWrite;
test('a fresh record review binds signer, resolver, calldata, name and value but permits a newer read block',()=>{
  assert.ok(sameRecordWrite(write,{...write,block:2n}));
  assert.equal(sameRecordWrite(write,{...write,actor:write.to}),false);
  assert.equal(sameRecordWrite(write,{...write,to:write.actor}),false);
  assert.equal(sameRecordWrite(write,{...write,data:'0xabcd'}),false);
  assert.equal(sameRecordWrite(write,{...write,name:'other.team.eth'}),false);
  assert.equal(sameRecordWrite(write,{...write,value:'Changed after review'}),false);
});
