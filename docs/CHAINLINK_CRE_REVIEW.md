# Chainlink CRE resource and security review

Reviewed on November 6, 2026 against the official [CRE overview](https://docs.chain.link/cre/overview), [EVM capabilities](https://docs.chain.link/cre/capabilities/evm-read-write), [deployed HTTP trigger guide](https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/triggering-deployed-workflows), [CRE templates](https://github.com/smartcontractkit/cre-templates) and [CCIP overview](https://docs.chain.link/ccip/overview).

## Result

AfterKey is a real deployed CRE integration, not a branded webhook or simulated workflow. The active workflow joins an external GitHub departure case to historical and current Sepolia authorization state, runs on a CRE DON, and has authenticated successful execution evidence. The owner still signs every revocation in the wallet; CRE independently verifies the outcome.

The primary execution is `f42d1d27-6bcf-4689-b290-d4d533f83729` on workflow `008980863d19e8315fed5364f8e504f3b5f447d28f3c7de5a7be0073475edb76`. The hardened collector now requires all 18 deployment, scope and departure-outcome checks to pass before marking that proof verified.

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
