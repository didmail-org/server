# DIDMail Server

DIDMail is encrypted mail built around DID identities. This server is an ARC
Blocklet: protocol HTTP, node signing, delivery jobs, administration and durable
instance AFS storage run inside ARC. There is no standalone Workers backend.

Eligible bound members exchange same-server mail directly, without an envelope,
payment or mail NFT. External mail uses NFT envelopes. Ordinary/chain-VC mail is
retired. The [protocol](https://github.com/didmail-org/protocol/blob/main/docs/protocol/README.md)
owns client wire contracts; operators and users can open `/help` on the server.

## Start here

1. This README explains the product and the supported runtime.
2. [Development guide](docs/local-arc-development.md): prerequisites, running,
   installing development tools and choosing checks.
3. [Architecture](docs/server-architecture.md): source ownership, modules and
   dependency boundaries.

With ARC installed and the selected instance already configured,
the shortest source-package launch is:

```sh
arc blocklet run blocklet --instance <instance-name>
```

Replace `<instance-name>` with the installation's actual instance name.
Open the URL ARC prints to activate the app, then use its configured mail origin.
This does not install a new instance or create a signing wallet. Follow the
[development guide](docs/local-arc-development.md#run-an-already-configured-package)
for the authoritative build/run sequence. A new developer can use isolated
regressions without obtaining an operator's wallet or modifying live data.

## By task

[Documentation tasks](docs/README.md) lead to operations, protocol references,
user help and release review. New installations and recovery are explicit
[operator procedures](docs/arc-package-runtime.md), outside ordinary startup.
[Capability status](docs/arc-package-runtime.md#capability-status) distinguishes
local checks, real accounts, paid delivery, hosted operation and distribution.

Original code and documentation use [Apache-2.0](LICENSE). Preserve [NOTICE](NOTICE)
and [third-party notices](THIRD_PARTY_NOTICES.md). A successful build does not
resolve the [distribution gates](docs/distribution-license-audit.md).
