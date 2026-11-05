import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registryInteroperableAddress,registrationKey,validAgentUrl } from '../src/ens/agent-records';
import { setupRecordValue, makeProxyAction } from '../src/ens/protocol';
import { decodeFunctionData, type Address } from 'viem';
import { factoryAbi, resolverInitAbi, ensAbi } from '../src/ens/abi';
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

test('setup never substitutes descriptive text for an agent endpoint and encodes the entered value',()=>{
  assert.throws(()=>setupRecordValue({key:'agent-endpoint[mcp]'}),/actual initial/);
  assert.throws(()=>setupRecordValue({key:'agent-endpoint[mcp]',textValue:'a description'}),/URL/);
  const owner='0x2cE812CF03d1F252C940aFf954E15D5E49bBedd5' as Address;
  const state={parent:'team.eth',label:'operator',key:'agent-endpoint[mcp]',textValue:'https://example.com/mcp',transactions:[]};
  const action=makeProxyAction('resolver',owner,state,10n);
  const factory=decodeFunctionData({abi:factoryAbi,data:action.data});
  const initializer=factory.args![2];assert.ok(initializer);
  const init=decodeFunctionData({abi:resolverInitAbi,data:initializer});
  const text=decodeFunctionData({abi:ensAbi,data:init.args![1][1]});
  assert.equal(text.functionName,'setText');
  assert.equal(text.args![1],'agent-endpoint[mcp]');
  assert.equal(text.args![2],state.textValue);
});
