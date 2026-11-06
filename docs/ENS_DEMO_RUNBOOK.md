# AfterKey: an ENS identity survives its operator

## Product story

A team keeps a stable ENS identity while a contractor maintains its public context or service endpoint. When the contractor leaves, a narrow revoke may leave a resolver-wide role active. AfterKey reads both scopes, prepares owner-signed cleanup, and compares the captured identity values and permissions after confirmation.

The pattern drawn from the ENS prize examples is identity → authority → useful action → observable revocation. This runbook demonstrates that pattern with actual Sepolia transactions. It does not claim an autonomous AI agent exists merely because the name contains “agent.”

## Prerequisites

- Owner: `0x2cE812CF03d1F252C940aFf954E15D5E49bBedd5`.
- Departing operator: `0x22225204824EdF00b3c8c32A43f1C04246e2d1b4`.
- Registered parent: `manager.eth` on Ethereum Sepolia, chain ID `11155111`.
- Both wallet accounts must be available to their respective holders. The operator needs Sepolia gas to sign a real record update. Never supply private keys to AfterKey.
- Run `npm run dev` from the project directory and open its printed URL in a browser with the wallet extension. The hosted version does not receive local edits automatically.

## Choose MetaMask

Cancel any old MathWallet connection request and refresh AfterKey. Click Connect wallet, select MetaMask in the wallet picker, then choose the owner account ending Bedd5. AfterKey uses that selected provider for account checks, network switching and transaction signing. Click the connected-wallet button to select another wallet. Wallet discovery follows EIP-6963; legacy extensions are shown as unidentified browser providers.

## Real demonstration, step by step

1. **Create the operator namespace as owner.** ENS identity → Set up namespace. Parent `manager.eth`; label `treasury-agent`; key `agent-context`. Enter an accurate context value describing the operator's real responsibility. Alternatively use an `agent-endpoint[...]` key with an actual URL you control. Prepare, inspect and sign each setup transaction. The resulting dedicated resolver limits the scope of the demonstration.
2. **Delegate the selected key.** Once setup is complete, explicitly enable delegation and sign the scoped grant to the departing operator. For the residual-access case, separately review and sign the optional resolver-wide text grant. It gives no admin rights but covers every key/name served by that resolver.
3. **Perform useful work as the operator.** Operate identity → enter `treasury-agent.manager.eth` and the same text key. Enter an accurate updated context. Choose Departing operator, prepare the update, switch MetaMask to that account, review and sign. Export the mined update receipt. No transaction is sent if the live authorization check fails.
4. **Demonstrate why a narrow revoke is insufficient.** Switch to the owner. Use Set up namespace → Revoke only the key role. Audit the operator name/key. The contract-wide text role and effective edit permission should remain active. Show the receipt and current read block.
5. **Offboard through AfterKey.** Add the discovered scopes, scan, inspect Why access survives, and review the revocation plan. Record the baseline after the legitimate operator update. Sign the owner-authorized revocations one at a time. The plan refreshes between steps.
6. **Verify preservation.** Check that operator authorization is absent, owner authorization and name ownership remain, and captured identity values/pointers are retained. The scanner compares the selected text value, ETH address, record bundle, registry resolver pointer, subregistry pointer, and expiry. It stops on missing required reads or changed preservation checks.
7. **Check the operator path again.** In Operate identity, choose the departing operator and prepare another update. Expect live authorization denial before submission. This is a permission-state check, not evidence of a mined reverted write. To show actual transaction execution, use the confirmed successful update from step 3.
8. **Export evidence.** Export record-update receipts separately and the offboarding report. Every displayed transaction hash links to Sepolia Etherscan. Save the complete recording with the name, wallet roles and chain visible.

If any observed state differs, show that state and investigate; never substitute a scripted result or claim an offboarding transaction occurred when none was signed.

## Coverage and interpretation

- Only configured scopes and captured record values are compared. Text-key rights can cover several names on the same resolver.
- The permission-path view shows reported contract-wide roles, resource roles and owner-operator approval. Contract-provided resource roles may already contain inheritance. It is not a complete graph of arbitrary team contracts.
- Inconsistent effective text authorization versus reported roles makes the scan incomplete. This detects some unsupported authority behavior; it is not a general custom-registry audit.
- Shared record bundles are flagged when observed among configured names. Unlisted aliases and names are not enumerated.
- Older/manual scopes without name/text metadata cannot establish record preservation; the UI labels them Not captured rather than Retained.
- Permission absence does not revoke copied API credentials, endpoint sessions, unknown contracts, or another wallet's access. Any external service needs its own enforcement.
- A denial during preparation does not imply a wallet-signed transaction reverted. No privileged-call simulations are used.

## Submission gates still requiring completion

The intended prize is Best Use of ENSv2, which accepts Sepolia. A signed end-to-end demonstration, a judge-accessible deployed build, and a publicly readable open-source repository must be verified. The separate Continuity prize requires an existing project and mainnet integration.

The latest read-only check is in `workspace-live-check.json`. It explicitly reports `signedOffboardingVerified: false`; it is not a substitute for completing the steps above. Changes are local; no GitHub push or hosting-audience change is part of this work.

References: [ENS prize requirements](https://ethglobal.com/events/mumbai/prizes), [Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control/), [Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/).
