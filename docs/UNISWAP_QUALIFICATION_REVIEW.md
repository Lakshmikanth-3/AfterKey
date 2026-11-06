# Uniswap qualification review

Target the general **Build with Uniswap** prize. The [official rules](https://ethglobal.com/events/mumbai/prizes/uniswap-foundation) permit v3 integrations. An API key, swap, v4 hook, CCA or Unichain deployment is not additionally required. Continuity Track eligibility is not established.

| Requirement | Current evidence / gap |
| --- | --- |
| Integrate the Uniswap stack | Official Sepolia v3 NonfungiblePositionManager; real NFTs 234145/234146, permission management, collect and optional atomic withdrawal. New ENS/CRE release consumers enforce operator, epoch and fixed treasury. |
| Public open-source repository | GitHub connection previously confirmed public and MIT; current local changes still need small commits and publishing. |
| FEEDBACK.md | Present at repository root with the public GitHub URL. |
| Developer feedback form includes FEEDBACK.md link | FEEDBACK.md records authorized submission; saved screenshot confirms successful form submission. The screenshot alone cannot prove individual submitted field values; no form receipt API is available here. |
| README points to integration contracts and code lines | Added current source table for manager, gate authorization, consumer collection, owner recovery and event verification. Recheck anchors after future edits. |
| Functional demo | Historical direct-manager flow has live receipts. New consumer setup and custody are live, but activation and both collections remain pending. Publish the current code/demo after proof. |

## Live state

[Read-only readiness](uniswap-release-readiness.json) at block 12079919 confirms both NFTs have nonzero liquidity, the USDC/WETH pair, fee tier 3000, and custody in their two registered replacement consumers. Recorded owed amounts are zero; they are not a full estimate of uncollected fees. Position-manager collect events determine the actual amounts.

## Fixes from this review

- Match the official manager Collect event to the expected NFT and owner recipient.
- Match the consumer Collected event to active digest/epoch and the exact raw token amounts.
- Reject absent, duplicated, forged-source or mismatched collection events.
- Report zero collection honestly as execution without token income.
- Add an independent CLI verifier for the exact mined collect call, canonical receipt, compiled consumer runtime, configured gate/manager, signer/treasury and adjacent-block NFT/principal/range preservation.

Run `node --import tsx scripts/verify-release-collection.ts <transaction-hash>` after each real new consumer collection. This does not send a transaction.

## Limits

The consumer collects owed tokens, potentially including principal removed before deposit; it does not classify every token as fee income. Direct-manager ERC-721 approvals permit transfers; use of the collect-only consumer avoids granting those approvals to the operator but requires NFT custody in that contract. Owner recovery is trusted. Unauthorized NFTs sent with unsafe transferFrom can be trapped; use the reviewed safeTransferFrom path. No new arbitrary-token rescue authority was added to deployed contracts. Price returns, agent intelligence, universal ENS dependency discovery and CCIP/v4 hooks are not claimed.

Official references: [v3 collection](https://developers.uniswap.org/docs/protocols/v3/guides/managing-liquidity/collect-fees), [developer docs](https://developers.uniswap.org/docs), [AI skills](https://www.skills.sh/uniswap/uniswap-ai), [feedback form](https://developers.uniswap.org/hackathon-feedback).
