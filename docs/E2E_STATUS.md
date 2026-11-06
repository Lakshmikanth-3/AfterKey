# End-to-end verification status

## ENS: configured offboarding verified

Ten real receipts establish namespace setup, scoped delegation, an operator-signed record update, broad delegation, key-only revocation and final root revocation. See [transaction evidence](transactions.md).

The independent verifier checked canonical before/after block hashes, historical roles and authorization, name ownership, expiry, resolver/subregistry pointers, ETH address, selected text value, record bundle and the actual revocation calldata/receipt. All 30 checks passed. Owner control and captured identity data were retained, with zero remaining findings in the configured ENS scope. See [final verification](ens-offboarding-verification.json).

The next user action is not another ENS grant or revoke. Save the export and move on to the real Uniswap position lifecycle and CRE execution phases. An optional operator preparation check can show the permission denial in the UI without submitting a transaction.

## Uniswap: position mints verified, operator lifecycle pending

The Uniswap workspace reads real position economics and offers individual/portfolio delegation and revocation, collection to the owner, and owner-reviewed withdrawal plus collection. Every operation checks its actor and current position state before signing. Offboarding compares ownership, pair, fee tier, range, liquidity and recorded owed tokens.

Positions **234145** and **234146** were minted successfully at blocks **12075338** and **12075343**. Each holds 1 USDC and 0.000038186831164543 WETH in the official Sepolia 0.3% full-range pool. Live ownership, mint events and canonical receipts passed four checks: [mint verification](uniswap-mint-verification.json).

The owner delegated position 234145 at block **12075485**. The operator successfully called `collect` to the owner at block **12075498**, collecting zero tokens; this proves authorized execution, not earnings. At block **12075512**, the owner enabled portfolio approval. Both NFTs retain their owner and liquidity. Individual and broad approval paths are now active: [operator receipt verification](uniswap-operator-verification.json). Narrow-only revocation, detection of surviving broad authority, complete offboarding and post-offboarding operator denial remain pending. See the [walkthrough](UNISWAP_CRE_RUNBOOK.md).

## Chainlink CRE: scheduled execution verified

The expanded workflow is ACTIVE: `00b083370fe2ae701fe30e89b363ba1e2071e3638e42bf8fc55c108ffd0420e5`. Its scheduled run `4a9f683b-50a0-4645-873d-d838400d21b6` succeeded at 05:20:11 UTC on November 6, 2026 (10:50:11 IST), reading Sepolia block `12074459`. Authenticated CLI status and complete, reconstructed logs passed all eight collector checks. See [execution proof](cre-execution-proof.json) and [deployment metadata](../cre/deployment.json).

The deployed configuration includes the actual four-resource ENS namespace and Uniswap scope. Its output shows no current access findings, complete configured reads, the owner's retained text-edit authority, and the unchanged public record. This run is a current snapshot; it does not claim before/after preservation without a baseline or claim signed Uniswap transactions.

Approval-event execution **e9a83e06-0f2c-463f-a26f-ab251c12eb53** succeeded after the portfolio grant. Its digest-verified output identifies the exact transaction and log index, reads block **12075512**, discovers both live position NFTs and reports the portfolio-wide and individual approval paths. Twelve checks compare the authenticated execution, configured scope, canonical receipt, block hash and detected permissions: [approval-event proof](cre-approval-event-proof.json).

Owner-signed HTTP requests, GitHub departure-case validation and historical before/after comparisons are implemented but still need their own live execution evidence. No labeled departure issue was found when checked. The workflow does not hold the owner key, sign revocations or publish an onchain attestation.

The first direct-read version failed the live 15-call quota. The revised version batches declared view calls, bounds payload size, and reconstructs digest-bound log chunks below the 1 KB line limit. No failed or truncated run was presented as complete proof.

## Validation

47 unit tests passed and the app production build passed after the block-read recovery fix. CRE typecheck/WASM build passed for the deployed source. Browser QA verified real portfolio discovery and delegation preparation. Both the development relay and built server rejected an unsigned request with HTTP 400; the built server served the app with HTTP 200. Tests cover exact request digests, signer/expiry/scope rejection, owner-bound recipients, withdrawal bounds, financial preservation, batched-read failures, log reconstruction limits and block availability retries. Unit fixtures do not stand in for live transaction receipts.

## Publication

Source is pushed in small feature commits. An unauthenticated GitHub API read confirmed that AfterKey is now public. The last hosted Sites build remains restricted and does not follow local edits. The new signed CRE relay requires server hosting (`npm run build` then `npm start`); a static-only upload cannot provide it. Update hosting and judge access before claiming a live public submission is ready.

No privileged-call or CRE simulations were run. ENS completion is scoped to its historical proof. CRE scheduled and approval-event monitoring, Uniswap mints, delegation and operator collection have real execution proof. Complete Uniswap offboarding and external-case / HTTP / before-after verification remain pending.
