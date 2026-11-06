import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverMessageAddress, sha256, stringToHex, toHex } from 'viem';
import { canonicalJson, triggerSigningRequest, finishTriggerJwt } from '../src/cre/auth';
import { evidenceLogFrames } from '../src/cre/chunks';
test('structured CRE evidence survives the one-kilobyte log limit, including Unicode',()=>{
  const encoded=JSON.stringify({text:'Identity 🔑 人'.repeat(300)}),frames=evidenceLogFrames(encoded);
  assert.ok(frames.length>1);
  assert.ok(frames.every(f=>new TextEncoder().encode(f).length<1024));
  const chunks=frames.map(f=>JSON.parse(f));
  assert.equal(chunks.map(c=>c.content).join(''),encoded);
  assert.ok(chunks.every(c=>c.digest===sha256(stringToHex(encoded))));
});
test('CRE JWT hashes recursively sorted exact request and normalizes wallet recovery byte',async()=>{
  // Public unit-test key derived in memory, never a user wallet or network transaction.
  const account=privateKeyToAccount(toHex(1n,{size:32}));
  const request=triggerSigningRequest('a'.repeat(64),{eventId:'case-7',event:'recheck',subject:account.address},account.address,1000,'11111111-1111-4111-8111-111111111111');
  assert.equal(request.digest,sha256(stringToHex(request.body)));
  assert.equal(request.body,canonicalJson(JSON.parse(request.body)));
  const payload=JSON.parse(Buffer.from(request.signingInput.split('.')[1],'base64url').toString());
  assert.equal(payload.exp-payload.iat,300);assert.equal(payload.digest,request.digest);
  const signature=await account.signMessage({message:request.signingInput});
  const jwt=finishTriggerJwt(request.signingInput,signature),raw=Buffer.from(jwt.split('.')[2],'base64url');
  assert.equal(raw.length,65);assert.ok(raw[64]===0||raw[64]===1);
  assert.equal(await recoverMessageAddress({message:request.signingInput,signature}),account.address);
  const changed=triggerSigningRequest('a'.repeat(64),{eventId:'case-8',event:'recheck',subject:account.address},account.address,1000,'11111111-1111-4111-8111-111111111111');
  assert.notEqual(changed.digest,request.digest);
});
