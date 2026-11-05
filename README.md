# AfterKey

AfterKey checks whether a departing wallet retains approvals or roles, prepares owner-reviewed revocations, and rereads live permission state after transaction confirmation.

## Scope and current behavior

- Ethereum Sepolia only (chain ID 11155111).
- Official Uniswap v3 NonfungiblePositionManager: `0x1238536071E1c677A632429e3655c799b22cDA52`.
- Enumerates up to 200 owner positions and checks individual NFT approvals plus portfolio-wide operator approval. Operator approval is checked even if the owner currently holds zero positions.
- ENSv2 EAC contracts/resources are explicitly configured. Scans root roles and resource roles separately, and registry ERC-1155 operator approval where applicable. Requires verified owner admin roles before offering EAC revocation.
- Broad permissions precede narrow cleanups. Every transaction is signed individually in the owner's browser wallet. Sequential execution is not atomic and does not eliminate mempool races.
- Confirms receipts, stops after a failed transaction or owner-state regression, and records a final permission-state report.
- **No privileged-call simulations, dry runs, fake findings, or fabricated transactions.** `eth_call` is used only for ordinary view-function reads of permissions and ownership, not for attempting privileged actions.
- Owner checks compare NFT ownership and recorded ENS role bitmaps. These are state checks, not a guarantee that all owner actions remain possible.

## Run locally

Requires Node.js 22+ and an Ethereum browser wallet to sign transactions.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite. Build with `npm run build`; run deterministic engine tests with `npm test`.

## New setup

1. Open **Setup & connections** and connect the owner browser-wallet account.
2. Enable Sepolia in the wallet and obtain test ETH using the linked faucet.
3. Use a second wallet account as the departing operator. Only public addresses go into AfterKey.
4. If needed, create Uniswap v3 liquidity positions on Sepolia through Uniswap. Test token funding and position minting happen in the external Uniswap interface; AfterKey does not mint positions.
5. To demonstrate incomplete revocation with test assets, the owner can grant both NFT approval and operator approval on the official contract, then remove only the individual approval. AfterKey will still detect operator approval. Do this only with intended Sepolia test positions. Setup grants are not performed automatically.
6. Optional ENS: deploy/use genuine ENSv2 contracts using the official contract-developer guide; add the deployed registry/resolver address and exact nonzero resource ID. Add each resource to scan. Root roles are automatically inspected for each address. The application does not deploy ENS contracts or invent names/resources.
7. Enter the owner and departing wallet on Offboarding and scan. Inspect findings and calldata, select paths, acknowledge review, then sign each revocation in your wallet.
8. Recheck or export the report. Verify the recorded block, transaction receipts, scan errors, remaining permissions and owner-state checks.

No seed phrases/private keys are requested, stored or handled. A browser with an injected wallet is required for signing; the embedded preview may not provide an extension.

## Core code

- `src/engine.ts`: live scanners, residual-access findings, role masks, broad-first ordering, owner comparisons, calldata generation.
- `src/main.ts`: setup, injected wallet connection, review, transaction execution, fresh-plan validation, receipt tracking, local evidence history and export.
- `tests/engine.test.ts`: authority, scope validation, independent approval paths, root deduplication, ordering and owner-preservation checks. These are unit tests, not blockchain simulations.

## Evidence and limitations

Reports contain the chain ID, block number/hash, wallet pair, configured scope, observed permissions, generated transaction data, submitted receipt status, before/after snapshots and owner-state comparisons. RPC URLs are excluded from exported evidence and scope files. Configuration and up to 20 reports remain in local browser storage; no server database is used.

A closed-scope result means no modeled path was found within the configured scope at that block. It does not establish that a person has no other access. Unknown contracts, alternate wallets, delegated accounts, signed permits, proxy changes and unconfigured ENS resources are outside coverage. ENS roles can also be derived by contract-specific hooks; remaining inherited authority is reported rather than assumed removed. New or concurrently granted permissions can change the result after a scan.

ENS root scope is contract-wide; it is not automatically authority on another contract. A root regular role does not itself imply the corresponding admin role. Resource computation is specific to the contract/version. Use exact deployment resources, not guessed namehashes.

Incomplete scans cannot execute a revocation plan or produce a closed-scope result. A zero-finding scan with failed reads is inconclusive. Public RPC availability and browser CORS restrictions can affect reads; configure another Sepolia RPC when needed.

## Departure automation

`cre/main.ts` implements a separately deployable Chainlink CRE workflow. An authorized external system submits a signed departure/recheck event. CRE independently reads approvals and configured ENS roles at one block and returns a permission-state report. See `cre/README.md`. Activation requires the user's authenticated CRE account and configuration; it is not deployed or claimed live. No CRE simulations are included. The browser form works independently of CRE. Live wallets/test assets must be provided by the user through the setup flow; no live transaction evidence is claimed before actual wallet signatures and receipts exist.

## References

- [Uniswap official Sepolia deployment](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments)
- [ENSv2 EAC documentation](https://docs.ens.domains/ensv2/enhanced-access-control/)
- [ENSv2 contract developer guide](https://docs.ens.domains/ensv2/tutorial-contract-developers/)
- [ERC-721](https://eips.ethereum.org/EIPS/eip-721)

## Hackathon materials

See `FEEDBACK.md`, `docs/AI_ATTRIBUTION.md`, `docs/DEMO.md` and `docs/transactions.md`. Event and sponsor eligibility must be checked against current official rules. The original planning documents are provided in `docs/specs/` as reference proposals; their simulation requirements are superseded by the user's request to omit simulations.

## License

MIT.
