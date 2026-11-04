# Production Worker dependency inventory

An esbuild production Worker metafile identified 1,102 inputs contributing bytes to the output, mapping dependency inputs to 151 installed package instances. The [inventory](worker-dependency-inventory.csv) records declared license metadata and whether each installed instance has a LICENSE or COPYING file. It contains no local filesystem paths.

This is a platform- and lockfile-specific audit snapshot, not a complete release SBOM or legal conclusion. Bundled dependencies may themselves contain third-party code not visible as separate esbuild modules. Source provenance, nested dependencies, NOTICE requirements, native or alternate targets and distribution obligations still require verification.

A collection of license and notice files available locally is preserved in [third-party notices](../THIRD_PARTY_NOTICES.md); missing items remain explicitly unresolved. Do not interpret this inventory as permission to distribute an unreviewed build.
