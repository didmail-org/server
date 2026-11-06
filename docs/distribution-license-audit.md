# Native ARC package distribution audit

Status: reproducible native artifact evidence updated 2026-11-06; **public
Blocklet/Store distribution remains blocked**. The supported runtime is the ARC
package. Independent Workers deployment has been retired; historical Worker
inventories are retained only as dependency/license provenance.

A successful build, byte audit or local runtime check does not grant a license,
approve publication or establish hosted/Store acceptance. Original DIDMail code
remains Apache-2.0. Preserve all applicable third-party terms.

## Current evidence and reproduction

The package owns source, dependency assets, native AUP pages, providers and
public notices. Its actual `.afs/manifest.json` is the artifact inventory.
`providers/didmail-http/vendor/manifest.json` records the dependency-only native
asset, import/require facades, 157 package versions, declared terms, copied
sidecars and SDK/lockfile/OCAP-patch provenance. Native DID validation also retains
unmodified `@noble/hashes@2.4.0` source and its MIT license.

From the repository root, with the documented ARC CLI and Node >=24.14:

```sh
arc blocklet build blocklet
node scripts/audit-distribution.mjs --write
# Review evidence changes. The command does not edit build output or grant approval.
node scripts/audit-distribution.mjs
```

The collector needs no `node_modules`, Worker bundle/metafile or ignored UI
compiler metadata. A package built in an isolated directory can be checked with
`--package /absolute/path/to/blocklet/dist`. The checked-in public package source
notices are compared with delivered bytes. Normal verification fails on stale
evidence; update only after reviewing intentional source/dependency changes.

The collector:

- verifies every actual ARC manifest hash and rejects unlisted outputs, unsafe
  paths, duplicate entries, symlinks, hardlinks, special files and known private
  data/development paths, including wallets, runtime descriptors and databases;
- verifies the native dependency asset digest and every recorded facade digest;
- requires each import/require facade and declared license sidecar to be listed
  in the artifact, with nonempty license text; recovered texts are bound by hash;
- records missing texts explicitly and keeps distribution approval blocked;
- binds stable public source inputs to [source evidence](distribution-artifact-evidence.json)
  and package/license data to [dependency evidence](distribution-dependency-evidence.json);
- writes the complete verified inventory and actual ARC manifest digest from each
  build to ignored `artifacts/distribution/current-artifact-evidence.json`. This
  report is an output, never an input required by a clean checkout.

ARC may retain old content-addressed resources in `.web-cache/_arc/assets`
when building in place. A clean isolated build can omit those older assets while
producing the same current pages. Generated output therefore is not compared
with another build's committed hash list. Every actual file still must be listed
and hash-match its own manifest; the full per-build report preserves those bytes'
identity. `--write` updates only stable source/dependency evidence, never generated
HTML, caches, asset hashes or release approval. Use a clean isolated package build
for release artifact review.

These checks detect packaging mistakes, not arbitrary secrets disguised as source
or a fabricated upstream manifest. Dependency updates still require review of the
actual source, licenses, provenance and content. The generated evidence is scoped
to the built package, not an independently verified full transitive SBOM.

Source/vendor changes require a reviewed `--write`; regenerated cache differences
alone do not change committed evidence.

See the [current native inventory](blocklet-dependency-inventory.md) and its
[CSV](blocklet-dependency-inventory.csv). The old Worker/UI evidence was preserved
privately before replacing snapshots; tracked earlier evidence remains in Git.
The retained [Worker CSV](worker-dependency-inventory.csv) and license collections
are explicitly historical and are not inputs to current evidence reconstruction.

## Unresolved release gates

| Scope | Current requirement |
| --- | --- |
| `@ocap/util@1.30.24` | Exact official release license/NOTICE and embedded-code provenance remain unavailable. Its Apache metadata alone is insufficient. |
| `interface@1.2.1` | MIT metadata has no authoritative complete grant/attribution text for this release. Obtain it or independently review a replacement. |
| `@ocap/proto@1.30.24` | Present in the current native vendor inventory without a root license sidecar. The old statement that this version did not contribute applied to historical builds and is no longer applicable. Verify release-specific terms/provenance. |
| `utf8@3.0.0` | Present without a collected license text in the native inventory. Its metadata is not a substitute for the original applicable text. |
| ARC-generated runtime/template output | Obtain an authoritative release/output-code license or vendor confirmation covering the actual generated assets and all required third-party notices. The CLI binary is not redistributed by this package. |
| Full artifact obligations | Review nested bundled code, external runtime resources, modifications and all attributions against current bytes before public distribution. |

