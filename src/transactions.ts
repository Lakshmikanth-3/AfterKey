import { isAddressEqual, type Address, type Hash, type Hex, type TransactionReceipt } from 'viem';

export type ReviewedCall = { from: Address; to: Address; data: Hex; value?: bigint };
export type MinedCall = { hash: Hash; from: Address; to: Address | null; input: Hex; value: bigint; chainId?: number; blockNumber: bigint | null; blockHash: Hash | null };
export type ReceiptReader = {
  getChainId(): Promise<number>;
  waitForTransactionReceipt(args: { hash: Hash; confirmations: number }): Promise<TransactionReceipt>;
  getTransaction(args: { hash: Hash }): Promise<MinedCall>;
  getBlock(args: { blockNumber: bigint }): Promise<{ hash: Hash | null }>;
};

// A wallet cancellation or replacement can have a successful receipt. Only the
// exact reviewed call (including a gas-only speed-up) confirms this operation.
export function assertReviewedReceipt(expected: ReviewedCall, receipt: TransactionReceipt, transaction: MinedCall, canonicalHash: Hash | null): void {
  if (receipt.status !== 'success') throw new Error('Transaction reverted. Recheck live permissions before preparing another operation.');
  if (!canonicalHash || canonicalHash !== receipt.blockHash || transaction.blockHash !== receipt.blockHash || transaction.blockNumber !== receipt.blockNumber || transaction.hash !== receipt.transactionHash) {
    throw new Error('Transaction block is not canonical or receipt details disagree. Recheck the transaction before relying on it.');
  }
  if (transaction.chainId !== 11155111 || !isAddressEqual(transaction.from, expected.from) || !transaction.to || !isAddressEqual(transaction.to, expected.to) || transaction.input.toLowerCase() !== expected.data.toLowerCase() || transaction.value !== (expected.value ?? 0n)) {
    throw new Error('The mined transaction differs from the reviewed operation. It may have been cancelled or replaced. No operation success is claimed; recheck live state.');
  }
}

export async function waitForReviewedReceipt(client: ReceiptReader, hash: Hash, expected: ReviewedCall, onMined?: (receipt: TransactionReceipt) => void): Promise<TransactionReceipt> {
  if (await client.getChainId() !== 11155111) throw new Error('Receipt verification requires Ethereum Sepolia.');
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
  onMined?.(receipt);
  if (receipt.status !== 'success') throw new Error('Transaction reverted. Recheck live permissions before preparing another operation.');
  const [transaction, block] = await Promise.all([
    client.getTransaction({ hash: receipt.transactionHash }),
    client.getBlock({ blockNumber: receipt.blockNumber }),
  ]);
  assertReviewedReceipt(expected, receipt, transaction, block.hash);
  return receipt;
}
