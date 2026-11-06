# Delegated liquidity and departure monitoring

Use Ethereum Sepolia and the existing owner/operator accounts. The completed ENS offboarding proof does not need to be repeated or overwritten.

## 1. Create an actual Uniswap position

1. Connect MetaMask as owner `0x2cE812CF03d1F252C940aFf954E15D5E49bBedd5`.
2. Open AfterKey → **Uniswap → Your positions → Create a Sepolia position**.
3. In the official Uniswap app, enable testnets if needed and select Ethereum Sepolia and v3. A verified existing example is ETH / Circle test USDC at 0.3%. Get test USDC from https://faucet.circle.com/ by selecting Ethereum Sepolia and the owner wallet. Its official token address is `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`. You need the pair's test tokens as well as test ETH for gas. Token balances are separate from ENS registration.
4. Choose the range and amounts yourself, review the token approvals and mint transaction in MetaMask, and keep the NFT in the owner wallet.
5. Return to AfterKey and click **Read live positions**. Confirm its token ID, pair, fee tier, liquidity and tick range. An empty wallet or another network is not a completed position lifecycle.

The app reads the official [Sepolia NonfungiblePositionManager](https://sepolia.etherscan.io/address/0x1238536071E1c677A632429e3655c799b22cDA52). It never deploys a substitute pool, mints fake liquidity, invents a position ID or submits a simulated write.

## 2. Demonstrate useful delegation

1. Choose **Manage this position → Delegate one position** with the owner as signer. Prepare, review, tick the review box, then sign. This ERC-721 approval permits managing **and transferring** the NFT; it is not a fee-only permission.
2. Choose **Collect to owner**, select the operator as signer, and switch MetaMask to `0x22225204824EdF00b3c8c32A43f1C04246e2d1b4`. Prepare and sign. The recipient is fixed to the team owner. The transaction proof shows actual `Collect` amounts; a zero-value collection is not fee earnings.
3. Switch back to the owner. For the residual-access demonstration, explicitly review **Delegate all positions**. This broader approval covers current and future NFTs in this manager, including transfers.
4. Choose **Remove one approval**. The portfolio approval remains independently effective. Read the portfolio again and inspect both sources.

`positions().tokensOwed0/1` are recorded amounts, may include removed principal, and do not include uncheckpointed fees. No USD value or projected return is presented.

## 3. Offboard and preserve the assets

1. After collecting, click **Scan every access path**. This enables Uniswap in Offboarding and preserves your ENS scope.
2. Scan, record the **before block**, review the plan and sign the remaining revocations as owner. Global approvals come first; per-position approvals are independent.
3. Recheck live permissions. The owner, token pair, fee tier, tick range, liquidity and recorded owed amounts must be retained. ENS identity checks remain part of the same configured audit.
4. Export the offboarding evidence. Return to Uniswap and attempt to prepare **Collect to owner** as the departing operator. Preparation must deny authorization after all its approval paths are absent. This is an authorization check, not a reverted transaction claim.
5. Preparing the same operation as owner remains available. Export its actual receipt if signed.

Optional owner continuity operation: **Withdraw liquidity to owner** atomically calls `decreaseLiquidity` and `collect` through the position manager's `multicall`. Enter positive liquidity units within the position balance, your token minimums, and review the ten-minute expiry. At least one minimum must be positive. This is a deliberate asset change performed separately from the preservation audit. The app restricts it to the owner as product policy; the protocol itself also authorizes approved NFT operators to decrease liquidity.

## 4. Connect the external departure case

1. Make the source repository public. In GitHub → Issues → Labels, create `afterkey-departure`.
2. Open AfterKey → **Chainlink → Departure case → Create departure issue**. The prepared body contains exactly one line:

   ```text
   AfterKey-Subject: 0x22225204824EdF00b3c8c32A43f1C04246e2d1b4
   ```

3. Publish the issue in `Lakshmikanth-3/AfterKey`, add the label, then close it as **Completed** using `Lakshmikanth-3`.
4. Open **Run a check → Verify GitHub departure case**, enter the issue number and optionally the before block. Prepare, review and sign the request as the configured owner. The wallet signs an expiring EIP-191 message; no signing key leaves the wallet.
5. CRE reads GitHub through its HTTP capability and reaches consensus on validated case fields. Wrong repository, wrong operator, missing label, pull requests, cancelled/open issues and a different completing actor fail validation.

The case triggers permission verification and review; it never authorizes the workflow to transfer assets or sign the owner's revocations. The public issue path is intentional. Private GitHub credentials are not placed in the browser or repository.

## 5. Verify CRE execution

The deployed workflow has three entry points:

| Trigger | Purpose |
| --- | --- |
| Owner-signed HTTP | Current check, externally confirmed departure case, or historical before/after verification |
| Cron every five minutes | Recheck the configured departing wallet for surviving or regranted access |
| SAFE-confidence Uniswap approval log | Recheck after this owner's `Approval` / `ApprovalForAll` changes |

The workflow reads the actual four-resource ENS namespace and up to ten Uniswap positions. View calls are batched through official Sepolia Multicall3; all calls must succeed and all values in each snapshot use the same block. Read failures and portfolios above the bound cannot produce complete evidence. Before/after requests compare ownership, financial position state, owner ENS authority and captured identity values.

Gateway `ACCEPTED` only means a trigger was accepted. Copy the execution ID and check real completion:

```sh
cre execution status <execution-id> --output json
cre execution logs <execution-id> --output json
npm run proof:cre -- <execution-id>
```

The collector checks authenticated CLI status/logs, current deployment time, workspace wallets and configured scope. It writes `docs/cre-execution-proof.json` and updates the app's recorded execution reference only for a matching successful run. This is execution evidence, not an onchain attestation or proof of owner signatures. Browser offboarding reports remain separate.

To pause monitoring from `cre/`: `cre workflow pause . --target production`. To change the monitored owner, subject, scope or schedule, edit `config.production.json`, build and redeploy. Credentials stay in the CLI session. No CRE simulations are used.

## Integration files

| File | Purpose |
| --- | --- |
| `src/uniswap/contracts.ts` | Official ABI, position economics and preservation comparisons |
| `src/uniswap/positions.ts` | Live portfolio discovery, actor checks, reviewed calldata and owner-bound collection/withdrawal |
| `src/uniswap/ui.ts` | Position, management and receipt screens |
| `src/engine.ts` | Independent approval paths, revocation ordering and financial preservation |
| `src/cre/auth.ts` | Canonical request digest, five-minute JWT, wallet signature conversion and gateway submission |
| `cre/main.ts` | Three real CRE triggers and before/after orchestration |
| `cre/batch.ts`, `cre/reader.ts` | Quota-aware pinned blockchain reads |
| `cre/case-policy.ts`, `cre/external-case.ts` | GitHub API and strict departure approval validation |
| `scripts/collect-cre-proof.ts` | Authenticated execution evidence collection |

References: [Uniswap deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments), [position-manager interface](https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/INonfungiblePositionManager.sol), [CRE trigger authentication](https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/triggering-deployed-workflows), [Multicall3 deployments](https://github.com/mds1/multicall3/blob/main/deployments.json), [GitHub issues API](https://docs.github.com/en/rest/issues/issues#get-an-issue).

The development server includes the signed CRE relay. `npm run build` emits a Worker ESM artifact with bundled public assets and the signed API route. `npm start` serves that artifact locally (optional port: `npm start -- 5174`); Sites deploys the Worker behind HTTPS. A static-only upload cannot provide the signed relay.

## Completed workspace proof

This workspace has completed the core lifecycle; do not mint or grant again just to follow the guide. NFTs 234145 and 234146 remain with the owner. Final portfolio revocation is confirmed at **12075584**. [Fourteen checks](uniswap-offboarding-verification.json) verify absent modeled approvals, preserved state and operator preparation denial. [GitHub issue 2](https://github.com/Lakshmikanth-3/AfterKey/issues/2) and successful CRE execution **f42d1d27-6bcf-4689-b290-d4d533f83729** establish the external-case before/after flow. See [current output](cre-execution-proof.json) and [departure checks](cre-departure-verification.json).
