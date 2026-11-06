# DIDMail Server

DIDMail Server runs as an ARC Blocklet. Protocol HTTP, original node signing,
scheduled delivery, administration UI and instance AFS storage execute inside
ARC. Cloudflare Workers and the external workerd preview are retired.

Same-server mail between eligible bound members is stored directly without an
envelope, payment, mail NFT or on-chain notification. External mail retains NFT
envelope delivery. See the [member-mail contract](https://github.com/didmail-org/protocol/blob/main/docs/protocol/member-mail.md)
before upgrading clients. Ordinary/chain-VC delivery remains retired.

## Help and documentation

Open `/help` or the header help icon. Public help does not authorize administration.
English is authoritative; [English](docs/help/en.md), [简体中文](docs/help/zh.md),
[العربية](docs/help/ar.md), [日本語](docs/help/ja.md) and [Русский](docs/help/ru.md)
are maintained together under the [authoring contract](docs/help/README.md).

Start with [architecture and source ownership](docs/server-architecture.md),
[local development](docs/local-arc-development.md) and the [documentation index](docs/README.md).

## Build and run

The native package builds with the ARC CLI alone. Repository operator tools and
regression checks require Node.js 24.14 or newer and the pnpm version declared
in package.json; the protocol SDK is pinned to a public Git revision.

```sh
arc dsl validate blocklet
arc blocklet check blocklet --profile basic
pnpm build
arc blocklet run blocklet/dist --instance didmail-web
```

`pnpm start` runs the package source with the approved `didmail-web` instance.
Open the ARC URL printed by the CLI to activate providers after a cold restart.
The complete configured local mail/UI origin is `http://didmail-server.localhost:8788`;
ARC owns its listener. The parent ARC origin supplies platform UI/login/AFS and
is not the raw mail endpoint. See [activation and private setup](docs/arc-package-runtime.md).

Stable identity is `did:blocklet:didmail-server`; the site is `didmail-server`.
The instance name remains `didmail-web`. Preserve its home, original node wallet,
private configuration and all data. Leave unrelated ARC instances running.

The package requires a real Space at `/instance` and contains no seed, key or
installation data. Initialize or import explicitly. Existing installations must
be imported before initialization; missing/corrupt state never triggers an empty
mailbox, new wallet or legacy-storage fallback. See [instance migration](docs/instance-afs-migration.md),
[policy fencing](docs/afs-policy-admission.md) and [storage/backup](docs/afs-business-storage.md).
Only one DIDMail signing instance per ARC process is currently supported.

## Verification

Run checks appropriate to the change from this repository:

```sh
pnpm lint
pnpm type-check:runtime
pnpm test
pnpm test:scripts
pnpm test:business
pnpm test:ui
pnpm build
pnpm test:arc
```

Existing browser commands cover native rendering, help and isolated administrator
flows. `pnpm test:smoke` uses GET-only checks against the configured running origin;
`DIDMAIL_SMOKE_URL` selects another origin. Browser fixtures prove their bounded
interactions, not paid-chain or hosted acceptance. For built-page checks without
restarting a live instance, use `DIDMAIL_BROWSER_CORE_CSS` with genuine ARC core CSS
and `node scripts/browser-artifacts.mjs ui` (also `admin` or `policy`).

`tests/business` retains protocol, storage, authorization and recovery regressions.
Its disposable Miniflare host is test infrastructure; no production Worker is
built or deployed. Cross-client codec checks may require sibling mobile and
extension dependencies. Tests must not send real mail or chain transactions.
Protocol fixtures retain their pinned-revision provenance.

## Migration and operation

The distributable native artifact is `blocklet/dist`. Private protocol setup,
original node identity, policy, attachment compatibility configuration and business
state/objects are coordinated runtime/backup inputs outside the artifact. See
[packaged runtime](docs/arc-package-runtime.md) and [business backup/restore](docs/afs-business-storage.md).
Retain signed transaction evidence, replay nonces, leases and closed fences.

[Historical D1/R2 recovery](docs/local-preview-persistence.md) and the
[retired Workers migration reference](docs/workers-migration.md) support one-time
exports/imports. Preserved checkpoints do not contain later AFS writes. Do not
restart the retired runtime or treat a stale checkpoint as an online fallback.

[Hosted ARC installation](docs/arc-native-migration.md), large-mailbox throughput,
real paid-chain acceptance and public distribution remain separate gates. An
isolated [support-community Docker example](examples/support-community-docker/README.md)
is ARC research, not DIDMail deployment acceptance.

## License

Original code and documentation use [Apache-2.0](LICENSE). Preserve [NOTICE](NOTICE),
[third-party notices](THIRD_PARTY_NOTICES.md), license texts and source evidence.
[Distribution review](docs/distribution-license-audit.md) verifies current native
inputs and every built manifest file. Stable source/dependency evidence is
committed; complete per-build hashes are written to ignored
`artifacts/distribution/current-artifact-evidence.json`. Audit success remains
independent of release permission. See the [project licensing guide](https://github.com/didmail-org/overview/blob/main/docs/licensing.md).
