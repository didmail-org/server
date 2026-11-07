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

With ARC installed, build the package from the repository root and select an
already configured ARC instance:

```sh
arc blocklet build blocklet
arc blocklet run blocklet/dist --instance <instance-name>
```

Open the URL ARC prints to activate the app, then use its configured mail
origin. The [development guide](docs/local-arc-development.md#run-an-already-configured-package)
covers source builds and running an installed package. Existing installations
with an older package path follow the [rebind procedure](docs/arc-package-runtime.md#rebind-an-existing-installation).

## By task

[Documentation tasks](docs/README.md) lead to operations, protocol references,
user help and release review. New installations and recovery are explicit
[operator procedures](docs/arc-package-runtime.md), outside ordinary startup.
[Capability status](docs/arc-package-runtime.md#capability-status) distinguishes
local checks, real accounts, paid delivery, hosted operation and distribution.

Original code and documentation use [Apache-2.0](LICENSE). Preserve [NOTICE](NOTICE)
and [third-party notices](THIRD_PARTY_NOTICES.md). A successful build does not
resolve the [distribution gates](docs/distribution-license-audit.md).
