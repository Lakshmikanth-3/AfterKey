# AfterKey — Proof-of-Revocation Security Engine

**ETHGlobal Mumbai 2026 · Classic (From Scratch) Track**
**Submission deadline: Saturday 7 November 2026, 09:00 IST**
**PRD version 1.0 — written 2026-11-05 22:45 IST**

> *"A revoked permission does not mean revoked power."*

---

## 0. TL;DR

AfterKey is an offboarding engine for Web3 teams. When an operator leaves, it finds
the permissions they still hold, shows the owner which ones are **dangerous because a
second path survives the obvious revocation**, executes the revocations, and then
**proves** the former operator can no longer act — by simulating their privileged call
and showing it revert on-chain.

The innovation is not revocation. Revocation already exists (Revoke.cash, multisig
admin panels). The innovation is **residual-path detection and proof**: revoking the
narrow permission while a broad one survives is the actual failure mode, and nothing
today catches it.

**Three sponsor picks:** ENS · Uniswap Foundation · Chainlink

---

## 1. What changed from the original AfterKey idea

The original pitch had four weaknesses. Each is fixed below.

| Weakness in v1 | Why it fails at judging | Fix in v2 |
|---|---|---|
| "Discovers permissions across different contracts and systems" | Unbounded. A judge asks "which contracts?" and the answer is a shrug. Cannot be proven complete. | Scope hard to **two** permission systems: ENSv2 Enhanced Access Control and Uniswap position approvals. State the boundary out loud. |
| "Proposes revocation transactions" | This is Revoke.cash. Judges use Revoke.cash. | Reframe around **residual access paths** — the second route that survives the obvious revocation. This is the novel claim. |
| "Checks whether permissions have been removed" | A status table is a UI claim, not proof. | **Execute** the privileged call as the former operator via `eth_call` and show the revert. Proof by failure, not by green tick. |
| Demo = "Bob's transaction fails" | Undramatic. Nothing visibly at stake. | Demo = the **near-miss**: Alice revokes, thinks she is safe, Bob still succeeds. Then AfterKey finds the residual path and closes it. |

---

## 2. The core insight — residual access paths

Two concrete, real cases. These are the spine of the whole project.

### 2.1 ENSv2 — role vs root role

ENSv2's Enhanced Access Control is a shared role-based permission system used by both
registries and resolvers. It exposes `grantRoles` / `revokeRoles` **and**
`grantRootRoles` / `revokeRootRoles`.

The failure: Alice revokes Bob's specific role on a subname's resolver. Bob still holds
a **root role** on the parent registry, which lets him reassign roles to himself — or
act across every subname below it. Alice's revocation looks successful and achieves
nothing.

Second ENSv2 case: resolver-level permissions are distinct from registry-level
permissions. Revoking Bob's ability to edit records on the registry does not touch a
Permissioned Resolver where he still holds rights.

### 2.2 Uniswap — per-token approval vs operator-wide approval

A Uniswap v3/v4 liquidity position is an NFT. There are two independent approval
mechanisms:

- `approve(spender, tokenId)` — permission over **one** position
- `setApprovalForAll(operator, true)` — permission over **every** position the owner
  holds, now and in the future

The failure: Alice revokes Bob's per-token approval on the position he managed. Bob
still holds operator-wide approval and can move **all** the team's positions, including
ones created after he left.

This is the single best demo beat in the project. It is real, it is common, and the
second path is invisible in the obvious UI.

### 2.3 Why this makes a project rather than a feature

A revocation tool answers "did this call succeed?" AfterKey answers **"is this person
still powerful?"** — which is a different and harder question, because power can route
through a path nobody looked at.

---

## 3. Mistakes to avoid

These are the things that will cost you the prize. Read before writing code.

### 3.1 Scope mistakes

1. **Do not claim to scan every permission on Ethereum.** You cannot. Say in the README
   and in the video: "AfterKey covers two permission systems today: ENSv2 EAC and
   Uniswap position approvals. Everything else is out of scope." A stated boundary reads
   as rigour. An unstated one reads as a bug.
2. **Do not build a dashboard.** A permissions table with coloured badges is the weakest
   possible version. The product is the *proof*, not the inventory.
