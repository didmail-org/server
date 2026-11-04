# Local preview persistence and restart

Status: current development procedure. Audience: contributors operating the local preview.

## Storage location

The approved `didmail-web` ARC instance serves UI/identity. Its business preview runs workerd at `http://didmail-arc.localhost:8788`; [run-arc-worker.mjs](../scripts/run-arc-worker.mjs) uses Miniflare `resourcePersistencePath` at `.wrangler/state/arc-preview` for D1/R2. Legacy `d1Persist`/`r2Persist` options can be ignored by current Miniflare; their presence is not proof of persistence. Do not merge old state roots blindly.

Wallets, environment files, `.data`, `.arc`, `.wrangler`, snapshots and reports are private ignored data, never public package contents.

## Restart procedure

1. Verify the listening workerd's parent runner, working directory, storage files and launch configuration belong to this checkout. Preserve its required launch options privately. Do not stop the ARC daemon or another project's process.
2. Quiesce writes by gracefully stopping only the business-preview runner. Do not run two previews against the same D1/R2 state.
3. Call `snapshotPreviewPersistence` from [preview-persistence.mjs](../scripts/preview-persistence.mjs) with the existing state root and a new private, nonnested destination.
4. Verify the snapshot and preserve the original node wallet/configuration separately. The checkpoint does not copy the node secret.
5. Restart the affected runner with the same intended configuration. Verify health, localized pages, node identity and original application table/object contents.

The checkpoint uses SQLite online backup, integrity checks and streamed object hashes. It refuses symlinks, overlapping roots and existing destinations; failures remove only its newly created incomplete destination. Directly copying an active SQLite main/WAL/SHM set is not a consistent backup. D1/R2 consistency still depends on quiesced writes; the tool cannot create a cross-storage transaction.

## Local ARC bridge

[preview-arc-service.mjs](../scripts/preview-arc-service.mjs) uses a loopback-only HTTP bridge with workerd's external PROXY transport. It preserves public URL, binary bodies and repeated cookies while regenerating hop-specific headers. The routing allowlist remains fixed; this is not an open proxy or a production Node backend.

Constructed ARC requests set Host from the trusted request URL. Forwarding arbitrary caller Host or browser credentials into privileged chain/member adapters is not allowed. Health success alone cannot prove that a host is registered for native pages/login/invites.

## Verification

Adjacent script tests cover active-WAL snapshots, nonempty encrypted objects, full Miniflare teardown/reopen, repeated preservation, bad destinations and symlink rejection. The bridge tests cover complete repeated HTML, original URL/body/cookies, session authentication and failures. These are local persistence/transport guarantees, not a remote Cloudflare restore drill.
