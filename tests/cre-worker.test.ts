import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { toHex } from 'viem';
import { triggerSigningRequest, finishTriggerJwt, CRE_GATEWAY } from '../src/cre/auth';
import { relayRequest } from '../server/cre-worker';

test('hosted relay verifies the owner and forwards the exact signed request once', async () => {
  const account = privateKeyToAccount(toHex(1n, { size: 32 }));
  const policy = { owner: account.address, subject: '0x2222222222222222222222222222222222222222', workflowId: 'a'.repeat(64) };
  const prepared = triggerSigningRequest(policy.workflowId, { eventId: 'unit-policy', event: 'recheck', subject: policy.subject }, account.address, 1000, '11111111-1111-4111-8111-111111111111');
  const authorization = `Bearer ${finishTriggerJwt(prepared.signingInput, await account.signMessage({ message: prepared.signingInput }))}`;
  let calls = 0;
  const forward: typeof fetch = async (url, init) => {
    calls++; assert.equal(url, CRE_GATEWAY); assert.equal(init?.body, prepared.body);
    assert.equal(new Headers(init?.headers).get('authorization'), authorization);
    return Response.json({ id: prepared.requestId, result: { status: 'ACCEPTED' } });
  };
  const request = (body: string) => new Request('https://afterkey.test/api/cre-trigger', { method: 'POST', headers: { Authorization: authorization }, body });
  const response = await relayRequest(request(prepared.body), { policy, now: 1050, forward });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls, 1);
  assert.equal((await relayRequest(request(prepared.body.replace('unit-policy', 'changed')), { policy, now: 1050, forward })).status, 400);
  assert.equal((await relayRequest(request(prepared.body), { policy, now: 1400, forward })).status, 400);
  assert.equal(calls, 1);
});

test('hosted relay rejects wrong methods and oversized streamed input before forwarding', async () => {
  let calls = 0;
  const forward: typeof fetch = async () => { calls++; throw new Error('Should not forward'); };
  assert.equal((await relayRequest(new Request('https://afterkey.test/api/cre-trigger'), { forward })).status, 405);
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(9000)); controller.enqueue(new Uint8Array(9000)); controller.close(); } });
  const request = new Request('https://afterkey.test/api/cre-trigger', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
  const response = await relayRequest(request, { forward });
  assert.equal(response.status, 400); assert.match(await response.text(), /exceeds 16000/);
  assert.equal(calls, 0);
});
