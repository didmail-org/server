# Native browser component

`script.js` is the canonical browser implementation, read directly by Web Device.
The named sections retain the existing module boundaries (locales, shared
formatting, identity, state, policy, members, chrome and administration).
`ui/` exposes the pure sections to the established Node regression tests; it
must not become a second implementation or require a regeneration command.

The prefix contains pinned Query Core 5.104.5 and QR Code Generator 1.4.4.
Query Core's published modules were adapted to one browser closure with the
production environment fixed; QR Code Generator's original implementation is
wrapped in a local scope. No dependency is fetched at runtime. Their original
notices are retained in `../../../third_party_licenses/` and
`../../../THIRD_PARTY_NOTICES.md` (paths relative to this component).
Deliberate dependency updates require source and
license review plus the native build, Node and browser regressions.

Component files are authored application inputs, not generated UI bundles.
ARC alone renders the AUP pages, collects component CSS/scripts and writes the
package manifest/content hashes. Do not edit emitted `.web-cache` or `dist` files.
