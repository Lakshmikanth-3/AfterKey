import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, zeroAddress, type Address } from 'viem';
import { buildPositionAction, samePositionAction, type Portfolio } from '../src/uniswap/positions';
import { positionAbi, economicChanges } from '../src/uniswap/contracts';
const owner='0x1111111111111111111111111111111111111111' as Address,subject='0x2222222222222222222222222222222222222222' as Address;
const portfolio=():Portfolio=>({block:1n,blockHash:`0x${'0'.repeat(64)}`,owner,subject,operator:true,count:1n,complete:true,positions:[{id:7n,owner,approved:subject,portfolioApproved:true,token0:owner,token1:subject,fee:3000,tickLower:-60,tickUpper:60,liquidity:100n,tokensOwed0:0n,tokensOwed1:0n,symbol0:'A',symbol1:'B',decimals0:18,decimals1:6}]});
test('collect recipient is always owner, including operator-signed collection',()=>{
  const a=buildPositionAction(portfolio(),{operation:'collect',tokenId:'7',actor:subject});
  const d=decodeFunctionData({abi:positionAbi,data:a.data});
  assert.equal(d.functionName,'collect');assert.equal((d.args![0] as any).recipient,owner);
  const p=portfolio();p.operator=false;p.positions[0].approved=zeroAddress;
  assert.throws(()=>buildPositionAction(p,a.request),/no live authorization/);
});
test('narrow revoke explains surviving portfolio permission; grants cannot overwrite others',()=>{
  const p=portfolio(),a=buildPositionAction(p,{operation:'revoke-position',actor:owner,tokenId:'7'});
  assert.match(a.warning,/still authorizes/);
  assert.throws(()=>buildPositionAction(p,{operation:'revoke-portfolio',actor:subject}),/asset owner/);
  p.positions[0].approved='0x3333333333333333333333333333333333333333';
  assert.throws(()=>buildPositionAction(p,{operation:'delegate-position',actor:owner,tokenId:'7'}),/already has/);
});
test('withdrawal binds liquidity, token minimums, owner recipient and expiry atomically',()=>{
  const r={operation:'withdraw' as const,actor:owner,tokenId:'7',liquidity:'50',amount0Min:'1',amount1Min:'0',deadline:'1100'};
  const a=buildPositionAction(portfolio(),r,1000n),d=decodeFunctionData({abi:positionAbi,data:a.data});
  assert.equal(d.functionName,'multicall');
  const calls=d.args![0] as readonly `0x${string}`[];
  assert.equal(decodeFunctionData({abi:positionAbi,data:calls[0]}).functionName,'decreaseLiquidity');
  assert.equal((decodeFunctionData({abi:positionAbi,data:calls[1]}).args![0] as any).recipient,owner);
  for(const bad of [{liquidity:'101'},{liquidity:'0'},{deadline:'999'},{deadline:'2000'},{amount0Min:'0'}])assert.throws(()=>buildPositionAction(portfolio(),{...r,...bad},1000n));
  const p=portfolio();p.positions[0].liquidity=90n;
  assert.equal(samePositionAction(a,buildPositionAction(p,r,1000n)),false);
});
test('offboarding preservation detects principal changes even when NFT owner is unchanged',()=>{
  const a=portfolio().positions[0];
  assert.deepEqual(economicChanges(a,{...a}),[]);
  assert.deepEqual(economicChanges(a,{...a,liquidity:99n}),['Position liquidity changed']);
});
