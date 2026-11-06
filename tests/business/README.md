# Business regression host

These are protocol, authorization, identity, storage, original-payment-byte and
recovery regressions for the native ARC server's shared modules. They are not a
standalone Cloudflare backend or a deployment acceptance suite.

The default runner executes test files serially to isolate heavyweight HTTP
containers; concurrency assertions inside each test still run concurrently.

`host/miniflare.mjs` temporarily supplies isolated HTTP execution and mocked
service links for the existing request assertions. It strips D1/R2 resource
configuration and executes relational predicates and encrypted-object operations
against `AfsBusinessStore` / `AfsObjectStore`. Test-only `host/environment.ts` and
`host/app.ts` adapt immutable environment and Express transport into this
container. None of these modules is included in the Blocklet.

`storage-fixture.mjs` provides explicit AFS transaction roots; the admission
fixture also exercises concurrent writers, policy roots and interrupted commits.
The SQL migration history remains the canonical schema under the package's
`didmail-business/migrations`; migration compatibility assertions are preserved.

The remaining platform coupling is **HTTP test isolation**, including simulated
service links and `setOptions` isolate replacement. Its migration endpoint is an
ARC-owned disposable-process harness with the same test-only routes and fault
injection, or a platform-neutral request harness over explicit immutable ports.
Move one regression group at a time without changing signed bytes, recovery
assertions, concurrency fences or cross-client codec checks. No production
Cloudflare startup/deployment code is retained to support this test host.

Real native execution is independently covered by `pnpm test:arc`, including
standalone package startup, original signing, encrypted delivery and restart
recovery. The temporary HTTP container cannot establish ARC authentication,
hosted deployment or real paid-chain settlement.