3. **Do not add a fourth protocol.** Two systems done provably beats five done by
   guessing.

### 3.2 Technical mistakes

4. **Do not use mock contracts for Uniswap.** The track requires integration with the
   real stack and says the README must point to the relevant contracts and lines of code
   so judges can verify. Deploy against official Uniswap contracts on Sepolia (or a fork,
   with the fork clearly stated).
5. **Do not hardcode values.** ENS states explicitly that the demo must be functional and
   not just include hard-coded values. Every permission shown must be read live from
   chain state.
6. **Do not confuse ENSv1 and ENSv2.** The track is ENSv2 on mainnet or Sepolia.
   ENSv1 resolver code will not qualify.
7. **Do not lock out the owner.** The most likely bug in this project: a revocation that
   also strips Alice. Every revocation batch must be followed by an automated check that
   the owner's own privileged call still succeeds. Make this a visible step, not an
   afterthought.
8. **Do not prove revocation with a UI state change.** Prove it by executing the call.
   `eth_call` from Bob's address against the live post-revocation state, show the revert
   reason. That is evidence.
9. **Do not forget the ordering problem.** Revoke the **broad** permission first, then the
   narrow one. If you revoke narrow-first and the attacker is watching the mempool, they
   can re-grant themselves through the surviving root role. Mention this in the README as
   a design decision — it shows you thought about the adversary.
10. **Do not run on mainnet with real assets.** Sepolia throughout.

### 3.3 Submission mistakes

11. **Do not single-commit.** Commit history is checked and large single commits may be
    disqualified. Commit every 30–45 minutes from now.
12. **Do not skip Uniswap's FEEDBACK.md** *and* the Developer Feedback Form. Both are
    required; submissions without them are reviewed and audited before winners are
    finalised. The form must contain the link to your FEEDBACK.md.
13. **Do not skip the AI attribution.** Document where AI tools were used — which files,
    which parts. If you use a spec-driven workflow, all spec files and prompts go in the
    repo.
14. **Do not break the video rules.** 2–4 minutes, 720p minimum, real voice. No AI
    voiceover, no text-over-music instead of narration, no phone recording, no speeding up
    to fit the limit. Any of these forces a re-submit.
15. **Do not forget the live demo link.** ENS requires the showcase to link a live demo
    and open-source code.

### 3.4 Judging mistakes

16. **Do not lead with the offboarding story.** Lead with the near-miss: "she revoked it,
    and he could still move the money." Tension first, explanation second.
17. **Do not hide prior art.** Name Revoke.cash and OWASP's offboarding guidance yourself,
    then state what residual-path detection adds. Being caught out by prior art is fatal;
    naming it is credibility.

---

## 4. Proof of workflow — the demo

Seven minutes in finalist judging: 4 minutes demo, 3 minutes Q&A. The video is 2–4
minutes. Both use this sequence.

### Setup (pre-staged, shown in 15 seconds)

- `acme.eth` on ENSv2 Sepolia, owned by **Alice**
- **Bob** holds: a role on the `treasury.acme.eth` resolver, *and* a root role on the
  parent registry
- **Bob** holds: `approve()` on LP position #A, *and* `setApprovalForAll` over Alice's
  whole position portfolio
- Position #B exists and was created **after** Bob's departure — proving the operator
  approval reaches positions he never managed

### Act 1 — the naive revocation fails (60s)

1. Alice marks Bob as departed. The obvious permissions are revoked: his resolver role,
   his approval on position #A. Two real Sepolia transactions, hashes on screen.
2. The screen says what any tool today would say: **revoked**.
3. Bob attempts to move position **#B**. **It succeeds.** Transaction hash on screen,
   explorer link.
4. Bob attempts to re-grant himself the resolver role via his surviving root role.
   **It succeeds.**

This is the moment the project exists for. Hold on it.

### Act 2 — AfterKey finds the residual paths (45s)

5. AfterKey scans live chain state and reports two surviving paths, read from chain, not
   hardcoded:
   - *Operator-wide approval over all positions — reaches 2 positions including one
     created after departure*
   - *Root role on parent registry — permits self-re-granting of any child role*
