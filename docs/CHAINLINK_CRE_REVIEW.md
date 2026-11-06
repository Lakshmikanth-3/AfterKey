# Chainlink CRE resource and security review

Reviewed on November 6, 2026 against the official [CRE overview](https://docs.chain.link/cre/overview), [EVM capabilities](https://docs.chain.link/cre/capabilities/evm-read-write), [deployed HTTP trigger guide](https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/triggering-deployed-workflows), [CRE templates](https://github.com/smartcontractkit/cre-templates) and [CCIP overview](https://docs.chain.link/ccip/overview).

## Current qualification result

Target **Best workflow with CRE**, not **Best use of CCIP 2.0**. The [official Mumbai prize page](https://ethglobal.com/events/mumbai/prizes/chainlink) lists these as separate prizes with separate requirements.

| CRE requirement | Evidence and current boundary |
| --- | --- |
| Blockchain plus external API/system | `cre/external-case.ts` joins the configured public GitHub issue with historical/current ENS and Uniswap Sepolia state. Historical successful execution `f42d1d27-6bcf-4689-b290-d4d533f83729` has [18 verified checks](cre-execution-proof.json). The new release-only trigger reads onchain data; it is not independently an external-API integration. |
| Successful simulation or live deployment | Actual CRE network deployment is ACTIVE. Historical HTTP, cron and approval-event runs succeeded. No simulation is presented as a live execution. The new release-report path remains pending a passing onchain report. |
| Meaningful orchestration | Departure verification joins GitHub approval with permissions and preservation. Release verification checks ENS candidate, policy and complete consumer custody before sending a signed gate report; the owner must separately activate. |
| CCIP inside contracts causing a state change | Not implemented. There is no cross-chain source/destination workflow or CCIP sender/receiver contract. Do not submit AfterKey as CCIP-complete. |

Earlier successful GitHub/chain evidence remains scoped to its recorded workflow ID and blocks. It is not proof that a newer binary delivered a release report. Vercel still needs the current local release UI and relay after live proof is complete. A screenshot saying ACCEPTED is not completion.

## Resource-to-code mapping

| Official pattern | AfterKey implementation |
| --- | --- |
| Trigger and callback workflow | [HTTP, cron and EVM log handlers](../cre/main.ts) |
| Multiple independent trigger sources | Five-minute monitor, SAFE-confidence Uniswap approval event, owner-authorized HTTP departure request |
| CRE HTTP capability and DON consensus | [Configured GitHub issue read and identical-field aggregation](../cre/external-case.ts) |
| CRE EVM capability with viem ABI handling | [Pinned-block registry, resolver and Uniswap reads](../cre/reader.ts) |
| Unique, short-lived deployed HTTP authorization | [Five-minute digest-bound JWT with UUID `jti`](../src/cre/auth.ts) |
| Verify execution rather than treating gateway acceptance as completion | [Authenticated CLI status/log collector](../scripts/collect-cre-proof.ts) |
| Production bounds and failure handling | Bounded request, response, target and position counts; read batches require `view`/`pure` methods and disallow partial success |
| End-to-end template structure | Separate configuration, workflow source, relay, runbook and deployment/evidence metadata |

## Fixes from this review

1. The public relay now rejects unknown input fields, invalid or zero baseline blocks, unsafe issue numbers and issue numbers attached to non-departure events before forwarding a paid CRE execution.
2. The primary proof collector can no longer accept an unrelated successful cron or event run. It requires `http:departure`, the configured GitHub repository and approver, exact operator wallet, access present before, access absent after, preserved positions and ENS state, and the exact `permissions_absent_assets_preserved` result.
3. Regression tests cover malformed event-specific inputs and semantic proof substitution. The known real departure execution was collected again and passes every hardened check.

## Why CCIP was not added

CCIP connects different blockchains and transfers cross-chain messages or tokens. AfterKey's demonstrated scope is intentionally one Sepolia workspace: ENSv2 identity, Uniswap v3 positions and their permissions all exist on the same chain. There is no destination chain or cross-chain state change in the product requirement.

Adding a no-op CCIP message would not strengthen the CRE offboarding workflow and would create another trust boundary, contract and fee path without solving a user problem. AfterKey therefore targets **Best workflow with CRE**, not the separate **Best use of Chainlink CCIP 2.0** prize, and makes no CCIP claim.

## Evidence and remaining limits

- [Authenticated execution](cre-execution-proof.json) proves the deployed workflow succeeded and all 18 strict checks passed.
- [Departure verification](cre-departure-verification.json) records the external case, before/after access and preservation assertions.
- [Owner receipt proof](uniswap-offboarding-verification.json) separately proves the owner-signed onchain revocation. CRE does not possess the owner key.
- HTTP authorization uses a unique UUID and five-minute expiry as documented by CRE. The gateway, not the stateless Vercel relay, is responsible for duplicate-`jti` handling inside that window.
- Each current snapshot starts from one CRE-selected latest block and pins all calls to it; historical baselines use an explicit block. The official capability supports latest, finalized and specific block reads. A stricter finalized-only policy is a possible production follow-up, but changing the deployed source would require a new deployment and new execution proof.
- The current SDK 1.23.0 transitively pins Zod 3.25.76, which has the documented memory-exhaustion advisory. Request/configuration bounds reduce exposure but do not fix the upstream dependency. No incompatible override was applied.
- Scope is the four configured ENS resources and discovered owner-held Uniswap positions, not every possible contract or offchain authorization system.

## Verification commands

```sh
npm test
npm run build
npm run build:vercel
cd cre && npm run typecheck
npm run proof:cre -- f42d1d27-6bcf-4689-b290-d4d533f83729
```

The proof command requires the participant's authenticated CRE CLI session. No private key is stored in this repository.

## Additional audit fixes

- Release reads now reuse `ViewBatch`, enforce view/pure functions, reject partial results and split payloads below 4,400 bytes. Custody reads are batched, with an explicit capability-call budget. Regression checks cover two and sixteen consumers.
- Release execution output uses hash-bound evidence frames below the 1 KB per-line logging limit. Conflicting, missing or tampered chunks fail verification.
- `scripts/collect-cre-release-proof.ts` requires an authenticated successful release execution, expected gate/consumer coverage, canonical successful report receipt, matching `Checked` event, exact digest/epoch/coverage, valid-at-delivery timestamp, compiled gate runtime and custody at the observed block. Cron/departure output cannot substitute for release proof. Activation and collection remain separate.
- GitHub approval now rejects issue content updated after closure. The configured approver must review and close an edited case again; malformed timestamps are rejected. The current issue 2 has identical valid update/closure timestamps.

## Remaining risks and explicit limits

- GitHub API fields are authenticated by TLS and CRE consensus, not a cryptographic HR identity or immutable external approval. Account compromise, stale approvals and policy changes remain organizational risks.
- The relay is stateless. CRE gateway duplicate-JWT handling is the replay control during the five-minute authorization window. Asset writes still need owner approval; report replay cannot activate a different digest or epoch.
- The release trigger itself uses ENS and chain state, while the separate departure trigger supplies the external GitHub integration. Do not pitch the release-only path as fetching GitHub approval.
- Deployed gate policy checks leaf ENS identity, owner, resource, expiry and resolver; it does not prove every ancestor/root pointer on each collection. A separate contract revision is needed for that stronger claim.
- A valid report authenticates the specific workflow and observation, not audited arbitrary consumer code, profitable LP management or agent behavior. Owner custody recovery is always trusted.
- The new audited workflow must be bound by the owner and executed live before its current release-report proof can be marked complete. Do not repeat deployments of NFTs, resolver, gate or consumer contracts.

## Reproduce

- `npm test`
- `npm --prefix cre run typecheck`
- `cre workflow build . --target production` from `cre/`
- `node --import tsx scripts/collect-cre-release-proof.ts <execution-uuid>` after a successful release execution

Official sources: [service quotas](https://docs.chain.link/cre/service-quotas), [HTTP requests](https://docs.chain.link/cre/guides/workflow/using-http-client/get-request), [HTTP trigger authorization](https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/triggering-deployed-workflows), [consumer report authentication](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts), [templates](https://github.com/smartcontractkit/cre-templates) and [CCIP](https://docs.chain.link/ccip).

The intro videos are educational resources; required behavior is checked against versioned code, official docs, authenticated execution logs and canonical chain receipts. No claim is made that watching a video creates an integration.
