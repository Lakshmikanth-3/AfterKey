# Validation record

## Implementation checks

- `npm test`: **58 tests passed**, including independent approvals, ENS scopes, identity/financial preservation, exact mined transaction intent, strict token minimums, metadata failure, stale review detection, wallet discovery, signed request digests, expiry, log framing, pinned-block recovery and Worker relay bounds.
- `npm run build`: TypeScript plus browser/Worker compilation and built-artifact checks passed. The Worker serves emitted assets, rejects unknown paths, and returns HTTP 400 for unsigned CRE requests.
- `npm run typecheck` and WASM compilation in `cre/` passed for the deployed workflow source.
- [GitHub validation run](https://github.com/Lakshmikanth-3/AfterKey/actions/runs/42200112055) passed for source `7994f6b49c0069e900cc932df415bc34da692414`, including tests, both hosting builds and CRE typecheck.
- Browser QA verified the actual two-position portfolio and reviewed delegation preparation. Actual user wallet signatures are recorded separately in the linked receipts.

## Live evidence

The [Uniswap security review](UNISWAP_SECURITY_REVIEW.md) records the resource-guided fixes, new regression coverage, [live read-only checks](uniswap-security-verification.json), and the unresolved upstream CRE/Zod dependency warning.

| Integration | Verified result |
| --- | --- |
| ENSv2 | Ten successful setup/delegation/update/revocation receipts; [30 historical checks](ens-offboarding-verification.json) retain the owner's identity and control |
| Uniswap mints | [Four checks](uniswap-mint-verification.json) verify NFTs 234145 and 234146, canonical receipts, ownership and pair/range |
| Uniswap operator | [Action verification](uniswap-operator-verification.json) proves delegation, operator-signed collection to the fixed owner, and portfolio grant. Collection amounts were zero |
| Uniswap offboarding | [14 checks](uniswap-offboarding-verification.json) verify narrow-only removal, surviving portfolio authority, final owner-signed revocation at 12075584, retained positions/ENS identity and operator preparation denial |
| CRE scheduled monitoring | [Authenticated archived run](cre-scheduled-execution-proof.json), version 2, block 12074459 |
| CRE approval event | [12 checks](cre-approval-event-proof.json), version 2, block 12075512, exact grant transaction/log reference |
| CRE GitHub departure | [Authenticated successful run](cre-execution-proof.json), version 3, eight collector checks; [nine semantic checks](cre-departure-verification.json), baseline 12075512 to 12075653, zero findings and preservation passed |

Current workflow: `008980863d19e8315fed5364f8e504f3b5f447d28f3c7de5a7be0073475edb76`. Current verified execution: `f42d1d27-6bcf-4689-b290-d4d533f83729`. The current workflow metadata and its source/configuration hashes are in [deployment metadata](../cre/deployment.json). Older scheduled/event evidence retains its original deployment identity.

The first HTTP departure execution failed on a disallowed explicit `User-Agent` header. Removing that header and redeploying produced the successful execution above. Four consensus outputs contained the same values in different object key orders; canonical comparison resolves that serialization difference without relaxing value checks.

No privileged-call or CRE simulations were used. Preparation denial is a live permission check, not proof of a mined reverted write. CRE does not hold the owner key or sign revocations. Its result covers the declared resources at recorded blocks and is not an onchain attestation.

## Submission checks still separate

The [public Vercel deployment](https://afterkey.vercel.app) passed HTTP and browser checks: real ENS discovery at block 12075839, two live Uniswap positions at 12075847, and the recorded successful CRE departure execution. The relay rejects unsigned POSTs with 400 and GETs with 405. [Deployment verification](vercel-deployment-verification.json). The Uniswap feedback form was submitted with explicit user consent; [confirmation](uniswap-feedback-confirmation.png). A real demo video and ETHGlobal showcase submission remain participant steps. The repository is public and MIT-licensed. See [current status](E2E_STATUS.md) and [showcase draft](SHOWCASE.md).