6. For each, AfterKey shows **why** the first revocation missed it: different function,
   different contract, different scope.

### Act 3 — Alice closes them, with human proof (45s)

7. Alice authenticates. The revocation batch is a protected action — it is irreversible
   and it can lock out the owner, so it requires a fresh human check, not just a
   connected wallet. *(World ID Agent Pass would be the natural fit here; see §6.4 if you
   have a fourth pick.)*
8. Broad-first ordering: `setApprovalForAll(false)` and `revokeRootRoles` execute before
   the narrow cleanups. Transaction hashes on screen.

### Act 4 — proof, not claims (45s)

9. AfterKey executes Bob's privileged calls again via `eth_call` against live
   post-revocation state:
   - move position #B → **reverts**, revert reason displayed
   - re-grant resolver role → **reverts**, revert reason displayed
10. AfterKey executes **Alice's** equivalent calls → **succeed**. The owner is not locked
    out.
11. Chainlink CRE panel: the workflow that fired on the departure signal, and the
    verification result it wrote back.

### Closing frame (15s)

```
Paths revoked by hand:        2
Paths that survived:          2
Positions still reachable:    2  (one created after departure)
After AfterKey:               0
Owner access:                 intact
```

### What makes this proof rather than demo theatre

- Every state change is a real Sepolia transaction with an explorer link.
- Every "he can no longer do this" is an executed call that reverts, with the reason shown.
- Position #B was created after Bob left — it cannot be staged collusion.
- The owner-still-works check runs automatically and is visible.

---

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js + viem/wagmi)                            │
│  Departure form · Path report · Revocation review · Proof   │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│  Path Engine (TypeScript)                                   │
│                                                             │
│  ens-scanner.ts      roles + root roles, registry + resolver│
│  uniswap-scanner.ts  approve(tokenId) + isApprovedForAll    │
│  residual.ts         which surviving path defeats which     │
│                      revocation (the core logic)            │
│  ordering.ts         broad-before-narrow revocation plan    │
│  prover.ts           eth_call as Bob → expect revert        │
│                      eth_call as Alice → expect success     │
└───────────────┬─────────────────────────────────────────────┘
                │
     ┌──────────┴──────────┬────────────────────┐
     ▼                     ▼                    ▼
  ENSv2 Sepolia      Uniswap Sepolia      Chainlink CRE
  EAC registry       NonfungiblePosition  departure signal →
  + resolver         Manager              verify → report
```

### The file that matters

`residual.ts` is the project. Everything else is plumbing. It holds the rule set:

```
RULE ens-root-survives-role
  IF subject holds rootRole(parent)
  THEN revoking role(child) is INSUFFICIENT
  BECAUSE subject can re-grant role(child) to self

RULE ens-resolver-separate-from-registry
  IF subject holds role on PermissionedResolver(name)
  THEN revoking role on registry(name) is INSUFFICIENT
  BECAUSE record-editing rights live on the resolver

RULE uniswap-operator-survives-token-approval
  IF isApprovedForAll(owner, subject) == true
  THEN revoking approve(tokenId) is INSUFFICIENT
  BECAUSE operator approval covers all tokenIds, including future ones
