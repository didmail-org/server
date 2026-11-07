# Development guide

Read this after the [README](../README.md); use the [architecture](server-architecture.md)
when locating source. Commands below run from the standalone Server repository.
They never require the historical Workers backend.

## Prerequisites

| Task | Required tools |
| --- | --- |
| Build from source | Pinned ARC CLI |
| Run a verified, installed package | Matching ARC CLI/runtime and a configured named instance |
| Audit a distribution | Node.js >=24.14 and the built package |
| Edit source and run repository checks | Node.js >=24.14, Corepack with pnpm 12.11.2, and ARC for package/native tests |
| Provision/import a real instance | Operator access and private installation data; see [operations](arc-package-runtime.md) |

Install ARC from the [official CLI installer](https://www.arcblock.io/en/docs/arc-cli/install/).
Its `--version` option selects a deliberate release; the [CI setup](../.github/workflows/ci.yml)
records the pinned Linux archive/checksum used by this project. Corepack must be
on PATH before the pnpm commands (`corepack enable` supplies the `pnpm` shim
used by nested scripts); use its [installation instructions](https://github.com/nodejs/corepack#manual-installs)
if your Node installation does not supply it.

The installed/CI ARC baseline is `2.0.0-beta.74 (49c9125c)`. Check `arc --version`
and match its `blocklet`/DSL contracts. The `basic` checker profile applies;
agent/settings recipe scaffolds are not prerequisites for this app.

## Run an already configured package

The authored ARC package lives in `blocklet/`. From the repository root:

```sh
arc dsl validate blocklet
arc blocklet check blocklet --profile basic
arc blocklet build blocklet
arc blocklet run blocklet/dist --instance <instance-name>
```

With development tooling installed, `corepack pnpm arc:check`,
`corepack pnpm build` and `corepack pnpm start --instance <instance-name>`
call these ARC commands directly. The root package.json and lockfile serve the
development toolchain. The minimal `blocklet/package.json` supplies native ESM
semantics. Building and running need only ARC.

ARC scans the selected package directory when constructing its manifest. Keep
development tools, tests and instance data outside `blocklet/`. Prepare a clean
checkout and follow the [distribution audit](distribution-license-audit.md)
before installing or publishing a release. The audit rejects unexpected files,
aliases and changed inputs. It requires Node.js and no installed dependencies.

The CLI writes `blocklet/dist/` and prerender cache under `blocklet/.web-cache/`.
When an instance is serving that dist, build the next version in a separate
checkout and install it at a versioned path.

For an installed, audited copy, ARC alone serves the self-contained directory:

```sh
arc blocklet run /absolute/path/to/installed-package --instance <instance-name>
```

The named instance must already know the installed package path. See
[operations](arc-package-runtime.md#rebind-an-existing-installation) to change that
binding. Open the printed app URL after a cold start. ARC lazily activates
providers. Use the configured mail origin for protocol APIs and the
[activation read](arc-package-runtime.md#activation-and-health) for diagnosis.

There is no guaranteed hot reload: source/provider or private configuration
changes require a controlled restart of the affected ARC instance. Preserve its
home and coordinated data; do not stop unrelated services.

A missing configuration leaves protocol ingress closed. A new installation is
an [operator provisioning task](arc-package-runtime.md#new-installation), not
`setup`, a SQLite import or a test fixture. For development without configured
mail data or private keys, use the isolated native test below.

## Install the development tools

```sh
node --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
```

Use the version declared in `package.json`, the repository lockfile, allowlist
and patches. Normal installation must execute approved dependency build scripts:
SQLite's Node addon, the protocol SDK, esbuild and the test host need usable
installed artifacts. `--ignore-scripts` is not evidence of a working regression
environment. The package's checked-in vendor assets serve ARC directly; installing
Node dependencies does not regenerate them or provision an instance.

Run a bounded first check, then the isolated native runtime:

```sh
corepack pnpm lint
corepack pnpm test:ui
corepack pnpm build
corepack pnpm audit:distribution
corepack pnpm test:arc
```

`test:arc` copies the verified artifact outside the checkout and creates/removes
its own named ARC instance with public fixtures. It exercises native web routes,
provider mounts, HTTP/WS, signing, storage and restart recovery. Keep the
synthetic caller configuration confined to this fixture.

## Change a feature and choose checks

| Change | Where to look | Relevant checks |
| --- | --- | --- |
| Protocol, signatures, account authorization or admission | [Business modules](server-architecture.md#business-modules) | `pnpm lint`, affected `pnpm test` or `pnpm test:business`, `pnpm test:arc` for native integration |
| Provider lifecycle, transport or private configuration | [Native host/providers](server-architecture.md#native-host-and-providers) | `pnpm test:scripts`, `pnpm test:arc` |
| AUP pages, components, translations or help | [Native UI](server-architecture.md#native-ui) | `pnpm lint`, `pnpm test:ui`, `pnpm arc:check`, `pnpm build`; affected browser check |
| Transaction storage, import or backup | [Storage contracts](afs-business-storage.md) | Relevant store/importer tests from `pnpm test:scripts`, business recovery assertions, native integration when affected |
| Engineering documentation | [Task index](README.md) | Links/anchors, actual command help and source consistency; no unrelated build |

`pnpm lint` includes the actual source scopes documented in [architecture](server-architecture.md#checks-and-adapters);
type checks and facade checks are separate evidence. `test:business` runs files
serially to isolate test containers, retaining concurrent requests within each
test. It prepares its own bundle; when invoking a business test file directly,
first run `node scripts/build-business-tests.mjs`. The cross-client codec test
needs sibling mobile/extension dependencies; `test:business:standalone` excludes
only that test. [Test host details](../tests/business/README.md) are optional.

## Optional browser preparation

The project uses `playwright-core`, which does not install a browser. Install a
Chrome/Chromium binary and set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its absolute
path (scripts otherwise default to the macOS Google Chrome application path).
Live fixtures use `DIDMAIL_BROWSER_URL` when selecting a configured origin.

For a built-page check without private instance data:

```sh
corepack pnpm build
export PLAYWRIGHT_CHROMIUM_EXECUTABLE=/absolute/path/to/chrome
export DIDMAIL_BROWSER_CORE_CSS="$(node scripts/cache-arc-core.mjs)"
node scripts/browser-artifacts.mjs ui
```

The helper creates and removes its own disposable ARC instance, obtains the
public stylesheet matching the built HTML hash and caches it under ignored
`artifacts/browser-core/`. It needs the same ARC version used for the build, not
an existing configured mail instance, operator key or live service restart.
Use `admin`/`policy` instead of `ui` for those fixtures; `pnpm test:browser:help`
uses the same CSS variable. These fixtures do not establish real authentication
or paid-chain acceptance.

Do not edit generated HTML, caches or manifest hashes. Update authored inputs,
then use ARC build. Vendor updates, full distribution review and real-instance
migration have their own [release](distribution-license-audit.md) and
[operations](arc-package-runtime.md) procedures; they are not ordinary startup.
