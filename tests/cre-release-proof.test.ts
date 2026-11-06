import {test} from 'node:test';
import assert from 'node:assert/strict';
import {releaseOutputFromLogs,validateReleaseOutput} from '../src/cre/release-proof';
import {evidenceLogFrames} from '../src/cre/chunks';
const address='0x1111111111111111111111111111111111111111',consumer='0x2222222222222222222222222222222222222222',hash='0x'+'a'.repeat(64);
const output=()=>({schemaVersion:1,source:'Chainlink CRE',kind:'configuration-release',gate:address,digest:hash,coverage:hash,transactionHash:hash,block:'12',epoch:'1',passed:true,issues:[],positions:[{consumer,tokenId:'7'}]});
const target={gate:address,consumers:[consumer]};
test('release proof requires complete hash-bound chunks and agreeing release output',()=>{
  const value=output(),frames=evidenceLogFrames(JSON.stringify(value));
  assert.deepEqual(releaseOutputFromLogs(frames.map(message=>({message}))),value);
  assert.throws(()=>releaseOutputFromLogs([{message:JSON.stringify({source:'Chainlink CRE',trigger:'cron:monitor',after:{block:'12'}})}]),/no configuration-release/);
  const conflicting=structuredClone(value);conflicting.passed=false;
  assert.throws(()=>releaseOutputFromLogs([JSON.stringify(value),JSON.stringify(conflicting)]),/disagree/);
  const f=JSON.parse(frames[0]);f.content+='tampered';
  assert.throws(()=>releaseOutputFromLogs([JSON.stringify(f),...frames.slice(1)]),/digest mismatch/);
  const split=evidenceLogFrames(JSON.stringify({...value,padding:'x'.repeat(1500)}));
  assert.throws(()=>releaseOutputFromLogs(split.slice(1)),/Incomplete/);
});
test('successful unrelated, failed, partial and malformed outputs cannot become release proof',()=>{
  assert.doesNotThrow(()=>validateReleaseOutput(output(),target));
  for(const patch of [{gate:consumer},{passed:false},{issues:['expired']},{positions:[]},{epoch:'-1'},{transactionHash:'0x1234'},{positions:[{consumer,tokenId:'-1'}]}])assert.throws(()=>validateReleaseOutput({...output(),...patch},target));
});
