# Validation performed

- Browser application: TypeScript production build passed.
- Seven deterministic engine tests passed, covering independent operator/token approval paths, broad-first ordering, ENS root deduplication, authority gating, EAC admin bit layout, invalid scope and owner-state regression.
- A real read-only Sepolia scan against the official Uniswap v3 position manager completed at block 12071197 using two clearly non-user test addresses with no positions. This checks RPC/ABI integration, not the live revocation path.
- Browser form scanning completed at block 12071198 and showed zero findings for the same empty-address scope. Empty-input validation and ENS configuration controls were inspected in the browser. No wallet transactions were signed.
- CRE TypeScript typecheck passed. `cre workflow build . --target production` compiled the workflow to WASM successfully. Binary SHA-256 reported by CRE: `b5f95b0e6ab2821fca9b60cb7f8c56e4564b879d5101ac529db35742bbc30cba`.
- No privileged-call or CRE simulations were run.
- Browser app dependency audit: no reported vulnerabilities at install. The separate CRE SDK dependency advisory is documented in `cre/README.md`.

The user-supplied owner address is `0x2cE812CF03d1F252C940aFf954E15D5E49bBedd5`. A read-only Sepolia check found zero ETH and zero Uniswap v3 positions when checked. The CRE workflow was subsequently deployed with this asset owner and authorized trigger address; CLI listing confirms ACTIVE registration in the private registry. See `cre/deployment.json`. Workflow execution has not yet been verified.

Pending user-owned environment validation: provide the departing wallet, connect the owner wallet, create/fund Sepolia assets, configure genuine ENSv2 resources, sign revocations and a CRE HTTP trigger, and verify before/after evidence. No live asset-offboarding result is claimed yet.
