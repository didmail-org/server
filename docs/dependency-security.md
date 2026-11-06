# Dependency compatibility and security patches

Status: maintained engineering reference. This document explains the security-related compatibility settings in [pnpm-workspace.yaml](../pnpm-workspace.yaml). It is not a release certification or a substitute for a fresh dependency audit.

## Runtime compatibility

The server requires Node.js 24.14 or newer. The original `@ocap/client` and its protobuf transaction codec remain in place. Its crypto implementation uses the maintained `@ocap/mcrypto` release, and its GraphQL helper uses the maintained `@arcblock/sdk-util` release. The server explicitly declares the legacy client's previously implicit GraphQL parser dependency.

The crypto update removes the old elliptic and eth-lib dependency chains. Public compatibility vectors captured from `@ocap/mcrypto` 1.19.15 check byte-for-byte public keys and signatures for Ed25519, secp256k1 and Ethereum. These are [explicit test keys](../tests/fixtures/legacy-dependency-compatibility.json), not credentials. Existing payment and mint fixtures continue to test the actual legacy and CBOR chain codecs independently. Do not replace the legacy client codec as an incidental dependency cleanup.

SQLite 6 retains the native database interface used by Sequelize and the export tools while using the maintained archive extraction dependency. Overrides for UUID, Phoenix, Undici, glob and minimatch select maintained versions; their calling interfaces are covered by the server tests. Keep the native storage adapters, Node database and historical export checks in the validation scope when updating them.

Multer 2.5.0 replaces the previously pinned 1.4.5-lts.1 release, which is affected by multiple upload denial-of-service advisories. The server unit tests and business multipart regression cover the existing middleware integration; retain upload limits and reassess the package against current advisories before release. See the [upstream changelog](https://github.com/expressjs/multer/blob/main/CHANGELOG.md).

## Checked-in patches

The [legacy client compatibility patch](../patches/@ocap__client@1.19.15.patch) explicitly disables the newer helper's automatic RPC retries. Durable DIDMail coordinators own retry decisions, especially after a broadcast acknowledgement is lost. This preserves the original single-attempt behavior without changing transaction bytes; a lost-acknowledgement regression checks that the helper cannot silently broadcast several times inside one job step.

The [minimatch compatibility patch](../patches/minimatch@11.0.3.patch) retains the callable CommonJS export and the path-segment interfaces used by the locked glob 7 and ESLint 8 callers. Segment matching still uses the maintained nonrecursive matcher; the patch does not restore the older matching algorithm. Legacy pattern fixtures and real glob enumeration verify these interfaces. This adapter is specific to the checked-in toolchain and needs review when its consumers change.

The [deepmerge security patch](../patches/deepmerge@4.3.1.patch) rejects prototype-related keys when copying both target and source objects, including nested objects and arrays. The unpatched target-copy and null-prototype-source cases reproduce returned-object prototype poisoning. The patch covers the Node and browser distributions as well as the upstream source. It addresses [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), for which the advisory currently lists no published patched version.

Package audits can continue to report the deepmerge version despite this checked-in fix. Preserve that raw result and report the applied patch and regression evidence separately. Do not add audit ignores, misstate the installed version or treat an absent native dependency-asset import as a vulnerability fix. Remove the patch only after an upstream replacement passes the same attack and compatibility checks.

## Validation

Run raw `pnpm audit --prod` and `pnpm audit` and retain their results separately
from the patch-aware `pnpm audit:dependencies` gate. Follow the
[development check matrix](local-arc-development.md#change-a-feature-and-choose-checks)
for source/regression/native commands rather than treating every browser or
release check as a dependency-update prerequisite.

The focused checks are [dependency-security.test.mjs](../scripts/dependency-security.test.mjs), [legacy-contact-payment.test.ts](../api/src/libs/__tests__/legacy-contact-payment.test.ts), [contact-service.test.ts](../api/src/routes/contact-service.test.ts) and the [business codec checks](../tests/business/dmp-codec.test.mjs). Native Node tests, packaged ARC execution and real-browser checks exercise different boundaries; one does not replace another.
