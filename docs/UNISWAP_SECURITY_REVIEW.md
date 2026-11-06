# Uniswap integration security review

Reviewed November 6, 2026. This is a focused source and dependency review with regression tests and read-only Sepolia verification, not an independent audit or a guarantee of safety.

## Resources applied

| User resource | How it informed this change |
| --- | --- |
| [Developer dashboard](https://developers.uniswap.org/dashboard) | Account and API-key provisioning. The existing direct v3 position-manager integration needs no API key. No unused key, secret or API dependency was added. |
| [Official documentation](https://developers.uniswap.org/docs) | The documented direct-protocol integration path fits approval removal and position preservation. Checks bind the official Sepolia manager, signer, recipient, calldata, token units and mined receipt. |
| [Uniswap AI skills](https://github.com/Uniswap/uniswap-ai) | Installed and applied `viem-integration` and `lp-integration` from commit `989dbafd07009769826f8692fe09b2cb2f686a24`. These informed public-client reads, wallet writes, exact transaction review and amount validation. |

The LP API builds unsigned transactions and requires dashboard credentials. AfterKey already builds its limited operations from the official v3 ABI, so adding that API would introduce another dependency without improving this permission-removal flow. Hooks are a v4 extension; this project demonstrates real v3 NFT approvals. No v4 hook or API integration is claimed. No privileged-call or CRE simulations were used.

## Confirmed gaps fixed

| Gap | Resulting behavior | Regression coverage |
| --- | --- | --- |
| A successful cancellation or changed replacement receipt could confirm the original reviewed operation | Read the actual mined transaction and its canonical block. Require Sepolia and exact sender, destination, calldata and value. Store the actual mined hash. A gas-only speed-up is accepted; different intent remains unverified. | Replacement, cancellation, wrong sender/destination/calldata/value/chain, reverted and inconsistent receipts |
| Evidence could associate receipts by destination and function without proving exact revocation intent | Require verified exact owner calldata and zero value within the snapshot interval. Every baseline path needs a matching receipt for the fully signed cleanup claim. Changed or incomplete scope cannot prove permission absence. | Legacy receipts, changed calldata, partial coverage and changed scope |
| Over-precise token minimums could be rounded by `parseUnits` | Reject excess fractional precision, exponent notation, negative values and uint256 overflow before preparing a withdrawal. | Exact USDC units and invalid numeric forms |
| Optional ERC-20 metadata failure could prevent portfolio permission operations | Preserve raw amounts, bound displayed symbols and mark decimals unavailable. Permission removal remains available; human-unit withdrawals require known decimals. | Missing or invalid metadata |
| A reviewed operation could outlive changes to financial state or portfolio membership | Compare copied position economics and, for portfolio operations, the reviewed NFT IDs before opening the wallet. | Owed-token and portfolio membership changes |
| Remote plaintext RPCs and cached views from another workspace could mislead review | Require HTTPS remotely, allow HTTP only on loopback for development, and clear portfolio/preparation state when owner, operator or RPC changes. | RPC transport validation; browser workspace checks |

All collection and withdrawal recipients remain fixed to the owner. ERC-721 approvals still authorize NFT transfer as well as management; they are not fee-only delegation. Individual and portfolio approvals are independent, and broad approval covers future NFTs. Those limits remain visible in the review.

## Validation

- **58 tests passed** with `npm test`. [GitHub CI](https://github.com/Lakshmikanth-3/AfterKey/actions/runs/42212652889) passed for source `05668da9855ca60b890d671127fcfa915166858c`.
- `npm run build` passed TypeScript, browser/Worker compilation and artifact-serving checks.
- `npm run build:vercel` passed TypeScript and the Vercel browser build.
- `npm run typecheck` in `cre/` passed. The deployed CRE source and workflow identity were not changed by this review.
- [Read-only verification](uniswap-security-verification.json) at block **12076345** found NFTs **234145** and **234146** retained by the owner, with individual approvals zero and portfolio approval absent.
- The new verifier checked the actual [final revocation](https://sepolia.etherscan.io/tx/0x2a4ca9ba41a8fe0d11f8d8eeba69a9a50dee27841b80e8c0905366e5032671f8), block **12075584**, against the exact expected `setApprovalForAll(operator, false)` call. No fresh transaction was sent.

The [Vercel security deployment](uniswap-security-deployment.json) serves the updated bundle at [afterkey.vercel.app](https://afterkey.vercel.app). Public root/assets return 200, `.env` returns 404, and unsigned relay POST/GET return 400/405. Browser verification at block **12076376** displayed both retained positions and absent approvals. Changing the RPC cleared the cached portfolio; the original public RPC was restored and the live read repeated successfully. No wallet transaction was sent.

Older exported receipts are historical evidence. Missing exact-call fields are not silently upgraded to verified receipts. A fully signed coverage claim is deliberately conservative when one broad revocation also removes inherited paths.

## Remaining dependency warning

The root application audit reported **zero known dependency vulnerabilities**. The separate CRE audit reported **two high-severity package entries for one underlying [Zod advisory, GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)**: Zod and its dependent Chainlink SDK. The advisory affects versions below 4.6.6 and concerns excessive memory use during collection validation.

The current Chainlink CRE SDK **1.23.0** pins **Zod 3.25.76** and uses v3-only function-schema APIs in its WASM host bindings. Forcing Zod v4 or accepting npm's suggested SDK downgrade to 0.0.0 would break compatibility. This warning remains unresolved pending a compatible upstream SDK release; no unsafe override was applied.

AfterKey does not supply a Zod schema to `Runner.newRunner`. Its own public relay limits signed request bodies to 16 KB, recovers the configured owner's signature, and forwards only the deployed workflow and workspace. CRE also bounds HTTP input, GitHub issue data, ENS targets and position count. These existing limits reduce input exposure; they do not establish that the SDK is immune to the advisory. The SDK runtime and host boundary still need an upstream fix and review.

## Scope limits

One-confirmation receipt checks establish canonical inclusion at the instant checked, not permanent finality. Fresh review cannot eliminate changes after signing or mempool races. Broad-first cleanup uses separate owner-signed transactions and is not atomic. Public RPC responses remain a trust dependency. Local browser exports can be edited and should be checked against transaction hashes and chain state. Unknown contracts, permits, other wallets and unconfigured ENS resources remain outside coverage. Liquidity withdrawal is implemented and tested but was not executed as part of this preservation proof.
