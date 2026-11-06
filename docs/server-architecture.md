# Server source and runtime boundaries

The supported runtime is the native ARC package. Production source and its pinned
dependency assets live inside that package. Cloudflare Workers and the external
workerd preview are retired. See [local development](local-arc-development.md)
for commands and [packaged runtime](arc-package-runtime.md) for activation/setup.

## Source ownership

```text
blocklet/
  blocklet.yaml              stable identity, sites, instance and mounts
  pages/                     AUP layouts and metadata
  .web/                      Web Device components and site config
  .aup/locales/              translations and public help
  providers/
    didmail-http/
      source/api/src/        retained REST routes and business rules
      source/http/           protocol HTTP dispatch and administration endpoints
      source/protocol/       mail/tasks/settlement and internal contact recovery
      source/identity/       sessions, membership, signing, replay and chain reads
      source/policy/         admission, access and gas eligibility
      source/storage/        AFS relational/object ports and caches
      source/config/         validated runtime/configuration access
      source/runtime/        host-neutral bindings and compatibility shims
      host/                  native loader, HTTP transport and lifecycle
      runtime-adapters.json  native compatibility substitution map
      vendor/                pinned dependency assets and license evidence
    didmail-business/        AFS transaction/object port and ordered migrations
    didmail-native/          verified-caller configuration/policy actions
    didmail/                 public discovery and compatibility projection
api/                         historical Node host/models and inward source links
ui/                          regression facades over native components
scripts/                     native build, operator, migration and checks
tests/business/              isolated protocol/storage/recovery regressions
tests/ui/, test/             UI regressions, vectors and compatibility evidence
docs/                        current contracts, operations and source evidence
```

Remaining `api/src` compatibility links point inward. Edit canonical package
source, never a second copy or generated snapshot. Ordered SQL migrations live
in `providers/didmail-business/migrations`. Their filenames, SQL predicates,
instance storage keys and the opaque `r2://` object marker remain durable
contracts despite retirement of the D1/R2 runtime.

The scoped native loader uses `runtime-adapters.json` to replace historical Node
environment/database/wallet ports. Test bundling reuses production modules with
a disposable test host. Miniflare is test infrastructure only; the package does
not depend on Cloudflare to run. Dependency shims and inventories retain their
explicit native maintenance boundary.

## Runtime dependency direction

The HTTP provider loads private configuration, activates business storage,
checks single-instance identity ownership and loads `host/runtime.mjs`.
The runtime configures immutable bindings, validates the original wallet and
loads the shared fetch/scheduled core. `host/http-server.mjs` handles only HTTP
and WebSocket transport: origin validation, incoming header filtering, body
limits, cookies, streams and connection cleanup. The runtime owns initialization
and scheduling. Shared REST routes use the selected environment, wallet,
database and chain adapters rather than importing an operator script.

Native business storage evaluates existing SQL transactions using ephemeral
SQLite and conditionally commits the instance AFS aggregate. It is not a durable
SQLite file. Ciphertext objects, configuration, policy, nonce fences and original
transaction evidence retain their documented instance paths. Read
[storage and backup](afs-business-storage.md), [admission fencing](afs-policy-admission.md)
and [migration order](instance-afs-migration.md) before changing persistence.

Providers stop accepting new startup work on unmount and await in-flight startup
before releasing their listener ownership. Wallet/environment configuration is
still immutable for the process; this does not enable hot key replacement.
Shutdown does not establish an exactly-once job drain: durable job recovery and
idempotency remain necessary after interrupted work.

## Build and distribution boundaries

`pnpm build` invokes `arc blocklet build blocklet`, emitting `blocklet/dist`.
`pnpm start` runs the source package through ARC; installed-artifact acceptance
runs `blocklet/dist` with the required instance Space. Production build/run
requires no repository node_modules or preparation/bundle script.

`pnpm test:business` compiles only the disposable regression harness and executes
`tests/business`; no test-only legacy dispatch is part of the native package.
`pnpm test:arc` checks the actual isolated ARC HTTP runtime. Historical Node
source remains compatibility/reference material, not another supported server.

`blocklet/.web-cache` and `blocklet/dist` are generated and ignored. Retained
root `dist`/`.worker` artifacts are obsolete local outputs, not deployable
products. `.arc`, `.wrangler`, `.data`, environment files and exports remain
private instance/operator state. Vendor manifests, license evidence and protocol
vectors remain maintained provenance. Public distribution and hosted execution
have separate acceptance gates.

## Applicable ARC contract

Checked CLI: `2.0.0-beta.74 (49c9125c)`, build stamp 2026-10-27. Use
`arc blocklet check blocklet --profile basic` and `arc dsl validate blocklet`.
The installed `recipe explain basic` requires a manifest; `minimal-app` is a
scaffold for web + AUP + agent + settings, not a requirement for every web app.
DIDMail does not claim that profile or add unused agents/settings.

The manifest fixes `did:blocklet:didmail-server`, `scope: app`, required
`/instance`, four provider mounts with explicit operations, site domain and
localized administration route bindings. Only attachment public configuration
is declared for guest network reads. Providers enforce verified caller actions;
private business/control/key paths are not public resources. Page composition,
locale coverage, manifest hashes and package confinement are checked by the
isolated package regression; native HTTP execution is exercised separately.

The official [Blocklet reference](https://www.arcblock.io/en/docs/blocklets/reference/)
and [package overview](https://www.arcblock.io/en/docs/blocklets/) distinguish
package, AUP, Web Device and AFS capabilities. Their published evidence baseline
is beta.28; installed beta.74 help/check/build and actual execution take
precedence for version-specific behavior. These checks do not certify Store
licensing, hosted scheduling, remote instance durability or paid-chain delivery.
Directory organization and the native adapter map are DIDMail engineering
choices, not ARC schema requirements.

## Retained data compatibility code

`storage/database.ts` retains the historical relational attachment-configuration
reader and policy/admission modules retain relational policy predicates used by
compatibility regressions. These operate on the same SQL/object interfaces over
AFS in tests. The production host fixes configuration/policy/storage backends to
AFS; private configuration cannot select another backend. They are not D1/R2
runtime fallback or supported deployment choices. Retire these data-compatibility
branches only after replacing their historical-record regressions and preserving
the one-time import contract. The `r2://` object marker and old export format
names remain durable identifiers and must not be renamed.
