# ENS qualification review

## Verdict

AfterKey is a strong conceptual fit for **Best Use of ENSv2**: remove a departing operator's ability to edit or redirect a team's ENS identity while retaining the owner's name, profile and permissions. EAC is the mechanism being audited, not a cosmetic name lookup.

The implementation now supports an ENS-first flow. **Prize qualification is not yet established**: the registered owner-controlled `manager.eth` namespace must be configured and exercised with live grants/revocations, the public repository link must work, and judges must be able to open the demo.

## Requirement mapping

| Supplied requirement | Implementation/evidence | Remaining work |
| --- | --- | --- |
| ENSv2 on mainnet or Sepolia | Official Sepolia deployments pinned to ENS's deployment-linked source revision; real contract reads and current ERC-165 checks | Record signed transactions on the owner's actual namespace |
| ENSv2 central | ENS identity is the default screen. Hierarchy, EAC root/argument scopes, registry operators and revocation checks drive the workflow | Demonstrate on the user's name |
| Functional, no hard-coded values | Names, owners, resources, roles and records come from live reads. Setup builds real wallet-signed calls | Complete the wallet-signed demo; protocol constants are not fabricated findings |
| Live demo link | Hosted app exists at https://afterkey-access.resplendentflair1.chatgpt.site | Currently owner-private; arrange judge access and submit the showcase link |
| Accessible open-source code | MIT-licensed source, tests and documentation exist locally | Supplied https://github.com/Lakshmikanth-3/AfterKey returned 404 publicly and through the GitHub connector; public publication is unverified |

This is a new project. Under the pasted rules, the $3,000 Existing Project prize requires Continuity Track participation and mainnet. Target **Best Use of ENSv2** with the current from-scratch Sepolia work.

## Implemented improvements

1. Discover registry ancestors and the nearest resolver from a normalized name. Obtain registry resources using `getResource`, respecting current versions rather than guessing from a labelhash or caching stale token IDs.
2. Use the deployed resolver's argument-scoped model. Text/data keys use `keccak256(bytes(key))`; coin/content types use the ABI-encoded uint256; interface IDs use four packed bytes. The same key scope can apply across names served by one resolver.
3. Validate current EAC and registry/resolver interfaces. Show ordinary versus ADMIN role names.
4. Read root roles, resource roles, effective authority, operator approval, name ownership, current token ID and expiry at a recorded block. Cache repeated reads within that block.
5. Build broad-first revocations. Refresh the plan between transactions so inherited roles that disappear after operator revocation do not cause stale cleanup transactions.
6. Compare owner roles, name ownership and known record authorization after changes. Show `hasRoles` state in the evidence screen. This is authorization-state evidence, not a simulated privileged write.
7. Guide official factory deployments of a Permissioned Resolver and User Registry, connect an owned parent, register an operator subname, initialize its address/profile and delegate one text key with `grantSetterRoles`.
8. Offer an explicit test flow: scoped grant, optional resolver-wide text grant, narrow-only revoke, then complete offboarding. Every change requires a real Sepolia wallet transaction. The broad test grant is opt-in and gives no admin rights.
9. Keep Uniswap optional, so ENS-only operation does not depend on another protocol.

## Correct technical story

Use one Permissioned Resolver:

- Operator holds `ROLE_SET_TEXT` for `description` and also on `ROOT_RESOURCE`.
- Owner removes only the key-scoped role using `revokeRoles`.
- A fresh `hasRoles(descriptionResource, ROLE_SET_TEXT, operator)` remains true through the root role.
- AfterKey detects and removes that root path before remaining scoped roles.
- Fresh reads show the operator's text authorization absent, the owner's authorization present, and the name still owned by the owner.

A registry root role is not automatically authority on another resolver. A regular root role does not imply self-regranting: the matching ADMIN role is required. Registry rights that can redirect a resolver/subregistry are separate access paths.

## Best use case and explanation

Use a treasury operations agent or contractor with an operator subname beneath an owned team parent. Its wallet edits selected identity records while the team retains ownership. AfterKey removes known edit/admin/operator paths when it leaves, while preserving the name and profile.

Pitch: **“Removing one ENS permission may leave another active. AfterKey finds the surviving path, removes it, and records the onchain permission state while keeping the team's ENS identity intact.”**

ENS makes identity portable; EAC makes delegation precise; AfterKey makes offboarding reviewable. An agent-labeled subname does not itself establish an autonomous AI integration. Do not claim the AI bonus merely because a name contains “agent.”

## Demo

1. Show the actual subname, profile, hierarchy and owner.
2. Grant scoped text access and the explicit test root text role.
3. Revoke only the key role. Show its receipt and effective authorization still active.
4. Review and sign AfterKey's broad-first plan.
5. Show operator authorization absent, owner authorization retained, unchanged name owner, recorded block and transaction links.
6. Export evidence and state the configured-scope limit. No privileged-call simulations are included.

## Useful next features

First finish live evidence and public access. Then prioritize multi-operator offboarding, bounded event indexing for additional delegated keys, and shared-resolver/record-link blast-radius reporting. Aliasing, wildcard apps and AI agents are examples in the prize brief, not a requirement to implement every feature.

## Verification and sources

`npm test` checks role/admin distinction, resource derivation, owner-only proxy initialization, scoped-grant ABI, scope deduplication, missing deployment-event rejection and owner-preservation regressions. `npm run verify:ens` checks real Sepolia code, cross-checks resource derivation against `decodeSetter`, walks a real registry entry and runs the scanner. See `ens-live-read-check.json`. Neither substitutes for the signed demonstration.

- https://docs.ens.domains/ensv2/permissioned-resolver/
- https://docs.ens.domains/ensv2/permissioned-registry/
- https://docs.ens.domains/ensv2/enhanced-access-control/
- https://docs.ens.domains/ensv2/verifiable-factory/
- https://docs.ens.domains/learn/deployments/
- https://github.com/ensdomains/contracts-v2/tree/07e55a056f5b6a9c90119f501bdd05714e67dddd

The default repository branch did not match the documented deployed resolver model when inspected. The integration follows the deployment-linked revision rather than mixing both versions.


## Latest local improvements

- `manager.eth` is registered on ENSv2 Sepolia to the configured owner; the operator subnamespace and signed offboarding evidence still need completion.
- Operate identity supports reviewed real text updates signed by either the configured owner or departing operator, with live authorization and fresh resolver/calldata checks before submission.
- Permission snapshots now capture registry resolver/subregistry pointers and selected resolver text, ETH address and record bundle at the same read block. Post-confirmation comparisons also detect expiry changes. Required capture failures make reads incomplete; legacy scopes without metadata are shown as uncaptured.
- Why access survives shows reported contract-wide roles, resource roles and registry operator approval. Inconsistent effective authorization blocks a complete report; arbitrary custom inheritance is not exhaustively attributed.
- A shared-bundle notice covers configured names only. Unknown aliases and unconfigured records remain outside coverage.
- Follow [the real transaction runbook](ENS_DEMO_RUNBOOK.md). Two unchanged read-only snapshots are saved in `workspace-live-check.json`; signed offboarding remains unverified.
