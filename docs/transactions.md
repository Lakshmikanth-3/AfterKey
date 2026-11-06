# Verified Sepolia transaction evidence

Collected from real contract logs, transaction calldata and mined receipts. No transaction was submitted by the audit script.

Owner: `0x2cE812CF03d1F252C940aFf954E15D5E49bBedd5`. Operator: `0x22225204824EdF00b3c8c32A43f1C04246e2d1b4`.

Name: `treasury-agent.manager.eth`. Resolver: `0x6161ada4D10a529940B90b078B4F9A8d3679c8f8`. Subname registry: `0x26560685235D2d7861afF80866E8C1846d14420D`.

| Operation | Block | Explorer evidence | Receipt |
| --- | --- | --- | --- |
| Deploy official proxy | 12073683 | [0xa8bb4b21â€¦](https://sepolia.etherscan.io/tx/0xa8bb4b214a207015881cd1d3bc08b2187066952ad562cae574e97a6e651f5625) | success |
| Deploy official proxy | 12073701 | [0xcd04a8b7â€¦](https://sepolia.etherscan.io/tx/0xcd04a8b7a62a279a6c0d674e44ca744d4acf25cb2f07ead92024d63c66a1e69e) | success |
| Attach subname registry | 12073760 | [0xb698d463â€¦](https://sepolia.etherscan.io/tx/0xb698d4638b339f7235ae12262ac35e79ac4491ee4521a70d53101f4352fe8432) | success |
| Set canonical parent | 12073770 | [0xd7ab69c7â€¦](https://sepolia.etherscan.io/tx/0xd7ab69c7518e18934f3713f2974aa0c489e6559bea3d622b031d42aa2ab460c5) | success |
| Register operator subname | 12073779 | [0xb3424a9aâ€¦](https://sepolia.etherscan.io/tx/0xb3424a9a24ace5feef48b558eaeeebd4e28d0a18602d9cdd4ec859c711f891fe) | success |
| Delegate agent-context key | 12073794 | [0xb43afd51â€¦](https://sepolia.etherscan.io/tx/0xb43afd51b210beb5e6e4e8670f9256942a09be093e0b14586fc8df0a593a2675) | success |
| Operator updates context to revision 2 | 12073875 | [0xe72a0deeâ€¦](https://sepolia.etherscan.io/tx/0xe72a0dee421bcb5fbb886ab5041dcba2fd86f16988c31af7a3130ed2e6c80284) | success |
| Grant broad text editor role | 12073926 | [0x4874b06câ€¦](https://sepolia.etherscan.io/tx/0x4874b06c9a5b12aa6b0b00d52e2ecf65b4d101c881a2671ca3e320a8f557dc50) | success |
| Remove only key-specific role | 12073943 | [0x87b7182dâ€¦](https://sepolia.etherscan.io/tx/0x87b7182d610f61d0fdc9967c43947e564b9bdc72ad1d41a52722850e2a73242f) | success |

## Current result

At block 12073970, the key-specific text role is absent but the resolver-wide text role remains active. The operator can still edit `agent-context`; the owner can also edit it. The record contains `Treasury operations context â€” revision 2.`. **Final offboarding is not yet verified.**

No Uniswap position-management or revocation transaction is established by these ENS receipts. No successful Chainlink CRE execution is established by them either.

Machine-readable evidence: [e2e-live-audit.json](e2e-live-audit.json). Run `npx tsx scripts/audit-e2e.ts` to refresh that file. These are dated observations, not a guarantee of later chain state.
