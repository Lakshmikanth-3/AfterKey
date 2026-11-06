import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, encodeFunctionResult, parseAbi, type Address } from 'viem';
import { ViewBatch } from '../cre/batch';
const address='0x1111111111111111111111111111111111111111' as Address;
const abi=parseAbi(['function roles(uint256,address) view returns (uint256)','function approve(address,uint256)']);
const aggregate=parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] results)']);
test('CRE read batches deduplicate exact scope, forbid writes and never accept partial results',()=>{
  let calls=0;
  const c={address,fn:'roles',args:[0n,address],abi};
  const batch=new ViewBatch((_to,data)=>{calls++;const d=decodeFunctionData({abi:aggregate,data});assert.equal(d.args![0].length,1);assert.equal(d.args![0][0].allowFailure,false);return encodeFunctionResult({abi:aggregate,functionName:'aggregate3',result:[{success:true,returnData:encodeFunctionResult({abi,functionName:'roles',result:16n})}]});});
  batch.warm([c,c]);batch.warm([c]);assert.equal(calls,1);assert.equal(batch.read(c),16n);
  assert.throws(()=>batch.warm([{...c,fn:'approve',args:[address,1n]}]),/view\/pure/);
  const partial=new ViewBatch(()=>encodeFunctionResult({abi:aggregate,functionName:'aggregate3',result:[]}));assert.throws(()=>partial.warm([c]),/Incomplete/);
  assert.throws(()=>batch.read({...c,args:[1n,address]}),/not batched/);
});
test('larger portfolios split view payloads below the live 5 KB limit',()=>{
  let calls=0;
  const batch=new ViewBatch((_to,data)=>{calls++;assert.ok((data.length-2)/2<=4400);const d=decodeFunctionData({abi:aggregate,data});return encodeFunctionResult({abi:aggregate,functionName:'aggregate3',result:d.args![0].map(()=>({success:true,returnData:encodeFunctionResult({abi,functionName:'roles',result:16n})}))});});
  batch.warm(Array.from({length:50},(_,i)=>({address,fn:'roles',args:[BigInt(i),address],abi})));
  assert.ok(calls>1);assert.equal(batch.read({address,fn:'roles',args:[49n,address],abi}),16n);
});
