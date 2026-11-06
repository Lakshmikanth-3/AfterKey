import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {releaseView} from '../src/releases/view';

const owner='0x1111111111111111111111111111111111111111',operator='0x2222222222222222222222222222222222222222',consumer='0x3333333333333333333333333333333333333333';
const base={config:{owner,subject:operator,rpc:'https://example.invalid',targets:[]},busy:false,tab:'setup',gate:'',name:'agent.manager.eth',consumer:'',token:'',forwarder:owner,author:owner,workflow:'0x'+'a'.repeat(64),operator,expiry:'',names:'',message:'',reviewed:false,receipts:[],workflowReady:false};
const live={epoch:1n,activeDigest:'0x'+'b'.repeat(64),active:[operator,owner,owner,5000n],digest:'0x'+'c'.repeat(64),checkedDigest:'0x'+'c'.repeat(64),checkedEpoch:1n,coverage:'0x'+'d'.repeat(64),activeCoverage:'0x'+'d'.repeat(64),checkedCoverage:'0x'+'d'.repeat(64),checkedUntil:2000n,now:1000n,checkedPassed:true,paused:false,identityValid:true,issues:[],block:100n,consumers:[{address:consumer,tokenId:7n,deposited:true}]} as any;
const render=(changes:Record<string,unknown>={})=>parseHTML(releaseView({...base,...changes} as any)).document;

test('new workspace exposes setup rather than premature transaction actions',()=>{
  const d=render();
  assert.ok(d.getElementById('rel-deploy-gate'));
  assert.equal(d.querySelector('[data-release-action="candidate"]'),null);
  assert.equal(d.querySelector('[data-release-action="collect"]'),null);
  assert.equal(d.querySelector('[data-release-action="release"]'),null);
  assert.equal(d.querySelectorAll('[data-release-tab]').length,5);
});
test('owner activation requires a passing report for exact epoch and coverage',()=>{
  const changes={tab:'review',gate:owner,state:live,workflowReady:true};
  assert.equal(render(changes).querySelector('[data-release-action="activate"]')?.hasAttribute('disabled'),false);
  for(const field of [{checkedEpoch:0n},{checkedCoverage:'0x'+'e'.repeat(64)},{checkedUntil:999n},{checkedPassed:false}]){
    assert.equal(render({...changes,state:{...live,...field}}).querySelector('[data-release-action="activate"]')?.hasAttribute('disabled'),true);
  }
});
test('paused consumers cannot collect and owner can review resume',()=>{
  const d=render({tab:'operate',gate:owner,consumer,state:{...live,paused:true}});
  assert.equal(d.querySelector('[data-release-action="collect"]')?.hasAttribute('disabled'),true);
  assert.ok(d.querySelector('[data-release-action="resume"]'));
  assert.equal(d.querySelector('[data-release-action="candidate"]'),null);
});
