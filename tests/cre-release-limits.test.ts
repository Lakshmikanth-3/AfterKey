import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeFunctionData,encodeFunctionData,encodeFunctionResult,parseAbi,type Hex,type Address} from 'viem';
import {releaseReadPlan} from '../cre/release-plan';
import {ViewBatch} from '../cre/batch';
import {evidenceLogFrames} from '../src/cre/chunks';
const gate='0x1111111111111111111111111111111111111111';
const digest=('0x'+'1'.repeat(64)) as Hex;
const aggregate=parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] results)']);

test('release read plans for 2 and 16 consumers stay within payload and capability limits',()=>{
  for(const count of [2,16]){
    const consumers=Array.from({length:count},(_,i)=>('0x'+(i+2).toString(16).padStart(40,'0')));
    const plan=releaseReadPlan({gate,consumers});
    const expected=new Map(plan.map((p,i)=>{
      const data=encodeFunctionData({abi:p.abi,functionName:p.fn,args:p.args});
      const value=p.fn==='identityValid'?true:p.fn==='candidate'?[{operator:gate,treasury:gate,manager:gate,expiry:99999n},digest]:p.fn==='epoch'?1n:p.fn==='consumerCount'?BigInt(count):p.fn==='tokenId'?BigInt(i):p.fn==='dnsName'?'0x00':p.fn==='coverageHash'?digest:gate;
      return [p.to.toLowerCase()+data,{p,value}];
    }));
    let capabilities=0;
    const batch=new ViewBatch((_to,data)=>{
      capabilities++;assert.ok((data.length-2)/2<=4400);
      const requests=decodeFunctionData({abi:aggregate,data}).args![0];
      return encodeFunctionResult({abi:aggregate,functionName:'aggregate3',result:requests.map(r=>{
        const expectedCall=expected.get(r.target.toLowerCase()+r.callData);assert.ok(expectedCall);assert.equal(r.allowFailure,false);
        return {success:true,returnData:encodeFunctionResult({abi:expectedCall.p.abi,functionName:expectedCall.p.fn,result:expectedCall.value} as never)};
      })});
    });
    batch.warm(plan.map(p=>({address:p.to,abi:p.abi,fn:p.fn,args:p.args})));
    for(const p of plan)assert.notEqual(batch.read({address:p.to,abi:p.abi,fn:p.fn,args:p.args}),undefined);
    // Remaining ownerOf and resolver batches have bounded counts, not one capability per NFT.
    assert.ok(capabilities+2<15,`Read budget exceeded for ${count} consumers`);
  }
});

test('large release output remains recoverable below the CRE per-line log limit',()=>{
  const output={schemaVersion:1,source:'Chainlink CRE',kind:'configuration-release',positions:Array.from({length:16},(_,i)=>({consumer:'0x'+'a'.repeat(40),tokenId:String(i)}))};
  const encoded=JSON.stringify(output),frames=evidenceLogFrames(encoded);
  assert.ok(frames.length>1);
  for(const frame of frames)assert.ok(new TextEncoder().encode(frame).length<=1024);
  assert.equal(frames.map(f=>JSON.parse(f).content).join(''),encoded);
});
