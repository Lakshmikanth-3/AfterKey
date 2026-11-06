import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublicClient, custom, fallback, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import { blockAwareTransport, isBlockUnavailable, BLOCK_READ_MESSAGE } from '../src/rpc';
import { errorText } from '../src/engine';

test('a null block header is retried at the same number before public fallback', async () => {
  const requests: unknown[] = [];
  let fallbackCalls = 0;
  const primary = blockAwareTransport(custom({ request: async args => { requests.push(args); return null; } }, { retryCount: 0 }), 0);
  const backup = blockAwareTransport(custom({ request: async args => { fallbackCalls++; return { number: '0xb84199', hash: `0x${'1'.repeat(64)}`, transactions: [], timestamp: '0x1' }; } }, { retryCount: 0 }), 0);
  const client = createPublicClient({ chain: sepolia, transport: fallback([primary, backup], { retryCount: 0 }) });
  const header = await client.getBlock({ blockNumber: 12075417n });
  assert.equal(header.number, 12075417n);
  assert.equal(requests.length, 4);
  assert.equal(fallbackCalls, 1);
  for (const request of requests) assert.deepEqual(request, { method: 'eth_getBlockByNumber', params: ['0xb84199', false] });
});

test('lagging contract reads retry the original pinned block and return actual response', async () => {
  const requests: any[] = [];
  const client = createPublicClient({ chain: sepolia, transport: blockAwareTransport(custom({ request: async args => {
    requests.push(args);
    if (requests.length < 3) throw { code: -32000, message: 'header not found' };
    return `0x${'0'.repeat(63)}2`;
  } }, { retryCount: 0 }), 0) });
  const count = await client.readContract({ address: '0x1238536071E1c677A632429e3655c799b22cDA52', abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: ['0x1111111111111111111111111111111111111111'], blockNumber: 12075417n });
  assert.equal(count, 2n);
  assert.equal(requests.length, 3);
  for (const request of requests) assert.deepEqual(request, requests[0]);
  assert.equal(requests[0].params[1], '0xb84199');
});

test('unavailable blocks stop after bounded retries with readable guidance', async () => {
  let calls = 0;
  const client = createPublicClient({ chain: sepolia, transport: blockAwareTransport(custom({ request: async () => { calls++; return null; } }, { retryCount: 0 }), 0) });
  await assert.rejects(client.getBlock({ blockNumber: 12075417n }), error => {
    assert.equal(errorText(error), BLOCK_READ_MESSAGE);
    return true;
  });
  assert.equal(calls, 4);
  assert.equal(isBlockUnavailable({ cause: { message: 'Block at number "12075417" could not be found.' } }), true);
});

test('permission reverts, unrelated failures, writes and pending receipts are not retried', async () => {
  for (const [method, message] of [['eth_call', 'execution reverted: unauthorized'], ['eth_call', 'network offline'], ['eth_sendRawTransaction', 'header not found']]) {
    let calls = 0;
    const transport = blockAwareTransport(custom({ request: async () => { calls++; throw { code: -32000, message }; } }, { retryCount: 0 }), 0)({ chain: sepolia });
    await assert.rejects(transport.request({ method, params: [] } as never));
    assert.equal(calls, 1);
  }
  let calls = 0;
  const transport = blockAwareTransport(custom({ request: async () => { calls++; return null; } }, { retryCount: 0 }), 0)({ chain: sepolia });
  assert.equal(await transport.request({ method: 'eth_getTransactionReceipt', params: [`0x${'0'.repeat(64)}`] }), null);
  assert.equal(calls, 1);
});
