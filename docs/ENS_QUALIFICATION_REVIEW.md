# ENSv2 qualification review

## Verdict

AfterKey meets the technical requirements for **Best Use of ENSv2** on Sepolia. ENSv2 is the product's authorization layer, not a cosmetic address label: the app discovers hierarchy and resolver scopes, delegates a real text permission, detects a surviving resolver-wide permission, prepares owner-reviewed revocations and proves that the identity remains under the owner.

## Requirement mapping

| Requirement | Current evidence |
| --- | --- |
| ENSv2 on mainnet or Sepolia | `treasury-agent.manager.eth` is live on ENSv2 Sepolia. The three-level hierarchy, Permissioned Resolver and User Registry are reread by `npm run verify:ens -- treasury-agent.manager.eth`. |
| ENSv2 central to the product | Registry resources, EAC root/local roles, resolver text-key roles and registry operator approval determine the audit and revocation plan. |
| Functional, not hard-coded | Names, owners, resources, expiry, pointers, roles, records and transaction receipts come from pinned live reads. Protocol addresses are pinned official deployments, not fabricated user state. |
| Live demo | https://afterkey.vercel.app is publicly accessible; wallet writes require the configured signer and Sepolia. |
| Open-source code | https://github.com/Lakshmikanth-3/AfterKey is public and MIT licensed. |

The separate Existing Project prize requires Continuity Track participation and mainnet under the supplied rules. This repository targets Best Use of ENSv2.

## Completed onchain lifecycle

1. Deployed an official Permissioned Resolver and User Registry proxy through the ENS Verifiable Factory.
2. Attached the registry beneath `manager.eth`, set its canonical parent and registered `treasury-agent.manager.eth`.
3. Delegated `agent-context` editing to the departing wallet and performed a real record update.
4. Added an explicit broad `SET_TEXT` test role so a narrow revoke left effective authority active.
5. Discovered the surviving role, revoked it as the owner and reread live authorization.
6. Preserved the name owner, owner permissions, hierarchy pointers and captured identity records.

The final root revocation succeeded at block 12,074,044. The historical verifier passed 30 checks in [ens-offboarding-verification.json](ens-offboarding-verification.json); transaction links are in [transactions.md](transactions.md).

## Security properties added from the official resources

- Names are normalized before traversal; registry resources come from `getResource` rather than guessed token or label IDs.
- Resolver resources are checked against live `decodeSetter`. Text/data scope is the key hash and can affect every name served by the resolver.
- Ordinary and ADMIN roles are distinct. Registry operator approval is reported separately because it inherits the owner's registry roles.
- Setup never replaces a nonzero subregistry, resolver or canonical parent silently.
- New proxies use the documented deterministic `OwnedResolver(owner, version)` and `UserRegistry(namehash(parent), version)` salts.
- Before setup trusts a resolver or subregistry, the official factory's `verifyContract` must prove its provenance and current implementation.
- Factory and implementation runtime code hashes are checked immediately before a deployment action is prepared.
- Agent endpoint values accept only HTTP, HTTPS or IPFS URLs. ENSIP-25 keys use the ERC-7930 interoperable registry encoding.

## Evidence boundary

A zero-finding report means no modeled permission survives in the configured contracts/resources at that block. It does not cover unknown contracts, other wallets, copied credentials, arbitrary aliases, social recovery or undiscovered keys. No privileged-call simulations are used. Every mutation requires a wallet signature and an exact mined-receipt check.

## Verification

```sh
npm test
npm run build
npm run verify:ens -- treasury-agent.manager.eth
```

The latest live read in [ens-live-read-check.json](ens-live-read-check.json) verifies the hierarchy, both proxy implementations through the official factory, the resolver resource model, four ENS targets and zero findings.

Sources: [ENSv2 overview](https://docs.ens.domains/ensv2/overview/), [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/), [Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/), [Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control/), [Verifiable Factory](https://docs.ens.domains/ensv2/verifiable-factory/), [ENSIP-26](https://docs.ens.domains/ensip/26/) and [ENSIP-25](https://docs.ens.domains/ensip/25/).
