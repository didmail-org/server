# Retired public-mail routes and retained compatibility

Status: current production boundary. Audience: compatibility-test maintainers.

DMP/1 is the public mail protocol. The native HTTP entry returns uncached `410 PROTOCOL_RETIRED` for historical mail send, sign and download routes, including requests with an old valid download signature. Rejected requests create no mail rows or encrypted objects.

Retained adapters still protect historical ciphertext/signature behavior for migration. [tests/business/entry.ts](../tests/business/entry.ts) exposes a test-only `/__legacy/api/mail/` dispatch with the original authorization, without reopening production routes. Tests assert original mail/attachment bytes, incorrect-signature rejection, malformed multipart handling and large encrypted payloads.

The [native runtime](arc-package-runtime.md) loads only the production entry. The [business test builder](../scripts/build-business-tests.mjs) builds a separate disposable harness; test-only dispatch is not installed in the package. Compatibility fixtures are not evidence of a supported old endpoint. See [protocol status](https://github.com/didmail-org/protocol/blob/main/docs/protocol/README.md), [runtime tests](../tests/business/runtime.test.mjs) and [release gates](https://github.com/didmail-org/overview/blob/main/docs/status.md).
