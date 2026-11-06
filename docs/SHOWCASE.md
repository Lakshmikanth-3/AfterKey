# Showcase draft

## Project

**AfterKey — Offboard the operator. Keep the identity.**

AfterKey helps a team remove a departing operator's onchain permissions without discarding its ENS identity or Uniswap liquidity positions. It discovers independent access paths, prepares owner-reviewed revocations, and verifies what remains afterward. Chainlink CRE connects a completed GitHub departure case with historical and current Sepolia state.

Source: https://github.com/Lakshmikanth-3/AfterKey

Application: https://afterkey-access.resplendentflair1.chatgpt.site — verify judge access before submitting. The demo video and ETHGlobal showcase submission have not yet been published.

## How it works

ENSv2 is the identity and permission layer. AfterKey follows the real registry hierarchy to `treasury-agent.manager.eth`, reads its Permissioned Resolver and Enhanced Access Control roles, and separates key-specific authority from resolver-wide authority. Removing a narrow role can leave effective access active. The team keeps its name, public records and owner control while removing the operator's known permissions.

Uniswap v3 supplies a second real delegation system with the same operational trap: per-position approval and portfolio-wide approval are independent. AfterKey reads the official Sepolia position manager, discovers actual NFTs, lets a delegated operator collect to the fixed team owner, and removes both approval paths. It compares position ownership, liquidity, token pair, fee tier, range and recorded owed amounts before declaring preservation.

Chainlink CRE provides independent orchestration through scheduled monitoring, approval-event triggers and owner-signed HTTP requests. It checks that a public GitHub issue was completed by the configured approver with the correct label and departing wallet. The deployed workflow compares baseline and final chain state and produces digest-bound execution evidence. Wallets retain signing control; CRE does not sign the owner's revocations.

## What was demonstrated

- ENSv2: ten actual receipts and 30 historical-state checks verify identity-preserving offboarding.
- Uniswap: two minted NFTs, individual delegation, operator-signed collection, portfolio delegation, narrow-only revocation with surviving authority, and final portfolio revocation. Collection returned zero tokens. Fourteen final checks confirm retained positions and absent modeled access.
- CRE: successful scheduled and approval-event executions, then successful signed HTTP departure execution `f42d1d27-6bcf-4689-b290-d4d533f83729`. It validates GitHub issue 2 and compares blocks 12075512 and 12075653, returning `permissions_absent_assets_preserved`.

Proof index: [README](../README.md#verify-the-implementation), [current status](E2E_STATUS.md). AI assistance is disclosed in [AI attribution](AI_ATTRIBUTION.md).

## Two-minute recording guide

Record the real application and narrate these steps. The completed lifecycle already has receipts; recording does not require regranting access.

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:15 | AfterKey, configured owner/operator | A teammate can leave while a broader permission survives a narrow revoke |
| 0:15–0:40 | ENS identity audit of `treasury-agent.manager.eth` and its current record | Real ENSv2 hierarchy, resolver and effective roles; the identity remains with the team |
| 0:40–1:05 | Uniswap positions 234145 and 234146 plus saved action evidence | The operator collected to the owner; individual revocation at 12075553 still left portfolio approval active |
| 1:05–1:25 | Final revocation receipt at 12075584 and a fresh scan | Zero modeled findings; the two positions and ENS data remain. Show operator preparation denial without sending a transaction |
| 1:25–1:50 | GitHub issue 2 and authenticated CRE output | A completed external case drives actual CRE verification of the baseline and final state |
| 1:50–2:00 | Evidence export and public source | Reproducible receipts and block-bound proof across the configured scope |

## Sponsor selections

Apply to ENS **Best Use of ENSv2**, Uniswap **Build with Uniswap**, and Chainlink **Best workflow with CRE**, subject to the event dashboard's eligibility. This project does not claim CCIP integration or a mainnet Continuity integration.

Before final submission: verify the demo's judge access, submit the Uniswap developer form with the public FEEDBACK.md link, attach the real video, and submit the showcase through the participant dashboard. The published Chainlink CRE prize requirements do not list a separate feedback form: https://ethglobal.com/events/mumbai/prizes .