```

Point judges at this file by name in the README. It is the thing that is not
Revoke.cash.

---

## 6. Sponsor requirements — checklist

### 6.1 ENS — Best Use of ENSv2 · $7,000 · 4 places ($3,000 / $2,000 / $1,000 / $1,000)

**What the track wants:** the new hierarchical registry structure, wildcard resolution,
your own subname registry, **Enhanced Access Control** (the shared role-based permission
system behind both registries and resolvers), Permissioned Resolvers, record and
namespace aliasing. Bonus points for bringing AI agents in — agents as namespaces, each
with their own identity and permissions.

**Qualification requirements:**

- [ ] Built on ENSv2, Ethereum mainnet or Sepolia
- [ ] ENSv2 features **central to the product**, not a cosmetic add-on
- [ ] Demo functional, **not hard-coded values**
- [ ] Showcase links a live demo
- [ ] Code open source on GitHub or similar

**How AfterKey satisfies it:** EAC is not decoration here — the root-role-survives-role
case is the project's central finding. You grant, detect, revoke and *verify* real EAC
roles on Sepolia.

**Resources:**
- Permissioned Registry docs — https://docs.ens.domains/ensv2/permissioned-registry
- Permissioned Resolver docs — https://docs.ens.domains/ensv2/permissioned-resolver/
- Enhanced Access Control docs — https://docs.ens.domains/ensv2/enhanced-access-control/
- Guide for Contract Developers — https://docs.ens.domains/ensv2/tutorial-contract-developers/
- Guide for App Developers — https://docs.ens.domains/ensv2/tutorial-app-developers/
- ENSv2 overview — https://docs.ens.domains/ensv2/overview/
- Agent-native CLI — https://github.com/ensdomains/ens-cli
- Agent Text Records (ENSIP-26) — https://docs.ens.domains/ensip/26/
- AI Agent Registry ENS Name Verification (ENSIP-25) — https://docs.ens.domains/ensip/25/
- Building with AI — https://docs.ens.domains/building-with-ai/
- Workshop: *ENSv2 — Identity for Apps, Agents & Beyond*, Thu 5 Nov 16:00 IST, Workshop Room 1

**Optional stretch for the AI bonus:** treat a departing *agent* as the subject — an
agent namespace with its own roles, offboarded the same way a human is. Only attempt if
the two core cases are already working.

---

### 6.2 Uniswap Foundation — Build with Uniswap · $10,000 · 4 places ($4,000 / $3,000 / $2,000 / $1,000)

**What the track wants:** build on or integrate any part of the Uniswap stack — the
Uniswap API, the AMM (v2, v3 or v4), CCA, or any other Uniswap protocol; new v4 hooks,
extensions or improvements to official repos, and tooling or solutions built for the
broader ecosystem.

**AfterKey is explicitly "tooling for the broader ecosystem."** Say those words.

**Qualification requirements:**

- [ ] Public GitHub repository, open-source code
- [ ] **FEEDBACK.md** file in the repo
- [ ] Completed Uniswap Developer Feedback Form — https://developers.uniswap.org/hackathon-feedback — **including the link to your FEEDBACK.md**
- [ ] README **clearly points to the relevant contracts and lines of code** so judges can verify the integration
- [ ] Proper commit history

⚠ Submissions without the feedback form are reviewed and audited before winners are
finalised. This is the cheapest prize-qualifying work in the whole project — do it at
hour 20, not hour 33.

**README section to write (judges will look for exactly this):**
```
## Uniswap integration
Contract:  NonfungiblePositionManager @ <sepolia address>
Read:      src/scanners/uniswap-scanner.ts L14-L62
           getApproved(tokenId) · isApprovedForAll(owner, operator)
Write:     src/revoke/uniswap.ts L8-L41
           approve(address(0), tokenId) · setApprovalForAll(operator, false)
Proof:     src/prover.ts L55-L90
           eth_call transferFrom as revoked operator → expect revert
