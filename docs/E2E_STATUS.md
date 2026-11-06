# End-to-end verification status

## ENS: real lifecycle in progress

Nine real receipts establish resolver/registry deployment, hierarchy attachment, subname registration, scoped delegation, an operator-signed record update, broad delegation, and key-only revocation. See [transaction evidence](transactions.md).

The final root permission is still active at the last audit. In AfterKey, Add discovered scopes & review offboarding â†’ Scan access paths â†’ review Contract-wide ENS roles survive â†’ sign the reviewed root revocation as owner â†’ Recheck live permissions â†’ Export evidence. Verify owner permissions, ownership and captured records are retained. Then prepare an operator update again and observe live authorization denial without sending another transaction.

## Uniswap: code implemented, asset lifecycle unverified

`src/engine.ts` reads the official Sepolia v3 position manager, discovers per-token and operator approvals, encodes their independent revocations, refreshes between transactions and compares position ownership. Current owner position count is zero and operator approval is absent. This proves an empty-wallet read, not successful position offboarding. A real Sepolia LP position, delegated management and signed revocation evidence remain necessary for the product demonstration.

## Chainlink CRE: verifier deployed, execution unverified

The CLI confirms workflow `006f1d09b1acf95154e601b9f7e0ebcdd1cbafecf26af76e336d581173c63f76` and deployment are ACTIVE. `lastExecutedAt` is null. The CRE source also passed its TypeScript typecheck during this audit. See [live status](cre-live-status.json).

The known configuration has no ENS targets. Export genuine ENS scope from AfterKey, update the configuration and redeploy before verifying this namespace. An authorized HTTP trigger and its real execution ID/result are still required. The current CRE workflow reads permissions and returns evidence; it does not sign owner revocations, replace an HR system, or publish an onchain attestation. The browser uses its own scanner and does not prove CRE execution by displaying a result.

## Publication

Source is pushed to GitHub; the repository remains private. The last checked hosted build has restricted owner-only access and does not automatically follow local edits. Publish the current build, configure judge access, and make source publicly accessible before claiming sponsor submission readiness.

No privileged-call or CRE simulations were run. No end-to-end completion is claimed until the corresponding real execution evidence exists.
