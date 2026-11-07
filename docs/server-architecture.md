# Server architecture

The package is the production source authority; the only supported business
runtime is native ARC. Read [development](local-arc-development.md) for commands
and [operations](arc-package-runtime.md) for installation, configuration and recovery.

## Native host and providers

```text
blocklet/
  blocklet.yaml                stable identity, sites, /instance and mount ops
  providers/
    didmail-http/
      host/                    scoped loader, immutable environment, HTTP/WS
      source/                  readable application modules (below)
      vendor/                  pinned dependency asset, facades and license texts
    didmail-business/          AFS SQL/object operations, initialization/migrations
    didmail-native/            verified-caller policy/configuration actions
    didmail/                   public discovery/compatibility projection
```

The HTTP provider reads private instance configuration, activates business
storage and checks single-instance signing ownership. `host/runtime.mjs`
configures immutable bindings, verifies the original wallet and loads HTTP/jobs.
`host/http-server.mjs` owns framing, body limits, Host/Origin checks, caller-header
filtering, repeated cookies, streams, WebSockets and connection cleanup.
Unmount waits for startup before releasing listener ownership.

The scoped Bun loader resolves package TypeScript and pinned dependency facades.
It confines resolved modules to the HTTP, business and native provider trees
and rejects aliases and unknown dependencies. These
installed-runtime constraints are exercised by native tests, not inferred from
a template. `basic` is the applicable package checker profile. Site identity,
routes, allowed mount operations and public leaves are declared in
[the manifest](../blocklet/blocklet.yaml); empty agent/settings modules are unnecessary.

## Business modules

All paths below are relative to `blocklet/providers/didmail-http/source/`:

| Path | Responsibility |
| --- | --- |
| `http/` | Public fetch routing, account/admin endpoints, Express assembly |
| `protocol/` | DMP handlers, settlement/jobs; `contact/` owns internal recovery including its encoding, quote and original-payment/mint evidence |
| `identity/` | Session/membership, original wallet, chain reads, nonces/payment lanes |
| `policy/` | Admission, envelope/namecard access and gas eligibility |
| `storage/` | AFS SQL/object client, compatibility models, caches and policy port |
| `config/` | Validated runtime/configuration access |
| `runtime/` | Project-owned SQL/object/fetch/task contracts, bindings, scheduler and shims |
| `api/src/` | Shared retained REST routes, business rules and signature helpers |
| `types/` | Development-time business and third-party declarations |

Dependency direction is host → HTTP/scheduler → business/identity/policy →
explicit storage/fetch ports. Operator scripts do not belong in the production
graph. `didmail-business` evaluates SQL in ephemeral SQLite and CAS-commits the
instance aggregate; it is not another durable database. Read the
[storage transaction contract](afs-business-storage.md) and
[admission fence protocol](afs-policy-admission.md) before changing predicates.

Ordered [SQL migrations](../blocklet/providers/didmail-business/migrations),
instance keys, `r2://` object pointers and versioned export formats are persisted
contracts. Relational attachment/policy readers remain for historical-record
regressions/import checks over AFS ports. Production fixes all backend selectors
to AFS; they do not enable another host or online storage fallback.

## Native UI

`blocklet/pages/*/layout.aup` composes pages. `blocklet/.web/site.yaml` owns locale
and rendering configuration; `.web/template/` supplies the native shell.
`.web/components/*/{render.js,style.css}` owns rendering/styles, and the named
sections of `didmail-chrome/script.js` own browser interactions. Native renderers
are self-contained; there is no React runtime, arbitrary renderer import graph
or separate application UI bundle.

`.aup/locales/*.json` supplies first-paint translations and help. Maintain
[help sources and native copies](help/README.md) together. Root `ui/` is a Node
regression facade; edit actual components, not a second browser implementation.

## Checks and adapters

Production modules import physical package paths. The native loader resolves
pinned dependency facades and rejects files outside the Blocklet; it has no
repository-path substitutions. Package source imports are checked independently
of the files reached by the current production entry, including internal recovery.

`tests/unit/` owns the 42 Node unit suites. `tests/support/node/` owns their
filesystem/SQLite, wallet, environment, session and cache ports. Only Jest reads
the nine explicit substitutions in `tests/node-adapters.json`; imports and mocks
resolve to the same selected test module. The Node signing environment is a
regression fixture, not a supported business runtime. No TypeScript `rootDirs`
overlay, root `api/` source tree or inward source symlinks remain.

`config/env.ts` reads immutable native bindings directly. The business test
builder uses the same physical application imports and substitutes only its
test environment and Express host; it rejects Node-only ports in its bundle.
Miniflare is temporary HTTP isolation/historical reading only; its
[migration endpoint](../tests/business/README.md) does not preserve a second product backend.

`pnpm lint` combines TypeScript checks, Node unit/support and UI facade lint and
`lint:runtime`. The latter parses actual owned `blocklet/providers` TypeScript/
JS and native component render/script files, plus the wallet/SQLite/chain operator tools and public CSS helper. It excludes `vendor`, generated outputs and pinned query/QR bodies within
the browser script (with checked boundaries and original line numbers). Its
recommended correctness rules are distinct from TypeScript and the older Node
style rules; the source file list is maintained in `scripts/lint-runtime.mjs`.

## Artifact boundary

The `blocklet/` directory is the complete authored package and the sole ARC
source authority. ARC directly builds it into `blocklet/dist/`. The root
`package.json`, lockfile, `docs/`, `scripts/`, `tests/` and `ui/` support development
and verification. The package's minimal ESM package.json preserves native module
semantics.

The package contains copies of the root LICENSE, NOTICE, third-party notices
and license texts. Keep those copies byte-identical. The shell logo at
`blocklet/.web/template/logo.svg` and the public `blocklet/assets/logo.svg` also retain
identical bytes for ARC's two conventions.

ARC selects files by the input directory. Its package scan does not apply the
repository's Git ignore rules as a release allowlist. Build releases from a clean
checkout, then audit the actual manifest and file tree against
[source evidence](distribution-artifact-evidence.json). Review input-list changes
explicitly and refresh source hashes after intentional edits.
`scripts/native-package-audit.mjs` shares integrity checks between the distribution
audit and regressions. It participates in verification.

Generated dist/cache files and private instance homes, wallets, configuration,
checkpoints and exports stay outside authored source. The
[distribution audit](distribution-license-audit.md) owns dependency/source hashes
and per-build evidence. The [operations status table](arc-package-runtime.md#capability-status)
records local, hosted and distribution acceptance.
