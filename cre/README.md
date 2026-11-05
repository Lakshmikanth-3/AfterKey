# AfterKey live CRE workflow

An authorized external HR/identity system sends a signed HTTP trigger carrying `{eventId, event: "departure" | "recheck", subject}`. The workflow independently reads Sepolia position approvals and configured ENSv2 permissions at one block, derives surviving paths and returns JSON evidence to the caller. The same `recheck` trigger is used after owner-approved revocations. It does not sign owner transactions or perform privileged-call simulations.

## Build and activate

1. `npm install` in this directory, then `npm run typecheck`.
2. Set the owner's public address, the authorized trigger signer's public address and exact ENS resources in `config.production.json`. Zero defaults deliberately prevent activation with an unintended identity.
3. Authenticate locally using `cre login`, confirm deployment access in your Chainlink account, and link the workflow owner using the official CLI flow. Do not paste private keys into chat or track credentials in Git.
4. Use `cre workflow build . --target production` and `cre workflow deploy . --target production` with your supported registry settings. Deployment requires the user's authenticated account, deployment eligibility and workflow owner setup. CLI may require Bun for TypeScript/WASM builds.
5. Configure your external system to invoke the returned workflow ID using Chainlink's signed HTTP trigger flow. The workflow accepts only signatures from `authorizedEVMAddress`.
6. Retain real execution IDs/output for the submission. No simulations or deployment claims are supplied in advance.

The workflow reads at most 20 positions and 10 ENS resources to bound execution cost. It returns `complete: false` when a portfolio exceeds its configured limit. RPC/view errors fail the workflow rather than returning a false clean result. Configured owner role snapshots are included in results so before/after owner checks can be compared. The browser app maintains its separate local scanner and is usable without CRE activation.

The return value is a workflow response, not an onchain attestation. CRE activation does not automatically create an HR system, notify another person, or publish a report onchain.

Dependency audit: the pinned CRE SDK 1.23.0 depends on Zod 3.25.76, which npm flags under GHSA-mrhx-c7xc-m3w5. A forced Zod 4 override is incompatible with the SDK's function schemas. The workflow limits incoming payloads to 16 KB and limits configured collections, but this does not resolve the upstream advisory. Review an upstream SDK fix before activating in a production environment. The independently built browser app does not depend on the CRE SDK or Zod.

References: [HTTP trigger configuration](https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/configuration-ts), [EVM view reads](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-read-ts), [deployment](https://docs.chain.link/cre/guides/operations/deploying-workflows/overview).
