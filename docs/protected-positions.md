# Protected LP mandates

AfterKey now has two distinct modes. Existing wallet-held Uniswap v3 NFTs use approval discovery and owner-signed revocation. Optional protected positions use `ENSPositionVault`: the owner intentionally transfers one NFT into an immutable contract, where operator collection requires both a current mandate and live ENSv2 authority.

## Contract-enforced flow

1. In Uniswap → Protected LP → Create vault, enter an owned ENSv2 name and wallet-held position ID.
2. Review and deploy the contract with the owner wallet. Deployment alone moves no NFT.
3. Read the verified vault and select Deposit position. This transfers custody to the contract. The treasury and recovery owner are permanently fixed to the workspace owner.
4. Grant the operator the vault's text-key capability through the official ENSv2 Permissioned Resolver.
5. Set the operator and a mandate expiry of at most 30 days.
6. The operator calls `collect()`. Every call checks the mandate, expiry, pause, ENS name registration resource, name owner, resolver pointer, name expiry, NFT custody and effective EAC role. All collected tokens go to the immutable treasury.
7. Revoke ENS authority, pause the vault, or replace its operator. A replacement invalidates the old operator even if an ENS grant survives. A root `SET_TEXT` grant remains effective after a key-only revocation; the UI tells the owner to check both.
8. Only the owner can release the NFT. Recovery works even when ENS is expired, changed or unavailable.

Operators cannot approve or transfer the NFT, decrease liquidity, choose a recipient, execute arbitrary calldata, upgrade the vault, or change its owner. Collected amounts may include removed principal; they are not necessarily fees. ERC-20 assets are paid directly by the manager to the treasury, not stored in the vault.

## ENS sources and boundaries

- [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/): current registration resource, name ownership, expiry and resolver binding. Registration-version changes invalidate the binding.
- [Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/): `grantSetterRoles` for a particular text argument, `revokeRoles` for the argument resource, `hasRoles` for effective authority.
- [Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control/): root roles can override a narrower revocation. Capability keys are application-defined records; ENSIP-26 does not define these authorization keys.
- [Contract developer guide](https://docs.ens.domains/ensv2/tutorial-contract-developers/), [app guide](https://docs.ens.domains/ensv2/tutorial-app-developers/), [overview](https://docs.ens.domains/ensv2/overview/): use the existing official hierarchy and resolver deployment flow rather than redeploying ENS substitutes.
- [ENSIP-26](https://docs.ens.domains/ensip/26/) and [ENSIP-25](https://docs.ens.domains/ensip/25/): existing agent profile discovery and registration attestation remain separate from transaction authority. Both documents currently label themselves drafts. The registry association check is not proof of agent reputation or execution permission.
- [ENS CLI](https://github.com/ensdomains/ens-cli) and [Building with AI](https://docs.ens.domains/building-with-ai/): development and inspection resources; no server-side key or CLI installation is needed in a browser wallet transaction flow.

The vault binds a leaf registry and label. It does not traverse or guarantee the health of every ancestor on each collection. Include the discovered hierarchy in independent scans. Resolver proxy upgrades are an organizational trust boundary; the vault reads the configured resolver's current EAC behavior. Use a dedicated resolver for isolation: argument-scoped rights apply across all names served by that resolver. Owner recovery assumes the owner wallet remains usable.

## Independent Chainlink CRE coverage

After deposit, wallet NFT enumeration excludes the protected position. Export the vault configuration from Protected LP → CRE coverage, merge `guardedVaults` into the deployed workflow's config, and redeploy. Configuration supports up to four explicit vaults, including expected treasury, NFT ID, registry, resolver and resource bindings.

The CRE reader pins every read to the same block. It checks bindings and vault custody, records departing/current operator authorization, reads the actual Uniswap position economics and reports active departing mandates. Before/after comparison permits a changed operator/epoch but flags altered treasury, custody, authority bindings or economics. Failed reads abort verification instead of returning a clean result. An owner-authorized CRE check does not grant CRE custody or revocation privileges.

The existing deployed workflow does not automatically gain this coverage. Configure and redeploy it after creating a vault. Depositing a position deliberately changes custody: capture a new baseline after deposit, before the operator handover. Do not compare a wallet-owned baseline to a vault-owned final state and call custody unchanged.

Browser offboarding automatically tracks a vault after a confirmed deposit or a verified read of its deposited NFT. Scans read protected authorization and economics at the scan's block, prepare an owner `setPaused(true)` containment call when collection survives, and bind protected addresses into exported evidence coverage. A failed or missing vault read prevents a complete report. Releasing an NFT intentionally changes custody and requires reviewing the scope/baseline again.

## Verification and release status

`npm run compile:vault` creates the deployment artifact with pinned solc, optimizer and EVM settings. Browser reads compare runtime code, masking only compiler-declared immutable slots, then validate actual immutable values against the workspace. Review all deployment arguments in the wallet.

`tests/guarded-vault.test.ts` runs compiled bytecode on a local EVM with registry/resolver/position-manager fixtures. It covers denied collection before a grant, collection after grant, fixed recipient, revoked ENS access, operator replacement, owner-only actions, pause, expiry, changed ENS bindings and recovery. These are local contract tests, not Sepolia deployment proof. `tests/guarded-continuity.test.ts` checks independent report behavior.

New source code and wallet flows do not establish a live deployment or security audit. A complete live demonstration still requires owner deployment and deposit, real ENS grants, an operator collection, revocation/rotation, and a completed execution of the updated CRE workflow. The optional vault introduces contract custody; keep the existing direct-approval mode available.