The native vendor inventory is broader than the old positive-byte Worker compiler
inventory. Inclusion in the native metadata is treated conservatively as requiring
review; this audit does not infer that unlicensed entries were tree-shaken away.

## Preserved license investigations

The [official npm release evidence](license-source-evidence.json) preserves release
metadata, tarball integrity and source hashes. Recovered original texts remain in
`third_party_licenses/` and the packaged public notice tree:

| Evidence | Applicable retained result |
| --- | --- |
| `boolbase@1.0.0` | [ISC text](../third_party_licenses/boolbase1.0.0.txt) from upstream license-adding commit `be0bcd8a4e917a0a5895e95b523fbbed05a64871`; its source matched the release. |
| `express-async-errors@3.1.1` | [ISC text](../third_party_licenses/express-async-errors3.1.1.txt), retaining Nikolay Nemshilov and David Banham attribution, from source-matching commit `f99d8fc2d238306a65653b4cdf64632981749536`. |
| `cookie-signature@1.0.6` | [Published README MIT section](../third_party_licenses/cookie-signature1.0.6-README-license.txt), including original attribution/disclaimer. |
| `jsonify@0.0.1` | [Published README public-domain declaration](../third_party_licenses/jsonify0.0.1-README-license.txt); no substitute grant invented. |
| `google-protobuf@3.21.0` | Retain its BSD text and the embedded [Closure Apache header](../third_party_licenses/google-protobuf3.21.0-Closure-header.txt) plus [Apache terms](../third_party_licenses/google-closure-library-Apache-2.0.txt). |
| `@arcblock/validator@1.19.15` | Metadata declares MIT while its packaged LICENSE supplies an ArcBlock Apache notice. Retain the original Apache text and flag the conflict; do not invent an MIT grant. |
| `qrcode-generator@1.4.4` | [MIT grant](../third_party_licenses/qrcode-generator1.4.4.txt) and [source header](../third_party_licenses/qrcode-generator1.4.4-source-header.txt) from source-matching `js1.4.4` commit `9bd2163ddc1628d1ec8ff22ea288a747275ef442`, including DENSO WAVE trademark attribution. |

The pinned protocol SDK embeds noble/scure crypto with its nested notices; retain
those notices without counting them as independent installed package instances.
Axios, Esprima and Lodash also contain embedded/bundled code whose supplied notices
remain required. OCAP generated helper and inaccessible upstream-code provenance
still require review. The patched OCAP client retains its original license and
modification description. Toolchain deepmerge/minimatch notices and historical
Cisco HPKE fixture provenance remain useful evidence even when they are not
native application inputs. Do not delete them based on missing code imports.

The historical collections `worker-bundle-licenses.txt` and
`blocklet-bundle-licenses.txt` preserve original texts, including the previous UI
TanStack license. They are supplemental evidence, not current package inventories.
Authoritative current native sidecars live with the vendor assets and are hashed
by this audit. No generic SPDX template replaces missing original text.

## Host resources and approval boundary

Native HTML references host resources such as `/__blocklet__.js` and
`/aup-core.*.css`, and external Google Fonts. A manifest proves only bytes shipped
inside the package. Host resources need runtime availability and appropriate
terms; adding offline copies requires a new exact-file audit. Generated files
already inside `.web-cache/` remain covered by the unresolved output-code gate.

The retained [ArcBlock request](license-requests/arcblock.md) and
[interface request](license-requests/interface.md) are drafts, not evidence of
contact, a reply or permission. Current audit commands send no messages, perform
no chain transactions, read no wallet/private configuration and restart no ARC
instance. Byte integrity and legal approval remain separate from dependency
security checks and local/native/hosted runtime acceptance.
