# Historical D1/R2 checkpoint recovery

Status: retained recovery procedure for private data from the retired preview.
Current backups use [instance AFS](afs-business-storage.md). This document does
not provide an alternative runtime or instructions to restart workerd.

## Storage location

The historical Miniflare source is `.wrangler/state/arc-preview`. It used
`resourcePersistencePath`; old `d1Persist`/`r2Persist` options were ignored by
some Miniflare versions. Retain all existing state roots until audited; never
merge them blindly. The active `didmail-web` instance now runs native ARC with
AFS at `http://didmail-server.localhost:8788`.

Wallets, configuration, runtime homes, snapshots and exports remain private,
ignored data outside the package. A checkpoint is not a node-key backup and does
not include subsequent AFS writes.

## Checkpoint procedure

1. Confirm the source belongs to this installation and is no longer being
   written. If a historical process is still running, identify and quiesce only
   that process before copying; leave ARC and unrelated services running.
2. Call `snapshotPreviewPersistence` from [preview-persistence.mjs](../scripts/preview-persistence.mjs)
   with the existing state root and a new private, nonnested destination.
3. Verify the checkpoint and preserve the original wallet/configuration separately.
4. Export/import from that consistent copy using [instance migration](instance-afs-migration.md)
   and [business import](afs-business-storage.md#import-backup-and-restore).
   Verify counts and object hashes before publishing an empty target aggregate.

The checkpoint uses SQLite online backup, integrity checks and streamed object
hashes. It refuses symlinks, overlapping roots and existing destinations; failures
remove only its newly created incomplete destination. Copying an active SQLite
main/WAL/SHM set is not a consistent backup. D1/R2 consistency requires quiesced
writers; the tool supplies no cross-storage transaction.

Never initialize over existing AFS state, replace the original wallet, or roll
back a paid installation to a stale checkpoint. Preserve task/nonce/fence and
original signed transaction evidence during reconciliation.

## Verification

Adjacent checkpoint tests exercise WAL snapshots, nonempty encrypted objects,
full fixture teardown/reopen and invalid destinations. Disposable Miniflare
fixtures establish recovery properties, not a supported Cloudflare deployment
or a hosted restore drill.
