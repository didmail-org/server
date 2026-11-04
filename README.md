# DIDMail Server

DIDMail's active server, maintained as a standalone repository. It runs on Cloudflare Workers, stores relational metadata in D1 and encrypted mail bodies/attachments in R2, and uses ARC for login and trusted organization membership. The administration UI uses native AUP / Web Device pages and vanilla JavaScript.

Same-server mail between eligible, bound members is stored directly without an envelope, payment, mail NFT or on-chain notification. External mail retains NFT-envelope delivery. Read the [member-mail protocol and upgrade requirements](https://github.com/didmail-org/protocol/blob/main/docs/protocol/member-mail.md) before upgrading clients or enabling organization delivery. Historical ordinary/chain-VC delivery documents describe a retired feature, not a supported alternative to enable.

## Help and usage

Open `/help` on the server, or use the help icon in the header. Each administration page links to its relevant section. Help is public; administration data and actions still require owner/admin authorization.

The English guide is authored first, then translated into the other supported UI languages:

- [English](docs/help/en.md) — `/help`
- [简体中文](docs/help/zh.md) — `/zh/help`
- [العربية](docs/help/ar.md) — `/ar/help`
- [日本語](docs/help/ja.md) — `/ja/help`
- [Русский](docs/help/ru.md) — `/ru/help`

The guides cover organization onboarding, identities and permissions, node wallets, service-node NFTs, members and bindings, internal/external delivery, envelopes, namecards, storage and backups, attachment limits, common errors, and operator setup. [Help authoring instructions](docs/help/README.md) explain translation parity and validation.

## Local development

Use Node.js 24.14 or newer, the pnpm version declared in this component's `package.json`, and the ARC CLI. The protocol SDK is pinned to a Git commit and built during installation. The pinned protocol repository is public. From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm arc:run
```

The approved local ARC instance is `didmail-web`; use `http://didmail-server.localhost:8788`. The combined preview serves real ARC pages/login and executes business APIs in workerd. Stopping the runner stops its business preview, not the ARC instance. Preserve existing D1/R2 state before restarting; see [local preview persistence](docs/local-preview-persistence.md). Do not recreate retired development instances or disturb other ARC projects.

The ARC package ID and site namespace are `didmail-server` (`did:blocklet:didmail-server`). When adopting this name, update any local `DIDMAIL_URL`, `ARC_HOST` or `DIDMAIL_ARC_PREVIEW_URL` overrides that still select the former hostname; `DIDMAIL_URL` also controls the packaged site domain. Existing D1/R2 resource names and the `didmail-web` instance retain their names to preserve stored data and identity.

The package explicitly requires a real DID Space mounted at `/instance`. It declares no seed because it currently ships no instance initialization data. This requirement does not migrate the Worker's business data from D1/R2 into ARC storage.

`pnpm start` is a separate Workers-only entry on port 8787. Without a trusted ARC connection, protected administration APIs cannot authenticate users. Do not replace authorization with caller-supplied role headers. Development wallets and `.dev.vars` are private local files; keep them and `.wrangler`, `.arc`, databases and exports out of Git and public packages.

## Verification

Run from the repository root:

```sh
pnpm lint
pnpm test
pnpm test:scripts
pnpm test:worker
pnpm build
pnpm test:browser
pnpm test:ui
pnpm test:browser:help
pnpm test:browser:admin
pnpm test:browser:ui
pnpm worker:deploy:dry
```

The help browser check serves real built ARC artifacts in isolation and reads only the public ARC core stylesheet from the running preview (`DIDMAIL_BROWSER_URL` can override its origin). The admin/UI browser checks use the running preview with isolated session and business-API fixtures. Automated tests must not broadcast chain transactions or send real mail. A successful build or dry run is not evidence of a completed remote deployment.

`pnpm test:smoke` checks the current Workers runtime, native page routes/assets, anonymous authorization and retired mail endpoints using GET requests only. It defaults to the approved preview; set `DIDMAIL_SMOKE_URL` to test another server origin. It sends no session credentials and does not load local wallet/environment files. For current built pages without changing a running preview, use `DIDMAIL_BROWSER_CORE_CSS=/absolute/path/to/genuine-arc-core.css node scripts/browser-artifacts.mjs ui` (also `admin` or `policy`). These browser checks use isolated business fixtures and do not prove live ARC authentication or chain settlement.

## Deployment and data migration

Production entry: `workers/index.ts`. Build adapters exclude native SQLite, Sequelize drivers, filesystem wallets and the legacy Node gateway. D1 holds metadata, R2 holds encrypted objects, Workers Secrets hold the original node wallet, and scheduled jobs handle recovery and expiration cleanup.

1. Create dedicated D1 and R2 resources, configure their actual identifiers and the server's public HTTPS origin in `wrangler.jsonc`.
2. Connect a trusted ARC integration through an authorized Service Binding or operator-provided HTTPS origin. Verify login, cookie/domain mapping, active membership status and instance-scoped mailbox-binding capabilities.
3. Securely configure the original node wallet and expected public address. Keep its chain/factory configuration. ARC login identity and the node's funding/signing identity are separate.
4. Build the server and apply all pending D1 migrations in order. Member direct storage requires `0016_member_mail.sql`.
5. Verify the intended client versions, receiving keys, membership checks, internal synchronization and external delivery in an isolated environment before changing the advertised endpoint.

See [Workers architecture, deployment and unresolved hosted ARC boundaries](docs/workers-migration.md). Local custom-module loading does not prove that hosted ARC supports that extension mechanism. Deploying the optional ARC page package alone does not deploy the business Worker.

For a historical SQLite migration, the read-only exporter is:

```sh
node scripts/export-worker-data.mjs \
  --database /safe/original/didmail.sqlite \
  --out /safe/new-worker-export
```

The export is private. It contains a manifest, D1 SQL and encrypted objects for R2. Preserve the original node wallet; a new wallet cannot replace its asset ownership or encrypted domain-key access. Quiesce writes for consistent migration, verify object hashes and counts, upload the matching R2 objects, and import into an empty, migrated D1 database before switching traffic. D1 and R2 do not share an atomic transaction; a partial import is not ready for use.

## Engineering references

- [Native UI, routes and browser checks](docs/native-ui.md)
- [Node identity and transactions](docs/node-identity-and-transactions.md)
- [ARC mailbox onboarding and recovery](docs/arc-mailbox-onboarding.md)
- [LAN invitation testing](docs/lan-invitation-testing.md)
- [Member-mail protocol](https://github.com/didmail-org/protocol/blob/main/docs/protocol/member-mail.md)
- [Repository contribution guide](https://github.com/didmail-org/overview/blob/main/CONTRIBUTING.md)

Some older engineering documents retain historical paths and feature proposals. Use the current help guide and implementation for operator instructions; see [repository migration](https://github.com/didmail-org/overview/blob/main/docs/repository-migration.md) for path changes.

## License

DIDMail original code and documentation use [Apache-2.0](LICENSE). Available third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); see the [Worker dependency inventory](docs/worker-dependency-inventory.md). Worker and Blocklet distribution remain blocked; see the [artifact license audit](docs/distribution-license-audit.md) for exact evidence, resolved items and remaining requirements. Other third-party components retain their own licenses; see the [licensing guide](https://github.com/didmail-org/overview/blob/main/docs/licensing.md).

The full `pnpm test:worker` includes the cross-client codec test and requires sibling `mobile` and `extension` checkouts with dependencies installed. `pnpm test:worker:standalone` runs the remaining Worker tests without those private checkouts; run the full suite when the cross-client checkouts are available. Protocol fixtures in `test/fixtures/protocol` were copied from the pinned protocol revision.

The 64 KiB contact test decodes the signed transaction with the independent OCAP reference codec in a disposable worker thread. This keeps Miniflare's host event loop and idle-connection cleanup responsive during the expensive conversion. It asserts host responsiveness before continuing the original mint/ledger checks. Concurrent full-suite runs also use separate temporary signer import directories. CI runs two contact settlement suites concurrently after the standalone suite; no network retry or relaxed timeout is used to hide transport failures.
