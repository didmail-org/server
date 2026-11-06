# Server documentation

Status: native ARC is the supported runtime; Workers is retired. English is the source language. Start with the [server README](../README.md) for installation and the [user guide](help/en.md) for UI tasks.

## Guides and references

| Task/topic | Document |
| --- | --- |
| Understand source ownership and runtime boundaries | [Server architecture](server-architecture.md) |
| Build and develop the native ARC package | [Local development](local-arc-development.md) |
| Activate protocol HTTP, configure keys and understand lifecycle limits | [Packaged ARC runtime](arc-package-runtime.md) |
| Import or initialize existing instance data | [Instance migration](instance-afs-migration.md) |
| Back up business data and preserve transaction semantics | [AFS business storage](afs-business-storage.md) |
| Preserve mail-policy admission locks and fences | [AFS policy/admission](afs-policy-admission.md) |
| Recover data from retired Workers installations | [Historical recovery boundary](workers-migration.md) |
| Evaluate hosted ARC installation and remaining gates | [ARC-native deployment contract](arc-native-migration.md) |
| Use the server and admin UI | [English help](help/en.md); [translations and authoring](help/README.md) |
| Recover historical D1/R2 preview state | [Preview persistence](local-preview-persistence.md) |
| Test phone invitations on LAN/USB | [LAN and USB testing](lan-invitation-testing.md) |
| Configure membership and mailbox association | [ARC onboarding](arc-mailbox-onboarding.md) |
| Implement the trusted membership adapter | [Member-source contract](arc-members-source-compatibility.md) |
| Understand mail policy APIs | [Policy API](mail-policy-api.md) |
| Connect a private endpoint | [Private endpoint behavior](private-endpoint-mail-design.md) |
| Preserve node identity and assets | [Node wallet model](node-identity-and-transactions.md) |
| Transfer available node funds | [Owner transfers](node-transfers.md) |
| Manage native-token gas stake | [Gas staking](gas-staking.md) |
| Manage service-node NFT stake | [Node NFT policy](node-staking.md) |
| Diagnose unavailable balances/factories | [Chain-read troubleshooting](troubleshoot-chain-reads.md) |
| Change routes, rendering or UI caching | [Native UI](native-ui.md) |
| Maintain dependency upgrades and security patches | [Dependency compatibility](dependency-security.md) |
| Understand disabled contact-recovery work | [Recovery scope](contact-recovery.md), [internal API](contact-recovery-api.md), [durable jobs](contact-recovery-jobs.md) |
| Maintain historical data compatibility | [Retired public-mail routes](mail-protocol-retirement-tests.md) |

- [Distribution license audit](distribution-license-audit.md), [historical Worker inventory](worker-dependency-inventory.md), and [recovered package source evidence](license-source-evidence.json).

## Authority and capability status

Active mail contracts are in the [protocol index](https://github.com/didmail-org/protocol/blob/main/docs/protocol/README.md); [delivery behavior](https://github.com/didmail-org/overview/blob/main/docs/delivery.md) explains internal, sponsored NFT and paid NFT outcomes. Contact recovery is internal-only; the existence of its handlers is not a production capability. Ordinary/chain-VC delivery is retired and has no enablement guide.

The [route baseline](legacy-routes.json) records retained adapter method/path declarations, not a promise that every historical route is publicly served. The production retirement gate takes precedence. [origin.json](origin.json) preserves the original import hashes for provenance; it is historical metadata, not the current file layout or a release verification report.

Use [server/AGENTS.md](../AGENTS.md), [project release gates](https://github.com/didmail-org/overview/blob/main/docs/status.md) and [documentation policy](https://github.com/didmail-org/overview/blob/main/docs/documentation.md) when making changes. Per-run reports, private installation state and old implementation diaries are intentionally absent from this index.
