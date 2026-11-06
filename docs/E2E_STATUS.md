# End-to-end verification status

Verified on November 6, 2026. These are real Sepolia receipts and authenticated CRE executions. No privileged-call or CRE simulations were run.

| Phase | Status | Evidence |
| --- | --- | --- |
| ENSv2 namespace, delegation, record update and offboarding | Complete in configured scope | [Ten receipts](transactions.md), [30 historical checks](ens-offboarding-verification.json) |
| Uniswap v3 position creation | Complete: NFTs 234145 and 234146 | [Mint receipt verification](uniswap-mint-verification.json) |
| Operator delegation and collection to owner | Complete; collection returned zero tokens | [Canonical action receipts](uniswap-operator-verification.json) |
| Narrow revocation and surviving broad access | Complete: individual approval cleared at 12075553 while portfolio approval remained | [Historical state](uniswap-offboarding-verification.json) |
| Complete Uniswap offboarding | Complete at block 12075584 | [Final receipt](https://sepolia.etherscan.io/tx/0x2a4ca9ba41a8fe0d11f8d8eeba69a9a50dee27841b80e8c0905366e5032671f8), [14 checks](uniswap-offboarding-verification.json) |
| CRE scheduled monitoring | Successful historical execution on workflow version 2 | [Scheduled proof](cre-scheduled-execution-proof.json) |
| CRE approval-event trigger | Successful historical execution on workflow version 2 | [12 checks](cre-approval-event-proof.json) |
| GitHub departure case and signed CRE HTTP trigger | Complete on deployed workflow version 3 | [Issue 2](https://github.com/Lakshmikanth-3/AfterKey/issues/2), [authenticated output](cre-execution-proof.json), [nine departure checks](cre-departure-verification.json) |
| Production app and signed relay | Public Vercel deployment verified | [afterkey.vercel.app](https://afterkey.vercel.app), [deployment checks](vercel-deployment-verification.json), [API](../api/cre-trigger.ts) |
| Public source | Complete: MIT repository | [GitHub](https://github.com/Lakshmikanth-3/AfterKey) |
| Uniswap developer form | Submitted with user-supplied contact details, ratings and explicit consent | [Confirmation](uniswap-feedback-confirmation.png), [feedback](../FEEDBACK.md) |
| Judge access | Public demo verified without login | [Vercel](https://afterkey.vercel.app) |
| Video and showcase | Pending participant submission work | [Prepared showcase copy](SHOWCASE.md) |

## What the final proof establishes

The owner removed portfolio approval at block **12075584**. Historical comparison from **12075512** confirms both NFTs kept the owner, liquidity, pair, fee tier and range. Individual approvals and portfolio approval are absent. Current operator preparation is denied while owner preparation remains available. This is a live authorization check, not a sent or reverted attack transaction. Four ENS resources retain their captured owner control and identity data.

CRE execution **f42d1d27-6bcf-4689-b290-d4d533f83729** succeeded on workflow **008980863d19e8315fed5364f8e504f3b5f447d28f3c7de5a7be0073475edb76**. It validated the completed, labeled GitHub issue and exact departing wallet, compared baseline **12075512** with **12075653**, and returned `permissions_absent_assets_preserved`. Eight authenticated collector checks and nine departure-specific checks passed. The workflow's preservation comparison has no changes. Owner-signed revocation receipts are established separately by the Uniswap evidence.

The earlier accepted HTTP request failed because `User-Agent` was not an allowed explicit CRE HTTP header. The revised deployment removed that header and the repeated request succeeded. Acceptance alone was never treated as completion. Consensus output comparison now ignores JSON object key order while preserving field values and array order.

## Validation and scope

**58 unit tests passed.** TypeScript, both hosting builds and Worker artifact-serving checks passed. CRE typecheck passed; WASM compilation previously passed for the unchanged deployed CRE source. Unit fixtures are policy checks, separate from execution evidence. The [security review](UNISWAP_SECURITY_REVIEW.md) records the fixes and remaining upstream dependency warning.

Coverage is the configured four ENS resources and two discovered Uniswap NFTs at recorded blocks. Unknown contracts, unconfigured permissions and other wallets are outside this report. Optional owner liquidity withdrawal is implemented and tested, but has not been live executed and is unnecessary for this preservation proof. No further grants, mints or revocations are needed for the demonstrated lifecycle.

## Hosted verification

The public Vercel app loaded the actual ENS identity at block **12075839**: operator text authority absent and owner authority retained. Its Uniswap view read block **12075847**, found both NFTs, and showed individual approvals zero and portfolio approval absent. The Chainlink workspace displayed the verified HTTP execution and current workflow ID. Public HTTP checks serve the app/assets, reject unsigned relay POSTs with 400, and reject relay GETs with 405. No fresh owner-signed execution was submitted from the hosted origin during these read-only checks.