Tx hashes: see /docs/transactions.md
```

**Resources:**
- Uniswap Docs — https://developers.uniswap.org/docs
- Uniswap Developer Platform — https://developers.uniswap.org/dashboard/welcome
- Uniswap AI Skills — https://www.skills.sh/uniswap/uniswap-ai
- Feedback form — https://developers.uniswap.org/hackathon-feedback
- Workshop: *How to Navigate the Uniswap Stack*, Thu 5 Nov 16:30 IST, Workshop Room 1

**Honest note:** Uniswap is the most contested track at every ETHGlobal, and AfterKey is
tooling rather than an AMM innovation. Treat placing here as upside, not as the plan.

---

### 6.3 Chainlink — Best workflow with CRE · $1,500

**What the track wants:** CRE as an **orchestration layer within your project**,
connecting a blockchain with an external API, system, data source, LLM or AI agent.

**Qualification requirements:**

- [ ] Build, simulate **or** deploy a CRE Workflow used as an orchestration layer
- [ ] Integrate at least one blockchain with an external API / system / data source / LLM / agent
- [ ] Demonstrate a successful **simulation via CRE CLI** *or* live deployment — deployment is **not** mandatory, simulation is enough
- [ ] Workflow is **meaningfully used** in the project
- [ ] Workflow code, config and simulation logs in the repo
- [ ] Workflow shown in the video

**AfterKey's workflow (genuinely orchestration, not decoration):**

```
TRIGGER   departure signal from external HR/identity API (mock endpoint is fine)
STEP 1    read subject's current ENSv2 role + root-role state on-chain
STEP 2    read subject's Uniswap getApproved + isApprovedForAll state on-chain
STEP 3    run residual-path rules off-chain
STEP 4    write verification result on-chain / notify owner
RECHECK   re-run post-revocation; if any path survives, raise
```

The recheck is what makes it orchestration rather than a webhook: CRE independently
verifies that the revocation actually worked, so the proof does not depend on AfterKey's
own frontend telling the truth.

⚠ **Chainlink's own note:** a project must use **CCIP** in some form to make a state
change on a blockchain to be eligible for the Chainlink *core* prizes — a frontend
merely reading from Data Feeds does not count. The CRE prize is its own track with its
own requirements above; confirm at the booth whether the CCIP condition applies to the
CRE prize for your submission. Ten minutes of asking, $1,500 of clarity.

**Resources:**
- CRE Docs — https://docs.chain.link/cre
- Intro to CRE playlist — https://www.youtube.com/playlist?list=PLVP9aGDn-X0S-JmwQKGTao6o_CMitvv2_
- CRE Templates — https://github.com/smartcontractkit/cre-templates/
- CCIP Documentation — https://docs.chain.link/ccip
- CCIP 2.0 LinkLab — https://www.youtube.com/watch?v=jt2fM84DGVE

---

### 6.4 Note on the fourth pick

You have **3 partner prize picks**. If a partner has multiple tracks, you are eligible
for all of them while only counting as 1 pick — so check at each booth whether your
project can be judged in more than one of their tracks.

If a pick frees up, **World ID Agent Pass ($5,000, 3 places)** is the natural fourth:
the revocation batch is irreversible and can lock out the owner, which is exactly the
"meaningful action that needs a human identity or approval layer, not simply a login
screen" that track asks for. It also requires a denied/expired/cancelled path where the
protected action does not occur — which AfterKey has for free (thief tries to release,
denied).

---

## 7. ETHGlobal submission requirements

- [ ] Submitted by **Sat 7 Nov 2026, 09:00 IST** via the Hacker Dashboard
- [ ] Project title, description, repository link
- [ ] **Up to 3 Partner Prizes** selected on the final step — this is the only way partners assess the project
- [ ] Demo video **2–4 minutes**, **720p minimum**, real spoken voice
- [ ] Live demo link
- [ ] Public repo, open-source licence, README with setup instructions
- [ ] **Classic / From Scratch:** all work begins after the hackathon starts. No prior project-specific code, designs or assets except public libraries and starter kits
- [ ] Commit history shows steady progress — no large single commits
- [ ] AI tool attribution: which files, which parts, which tools
- [ ] Spec files and prompts in the repo if using a spec-driven workflow

**Judging criteria (five categories):** Technicality · Originality · Practicality ·
Usability (UI/UX/DX) · WOW Factor.

**Finalist session:** 7 minutes — 4 minutes demo, 3 minutes Q&A.

**Finalist prizes (separate, cost no partner pick):** 3–5 people → 1,000 USDC per person
+ 500 USDC travel per person. A team of four is roughly $6,000, plus the finalist pack.

**Partner judging** is from submitted materials. Visiting booths is optional and is for
feedback and networking, not required for judging.

---

## 8. Build plan — 34 hours

Now: Thu 22:45 IST. Deadline: Sat 09:00 IST.

| Block | Hours | Deliverable | Cut line if behind |
|---|---|---|---|
| **A** | Thu 23:00 – Fri 03:00 | Sepolia setup. ENSv2 name + subname. Grant Bob a resolver role **and** a root role. Grant Bob per-token approval **and** `setApprovalForAll`. Mint position #B. **Both residual paths must exist and be exploitable before anything else is built.** | Nothing. This is the project. |
| **B** | Fri 03:00 – 07:00 | `ens-scanner.ts` + `uniswap-scanner.ts` reading live state. No UI. | — |
| **C** | Fri 07:00 – 11:00 | `residual.ts` rule engine + `ordering.ts`. Console output only. | — |
| **D** | Fri 11:00 – 15:00 | `prover.ts` — eth_call as Bob → revert; as Alice → success. **This is the differentiator.** | Never cut. |
| **E** | Fri 15:00 – 19:00 | Revocation execution on Sepolia. Real transactions. Record every hash in `/docs/transactions.md`. | — |
| **F** | Fri 19:00 – 22:00 | Frontend: departure form → path report → review → proof panel. Functional over pretty. | Reduce to one page. |
| **G** | Fri 22:00 – Sat 01:00 | Chainlink CRE workflow + CLI simulation + logs committed. | Cut if D or E is unfinished — CRE is $1,500, the EF-grade proof is the project. |
| **H** | Sat 01:00 – 03:00 | **FEEDBACK.md, Uniswap feedback form, README with contract/line pointers, AI attribution, prior-art section.** | Never cut. This is prize-qualifying. |
| **I** | Sat 03:00 – 06:00 | Record video. 2–4 min, 720p, real voice. Multiple takes. | — |
| **J** | Sat 06:00 – 08:00 | Deploy live demo, final README pass, submit. | — |
| **K** | Sat 08:00 – 09:00 | Buffer. **Do not plan into this hour.** | — |

**Commit every 30–45 minutes.** Set a timer.

**Hour-4 go/no-go:** if Bob cannot exploit both residual paths on live Sepolia by
Fri 03:00, the demo has no Act 1 and the project has no claim. Stop and simplify to the
Uniswap operator-approval case alone — it is the stronger of the two and it is enough.

---

## 9. Prior art — write this in the README before a judge raises it

| Exists today | What it does | What AfterKey adds |
|---|---|---|
| Revoke.cash | Discovers and revokes token and NFT approvals | Does not model *residual paths* — that a surviving operator-wide approval defeats a per-token revocation |
| Multisig admin tooling (Safe and others) | Manages signer sets and modules | Scoped to the multisig itself, not to permissions scattered across protocols |
| OWASP Web3 employee-lifecycle guidance | Identifies forgotten blockchain and multisig permissions as a real offboarding risk | Validates the problem — AfterKey is the first tool to *prove* removal rather than assert it |

**The sentence to use:** "Revocation tools answer *did this call succeed*. AfterKey
answers *is this person still powerful* — and proves the answer by executing their
privileged call and showing it revert."

---

## 10. Honest limits — say these before judges do

- Covers **two** permission systems: ENSv2 EAC and Uniswap position approvals. Not a
  universal permission scanner, and cannot be.
- Cannot prove a former operator has **no** access — only that the paths AfterKey models
  are closed. A second wallet, an unrelated contract, or a social path are out of scope.
- Permission discovery depends on knowing which contracts to ask. Discovery across
  arbitrary unknown contracts is an open problem, not a weekend one.
- Sepolia only. Mainnet deployment would need an audit.
- The residual-path rule set is hand-written today. The roadmap is deriving it from
  contract ABIs and role hierarchies automatically.

---

## 11. Open questions — resolve at the booths tonight

1. **Chainlink:** does the CCIP state-change condition apply to the CRE track, or only to
   the core prizes?
2. **ENS:** is a *departing agent namespace* in scope for the AI bonus, or is that stretching it?
3. **Uniswap:** v4 position approvals — same `setApprovalForAll` semantics as v3's
   NonfungiblePositionManager, or different? This changes which contract you target.
4. **ETHGlobal desk:** confirm the 09:00 IST Saturday deadline on your Hacker Dashboard.

---

## 12. The one-sentence pitch

> When someone leaves a Web3 team, you revoke their access — and they can still move your
> money, because the permission you revoked was not the one that mattered. AfterKey finds
> the path you missed, closes it in the right order, and proves it is closed by running
> their transaction and showing it fail.

---

*End of PRD.*
