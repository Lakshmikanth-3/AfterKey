# Uniswap developer feedback

Integration: the official Sepolia Uniswap v3 NonfungiblePositionManager, using ERC-721 `balanceOf`, `tokenOfOwnerByIndex`, `ownerOf`, `getApproved`, `isApprovedForAll`, `approve`, `setApprovalForAll`, `positions`, `collect`, `decreaseLiquidity` and the manager's `multicall`.

The separate per-token and operator approval paths are useful for delegated management but require explicit presentation when offboarding. Clearing one does not clear the other. Position enumeration lets an owner-bound tool discover positions without a separate indexer, though large portfolios need pagination.

The deployment documentation explicitly lists a Sepolia position-manager address, which avoids assuming identical addresses across networks.

The position workspace now distinguishes recorded owed tokens from uncheckpointed fees, fixes collection recipients to the team owner, requires explicit withdrawal minimums/deadline, and compares principal state during offboarding. A position NFT can remain owned by the team even after liquidity has been removed; ownership alone is not sufficient preservation evidence.

This is implementation feedback. No live signed-transaction feedback is claimed yet. Add actual wallet/testnet findings after completing the new-setup flow.

Before prize submission, publish this file in the public repository and submit its public link through the [Uniswap developer feedback form](https://developers.uniswap.org/hackathon-feedback). This form has not been submitted by the agent.
