# Pinned protocol runtime dependencies

This directory is a versioned third-party dependency asset, not an application
build output. Normal `arc blocklet build` copies it without installing npm
packages or running repository preparation scripts. Shared application modules
remain readable source under `../source/`.

`manifest.json` records the dependency-only esbuild asset SHA-256, ESM/CommonJS
facade hashes, exact installed versions and upstream repository/license metadata,
the public pnpm lockfile hash, pinned protocol Git revision and applied OCAP retry
patch hash. `licenses/` preserves package-root texts found during capture. Other
applicable recovered and nested notices remain in the Blocklet's curated
`third_party_licenses/` collection and `THIRD_PARTY_NOTICES.md`.

The asset exposes namespace entries for the specifiers in the manifest. Their
facades share one dependency graph, preserving Express patching and crypto type
identity. Host-only substitutes (`sequelize`, `node-fetch`, `depd`, `@arcblock/ws`)
remain external to the asset and resolve to readable packaged host adapters.
Dependencies were captured using the recorded esbuild version/target and the
frozen server lockfile, with Axios' browser/fetch transport and Node builtins
external. Application modules were explicitly excluded from that capture.

Updating this asset is a deliberate dependency/vendor review: use the frozen
approved versions and patches, preserve all upstream terms, verify no application
or private inputs enter the asset, update inventory/hashes/facades, and rerun the
standalone native HTTP/SDK test. Native package/application changes alone do not
require regenerating it. Its inventory is not distribution approval; the
repository's distribution-license audit still blocks public release.
