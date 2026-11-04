# Server documentation

Status: active Worker implementation. English is the source language. Start with the [server README](../README.md) for installation and the [user guide](help/en.md) for UI tasks.

## Guides and references

| Task/topic                                       | Document                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Use the server and admin UI                      | [English help](help/en.md); [translations and authoring](help/README.md)                                                 |
| Understand Worker/ARC/D1/R2 boundaries or deploy | [Runtime and deployment](workers-migration.md)                                                                           |
| Plan ARC-native server migration                  | [ARC-native migration](arc-native-migration.md)                                                                          |
| Preserve or restart local preview data           | [Preview persistence](local-preview-persistence.md)                                                                      |
| Test phone invitations on LAN/USB                | [LAN and USB testing](lan-invitation-testing.md)                                                                         |
| Configure membership and mailbox association     | [ARC onboarding](arc-mailbox-onboarding.md)                                                                              |
| Implement the trusted membership adapter         | [Member-source contract](arc-members-source-compatibility.md)                                                            |
| Understand admission and attachment policies     | [Policy API](mail-policy-api.md)                                                                                         |
| Connect a private endpoint                       | [Private endpoint behavior](private-endpoint-mail-design.md)                                                             |
| Preserve the node identity and assets            | [Node wallet model](node-identity-and-transactions.md)                                                                   |
| Transfer available node funds                    | [Owner transfers](node-transfers.md)                                                                                     |
| Manage native-token gas stake                    | [Gas staking](gas-staking.md)                                                                                            |
| Manage service-node NFT stake                    | [Node NFT policy](node-staking.md)                                                                                       |
| Diagnose unavailable balances/factories          | [Chain-read troubleshooting](troubleshoot-chain-reads.md)                                                                |
| Change routes, rendering or UI caching           | [Native UI](native-ui.md)                                                                                                |
| Maintain dependency upgrades and security patches | [Dependency compatibility](dependency-security.md)                                                                    |
| Understand disabled contact-recovery work        | [Recovery scope](contact-recovery.md), [internal API](contact-recovery-api.md), [durable jobs](contact-recovery-jobs.md) |
| Maintain historical data compatibility           | [Retired public-mail routes](mail-protocol-retirement-tests.md)                                                          |

- [Worker and Blocklet distribution license audit](distribution-license-audit.md), [Worker inventory](worker-dependency-inventory.md), and [recovered package source evidence](license-source-evidence.json).

## Authority and capability status

Active mail contracts are in the [protocol index](https://github.com/didmail-org/protocol/blob/main/docs/protocol/README.md); [delivery behavior](https://github.com/didmail-org/overview/blob/main/docs/delivery.md) explains internal, sponsored NFT and paid NFT outcomes. Contact recovery is internal-only; the existence of its handlers is not a production capability. Ordinary/chain-VC delivery is retired and has no enablement guide.

The [route baseline](legacy-routes.json) records retained adapter method/path declarations, not a promise that every historical route is publicly served. The production retirement gate takes precedence. [origin.json](origin.json) preserves the original import hashes for provenance; it is historical metadata, not the current file layout or a release verification report.

Use [server/AGENTS.md](../AGENTS.md), [project release gates](https://github.com/didmail-org/overview/blob/main/docs/status.md) and [documentation policy](https://github.com/didmail-org/overview/blob/main/docs/documentation.md) when making changes. Per-run reports, private installation state and old implementation diaries are intentionally absent from this index.
