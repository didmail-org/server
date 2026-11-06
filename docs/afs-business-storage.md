# Instance business storage

Status: active on local `didmail-web` with ARC beta.74; preview/operator tools
use Node 24.14 or newer. The native runtime stores its business data in instance
AFS without D1/R2 bindings. The [packaged native provider](arc-package-runtime.md)
now executes the SQLite/object/policy port inside ARC; the Node bridge transports
requests only. The [packaged HTTP provider](arc-package-runtime.md) now executes the protocol, original signing and scheduler inside ARC; the owned workerd preview was retired. This does not
establish hosted ARC execution. Workers and the external executor are retired. Historical D1/R2 checkpoints
remain one-time migration sources, not runtime backends.

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

## Import, backup and restore

Quiesce all business and administrator writes first. Preserve original wallet,
configuration, attachment configuration and policy/list/audit separately. Follow
[legacy D1/R2 checkpointing](local-preview-persistence.md) before importing an
existing preview. The import is an explicit operator operation, independent of
`arc blocklet build blocklet`:

```sh
node scripts/migrate-arc-business.mjs --instance didmail-web \
  --database /absolute/private/checkpoint/d1/business.sqlite \
  --checkpoint /absolute/private/checkpoint \
  --out /absolute/private/original-business-export
```

The database is read-only in one SQLite snapshot. All source bucket objects are
exported with hashes/metadata; every referenced object must exist. Import verifies
all exported bytes before mutation, copies objects with conditional creation and
readback, then publishes the aggregate with `!absent`. A partial object copy can
be resumed using the same validated export. An existing target aggregate or
conflicting object rejects import. Source storage and identity are never deleted
or overwritten. No online storage switch is inferred from an import alone.

For the active AFS instance, with all writers quiesced:

```sh
node scripts/migrate-arc-business.mjs --instance didmail-web \
  --backup /absolute/private/new-business-backup
```

The backup captures the aggregate and every referenced object, including queued
jobs' ciphertext. A version change during backup rejects it. Unreferenced orphan
objects and deletion tombstones are excluded; closed admission fences remain in
the aggregate. Restore to an empty target instance with:

```sh
node scripts/migrate-arc-business.mjs --instance <empty-target> \
  --import /absolute/private/new-business-backup
```

Restore the coordinated policy/configuration and original node identity too;
never restore either transaction participant online. Existing signed jobs keep
their original transactions; expired leases recover through the original fencing
rules, not by creating replacement payments.

For a genuinely new installation, explicitly create the empty business schema
(with no source database/bucket), then initialize mail policy through
the administrator UI. Initialize/import the retained attachment configuration
through the [operator tool or authorized native action](instance-afs-migration.md);
the current Settings page does not render its historical form:

```sh
node scripts/migrate-arc-business.mjs --instance didmail-web --initialize
```

This refuses an existing aggregate and publishes the complete schema once. Do
not use it to replace an existing installation's import.

The native runtime requires `DIDMAIL_STORAGE_BACKEND=afs`. It does not create
missing business state automatically: new installations need explicit operator
initialization/import before mail ingress. No D1 runtime selection or error fallback is supported. Historical checkpoints
after AFS writes require separate reconciliation, never an online backend switch.

On 2026-11-05 the existing preview was quiesced, checkpointed, imported and
restarted using AFS with no D1/R2 resources. API-first startup, exact business
state, every imported object digest, policy/list/audit and wallet/configuration
hashes matched. Private evidence remains under ignored
`artifacts/private/business-afs-20261105/`; it is never package input.

## Verification

```sh
node --test scripts/afs-business-store.test.mjs
DIDMAIL_TEST_AFS_STORAGE=1 node --test tests/business/afs-mail-admission.test.mjs
DIDMAIL_ARC_PROVIDER_TEST=1 DIDMAIL_TEST_AFS_STORAGE=1 \
  node --test scripts/arc-mail-policy-live.test.mjs
```

Contact preparation/API/job regressions can use the same backend switch:

```sh
DIDMAIL_TEST_AFS_STORAGE=1 node --test tests/business/contact-preparation.test.mjs \
  tests/business/contact-api.test.mjs tests/business/contact-jobs.test.mjs
```

All 38 cases passed with no D1/R2 resources, including original payment races,
lease replacement, interruption before/after mint persistence and workerd restart.
These low-level suites retain their legacy policy fixture in their own isolated
aggregate; the actual preview uses the separate native policy authority.

Build the regression harness first with `node scripts/build-business-tests.mjs`
when running business/live fixtures directly. Miniflare supplies only a disposable
test host, with no production Cloudflare entry. The isolated fixture omits D1 and R2 bindings.
Tests cover peer CAS updates, batch rollback, unique constraints, sequences,
stale task ownership, unknown commit outcomes, binary integrity, incomplete and
resumable migration, source retention and AFS backup/restore. The six existing
admission regressions run unchanged against that backend, including signed
external/internal delivery, authorization/CSRF, policy and binding races, denied
admission, accepted retries/download and concurrent upload cleanup.

The opt-in actual ARC test uses independent adapters against one real instance,
retains accepted job/payment evidence through workerd and ARC restarts, resumes
only fixture settlement, and decrypts a multi-chunk binary attachment. It also
verifies private-state read denial, native policy edits with the executor down,
and delayed admission fencing across restart. Synthetic caller roles exist only
on disposable evidence instances. No real mail or chain transaction is sent.
Real DID-Connect administrator login and hosted distribution remain separate
acceptance.

Acceptance completed on 2026-11-06: lint/type checks, native checks/build, 362
unit tests, 51 UI tests, 114 script tests (4 opt-in skips), 149 test-host business cases
(1 opt-in skip), 44 additional AFS protocol cases, 56 browser scenarios and the
actual ARC storage/restart test passed. The active preview passed 9 read-only
smoke checks. The earlier Workers packaging gate was not deployment acceptance; that
runtime is now retired. No remote deployment was attempted.

Reference: ArcBlock's [Data and AFS](https://www.arcblock.io/en/docs/blocklets/data-and-afs/)
and [provider contract](https://www.arcblock.io/en/docs/afs/author-a-provider/).

The 2026-11-06 native HTTP cutover also verified original SDK signatures, encrypted multi-chunk delivery and accepted-task recovery with no workerd. Back up private protocol configuration/original key and policy/attachment objects separately from the business export; see [runtime acceptance and key custody](arc-package-runtime.md). Earlier workerd fixtures above remain compatibility evidence.
