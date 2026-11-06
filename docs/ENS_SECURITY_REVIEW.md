# ENSv2 implementation security review

Reviewed 6 November 2026 against the official ENSv2 registry, resolver, EAC, factory, app/contract developer and agent-record documentation.

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
