import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeFunctionData} from 'viem';
import {checkReleaseSetter,releaseSetter,releaseDataAbi} from '../src/releases/ens-policy';
import {resolverResource,SET_DATA,SET_TEXT,RESOLVER_OWNER_ROLES} from '../src/ens/roles';
import {dns} from '../src/ens/protocol';

test('release resolver setup retains data setter and matching admin for the owner',()=>{
  assert.equal(RESOLVER_OWNER_ROLES&SET_DATA,SET_DATA);
  assert.equal(RESOLVER_OWNER_ROLES&(SET_DATA<<128n),SET_DATA<<128n);
});
test('release publication uses DNS bytes and the ENS data profile',()=>{
  const bytes=dns('afterkey-release.manager.eth');
  const decoded=decodeFunctionData({abi:releaseDataAbi,data:releaseSetter(bytes,'0x1234')});
  assert.equal(decoded.functionName,'setData');
  assert.deepEqual(decoded.args,[bytes,'afterkey.release','0x1234']);
});
test('a text role or wrong data key cannot pass release permission checks',()=>{
  const resource=resolverResource('data','afterkey.release');
  assert.doesNotThrow(()=>checkReleaseSetter(resource,SET_DATA));
  assert.throws(()=>checkReleaseSetter(resource,SET_TEXT),/mapping differs/);
  assert.throws(()=>checkReleaseSetter(resolverResource('data','other'),SET_DATA),/mapping differs/);
});
