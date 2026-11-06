import { test } from 'node:test';
import assert from 'node:assert/strict';
import { departureProofChecks } from '../src/cre/proof-policy';

const owner='0x1111111111111111111111111111111111111111',subject='0x2222222222222222222222222222222222222222';
const config={owner,subject,github:{repository:'example/afterkey',approver:'builder'}};
const valid={
  trigger:'http:departure',departureCase:{repository:'example/afterkey',approvedBy:'builder',subject,issueNumber:2},
  before:{block:'10',owner,subject,uniswapIncluded:true,positions:[{tokenId:'1'}],findings:[{kind:'operator-wide'}]},
  after:{block:'20',owner,subject,uniswapIncluded:true,positions:[{tokenId:'1'}],findings:[],complete:true},
  preservation:{checked:true,passed:true,changes:[]},permissionStateVerified:true,status:'permissions_absent_assets_preserved'
};

test('primary CRE proof requires the complete departure outcome',()=>{
  assert.ok(Object.values(departureProofChecks(valid,config)).every(Boolean));
  const cron={...valid,trigger:'cron:monitor'};
  assert.equal(departureProofChecks(cron,config).departureTrigger,false);
  const accessRemaining={...valid,after:{...valid.after,findings:[{kind:'token-approval'}]}};
  assert.equal(departureProofChecks(accessRemaining,config).afterAccessAbsent,false);
  const changed={...valid,preservation:{checked:true,passed:false,changes:['Position changed']}};
  assert.equal(departureProofChecks(changed,config).preservationPassed,false);
});
