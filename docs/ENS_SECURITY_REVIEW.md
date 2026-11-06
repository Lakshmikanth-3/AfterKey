# ENSv2 implementation security review

Reviewed 6 November 2026 against the official ENSv2 registry, resolver, EAC, factory, app/contract developer and agent-record documentation.

## Latest release workflow audit

The legacy resolver had no `SET_DATA` or matching admin role. The replacement resolver `0xd629d7De9c72684d27682Ed3C503283314906c24` was deployed by the owner at block 12079630 with both roles, and the new subname was registered at 12079639. The replacement gate is `0x47ae5aF5A9A2D0e90D2986861aD99f088270258F`. Old name records were preserved and both NFTs were recovered before the replacement deposits.

Additional preparation checks now verify the live official factory implementation and `decodeSetter` mapping for `afterkey.release`. An interface-compatible resolver with an unexpected implementation, the wrong key resource, a text role instead of a data role, or missing owner authority cannot prepare publication. Gate deployment requires the exact registered leaf name and official User Registry, which prevents an inherited/wildcard parent being mistaken for a dedicated registered subname.

Registry hierarchy reads are grouped at one explicit block. Rate limits and unavailable blocks propagate instead of being mislabeled as unsupported resolvers, missing profiles or unpublished candidates. Wallet writes are never retried automatically.

The latest code checks do not alter deployed gate bytecode or require another gate/consumer deployment. See `src/releases/ens-policy.ts`, `tests/ens-release-policy.test.ts` and the read-only `scripts/verify-ens-release.ts` report.

## Deployment limitations that remain

- The immutable gate checks its pinned **leaf registry resource, owner, expiry and resolver**. It does not independently prove every ancestor/root pointer on each collection. Changing an ancestor can make normal ENS resolution disagree with the pinned source. Do not claim universal hierarchy continuity; an ancestor-attested gate would require a separately reviewed contract version and deployment.
- The owner is trusted and can recover NFTs or rebind workflows. Resolver provenance checks in the app are not a substitute for gate-level enforcement against every future proxy upgrade. This resolver was initialized without an upgrade role.
- Data/text roles are scoped by key/type across the resolver, not per name. The release name uses a dedicated resolver. Known bundle inspection is bounded and not an index of every alias or application dependency.
- CRE acceptance is not completion. The prior release attempt failed at its read capability limit. A batched verifier is deployed; its passing onchain report, activation and both collections are still pending.
- The published Vercel bundle and remote source need updating to the current release version. Earlier offboarding evidence remains valid for its stated historical scope.

## Findings fixed

### Deterministic official proxy salts

Fresh setup previously generated a random salt for each attempt. A repeated setup could therefore deploy another resolver or registry for the same logical owner/name. Fresh setups now use the documented deterministic inputs:

- resolver: `keccak256(abi.encode(keccak256("OwnedResolver"), owner, 0))`
- registry: `keccak256(abi.encode(keccak256("UserRegistry"), namehash(parent), 0))`

The factory still mixes the caller into its final CREATE2 salt. Before preparing a deployment, AfterKey asks the factory for the predicted address. If a verified proxy already exists there, setup reuses it instead of sending a duplicate deployment. Existing saved setup salts remain usable so an in-progress wallet flow is not silently changed.

### Proxy provenance and implementation drift

Interface checks alone could accept an unrelated compatible contract. Setup now calls the pinned official Verifiable Factory's `verifyContract(proxy)` and requires the exact pinned current implementation before reusing a resolver or subregistry. Factory and implementation runtime hashes are reread immediately before a new deployment transaction is prepared.

The live workspace passed these checks at Sepolia block 12,076,795:

- resolver `0x6161ada4D10a529940B90b078B4F9A8d3679c8f8` → `0x115eb53F0c60696633855F90b138178Fb40b2b2C`
- registry `0x26560685235D2d7861afF80866E8C1846d14420D` → `0x9BD8a88719068D09ecee662f36c0e3856708366a`

## Confirmed correct

| Official model | AfterKey behavior |
| --- | --- |
| Registry resources are mutable and differ from token IDs | Reads `getResource`, `getTokenId`, owner and expiry at one pinned block. |
| Resolver roles are record-type/argument scoped, not name scoped | Derives the resource through `decodeSetter` and warns that a key role applies across names served by that resolver. |
| EAC ADMIN roles occupy the upper 128 bits | Labels and handles ordinary/admin roles independently; only matching authority can prepare revocation. |
| Registry operator approval inherits the owner's roles | Scans `isApprovedForAll` as an independent broad access path. |
| Writes go to the actual resolver with DNS-encoded names | Uses the discovered Permissioned Resolver and DNS packet encoding for setter calldata. |
| `agent-endpoint[...]` must be a URL | Accepts HTTP, HTTPS and IPFS; rejects script/data schemes and empty placeholders. |
| ENSIP-25 uses an interoperable registry identifier | Constructs and tests the ERC-7930 EVM registry identifier and treats only a nonempty record as an attestation. |

## Known limits

- ENSIP-25 support verifies the ENS-side attestation record; it does not independently prove an ERC-8004 NFT, reputation or endpoint safety.
- The Agent CLI is used only as optional independent developer tooling because its own repository labels it not production-ready.
- The scanner is intentionally bounded to configured names/resources. It does not claim universal discovery across arbitrary contracts or aliases.
- Sepolia deployments may be reset by ENS during active development; pinned code/provenance checks fail closed if that happens.

## Reproduce

Run `npm test`, `npm run build` and `npm run verify:ens -- treasury-agent.manager.eth`. The machine-readable result is [ens-live-read-check.json](ens-live-read-check.json).
