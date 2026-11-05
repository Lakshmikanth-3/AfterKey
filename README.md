# AfterKey

**Offboard the operator. Keep the ENS identity.**

AfterKey discovers surviving ENSv2 permissions for a departing wallet, prepares owner-reviewed revocations, and rereads live authorization state after confirmation. The default workflow centers ENSv2 registry hierarchy, Enhanced Access Control and Permissioned Resolvers. Uniswap v3 position approvals are an optional additional scope.

Live application: https://afterkey-access.resplendentflair1.chatgpt.site — currently owner-private. Judge-accessible sharing must be arranged before submission. The requested GitHub URL, https://github.com/Lakshmikanth-3/AfterKey, returned 404 when checked; public source access is not yet verified.

## Why ENSv2 is central

Removing a text-key permission from a Permissioned Resolver does not remove a corresponding resolver-wide role. AfterKey checks both scopes, distinguishes ordinary and admin roles, and shows effective authority through `hasRoles`. It also checks registry roles that can redirect identity and ERC-1155 operator approval. The identity, its record values and its owner remain visible while the departing wallet's known access paths are removed.

See [the ENS qualification review](docs/ENS_QUALIFICATION_REVIEW.md) for the prize mapping, technical limitations and demo narrative. Qualification still requires live user-owned namespace/transaction evidence and publicly accessible submission links.

## Run

Node.js 22+ is required. A browser wallet on Sepolia is required for signing.

```sh
npm install
npm run dev
npm test
npm run build
npm run verify:ens
```

`verify:ens` performs ordinary view reads on real Sepolia deployments. It does not send transactions or attempt privileged writes. Its default target is the public `.eth` registry entry, not a namespace owned by this project. Optionally pass a real name with `npm run verify:ens -- your-name.eth`. Set `SEPOLIA_RPC_URL` in the environment to use a different RPC.

## Live ENS setup

1. Fund the configured owner with Sepolia test ETH using the faucet linked in the app.
2. Register a Sepolia `.eth` name through https://sepolia.app.ens.domains/ and retain ownership in the configured owner wallet.
3. Open **ENS identity** and enter that parent in the setup section. Choose an operator label and text key.
4. Prepare, review and sign each step. The flow uses the official ENS Verifiable Factory, Permissioned Resolver implementation and User Registry implementation. It reuses suitable existing infrastructure and stops instead of replacing an existing nonzero subregistry or another resolver.
5. The flow initializes the operator subname's ETH address and text profile, connects the canonical parent, and registers the subname. A new subname gets a one-year expiry. Registration is an actual onchain operation; no name is invented by the UI.
6. Optionally delegate the text key to the departing wallet. A separate opt-in broad test grant creates the residual-access demo on Sepolia. It grants an ordinary text role, never admin rights.
7. Revoke only the key role in the explicit demo and read the effective permission again. If a root role survives, `hasRoles` remains true.
8. Add discovered scopes to Offboarding, review the complete plan and sign broad-first revocations. The app refreshes permissions between transactions and rereads owner/name state.
9. Export the evidence, including block/hash, configured resources, role state and real transaction links.

Wallet pair supplied by the user:

- Owner: `0x2cE812CF03d1F252C940aFf954E15D5E49bBedd5`
- Departing operator: `0x22225204824EdF00b3c8c32A43f1C04246e2d1b4`

The public addresses are defaults and do not authorize the application to sign. No seed phrases or private keys are requested or stored. The browser wallet must match the configured owner and Sepolia network. The embedded preview may not provide a wallet extension; use a wallet-enabled browser for signing.

## ENS implementation

