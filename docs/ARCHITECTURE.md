# Architecture and evidence flow

![AfterKey architecture](architecture.svg)

The browser scanner and Chainlink CRE read independently. Asset changes require the actual owner's wallet signature. CRE never receives that private key or executes the owner's revocations.

## Owner-reviewed offboarding

```mermaid
sequenceDiagram
    actor Owner
    participant UI as AfterKey browser
    participant Wallet as Browser wallet
    participant Chain as ENSv2 and Uniswap v3 on Sepolia
    Owner->>UI: Select owner, operator and scope
    UI->>Chain: Pin block and read permission paths
    Chain-->>UI: Roles, approvals and captured asset state
    UI-->>Owner: Review broad and individual revocations
    Owner->>Wallet: Sign each reviewed transaction
    Wallet->>Chain: Submit revocation
    Chain-->>UI: Receipt, transaction hash and block
    UI->>Chain: Refresh between transactions and verify final state
    UI-->>Owner: Export scoped before/after evidence
```

## Independent CRE monitoring

```mermaid
flowchart TD
    Owner[Owner wallet] -->|Expiring signed request| Relay[AfterKey relay]
    Relay -->|Validated exact request| CRE[Chainlink CRE HTTP handler]
    Cron[CRE cron trigger] --> Monitor[CRE access monitor]
    Logs[Uniswap approval log trigger] --> Monitor
    CRE -->|Departure requests only| GitHub[Configured GitHub issue API]
    GitHub -->|Validated completed case| Reader[CRE pinned reader]
    CRE -->|Current or before/after check| Reader
    Monitor --> Reader
    Reader --> Batch[Sepolia Multicall3]
    Batch --> ENS[ENSv2 registries and Permissioned Resolver]
    Batch --> UNI[Uniswap v3 position manager]
    Reader --> Output[Remaining paths and captured asset state]
    Output --> Frames[Digest-bound execution log chunks]
    Frames --> CLI[Authenticated CRE status and logs]
    CLI --> Proof[Validated execution evidence]
```

## Verification boundaries

| Artifact | Establishes |
| --- | --- |
| Wallet transaction receipt | A specified transaction was mined; decoded destination/calldata and historical state give it meaning |
| Browser before/after report | Configured modeled access and captured owner/identity/position state at the recorded blocks |
| CRE gateway acceptance | A signed trigger was accepted, not that its workflow succeeded |
| Authenticated CRE execution proof | The matching deployed workflow completed and emitted the reconstructed scope-bound output |

Recurring monitoring has recorded live execution proof. A distinct GitHub departure case, signed HTTP request, approval-event run or position transaction needs its own reference before it is claimed as demonstrated. See [current verification status](E2E_STATUS.md).
