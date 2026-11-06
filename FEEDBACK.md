# Uniswap developer feedback

Project: [AfterKey](https://github.com/Lakshmikanth-3/AfterKey). Integration: the official Sepolia v3 NonfungiblePositionManager at `0x1238536071E1c677A632429e3655c799b22cDA52`.

We used ERC-721 enumeration, `ownerOf`, `getApproved`, `isApprovedForAll`, `approve`, `setApprovalForAll`, `positions`, `collect`, `decreaseLiquidity` and the manager's `multicall`. The owner created positions **234145** and **234146**, delegated one to an operator, and the operator successfully collected to the fixed owner address. That collection returned zero tokens. Narrow revocation left portfolio access active; final portfolio revocation at block **12075584** removed access while both positions retained their ownership and liquidity. [Receipt and historical-state evidence](docs/uniswap-offboarding-verification.json).

Separate token and portfolio approvals are useful for delegation. They also make offboarding easy to get wrong: clearing one is insufficient. ERC-721 approval permits managing and transferring the NFT, so the UI must not describe it as fee-only access. Ownership alone also cannot prove principal preservation; we compare liquidity, pair, fee tier, range and recorded owed amounts.

The deployment documentation's explicit Sepolia address helped avoid assuming identical addresses across networks. Enumeration made a small portfolio readable without an indexer. Larger portfolios need bounded pagination and explicit incomplete-coverage handling.

During the real testnet setup, searching for “Sepolia” as a token returned unrelated mainnet tokens. A direct network-selection guide and verified test-token addresses would reduce this confusion. The Uniswap interface also reported “error fetching data required for your transaction” before a wallet request became available; the message did not identify the failing dependency or whether a transaction had been broadcast.

An initial batched mint consumed the supplied gas and failed inside the batch. A later attempt with a larger reviewed gas limit succeeded using the same small deposit. The failure was not evidence that a 1-USDC deposit was below a minimum. Showing inner-call failures and distinguishing gas exhaustion from slippage, allowance and data-fetch errors would help builders debug without guessing.

AfterKey now fixes collection recipients to the team owner, requires explicit withdrawal minimums/deadlines, and verifies financial position state during offboarding. Optional withdrawal has unit coverage but was not used in the live preservation demo.

Public feedback link for the required [developer form](https://developers.uniswap.org/hackathon-feedback): https://github.com/Lakshmikanth-3/AfterKey/blob/main/FEEDBACK.md . Technical answers are prepared; form submission is not yet confirmed.
