# Retired Workers runtime and historical migration

Status: Cloudflare Workers and the external workerd preview are retired. The
supported server is the [native ARC package](server-architecture.md). This path
is retained for links from other DIDMail repositories and historical recovery.
There is no current Workers build, startup, deployment or D1/R2 fallback workflow.

## Historical storage and identity

Former deployments stored relational metadata in D1 and encrypted bodies,
attachments and cache payloads in R2. They used the original node signing wallet.
D1, R2 and the chain never shared an atomic transaction. A D1-only export is not
a complete backup, and an uncertain transaction outcome never authorizes a new
payment. Preserve original signed bytes, keys, task evidence, leases and fences.

Keep existing private `.wrangler/state/arc-preview`, wallet/configuration and
exports. Use the [checkpoint procedure](local-preview-persistence.md) for retained
local source state. For a historical SQLite source, the read-only exporter is:

```sh
node scripts/migration/export-legacy-data.mjs \
  --database /safe/original/didmail.sqlite \
  --out /safe/new-private-export
```

Quiesce source writers and preserve matching encrypted objects and hashes. Never
publish the export or overwrite the source. This exporter is a recovery tool,
not a replacement for the active [AFS backup](afs-business-storage.md#import-backup-and-restore).

## Import into ARC

Follow [instance migration](instance-afs-migration.md) and
[business storage](afs-business-storage.md) to import into an empty target using
conditional creation. Import policy/configuration separately and retain the
original node identity. Verify counts/digests and coordinated restore on an
isolated copy before serving traffic. Retained D1/R2 sources do not include later
AFS changes and cannot be selected as an automatic rollback.

Existing protocol, authorization and transaction recovery checks now live in
`tests/business`; temporary Miniflare execution is a test fixture only. Historical
deployment records and dependency/license evidence describe their recorded
artifacts, not a supported runtime. Hosted ARC has its own
[deployment contract](arc-native-migration.md).
