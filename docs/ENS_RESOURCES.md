# ENS resource integration

AfterKey’s use case is offboarding an operator or agent while retaining the team’s ENS identity. Removing a text-key grant can leave a resolver-wide grant active. AfterKey inspects both and orders broad revocations before scoped cleanup. ENSv2 permissions are central to that operation.

## Resource decisions

| Official resource | How AfterKey uses it | Boundary / reason |
| --- | --- | --- |
| [ENSv2 overview](https://docs.ens.domains/ensv2/overview/) | Hierarchical namespace discovery and separate registry/resolver permission scopes. | A human-readable label by itself is insufficient for this product. |
| [App developer guide](https://docs.ens.domains/ensv2/tutorial-app-developers/) | Normalized names and viem’s Universal Resolver read APIs for cross-version address/text resolution. Writes target the actual supported Permissioned Resolver. | Mainnet profiles are read only; owner-signed setup and revocations run on Sepolia. |
| [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/) | Live hierarchy traversal, current resource IDs, owner/expiry checks, optional owner-controlled subname registry setup. | Never replaces an existing nonzero subregistry automatically. |
| [Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/) | Official factory deployment, text-key scoped delegation, resolver-wide roles, record authorization checks. | Permission scope can cover several names served by one resolver. |
| [Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control/) | Root and local role discovery, effective authorization, revocation, owner-permission comparison. | Unknown deployments / incomplete reads do not establish closure. |
| [Contract developer guide](https://docs.ens.domains/ensv2/tutorial-contract-developers/) | Official ABI, factory initialization, deployment runtime-hash validation. | Pinned deployment-linked contracts at `07e55a056f5b6a9c90119f501bdd05714e67dddd`, rather than assuming any source branch matches live contracts. |
| [Agent Text Records / ENSIP-26](https://docs.ens.domains/ensip/26/) | Agent Records tab reads `agent-context` and `agent-endpoint[mcp]`, `[a2a]`, `[web]` at a recorded block. Exportable results distinguish absent records from errors. | Draft standard. Published text is displayed as untrusted data. No endpoint is fabricated or automatically contacted. |
| [AI Agent Registry ENS Name Verification / ENSIP-25](https://docs.ens.domains/ensip/25/) | Parameterized registry attestation lookup with ERC-7930 registry encoding. Any nonempty value counts as the name owner’s attestation. | Draft standard. Requires a real registry chain/address and agent ID. This lookup alone does not independently verify an ERC-8004 registration, ownership of its NFT, reputation, or service safety. |
| [Agent-native CLI](https://github.com/ensdomains/ens-cli) | Independent developer verification using pinned checkout `0d07eaee185a0e7efe2bf1a634f8939c59a1cf79`. Mainnet and Sepolia results checked against the supplied name. | Official project labels it experimental and not production-ready. It is not bundled into the browser or used to hold signing keys. |
| [Building with AI](https://docs.ens.domains/building-with-ai/) | Used the linked machine-readable documentation entry point, [llms.txt](https://docs.ens.domains/llms.txt), for protocol discovery. | Development guidance, not a runtime feature. An additional MCP server or autonomous agent is not necessary to revoke permissions. |

## Supplied reference name

Read-only checks on 6 November 2026 confirmed:

- Ethereum mainnet: `sepolia-testnet.eth` resolves to `0x99920488E2cA7EDDFc8dC127Dd8067284dFA4a83`.
- Ethereum Sepolia: canonical address lookup returns null; current ENSv2 hierarchy reports the name unregistered.
- A resolved address does not prove name ownership. “Sepolia” in the label does not select the network. The configured workspace owner remains `0x2cE812CF03d1F252C940aFf954E15D5E49bBedd5`.

Repeat the actual read checks with `npx tsx scripts/verify-agent-records.ts`. Evidence is saved in `docs/ens-agent-live-read-check.json`; timestamps and block numbers identify the observation, not a permanent state guarantee.

For an independent CLI check, in the separate pinned official CLI checkout, install its lockfile dependencies with `bun install --frozen-lockfile`, then run:

```powershell
bun src/index.ts get address sepolia-testnet.eth --chain mainnet --json
bun src/index.ts get address sepolia-testnet.eth --chain sepolia --json
```

These commands only read public chain state. No privileged-call simulations, transactions, or CLI feedback submissions are needed.

## Finish a real Sepolia namespace

1. Select your configured owner account in MetaMask, ending `Bedd5`.
2. Enable test networks and choose Ethereum Sepolia. Obtain Sepolia ETH from a faucet if needed.
3. Open [the official Sepolia ENS app](https://sepolia.app.ens.domains/), connect that owner, and register an available name. Complete the commitment/wait/registration steps shown by the app.
4. In AfterKey → ENS identity → Set up namespace, enter the owned Sepolia name. Review the live ownership check and each proposed transaction; sign each step in your wallet.
5. Delegate the operator’s text-key permission. Audit the resulting identity and review the offboarding plan. After each revocation, recheck the live roles and retained owner permissions; export transaction evidence.
6. To demonstrate ENSIP-26, enter `agent-context` or an `agent-endpoint[...]` key and its actual initial value during setup (or publish through the name’s resolver editor). Use that exact text key for scoped offboarding. To exercise ENSIP-25, use a real registry registration and its exact attestation key. Neither is prefilled with invented services or registrations.

## Submission status

The Best Use of ENSv2 technical gates are now demonstrated on Sepolia: signed setup/grant/update/revoke receipts, preserved identity evidence, a public live demo and public source are available. The separate Existing Project Continuity prize still requires mainnet integration and track eligibility. The participant must still attach the final demo video, select the ENS prize and submit the ETHGlobal showcase entry.

See [ENS_SECURITY_REVIEW.md](ENS_SECURITY_REVIEW.md) for the resource-driven code review and [ens-live-read-check.json](ens-live-read-check.json) for current factory, hierarchy and permission evidence.
