# Instance business storage

For maintainers changing the AFS database/object port, SQL predicates or backup
format. [Operations](arc-package-runtime.md) owns installation, import and restore
commands; [capability status](arc-package-runtime.md#capability-status) owns acceptance claims.

## Durable authority

| Private instance path | Contents |
| --- | --- |
| `/instance/app/didmail/private/business/state.json` | Schema/typed rows for mail metadata, job state and leases, keys, replay nonces, links/intents, payment reservations, wallet lanes, fences, legacy records and cache pointers |
| `/instance/app/didmail/private/business/objects/<sha256-of-key>.json` | Original opaque key, base64 ciphertext/object bytes, SHA-256, byte length and metadata; deletion leaves a conditional tombstone |

The existing attachment configuration and private policy/list/audit paths remain
separate authorities. The retired D1 policy/list/audit tables are excluded from
business imports. No automatic D1/R2 fallback or replication runs in AFS mode.
Legacy `r2://` references remain opaque logical keys for compatibility; they
resolve through the AFS object port. Message signature preimages, keys, manifest,
quote, payment and receipt bytes are unchanged. Ciphertext is never decrypted by
the storage adapter. All byte values, including imported SQLite BLOBs, have an
explicit lossless representation.

These paths are private. No new `networkRead`, browser SQL endpoint or public
storage operation is declared. Existing signed DMP authorization, owner/admin
session/CSRF checks and native AFS access boundaries continue to gate access.
The fixed loopback operator scope in `arc-native-storage-client.mjs` supplies only the
private `ARC_STORAGE` Service Binding. Hostnames and instance paths cannot be
selected by a public request. A missing binding/instance/object, corrupt content,
unsupported conditional write or unknown backend rejects the operation.

## Transaction and failure contract

The native ARC adapter evaluates existing SQL in an ephemeral `:memory:` SQLite engine.
It reconstructs constraints, indexes, sequences and rows from the current AFS
version, executes the original statements in one transaction, and commits the
whole resulting aggregate with `ifMatch`. A batch is one such commit. Public AFS
contracts do not expose the internal SQL schema. There is no runtime SQLite file
or second durable database to recover or synchronize.

Competing evaluator instances retry only a definite CAS conflict and reevaluate
all original predicates on the new version. Constraint errors roll back the
entire batch. An unknown/lost AFS write response is never automatically replayed;
callers reconcile using the existing immutable message, quote, payment or request
IDs. Job lease owner/fence/expiry, exact account-link observations, unique payment
reservations, replay isolation and wallet-lane predicates remain in the same
transaction aggregate. Primary-first sessions read the current AFS version;
there is no replica/bookmark transport in this local adapter.

The [policy admission protocol](afs-policy-admission.md) is unchanged in ordering:
AFS policy CAS lock, relational fence, guarded commit, fence closure, lock release.
The relational fence now resides in this AFS aggregate. Closed tokens are retained
and cannot be reopened. Recovery still closes a fence before releasing its policy
lock. It never assumes a cross-object AFS batch is atomic.

Objects are written before their metadata reference. DMP uploads retain unique
per-attempt keys, so rejected duplicate cleanup cannot delete a winner's bytes.
Unknown outcomes retain potentially referenced bytes. Deletion marks a message's
lifecycle first, conditionally tombstones its objects, then commits final metadata
cleanup. Interrupted cleanup is retried through the existing deleting lifecycle.
Cache pointer/generation guards and object cleanup follow the same existing rules.
Objects verify their decoded byte count and digest before being served.

The current representation rewrites and validates the whole metadata aggregate
per transaction and base64-encodes each object. It favors preserving transaction
semantics during local migration; it has not passed large-mailbox throughput or
hosted multi-daemon acceptance. Do not present it as a production-scale query
engine. A future partitioning change must preserve cross-record predicates and
fenced recovery rather than replace them with unrelated file writes.

## Import and backup invariants

Exports use one read-only SQLite snapshot. Every referenced object must exist;
verify original object bytes, length, hash and metadata before mutation. Import
conditionally creates and reads back objects, then publishes the complete
aggregate with `!absent` last. An existing aggregate/conflicting object rejects
import. A partial object copy can resume from the same validated export; it does
not make an incomplete mailbox visible. Original source and identity remain intact.

An AFS backup captures the aggregate and every referenced object, including job
ciphertext, and rejects version changes during capture. It omits unreferenced
orphans and deletion tombstones while retaining closed admission fences. The
business export excludes policy, attachment and private protocol configuration
and the signing identity. Coordinate them under the
[backup/restore procedure](arc-package-runtime.md#backup-and-restore); never restore
either transaction participant online.

[Ordered migrations](../blocklet/providers/didmail-business/migrations) preserve
schema and compatibility predicates. Initialization publishes a complete empty
schema exactly once; additive upgrades do not initialize or replace existing
state. Historical checkpoints are import sources, not a runtime storage selector.

## Verification

Store and importer assertions are in `scripts/afs-business-store.test.mjs`;
`tests/business` covers authorization, original-payment races, leases, unknown
outcomes and recovery through AFS ports. Build its test harness before direct
file invocation, as described in the [development guide](local-arc-development.md#change-a-feature-and-choose-checks).
Use `pnpm test:arc` when changing native execution. Test fixtures are not real
account or paid-chain acceptance. Do not append per-run counts/evidence paths
here; update the contract and record runs outside the formal guide.
