# ENS resource audit

The official resources were reviewed against the current release implementation. The current gate and consumers were not redeployed for this code audit.

| Official resource | Actual use | Boundary |
| --- | --- | --- |
| [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/) | Hierarchical registered subnames; current resource, owner, expiry and resolver reads; official factory provenance | Gate enforces its pinned leaf identity, not every ancestor pointer |
| [Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/) | DNS setters, dedicated resolver, `afterkey.release` data record and known shared-bundle inspection | No automatic alias writes or universal dependency discovery |
| [Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control/) | Separate text/data and regular/admin roles; effective `hasRoles`; live `decodeSetter` validates key resource and role | Name ownership alone is not resolver write authority; roles cover keys across a resolver |
| [Contract guide](https://docs.ens.domains/ensv2/tutorial-contract-developers/) | Official factory/User Registry setup and owner-controlled registration | Custom gate consumes ENS; it does not replace ENS |
| [App guide](https://docs.ens.domains/ensv2/tutorial-app-developers/) | Name normalization, live profile reads, reviewed DNS calldata and mined receipt verification | Protocol constants are pinned; user state comes from chain |
| [Overview](https://docs.ens.domains/ensv2/overview/) | Hierarchy, resolver profiles and EAC form the configuration layer | Sepolia, without a mainnet eligibility claim |
| [Agent CLI](https://github.com/ensdomains/ens-cli) | Reviewed as a developer reference | Not a required runtime dependency; repository labels it not production-ready; browser wallet signing is retained |
| [ENSIP-26](https://docs.ens.domains/ensip/26/) | Agent context/endpoint keys, URL validation and profile reads in agent-record modules | Draft specification; supported keys do not prove an autonomous agent is running |
| [Building with AI](https://docs.ens.domains/building-with-ai/) | Official documentation used to validate APIs | A development resource, not a runtime qualification requirement |
| [ENSIP-25](https://docs.ens.domains/ensip/25/) | ERC-7930 registry key construction and nonempty ENS attestation lookup | Draft specification; not full ERC-8004 NFT, reputation or ownership verification |

## Changes from this audit

- Verify current resolver factory provenance before candidate publication.
- Validate the live data-setter key resource and role before writes.
- Require the exact registered leaf and official User Registry before gate deployment.
- Batch same-block hierarchy reads and propagate infrastructure errors.
- Add regression coverage for data setter/admin initialization, DNS encoding and wrong role/key rejection.
- Replace stale release qualification claims with the actual pending workflow and publication steps.

## Validation

76 tests passed; Vercel production build passed. The independent [live readiness report](ens-release-readiness.json) passed 12 ENS/setup checks. Its workflow-binding, passing-report and activation checks remain false. This bounded review is not an independent security audit or a prize guarantee.
