import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTokenMinimum, readTokenPresentation } from '../src/uniswap/amounts';

test('withdrawal minimums preserve exact units and reject precision loss or ambiguous numbers',()=>{
  assert.equal(parseTokenMinimum('1.000001',6,'USDC'),1000001n);
  assert.equal(parseTokenMinimum('',6,'USDC'),0n);
  for(const input of ['1.0000001','0.0000009','-1','+1','1e6','Infinity','1.'])assert.throws(()=>parseTokenMinimum(input,6,'USDC'));
  assert.throws(()=>parseTokenMinimum('1',null,'token'),/unavailable/);
  assert.throws(()=>parseTokenMinimum(String(2n**256n),0,'token'),/uint256/);
});

test('optional ERC-20 metadata failures preserve raw-unit permission workflows without inventing decimals',async()=>{
  const address='0x1111111111111111111111111111111111111111' as const;
  const missing=await readTokenPresentation(address,async()=>{throw new Error('Method not implemented');});
  assert.equal(missing.decimals,null);assert.match(missing.symbol,/0x1111/);
  const malformed=await readTokenPresentation(address,async field=>field==='symbol'?'A'.repeat(1000):256);
  assert.equal(malformed.symbol.length,64);assert.equal(malformed.decimals,null);
});
