# End-to-end verification status

## ENS: configured offboarding verified

Ten real receipts establish namespace setup, scoped delegation, an operator-signed record update, broad delegation, key-only revocation and final root revocation. See [transaction evidence](transactions.md).

The independent verifier checked canonical before/after block hashes, historical roles and authorization, name ownership, expiry, resolver/subregistry pointers, ETH address, selected text value, record bundle and the actual revocation calldata/receipt. All 30 checks passed. Owner control and captured identity data were retained, with zero remaining findings in the configured ENS scope. See [final verification](ens-offboarding-verification.json).

The next user action is not another ENS grant or revoke. Save the export and move on to the real Uniswap position lifecycle and CRE execution phases. An optional operator preparation check can show the permission denial in the UI without submitting a transaction.

## Uniswap: code implemented, asset lifecycle unverified

`src/engine.ts` reads the official Sepolia v3 position manager, discovers per-token and operator approvals, encodes their independent revocations, refreshes between transactions and compares position ownership. Current owner position count is zero and operator approval is absent. This proves an empty-wallet read, not successful position offboarding. A real Sepolia LP position, delegated management and signed revocation evidence remain necessary for the product demonstration.

## Chainlink CRE: verifier deployed, execution unverified

The CLI confirms workflow `006f1d09b1acf95154e601b9f7e0ebcdd1cbafecf26af76e336d581173c63f76` and deployment are ACTIVE. `lastExecutedAt` is null. The CRE source also passed its TypeScript typecheck during this audit. See [live status](cre-live-status.json).

The known configuration has no ENS targets. Export genuine ENS scope from AfterKey, update the configuration and redeploy before verifying this namespace. An authorized HTTP trigger and its real execution ID/result are still required. The current CRE workflow reads permissions and returns evidence; it does not sign owner revocations, replace an HR system, or publish an onchain attestation. The browser uses its own scanner and does not prove CRE execution by displaying a result.

## Publication

Source is pushed to GitHub; the repository remains private. The last checked hosted build has restricted owner-only access and does not automatically follow local edits. Publish the current build, configure judge access, and make source publicly accessible before claiming sponsor submission readiness.

No privileged-call or CRE simulations were run. ENS completion is limited to the verified configured scopes. No Uniswap or CRE end-to-end completion is claimed without their corresponding real execution evidence.
