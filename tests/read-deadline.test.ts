import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withReadDeadline } from '../src/ens/read-deadline';

test('read deadlines preserve completed results and genuine RPC errors',async()=>{
  assert.equal(await withReadDeadline(Promise.resolve('prepared'),100),'prepared');
  await assert.rejects(withReadDeadline(Promise.reject(new Error('RPC rejected')),100),/RPC rejected/);
});
test('a stalled read releases preparation with an explicit no-transaction error',async()=>{
  let complete!:(value:string)=>void;
  const pending=new Promise<string>(resolve=>{complete=resolve;});
  await assert.rejects(withReadDeadline(pending,10),/timed out.*No transaction was sent/);
  complete('late calldata');
});
