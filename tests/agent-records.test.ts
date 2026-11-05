import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registryInteroperableAddress,registrationKey,validAgentUrl } from '../src/ens/agent-records';
test('ENSIP-25 registry key matches the official ERC-7930 Ethereum example',()=>{
  const address='0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
  const encoded='0x000100000101148004a169fb4a3325136eb29fa0ceb6d2e539a432';
  assert.equal(registryInteroperableAddress(1n,address),encoded);
  assert.equal(registrationKey(1n,address,'167'),`agent-registration[${encoded}][167]`);
  assert.match(registryInteroperableAddress(11155111n,address),/^0x0001000003aa36a714/);
});
test('registry IDs and malformed EVM identifiers cannot construct ambiguous keys',()=>{
  const address='0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
  assert.throws(()=>registrationKey(1n,address,'agent][other'),/brackets/);
  assert.throws(()=>registrationKey(1n,address,''),/required/);
  assert.throws(()=>registryInteroperableAddress(0n,address),/positive/);
  assert.throws(()=>registryInteroperableAddress(1n,'0x00'),/valid/);
});
test('agent endpoints accept documented URL schemes and reject script execution',()=>{
  assert.ok(validAgentUrl('https://example.com/mcp'));assert.ok(validAgentUrl('ipfs://bafy/example'));
  assert.equal(validAgentUrl('javascript:alert(1)'),false);assert.equal(validAgentUrl('data:text/html,hello'),false);assert.equal(validAgentUrl('not a URL'),false);
});
