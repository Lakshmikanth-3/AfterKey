import { parseUnits, type Address } from 'viem';

export type TokenPresentation = { symbol: string; decimals: number | null };

// ERC-20 presentation methods are optional. Their failure must not prevent
// emergency permission revocation; an unknown decimal count is never invented.
export async function readTokenPresentation(address: Address, read: (field: 'symbol' | 'decimals') => Promise<unknown>): Promise<TokenPresentation> {
  const [symbol, decimals] = await Promise.allSettled([read('symbol'), read('decimals')]);
  const value = decimals.status === 'fulfilled' ? decimals.value : null;
  return {
    symbol: symbol.status === 'fulfilled' && typeof symbol.value === 'string' && symbol.value.trim() ? symbol.value.slice(0, 64) : `${address.slice(0, 6)}…${address.slice(-4)}`,
    decimals: typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255 ? value : null,
  };
}

export function parseTokenMinimum(value: string, decimals: number | null, label: string): bigint {
  if (decimals === null || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error(`${label}: token decimals are unavailable. Withdrawal cannot be prepared.`);
  const amount = value.trim() || '0';
  if (amount.length > 512 || !/^\d+(?:\.\d+)?$/.test(amount)) throw new Error(`${label}: enter a nonnegative decimal amount.`);
  if ((amount.split('.')[1]?.length ?? 0) > decimals) throw new Error(`${label}: use at most ${decimals} decimal places. Minimums are never rounded.`);
  const units = parseUnits(amount, decimals);
  if (units > 2n ** 256n - 1n) throw new Error(`${label}: amount exceeds uint256.`);
  return units;
}
