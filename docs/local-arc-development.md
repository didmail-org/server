# Local ARC development

DIDMail's current UI target is a standard Blocklet using authored AUP layouts
and Web Device components. Build and run it with the public ARC commands below.
No application preparation script, JavaScript bundler or HTML/hash postprocessor
is part of this package build. The checked local CLI is
`2.0.0-beta.74 (49c9125c)`, built 2026-10-27.

## Standard commands

From the standalone server repository:

```sh
arc dsl validate blocklet
arc blocklet check blocklet
arc blocklet build blocklet
arc blocklet inspect blocklet/dist
arc blocklet run blocklet/dist --instance didmail-web
```

Use the URL printed by the CLI. The existing local instance is `didmail-web`;
retain its home, identity and instance data. Running the source directly with
`arc blocklet run blocklet --instance didmail-web` is also supported for local
development. The pnpm build/run aliases invoke these ARC commands directly.
A native package build needs the ARC CLI, not this repository's node_modules.

Use the official [Blocklets](https://www.arcblock.io/en/docs/blocklets/),
[local run](https://www.arcblock.io/en/docs/blocklets/create-run-locally/) and
[Web Device](https://www.arcblock.io/zh/docs/web-device/) contracts. Match the
checker profile to the actual application: do not add unused agents or settings
just to pass a different recipe profile.

## Authored package inputs

| Path | Responsibility |
| --- | --- |
| `blocklet/blocklet.yaml` | Stable identity, version, metadata, site, required instance and provider |
| `blocklet/.route/web` | Public Web Device entry |
| `blocklet/pages/*/layout.aup` and `seo/` | Page composition and page metadata |
| `blocklet/.web/site.yaml` | Explicit default/supported locales and native rendering settings |
| `blocklet/.web/template/` | Native header, language/user controls, navigation and logo |
| `blocklet/.web/components/*/render.js` | Directly readable Web Device renderers |
| `blocklet/.web/components/didmail-chrome/script.js` | Canonical browser interactions in named module sections |
| `blocklet/.web/components/*/style.css` | Native component styles, including shared brand/header styles |
| `blocklet/.aup/locales/*.json` | Native first-paint translations and public help text |
| `blocklet/providers/didmail/` | Read-only native health/public policy; explicit proxy mode for compatibility fixtures |
| `blocklet/providers/didmail-native/` | Instance AFS configuration/policy and verified-caller actions |
| `blocklet/providers/didmail-http/` | Packaged source, pinned dependencies, HTTP/signing/scheduler and private configuration |
| `blocklet/providers/didmail-business/` | Native transaction/object/policy port, initializer, migrations and admission recovery |
| `blocklet/LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md`, `third_party_licenses/` | Reviewed package notice inputs |

The native renderer does not resolve arbitrary JavaScript imports. Keep its
renderers self-contained. Browser interactions are likewise a native component,
so they do not depend on arbitrary root-relative static module URLs. The
`didmail-chrome` component supplies the common header behavior and existing
business interactions; each page composes it explicitly before its content.
Pinned browser-library notices accompany the source.

`ui/` retains Node regression facades over the native browser component and
renderer exports. Edit the canonical component sections, not those facades.
The packaged locale registry remains an explicit shared input. Keep page titles/translations aligned with browser translations and
`docs/help/*.md`; the native package test checks the help copies.

`blocklet/dist` and `blocklet/.web-cache` are generated and ignored. Do not
rewrite their HTML, script names or manifest hashes after ARC builds them.
Do not put node_modules, environment files, wallets, runtime homes or databases
under `blocklet/`: the package root is deliberately separate from those files.
The build reads authored configuration, not private local environment files.

## Native business runtime

The package now runs the original protocol HTTP handlers, Express compatibility
routes, signing wallet and scheduler inside ARC. Business/policy/configuration
state and ciphertext objects use instance AFS; no workerd or D1/R2 resource is
required by this local path. Read [packaged runtime](arc-package-runtime.md) for
private configuration, lazy activation after cold restart, the single signing
instance per process boundary and backup requirements.

Open the complete configured mail/UI origin, currently
`http://didmail-server.localhost:8788`, after activating the app at the ARC URL.
The parent ARC port serves native pages/login and AFS, but has no raw mail REST
routes. `pnpm preview:local` now invokes `arc blocklet run blocklet/dist`;
The external workerd executor and Workers deployment have been retired.

Keep the original node key/address and membership credential in private instance
configuration. Initialization/import is explicit and conditional. The package
contains neither installation data nor secrets. Normal ARC build/run needs no
repository scripts or node_modules. Node/pnpm remain operator/regression tools.

## Verification and subsequent business work

`scripts/arc-package.test.mjs` copies only the package sources into a temporary
directory with no repository build scripts or node_modules, then runs the three
ARC gates. It verifies page content in all five locales, required instance,
public notices and emitted file hashes. Existing Node regressions import the
same native component functions. Chromium checks exercise rendered pages with
isolated API fixtures; read-only smoke checks cover the running native service.
Keep actual hosted, authenticated-user and chain acceptance separate.

ArcBlog is a useful reference for the package/instance split and for separating
native AUP interaction pages from Web Device content. Its source also documents
custom concatenation and artifact-scrubbing steps; those build dependencies are
not adopted here. DIDMail keeps private inputs outside the package root instead.

After the native package and local runtime pass, fix business defects with
focused regressions while preserving protocol signatures, exact amounts,
encrypted objects and original transaction recovery evidence. The
[ARC-native migration](arc-native-migration.md) records the remaining hosted cutover contracts. Existing [distribution decisions](distribution-license-audit.md) are
separate from permission to build and test locally.
