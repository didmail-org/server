# Native Blocklet dependency inventory

The current [CSV](blocklet-dependency-inventory.csv) and
[dependency evidence](distribution-dependency-evidence.json) derive from the
built native package's vendor manifest and actual delivered license bytes.
[Source evidence](distribution-artifact-evidence.json) binds stable public package
inputs by SHA-256. Every audit also validates every actual ARC manifest file and
writes its complete hashes plus manifest digest to ignored
`artifacts/distribution/current-artifact-evidence.json`. These files can be rebuilt from public source plus the installed
ARC CLI; no Worker compiler output or historical UI metafile is needed.

Run `arc blocklet build blocklet`, then
`node scripts/audit-distribution.mjs --write`, review changes, and verify with
`node scripts/audit-distribution.mjs`. For an isolated build, add
`--package /absolute/path/to/blocklet/dist` to both audit commands.

The native dependency-only asset currently records 157 package instances. Its
SDK, lockfile and patch provenance are retained in the vendor manifest, alongside
facade and asset digests. A valid clean rebuild or changed ARC cache does not
require changing committed source evidence; its own manifest still must match
every actual byte. `--write` never rewrites generated HTML or cache assets. The collector validates those digests and binds copied
root sidecars plus applicable recovered texts. Unmodified native noble-hashes
source is recorded separately. The historical UI collection is supplemental
license evidence, not another current source of package-version truth.

Four native entries currently lack collected license texts:
`@ocap/proto@1.30.24`, `@ocap/util@1.30.24`, `interface@1.2.1` and `utf8@3.0.0`.
All remain explicit in machine-readable evidence. Collected text also does not
complete attribution, nested-code provenance or output-code review. Distribution
remains **blocked** under the [distribution audit](distribution-license-audit.md).
