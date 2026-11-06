# Historical source recovery into ARC

Workers and the external workerd preview are retired. This document covers
one-time recovery from retained D1/R2 or legacy SQLite sources. The supported
server is the [native ARC package](server-architecture.md); current backups use
[instance AFS](arc-package-runtime.md#backup-and-restore). Historical
sources contain no subsequent AFS writes and are never an automatic fallback.

## Source and identity boundaries

The historical Miniflare source is `.wrangler/state/arc-preview`. It used
`resourcePersistencePath`; old `d1Persist`/`r2Persist` options were ignored by
some Miniflare versions. Retain existing state roots until their provenance is
verified; never merge them blindly. Former deployments stored relational metadata
in D1 and encrypted mail, attachments and cache payloads in R2.

A checkpoint is not a node-key backup. Preserve the original signing wallet,
private configuration, encrypted domain keys, original signed transaction bytes,
accepted task evidence, nonces, leases and fences separately in protected storage.
ARC login identity does not replace the node signing identity. D1, R2 and the chain
never shared an atomic transaction: a database-only export is incomplete, and an
unknown outcome never authorizes a replacement payment.

Keep runtime homes, snapshots, exports and keys ignored and outside the public
package. Leave the current `didmail-web` ARC instance and unrelated services
running while inspecting retained source state.

## Consistent D1/R2 checkpoint

1. Confirm the existing source belongs to this installation. Identify and quiesce
   only any historical process still writing it before taking the coordinated
   snapshot; a copy of active SQLite main/WAL/SHM files is not a consistent backup.
2. Call `snapshotPreviewPersistence` from
   [preview-persistence.mjs](../scripts/preview-persistence.mjs) with the existing
   state root and a new private, nonnested destination.
3. Verify the checkpoint's database integrity, object counts and streamed hashes;
   retain the original source and wallet/configuration backup separately.
4. Export/import from that consistent copy through the
   [instance migration procedure](arc-package-runtime.md#existing-installation-import-before-initialization) and
   [business import contract](arc-package-runtime.md#backup-and-restore).

The checkpoint uses SQLite online backup and integrity checks, and hashes
nonempty encrypted objects. It refuses aliases, overlapping roots and existing
destinations; a failure removes only its newly created incomplete destination.
Cross-storage consistency still requires quiesced writers. Adjacent regression
fixtures exercise WAL snapshots, teardown/reopen and invalid destinations; they
are not a hosted restore acceptance or supported Miniflare runtime.

## Legacy SQLite export

For a historical SQLite source, the read-only exporter is:

```sh
node scripts/migration/export-legacy-data.mjs \
  --database /safe/original/didmail.sqlite \
  --out /safe/new-private-export
```

Quiesce writers for a consistent database/object set; export only into a new
private directory. The preserved `didmail-workers-v1` format is a recovery
contract, not a deployment target. Keep matching encrypted objects and verify
their counts and hashes against the export manifest. Never overwrite the source
or publish the export.

## Import and verification

Import only into an empty target by conditional creation. Follow the ordered
schema/migration contract; import policy, attachment configuration and private
protocol configuration separately. Preserve the original node wallet and verify
its expected public address and existing asset/encrypted-key access before traffic.

Compare source/export/target counts, object hashes, business and configuration
digests, task/nonce/fence state and original signed evidence. Verify coordinated
restore on an isolated copy before activating the target. An imported database
without its matching objects, policy, configuration and original identity is not
ready for use. See [instance migration](arc-package-runtime.md#existing-installation-import-before-initialization) for the exact
backend import and validation sequence.

Never initialize over existing AFS state or roll a paid installation back to a
stale checkpoint. Preserve unknown chain outcomes for reconciliation; the source
checkpoint alone cannot undo external effects. Hosted ARC and distribution have
separate [deployment gates](arc-native-migration.md).

The optional `legacy:sqlite:import` command prepares a historical local SQLite
and original-wallet working copy in an empty destination; it does not initialize
ARC. `legacy:wallet:setup` is only an explicit historical development-wallet
creator, never an identity-recovery operation. Both commands provide read-only
`--help`; their modules do not create config files on import. Neither command is
part of the ordinary developer startup path.
