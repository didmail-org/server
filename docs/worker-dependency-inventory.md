# Production Worker dependency inventory

Status: reproducible build evidence, not permission to distribute. See the [distribution audit](distribution-license-audit.md) for conclusions and remaining gates.

The production build has 1,260 esbuild inputs; 1,102 contribute bytes to `.worker/index.mjs`, mapping to **151 installed package instances**. The [CSV](worker-dependency-inventory.csv) records declared license metadata and local LICENSE/COPYING availability. `local_license_file=no` does not mean no license evidence: original README sections and recovered upstream grants are tracked separately. Conversely, a license file or SPDX field alone does not complete distribution review.

The [machine-readable evidence](distribution-dependency-evidence.json) binds each contributing package-relative input and collected notice to SHA-256. It handles the direct Axios alias and package-internal manifests without confusing them with installation boundaries. Tests now write `.worker/test-metafile.json`, leaving the production metafile intact. [Official package provenance](license-source-evidence.json) records the investigated npm releases and tarball hashes.

From the Server root, using Node >=24.14 and the declared pnpm version:

```sh
corepack pnpm build
corepack pnpm audit:distribution:update
# Inspect generated inventory/notice changes, then rebuild to copy them.
corepack pnpm build
corepack pnpm audit:distribution
```

The update command rewrites reviewed source snapshots; it does not approve a release. Verification checks current compiler evidence, byte-identical legal copies in `.worker/legal`, Worker ASSETS `dist`, and `blocklet/dist`, plus every ARC manifest file hash. A separate Wrangler dry run inspects the final upload compilation; native runtime, core CSS and hosted integration boundaries remain in the audit report.

The [Worker collection](../third_party_licenses/worker-bundle-licenses.txt) preserves available texts, including protocol nested notices and recovered upstream licenses. Two instances remain without verified text: `@ocap/util@1.30.24` and `interface@1.2.1`. Nested code and ARC-generated assets are reviewed separately. The Blocklet/UI inputs are in their [own inventory](blocklet-dependency-inventory.csv).
