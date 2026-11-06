# Validation record

This page describes the current implementation. Earlier empty-wallet checks and initial deployment results remain available in Git history; they do not override the later evidence below.

## Local checks

- `npm test`: **43 tests passed**. Coverage includes independent approval paths, ENS EAC scopes, owner/identity preservation, withdrawal bounds, owner-bound collection recipients, wallet discovery, request-signature validation, expiry and digest rejection, view-batch bounds and evidence-log framing.
- `npm run build`: TypeScript and Vite production build passed after the Sepolia setup guidance was added.
- `npm run typecheck` in `cre/`: passed for the deployed workflow source.
- The deployed CRE source compiled to WASM. Its recorded binary/configuration hashes are in [deployment metadata](../cre/deployment.json).
- Browser inspection verified the position workspace, real empty-portfolio discovery, exact CRE request preparation and recorded execution status. Browser preparation did not sign a wallet transaction.
- Both the development relay and built server rejected an unsigned local request with HTTP 400. The built server served the application with HTTP 200.

Unit fixtures test policy and encoding. They are not blockchain execution proof. No privileged-call or CRE simulations were used.

## ENS live proof

The real workspace is `treasury-agent.manager.eth` on Sepolia. Ten successful receipts cover namespace setup, scoped delegation, an operator-signed text update, broad delegation, key-only revocation and final broad-role revocation.

The independent verifier checked 30 conditions against historical state and the actual final transaction. Between blocks **12074041** and **12074046**, the operator lost effective text-edit authority while the captured owner permissions, ownership, expiry, identity pointers, ETH address, record bundle and selected text value were retained.

Evidence: [transaction receipts](transactions.md), [historical verification](ens-offboarding-verification.json).

## Chainlink live proof

Workflow `00b083370fe2ae701fe30e89b363ba1e2071e3638e42bf8fc55c108ffd0420e5` was deployed ACTIVE with the actual four ENS resources and Uniswap scope. Scheduled execution `4a9f683b-50a0-4645-873d-d838400d21b6` succeeded at **10:50:11 IST on November 6, 2026**, reading Sepolia block **12074459**.

The collector authenticated through the local CRE CLI, reconstructed digest-bound output from bounded log chunks, and passed eight checks for successful execution, current deployment, agreeing output, wallet pair and configured scope. The recorded result found no remaining modeled access in that scope.

Evidence: [execution output and checks](cre-execution-proof.json), [deployment](../cre/deployment.json), [status](cre-live-status.json).

This scheduled snapshot does not prove external-case validation, HTTP authorization, approval-event execution, a historical comparison or a signed Uniswap operation. Each needs its own execution/receipt evidence.

## Remaining live and submission checks

| Check | Next evidence |
| --- | --- |
| User-owned Uniswap lifecycle | Create a real Sepolia v3 position; retain delegation, management and revocation receipts |
| GitHub departure case | Completed, labeled issue and successful owner-authorized CRE execution |
| Approval-event trigger | Real approval transaction plus matching CRE execution reference |
| CRE before/after comparison | Successful verification request with a genuine baseline block |
| Hosted demo | Deploy the app with its relay server and verify judge access; a static-only build cannot provide the relay |
| Uniswap submission form | Submit the public FEEDBACK.md link and retain confirmation |

The repository is public and MIT-licensed. Source access, tests, receipts and hosted-demo access are separate facts. See [the current E2E status](E2E_STATUS.md) and [runbook](UNISWAP_CRE_RUNBOOK.md).
