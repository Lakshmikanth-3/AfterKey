# Demo flow — no simulations

For the ENS prize, use `ENS_QUALIFICATION_REVIEW.md`: real subname/profile → key plus root text delegation → key-only revoke → effective permission still active → broad-first offboarding → operator authorization absent and owner/name retained. The ENS identity screen guides actual setup and delegation; a registered parent and wallet signatures are required.

1. Show the owner and departing wallet plus the configured testnet scope.
2. Explain that a position approval can be removed while operator-wide approval remains.
3. Scan live state. Show the operator finding and any separately configured ENS findings.
4. Review the broad-first plan and exact calldata.
5. Sign transactions in the owner wallet. Show confirmed receipt/explorer links.
6. Recheck permissions. Show the block, remaining path count and owner ownership/role comparisons.
7. Export evidence. State the coverage limit: configured contracts/resources at the recorded block.

Do not describe view-state verification as an executed attack attempt or a universal proof of no access. No privileged-call simulations are included.

## Final 2-minute narration

**0:00–0:15 — Problem**

“When a teammate leaves, teams revoke the permission they remember and hope there is not another one. Onchain access does not work like that: a narrow permission can disappear while a broader approval still survives.”

**0:15–0:45 — ENSv2 identity**

“This is `treasury-agent.manager.eth`, a real ENSv2 subname on Sepolia. AfterKey follows the registry hierarchy, verifies the Permissioned Resolver, and reads Enhanced Access Control directly. The operator had both key-level and resolver-wide authority. We removed both, while the team kept the name, owner, address and records.”

**0:45–1:15 — Uniswap position access**

“The same trap exists in Uniswap v3. These are real position NFTs 234145 and 234146. A position can have an individual approval and the wallet can also have portfolio-wide approval. Removing only the individual approval still left access. AfterKey found the surviving path and removed the final portfolio approval without moving or closing either position.”

**1:15–1:40 — Chainlink CRE verification**

“Chainlink CRE independently checks the departure. It validates a completed GitHub case, reads the baseline and final Sepolia state, and verifies that permissions are absent while the ENS identity and Uniswap assets are preserved. CRE never holds the owner key; every revocation remains wallet-signed.”

**1:40–2:00 — Proof**

“Every claim is reproducible. The app exposes transaction receipts, block-bound evidence, deployed contract addresses and the public source. AfterKey closes every known path, not the identity or the position.”

## Recording checklist

- Record desktop at 1080p; do not film the screen with a phone.
- Keep the browser at 90–100% zoom and hide unrelated tabs or notifications.
- Show the live app, ENS identity, both Uniswap positions, final revocation receipt, CRE execution result and GitHub repository.
- Keep the final export under four minutes; target 2:00–2:30.
- Do not create new grants, positions or transactions for the recording. Use the saved real evidence.
