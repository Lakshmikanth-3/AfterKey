# ENSv2 qualification review

## Current verdict — release workflow review

Target **Best Use of ENSv2** on Sepolia. ENS is central: its permissioned data record supplies the proposed operator, treasury, manager and expiry; the gate and CRE bind activation to that exact digest. The separately documented offboarding lifecycle is already supported by historical receipts. Do not describe the new release lifecycle as complete until report delivery, activation and both collections have their own receipts.

| Requirement | Observed status |
| --- | --- |
| ENSv2 on mainnet or Sepolia | Verified Sepolia subname `afterkey-release.manager.eth`, dedicated official Permissioned Resolver and owner-controlled User Registry. See [live release readiness](ens-release-readiness.json). |
| ENSv2 central | EAC authorizes candidate publication; resolver data is independently read by CRE and the onchain gate. Names are not just wallet labels. |
| Functional, not hard-coded | Real registration, data publication, consumer deployment and deposits have receipts. Candidate/role/custody reads are live. The latest release CRE deployment still needs binding, successful report delivery, owner activation and both collection proofs. |
| Live demo link | Vercel returns HTTP 200, but its downloaded bundle still serves the older offboarding app. Publish and verify the current release workflow after its live proof is complete. |
| Public open-source repository | GitHub connector confirms `private:false` and MIT. New local repair/release changes still need small reviewed commits and a push. |
| Showcase contains demo and source links | Must still be checked in the participant's final showcase entry. A README alone does not prove submission. |

The **Existing Project / Continuity** prize additionally requires Continuity Track eligibility and Ethereum mainnet. Sepolia proof does not satisfy that prize. Do not spend real ETH on a mainnet deployment merely to imitate eligibility.

Wildcard resolution, record/namespace aliasing, an agent CLI and AI-agent integrations are optional capabilities or resources in the supplied brief, not a checklist of mandatory features. The current implementation uses its own subname registry, dedicated resolver and EAC. Dependency inspection detects known shared record bundles; it does not create aliases or discover every dependent name. ENSIP-25 support is an ENS-side attestation lookup, not full ERC-8004 ownership/reputation verification. ENSIP-26 keys are supported; do not claim a real autonomous agent has run without its own evidence.

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
