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
      runtime-adapters.json    native substitutions for retained Node ports
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

The scoped Bun loader resolves package TypeScript and pinned dependency facades;
unknown dependencies fail closed and other ARC apps are unaffected. These
installed-runtime constraints are exercised by native tests, not inferred from
a template. `basic` is the applicable package checker profile. Site identity,
routes, allowed mount operations and public leaves are declared in
[the manifest](../blocklet/blocklet.yaml); empty agent/settings modules are unnecessary.

## Business modules

All paths below are relative to `blocklet/providers/didmail-http/source/`:

| Path | Responsibility |
| --- | --- |
| `http/` | Public fetch routing, account/admin endpoints, Express assembly |
| `protocol/` | DMP handlers, settlement/jobs; `contact/` retains internal recovery |
| `identity/` | Session/membership, original wallet, chain reads, nonces/payment lanes |
| `policy/` | Admission, envelope/namecard access and gas eligibility |
| `storage/` | AFS SQL/object client, compatibility models, caches and policy port |
| `config/` | Validated runtime/configuration access |
| `runtime/` | Project-owned SQL/object/fetch/task contracts, bindings, scheduler and shims |
| `api/src/` | Shared retained REST routes, business rules and signature helpers |

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

`api/src` compatibility symlinks point inward. Node unit checks still select
historical filesystem/SQLite ports; native loading selects AFS and the installed
signing environment. Nine entries in `runtime-adapters.json` identify that
intentional host substitution. TypeScript `rootDirs` and the Jest resolver
support those Node ports; the native loader and business test builder consume
the map. Removing this remaining virtual tree requires explicit host/signing
context isolation, not another rename or copied implementation.

`config/env.ts` reads immutable bindings directly. Native modules use actual
package-relative imports where no host substitution is needed. The test builder
keeps repository and package-virtual keys for the intentional Node ports.
Miniflare is temporary HTTP isolation/historical reading only; its
[migration endpoint](../tests/business/README.md) does not preserve a second product backend.

`pnpm lint` combines TypeScript checks, existing Node adapter/facade lint and
`lint:runtime`. The latter parses actual owned `blocklet/providers` TypeScript/
JS and native component render/script files, plus the wallet/SQLite/chain operator tools and public CSS helper. It excludes `vendor`, generated outputs and pinned query/QR bodies within
the browser script (with checked boundaries and original line numbers). Its
recommended correctness rules are distinct from TypeScript and the older Node
style rules; the source file list is maintained in `scripts/lint-runtime.mjs`.

## Artifact boundary

Only `blocklet/` authored inputs and pinned assets are required for native
build/run. `blocklet/dist` and `.web-cache` are generated. Private instance homes,
wallets, environment files, checkpoints and exports stay outside the package.
The [distribution audit](distribution-license-audit.md) owns dependency/source
hashes and per-build evidence; it does not grant deployment or legal approval.
The [operations status table](arc-package-runtime.md#capability-status) is the
single acceptance summary.
