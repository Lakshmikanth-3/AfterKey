# AfterKey live CRE orchestration

The workflow independently reads the deployed ENSv2 namespace and official Sepolia Uniswap v3 positions. It uses three genuine CRE trigger types:

| Trigger | Operation |
| --- | --- |
| Owner-signed HTTP | `recheck`: current access; `departure`: verify a real GitHub departure issue then inspect access; `verify`: read historical before/current after state and compare preserved assets |
| Cron | Recheck the configured operator every five minutes |
| EVM log | Recheck after the owner's Uniswap `Approval` / `ApprovalForAll` changes, with SAFE trigger confidence |

The GitHub case must be a completed issue in the configured public repository, labeled `afterkey-departure`, closed by the configured approver, and contain exactly one matching `AfterKey-Subject: 0x...` line. CRE's HTTP capability reads the GitHub API and reaches consensus on validated case fields. A browser-supplied issue description is not trusted as approval.

The workflow reports access and preservation. It holds no asset-owner signing key, executes no revocations and publishes no onchain attestation. Review and sign cleanup in the application. It does not automatically notify another person.

## Build and deploy

```sh
npm install
npm run typecheck
npm run build
cre workflow deploy . --target production
```

Use the authenticated CRE CLI session with deployment access. Private-registry deployment does not require the owner's wallet private key. Public addresses and configuration are in `config.production.json`; `deployment.json` records the actual workflow version. Update configuration and redeploy after changing the owner, monitored operator or scope. This deployment includes the actual four-resource `manager.eth` namespace.

The browser signs a five-minute EIP-191 authorization bound to recursively sorted JSON and its SHA-256 digest. A same-origin relay verifies signer, scope, expiry and body before forwarding to the fixed CRE gateway. No bearer token is saved or exported. The gateway does not provide browser CORS, so run the app with `npm run dev`, or build it and use `npm start` from the repository root. A static-files-only host cannot provide the relay route.

Gateway acceptance is not completion. Retrieve real execution status and output:

```sh
cre execution list afterkey-departure-verifier --output json
cre execution status <execution-id> --output json
cre execution logs <execution-id> --output json
# From the repository root:
npm run proof:cre -- <execution-id>
```

The collector checks authenticated CLI status, current deployment time, wallet pair and exact configured scope. Complete output is framed in log lines below 1 KB with a shared digest, reconstructed and checked before recording evidence. The app displays the saved execution observation, not a live health poll. Individual transaction signatures remain separate proof.

## Live limits

The deployed workflow's initial direct-read version hit the live 15-call quota and failed explicitly. Reads now use the canonical Sepolia Multicall3 deployment to batch **only declared view/pure functions**, with each request below the 5 KB payload limit. All required calls must succeed. Each snapshot is pinned to a single header block. Before/after verification uses independent snapshots and compares owner roles, identity values, position ownership, token pair, range, liquidity and recorded owed tokens.

The configured bound is ten positions (maximum configurable twenty) and ten ENS resources. Above the position bound, evidence is incomplete. Extremely large scopes, view arguments, evidence or quota errors stop execution; they cannot produce a clean report. The workflow is not a universal permission graph and does not enumerate old signed permits, unknown keys, other wallets or unrelated contracts. Its owner-preservation claims cover only captured state.

Pause recurring monitoring with `cre workflow pause . --target production`. No CRE or privileged-call simulations are used.

The pinned SDK 1.23.0's Zod 3 dependency has the previously documented GHSA-mrhx-c7xc-m3w5 advisory. Forcing Zod 4 breaks SDK schemas. Payload/configuration bounds reduce exposure but do not fix that upstream dependency. Browser builds do not import the CRE SDK or Zod.

See [the complete walkthrough](../docs/UNISWAP_CRE_RUNBOOK.md), [trigger authentication](https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/triggering-deployed-workflows), [service quotas](https://docs.chain.link/cre/service-quotas) and [Multicall3 deployments](https://github.com/mds1/multicall3/blob/main/deployments.json).
