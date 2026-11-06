import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Address, type Hash, type TransactionReceipt } from 'viem';
import { assertReviewedReceipt, waitForReviewedReceipt, type MinedCall, type ReviewedCall } from '../src/transactions';

const owner = '0x1111111111111111111111111111111111111111' as Address;
const manager = '0x2222222222222222222222222222222222222222' as Address;
const hash = `0x${'1'.repeat(64)}` as Hash, replacement = `0x${'2'.repeat(64)}` as Hash, blockHash = `0x${'3'.repeat(64)}` as Hash;
const expected: ReviewedCall = { from: owner, to: manager, data: '0x095ea7b3' };
const receipt = (transactionHash = hash) => ({ status: 'success', transactionHash, blockHash, blockNumber: 10n }) as TransactionReceipt;
const transaction = (txHash = hash): MinedCall => ({ hash: txHash, from: owner, to: manager, input: expected.data, value: 0n, chainId: 11155111, blockNumber: 10n, blockHash });

test('receipt verification accepts only the exact reviewed call, including gas-only replacements', async () => {
  assert.doesNotThrow(() => assertReviewedReceipt(expected, receipt(), transaction(), blockHash));
  const result = await waitForReviewedReceipt({
    getChainId: async () => 11155111,
    waitForTransactionReceipt: async () => receipt(replacement),
    getTransaction: async ({ hash: requested }) => { assert.equal(requested, replacement); return transaction(replacement); },
    getBlock: async () => ({ hash: blockHash }),
  }, hash, expected);
  assert.equal(result.transactionHash, replacement);
});

test('successful cancellation, altered calldata, recipient, sender, value and chain cannot confirm an operation', () => {
  for (const change of [{ to: owner, input: '0x' as const }, { input: '0xdeadbeef' as const }, { to: owner }, { from: manager }, { value: 1n }, { chainId: 1 }, { chainId: undefined }]) {
    assert.throws(() => assertReviewedReceipt(expected, receipt(), { ...transaction(), ...change }, blockHash), /differs/);
  }
});

test('reverted, orphaned and inconsistent receipts fail closed', () => {
  assert.throws(() => assertReviewedReceipt(expected, { ...receipt(), status: 'reverted' }, transaction(), blockHash), /reverted/);
  assert.throws(() => assertReviewedReceipt(expected, receipt(), transaction(), null), /canonical/);
  assert.throws(() => assertReviewedReceipt(expected, receipt(), { ...transaction(), blockNumber: 9n }, blockHash), /canonical/);
  assert.throws(() => assertReviewedReceipt(expected, receipt(), { ...transaction(), hash: replacement }, blockHash), /canonical/);
});
