import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { toHex } from 'viem';
import { triggerSigningRequest, finishTriggerJwt } from '../src/cre/auth';
import { validateSignedTrigger } from '../server/cre-relay';
test('relay verifies wallet authorization, exact digest, expiry and deployed scope without a signing key',async()=>{
  const account=privateKeyToAccount(toHex(1n,{size:32})),subject='0x2222222222222222222222222222222222222222',workflowId='a'.repeat(64);
  const policy={owner:account.address,subject,workflowId};
  const r=triggerSigningRequest(workflowId,{eventId:'case-1',event:'recheck',subject},account.address,1000,'11111111-1111-4111-8111-111111111111');
  const signature=await account.signMessage({message:r.signingInput}),authorization=`Bearer ${finishTriggerJwt(r.signingInput,signature)}`;
  await validateSignedTrigger(r.body,authorization,1050,policy);
  await assert.rejects(()=>validateSignedTrigger(r.body,authorization,1301,policy),/expired/);
  await assert.rejects(()=>validateSignedTrigger(r.body.replace('case-1','case-2'),authorization,1050,policy),/digest/);
  await assert.rejects(()=>validateSignedTrigger(r.body,authorization,1050,{...policy,owner:subject}),/Only/);
  await assert.rejects(()=>validateSignedTrigger(r.body,authorization,1050,{...policy,workflowId:'b'.repeat(64)}),/deployed workflow/);
  await assert.rejects(()=>validateSignedTrigger(r.body,'',1050,policy),/Missing/);
});
