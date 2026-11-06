import { createPublicClient, createTransport, fallback, http, type Transport } from 'viem';
import { sepolia } from 'viem/chains';

export const DEFAULT_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const blockReads = new Set(['eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_call', 'eth_getCode']);
const blockLookups = new Set(['eth_getBlockByNumber', 'eth_getBlockByHash']);
export const BLOCK_READ_MESSAGE = 'The Sepolia RPC cannot serve this block yet. Please try the read again in a moment.';

class BlockUnavailableError extends Error {
  constructor() { super(BLOCK_READ_MESSAGE); this.name = 'BlockUnavailableError'; }
}

export function isBlockUnavailable(error: unknown): boolean {
  const seen = new Set<unknown>();
  for (let e = error, depth = 0; e && typeof e === 'object' && depth < 12 && !seen.has(e); depth++) {
    seen.add(e);
    const item = e as { name?: string; message?: string; shortMessage?: string; details?: string; cause?: unknown };
    if (item.name === 'BlockUnavailableError' || item.name === 'BlockNotFoundError') return true;
    const text = [item.message, item.shortMessage, item.details].filter(Boolean).join(' ');
    if (/\b(header not found|unknown block|block not found)\b/i.test(text)
      || /\bblock\b[^\n]{0,100}\b(could not be found|not available|not yet available)\b/i.test(text)) return true;
    e = item.cause;
  }
  return false;
}

// Retry the exact read, including its block parameter. Never retry wallet writes,
// replace a pinned block with "latest", or interpret a pending receipt as an error.
export function blockAwareTransport(transport: Transport, retryDelay = 350): Transport {
  return options => {
    const inner = transport(options);
    return createTransport({
      key: 'block-aware', name: 'Block-aware RPC', type: 'block-aware', retryCount: 0,
      request: (async (args, requestOptions) => {
        for (let attempt = 0; ; attempt++) {
          try {
            const result = await inner.request(args, requestOptions);
            // JSON-RPC can return null without an RPC error. Fallback otherwise
            // treats that as success, and viem throws only after fallback finishes.
            if (result === null && blockLookups.has(args.method)) throw new BlockUnavailableError();
            return result;
          } catch (error) {
            if (!blockReads.has(args.method) || !isBlockUnavailable(error) || attempt >= 3) throw error;
            await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          }
        }
      }) as typeof inner.request,
    });
  };
}

export const clientFor = (rpc: string) => createPublicClient({
  chain: sepolia,
  transport: rpc === DEFAULT_RPC
    ? fallback([
      blockAwareTransport(http(DEFAULT_RPC, { timeout: 15000, retryCount: 0 })),
      blockAwareTransport(http(sepolia.rpcUrls.default.http[0], { timeout: 15000, retryCount: 0 })),
    ], { retryCount: 0 })
    : blockAwareTransport(http(rpc, { timeout: 20000, retryCount: 1 })),
});