| File | Purpose |
| --- | --- |
| `src/ens/deployments.json` | Official Sepolia addresses and observed runtime-code hashes, pinned to the deployment-linked ENS revision |
| `src/ens/abi.ts` | Version-matched EAC, registry, resolver and factory ABI subsets |
| `src/ens/roles.ts` | Current role constants, ordinary/admin labels and exact resolver resource calculation |
| `src/ens/protocol.ts` | Live hierarchy/profile discovery, canonical resources, deployment checks and reviewed setup transactions |
| `src/ens/ui.ts` | ENS-first identity audit, setup, explicit delegation demo and evidence export |
| `src/engine.ts` | Permission scans, residual paths, ordering, per-block read caching and owner-preservation checks |
| `src/main.ts` | Wallet connection, calldata review, receipt tracking and verification |
| `tests/ens.test.ts` | Resource/role/grant/deployment-event and ownership invariants |

Protocol constants are not fabricated user state. Actual names, profiles, owners, current resources, permission bitmaps and transaction evidence are read from chain. Source revision: `07e55a056f5b6a9c90119f501bdd05714e67dddd`, linked from ENS's [deployment table](https://docs.ens.domains/learn/deployments/). Code/interface checks detect deployment-version drift; they are not an audit of arbitrary custom implementations.

Resolver text/data resources depend on the key alone. Coin/content resources depend on the ABI-encoded uint256. Interface resources depend on four packed bytes. A key-scoped role can affect that key across every name served by a resolver; it is not name-scoped. Registry resources come from `getResource` so current registration versions are respected. Token IDs can change during role updates; owner checks use the current resource and name owner.

Registry and resolver permissions are separate. A registry root role does not automatically confer a role on another resolver, although certain registry roles can redirect a name/subregistry. Regular roles are distinct from ADMIN roles controlling granting/revoking.

## Optional Uniswap integration

Sepolia NonfungiblePositionManager: `0x1238536071E1c677A632429e3655c799b22cDA52`, from [Uniswap's deployment documentation](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments).

Enable **Include Uniswap v3** to enumerate up to 200 owner positions and check `getApproved` plus `isApprovedForAll`. Writes are `approve(address(0), tokenId)` and `setApprovalForAll(operator, false)`. Operator approval is checked even with zero current positions. This optional scope does not gate ENS-only scanning.

## CRE

An authorized external system submits a signed departure/recheck event to the CRE workflow. See `cre/README.md` and `cre/deployment.json` for registered deployment details. New source supports ENS interface/current-resource/owner checks and optional Uniswap; compile with `cre workflow build . --target production` from `cre/`. Export configured ENS targets and redeploy when the namespace/scope changes. Do not claim a prior empty ENS deployment scope covers a newly configured namespace.

Registration is not proof of trigger execution. No successful live CRE execution or wallet-signed revocation is claimed before real evidence exists. No CRE or privileged-call simulations are included.

## Evidence, limits and submission

- Sepolia only; not an audited production security product.
- A closed result means no modeled path was found in the configured scope at that block. Other wallets, signed permits, unknown contracts, social recovery and unconfigured resources are outside coverage.
- Reads are cached only within one block snapshot. Incomplete reads and empty protocol scope cannot produce a closed result.
- The default public RPC falls back to viem's Sepolia default endpoint on provider failures, with reads pinned to the requested block. A custom RPC is used exclusively, without that fallback.
- Transactions are signed individually. Broad-first execution is not atomic and does not eliminate mempool races.
- Owner checks compare recorded EAC roles, known record authorization and name/NFT ownership; they do not execute arbitrary owner actions.
- Setup records and up to 20 reports remain in browser storage. Exported scope/evidence excludes the RPC URL. No server database is used.
- Public source access, judge demo sharing, showcase submission and real signed transaction evidence remain submission tasks.

The appropriate ENS prize for this from-scratch Sepolia project is **Best Use of ENSv2**. The Continuity-only Existing Project prize is separate and requires mainnet under the supplied rules. Adding every feature in the sponsor brief is not necessary.

See `docs/AI_ATTRIBUTION.md`, `docs/VALIDATION.md`, `docs/DEMO.md`, `docs/transactions.md` and `FEEDBACK.md`. Verify sponsor rules against the current event page before submitting. MIT license; public availability is a separate requirement.


ENS resource decisions, agent-record support, live network evidence, and setup steps: [ENS_RESOURCES.md](docs/ENS_RESOURCES.md).
