# ETHGlobal showcase package

Use the text in **Paste-ready fields** in the participant dashboard. The proof and sponsor answers below are final and match the public implementation.

## Paste-ready fields

**Project name**

AfterKey

**Tagline**

Offboard the operator. Keep the identity.

**Short description**

AfterKey finds onchain permissions that survive employee offboarding, prepares owner-reviewed revocations, and proves that the team's ENS identity and Uniswap positions remain intact. ENSv2 provides hierarchical identity and scoped access, while Chainlink CRE independently connects a completed GitHub departure case to historical and current Sepolia state.

**Live demo**

https://afterkey.vercel.app

**Source code**

https://github.com/Lakshmikanth-3/AfterKey

**Primary technologies**

ENSv2, Enhanced Access Control, Permissioned Resolver, Permissioned Registry, Uniswap v3, Chainlink CRE, viem, TypeScript, Vite, Vercel, Sepolia

**Prize selections — maximum three**

1. ENS — Best Use of ENSv2
2. Uniswap Foundation — Build with Uniswap
3. Chainlink — Best workflow with CRE

**AI disclosure**

AI assisted with implementation, debugging, documentation and test generation. The repository includes the product requirements, AI attribution and implementation evidence. All claimed sponsor integrations were exercised against real Sepolia state or authenticated Chainlink CRE executions; privileged wallet operations were reviewed and signed by the project owner.

## Project

**AfterKey — Offboard the operator. Keep the identity.**

AfterKey helps a team remove a departing operator's onchain permissions without discarding its ENS identity or Uniswap liquidity positions. It discovers independent access paths, prepares owner-reviewed revocations, and verifies what remains afterward. Chainlink CRE connects a completed GitHub departure case with historical and current Sepolia state.

Source: https://github.com/Lakshmikanth-3/AfterKey

Application: https://afterkey.vercel.app — public app and signed CRE relay verified.

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

The public demo and Uniswap developer form are complete; [form confirmation](uniswap-feedback-confirmation.png). The published Chainlink CRE prize requirements do not list a separate feedback form: https://ethglobal.com/events/mumbai/prizes .

## Sponsor-answer copy

### ENS — Best Use of ENSv2

AfterKey makes ENSv2 the identity and access-control layer, not a display-name feature. It follows the live hierarchy to `treasury-agent.manager.eth`, verifies the official Permissioned Registry and Permissioned Resolver implementations, reads Enhanced Access Control roles, distinguishes key-scoped from resolver-wide authority, and prepares broad-first revocations. Ten Sepolia receipts and 30 historical checks show that the operator loses the configured access paths while the name, owner, address and records remain with the team.

### Uniswap Foundation — Build with Uniswap

AfterKey reads real Uniswap v3 position NFTs from the official Sepolia NonfungiblePositionManager and treats individual approval and portfolio-wide approval as independent offboarding paths. The demonstrated lifecycle minted positions 234145 and 234146, delegated an operator, allowed collection only to the owner, exposed surviving portfolio access after a narrow revoke, then removed the final approval. Fourteen historical checks confirm that ownership, liquidity, pair, fee tier and tick range were preserved. `FEEDBACK.md` is public and the required developer form was submitted.

### Chainlink — Best workflow with CRE

Chainlink CRE independently joins an external HR-style departure signal with onchain authorization state. A completed, labeled GitHub issue identifies the departing wallet; owner-signed HTTP authorization, scheduled monitoring and Uniswap approval-event triggers execute the deployed workflow. The successful departure run validates issue 2, compares baseline block 12075512 with final block 12075653 and returns `permissions_absent_assets_preserved`. CRE verifies the outcome but never holds the owner key or signs revocations.

## Final dashboard checklist

- [ ] Upload or link the real 2–4 minute demo video.
- [ ] Paste the live demo and public GitHub URLs exactly as shown above.
- [ ] Select the three sponsor prizes listed above; do not select Continuity-only variants.
- [ ] Include the AI disclosure.
- [ ] Preview every external link.
- [ ] Submit before the event deadline and save the public showcase URL.
