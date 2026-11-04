# Worker runtime and deployment

Status: current architecture and deployment boundary. Audience: operators and server contributors. The target and transition requirements for an ARC-native server are described in [ARC-native migration](arc-native-migration.md).

## Runtime

[workers/index.ts](../workers/index.ts) is the production fetch/scheduled entry. Existing Express business handlers run through the Worker HTTP adapter. [workers/database.ts](../workers/database.ts) implements the required parameterized relational operations over D1; R2 holds encrypted bodies, attachments and large cache payloads. Workers Secrets supply the original node wallet.

[build-worker.mjs](../scripts/build-worker.mjs) substitutes Worker adapters and rejects filesystem wallets, native SQLite, Sequelize drivers, the Node gateway and test modules in the production graph. Local Node runners bridge development services; they are not production business servers.

Each node needs dedicated business D1/R2 bindings. ARC's platform storage is a separate resource. Multiple ARC tenants sharing one business database/bucket are not supported.

## ARC integration

Configure an authorized `ARC` Service Binding or a validated `ARC_ORIGIN` HTTPS endpoint for identity/platform forwarding. Mailbox association uses its separately scoped trusted membership integration. Do not infer a caller's role from supplied headers or a mailbox DID.

The local ARC runtime can serve the built page package. This does not prove that hosted ARC can load an arbitrary custom business module. The optional ARC page/provider package and the business Worker are separate deployment artifacts; publishing one does not deploy the other. Remote login, cookie/redirect/domain mapping, role checks and provider mounts need explicit acceptance on the target installation.

## Chain reads

Node balances, factories, NFTs, templates and stakes use [workers/chain-read.ts](../workers/chain-read.ts) through `ARC_CHAIN`, or the configured ARC connection. Optional `ARC_CHAIN_TOKEN` belongs in Secrets, scoped to read/list under the selected namespace. Browser session cookies and node signing keys must not travel with read RPC.

| Business read              | AFS resource                                                    |
| -------------------------- | --------------------------------------------------------------- |
| Factory metadata and SVG   | `/dev/chain/<network>/factories/<address>`                      |
| Account and precise tokens | `/dev/chain/<network>/accounts/<address>` and `/tokens`         |
| Filtered NFT inventory     | `/dev/chain/<network>/assets`                                   |
| Stake and asset evidence   | `/dev/chain/<network>/stakes/<address>` and `/assets/<address>` |
| Nondefault pricing token   | `/dev/chain/<network>/tokens/<tokenId>`                         |

Default beta/main mounts require matching canonical `CHAIN_ID`/`CHAIN_HOST`. A custom network requires explicit `ARC_CHAIN_PATH` and `ARC_CHAIN_ENDPOINT` matching the configured host and an independently configured provider mount. A configuration assertion does not create a mount.

Validate provider capabilities, resource identities, response limits and complete pagination. Missing/unavailable providers cannot become zero balances or empty NFT lists. Filtered inventory enumeration is bounded to 10,000 entries / 32 MiB, with individual RPC responses bounded to 16 MiB. Repeated/incomplete pages fail and preserve the previous cache. Provider-side ordering is not assumed when the provider reports it ignored the request. Large inventories need verified server-side ordering/query support.

Transaction preparation, signing/broadcast and immediate settlement evidence remain separate SDK paths. The compatibility Forge-state endpoint, aliases and contact/mail transaction verification are outside the administrative read adapter.

## Storage consistency

D1 batches provide atomic relational updates; D1/R2/chain do not share a distributed transaction. A crash between object creation and index commit can leave orphan objects. Automatic orphan-object sweeping is not provided. Durable tasks and fenced leases retain original transaction evidence rather than infer nonpayment from a timeout.

Use dedicated resources, preserve the node wallet and back up matching metadata/objects. See [preview persistence](local-preview-persistence.md) for local checkpoints and the [server README](../README.md#deployment-and-data-migration) for deployment/export steps. Apply migrations before serving upgraded code.

## Acceptance

The repository includes real workerd/D1/R2 tests, binary/signature compatibility checks, WAL export/restore checks, native ARC page builds, isolated Chromium interactions and Wrangler packaging dry runs. These establish local implementation properties. They do not establish hosted ARC compatibility, remote resource provisioning, real paid-chain settlement, data import or production availability. The current [release gates](https://github.com/didmail-org/overview/blob/main/docs/status.md) remain explicit.
