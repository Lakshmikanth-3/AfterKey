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

The departing wallet was subsequently supplied as `0x22225204824EdF00b3c8c32A43f1C04246e2d1b4` and validated. A live scan of the real wallet pair at Sepolia block 12071617 completed with zero Uniswap v3 positions, no operator approval, and zero findings. ENS targets remain unconfigured. The owner's Sepolia ETH balance remained zero. This is an empty-scope setup check, not evidence of successful revocation. The browser defaults and prepared CRE event payloads now use this wallet pair. No new CRE deployment is required for a different subject; the subject is supplied in each authorized trigger payload.

## ENS requirements implementation

- Sixteen deterministic tests passed after adding ENS resource metadata validation, exact keyed delegation, owner-control initialization, deployment-event validation, name ownership and effective record-permission preservation.
- The ENS-first production build passed. Browser inspection verified the identity screen, live `.eth` hierarchy discovery, and rejection of an empty ENS-only scope as incomplete. `.eth` was a read-only public protocol check, not a claimed user-owned namespace.
- Official Sepolia contract runtime hashes and current interfaces were read and checked against the deployment-linked source revision `07e55a056f5b6a9c90119f501bdd05714e67dddd`. Text resource derivation was independently compared to the deployed resolver's pure `decodeSetter` view. The latest result is in `ens-live-read-check.json`.
- Intermittent public RPC “resource not found” responses were observed. The default browser transport now has a second Sepolia read provider while retaining block pinning; custom RPC configurations use only their configured endpoint. Persistent failures remain incomplete/error results.
- The updated CRE verifier compiled and was deployed in the private registry. CLI `workflow get` confirmed ACTIVE registration for `006f1d09b1acf95154e601b9f7e0ebcdd1cbafecf26af76e336d581173c63f76`; `lastExecutedAt` was null. Its configured ENS targets remain empty until the user's namespace is available.
- The supplied GitHub URL returned 404 both publicly and through the connector. Public repository availability and judge access to the private demo remain unverified.
- No ENS setup, delegation, or revocation transaction has been signed in this session. No simulations were run. The user's registered Sepolia name and wallet signatures are required for the end-to-end evidence.
