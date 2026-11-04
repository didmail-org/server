# Retired public-mail routes and retained compatibility

Status: current production boundary. Audience: compatibility-test maintainers.

DMP/1 is the public mail protocol. The Worker returns uncached `410 PROTOCOL_RETIRED` for historical mail send, sign and download routes, including requests with an old valid download signature. Rejected requests create no mail rows or R2 objects.

Retained adapters still protect historical ciphertext/signature behavior for migration. [tests/workers/entry.ts](../tests/workers/entry.ts) exposes a test-only `/__legacy/api/mail/` dispatch with the original authorization, without reopening production routes. Tests assert original mail/attachment bytes, incorrect-signature rejection, malformed multipart handling and large R2 payloads.

[build-worker.mjs](../scripts/build-worker.mjs) excludes tests and test-only dispatch from production. Compatibility fixtures are not evidence of a supported old endpoint. See [protocol status](https://github.com/didmail-org/protocol/blob/main/docs/protocol/README.md), [runtime tests](../tests/workers/runtime.test.mjs) and [release gates](https://github.com/didmail-org/overview/blob/main/docs/status.md).
