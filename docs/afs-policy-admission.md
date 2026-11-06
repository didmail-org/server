# Instance mail policy and fenced admission

Status: active native ARC contract. The policy object and relational business
aggregate are separate AFS transaction participants. Workers/D1 deployment is
retired; retained D1 tables are historical migration evidence only.

## Authority and authorization

`/instance/app/didmail/private/mail-policy.json` contains the versioned policy,
allow/deny entries, audit and pending admission tokens. Policy/list edits use one
conditional object write, increment the semantic revision and append its audit
record together. Updating a remark preserves the entry's original creator/time.
No policy, access-list or audit mirror is maintained in a second database. Existing
D1 source tables remain untouched for recovery; integration tests drop all three
and still complete signed upload, acceptance and authorized download.

The native provider exposes private owner/admin policy, list and audit reads;
`update-mail-policy`, `update-access-entry`, `remove-access-entry` and
`list-access-entries` actions use ARC's verified caller context. Role/DID arguments
cannot grant access. Runtime-injected `_scope_afs` is ignored and never supplies
identity or storage authority. Public policy projection omits identities, remarks,
audit, admission tokens and the underlying object version. Public leaf reads do
not grant raw instance access. Cross-origin actions remain denied.

A missing new-instance policy requires explicit administrator
`initialize-mail-policy` with `!absent`; opening Settings never writes. Imported
instances must be imported first. ARC membership mode continues to use ARC's
member directory and node NFT/stake rules, with the AFS denylist applied; adding
legacy allow entries or changing the stored access mode through this UI is
rejected. HTTP administration retains verified session, role and CSRF checks and
uses the same private authority. Native pages use ARC-verified caller context for these operations; protocol
HTTP and delivery run in the same ARC process.

## Admission protocol

The policy object and business aggregate do not share one atomic transaction.
The following order preserves policy serialization while business predicates
execute atomically inside the AFS relational aggregate:

1. Read and validate policy/list revision and sender authorization. Capture the
   exact observed relational account link, including its absence or revoked state.
2. CAS-add a fresh UUID admission token to that same AFS object, requiring the
   observed revision. Admission changes do not increment the semantic revision.
   Every administrator policy/list edit rejects while any token remains active.
3. Insert an open relational fence with token/revision, using `ON CONFLICT DO NOTHING`.
   A closed token can never be reopened.
4. Each admission-related relational write checks the open token/revision, the exact
   observed account link and the existing member-pair, key, quote and lifecycle
   predicates. This includes quote refresh, preparation, upload and acceptance.
   A public sender linking to a denied ARC identity between read and commit
   therefore fails. Accepted download/idempotency semantics remain unchanged.
5. Close the relational fence by upserting a permanent closed tombstone, then CAS-remove
   the AFS token. A cleanup failure retains the durable lock for recovery.

After 60 seconds, recovery first upserts the relational closed tombstone and only then
releases the AFS lock. It does not infer safety from elapsed time alone. A request
paused before fence insertion cannot register an open fence after recovery;
requests paused before a SQL commit fail its predicate. If revocation fails or
its result is unknown, recovery leaves the lock and edits fail closed. Concurrent
admissions may coexist; each has an independent token. CAS conflicts reject stale
administrators and retry bounded internal lock updates. Never reuse tokens or
prune fence tombstones while delayed writers could exist.

AFS uploads use a unique per-attempt object key. A rejected/duplicate request may
clean only its own newly written bytes, preserving a concurrent winner's body.
Unknown relational outcomes retain potentially referenced bytes. This does not create a
general transaction across objects and relational metadata. Chain membership reads remain point-in-time
observations, as before, rather than a cross-chain transaction.

The aggregate is deliberately one object to serialize policy/list/audit and
admission changes. Audit/list size grows without silent truncation; large-scale
throughput and multi-daemon behavior need separate acceptance before changing
this representation. Unsupported conditional-write capability, unavailable AFS,
malformed stored data or mismatched access source reject admission without an automatic legacy policy fallback.

## Local runtime and migration

The native runtime sets `DIDMAIL_POLICY_BACKEND=afs` and supplies the private
in-process `ARC_MAIL_POLICY` binding. The packaged business provider owns fixed
instance paths and performs admission recovery. Public callers cannot select an
operator origin, SQL port or storage path. Migration `0021_afs_admission_fences.sql`
retains the relational coordination schema. Recovery must close the fence in the
business aggregate before removing the policy token, even when HTTP ingress is
down. See [native runtime](arc-package-runtime.md).

On beta.74 the application instance projection is lazy. The preview activates
its known `didmail-server` application before private reads/startup recovery, so
an API-only client after daemon restart does not mistake an inactive projection
for missing state. This uses the existing `didmail-web` instance and identity.

For an existing installation, quiesce all business writers and checkpoint D1/R2
with the documented [preview persistence procedure](local-preview-persistence.md).
Export/import the original policy and lists from the consistent SQLite snapshot:

```sh
node scripts/migrate-arc-mail-policy.mjs --instance didmail-web \
  --database /absolute/private/checkpoint/database.sqlite \
  --access-source arc --export /absolute/private/original-policy.json
```

Choose the actual configured `arc` or `legacy` access source explicitly. Export
uses one read-only SQLite transaction and preserves revision, exact amounts,
entry metadata and retained audit history, including existing history gaps.
Import rejects active tokens, requires `!absent`, verifies exact readback and
never deletes the source or overwrites an existing AFS object. This is an
operator operation, independent of `arc blocklet build blocklet`. New package
builds need no custom preparation script.

On 2026-11-05 the current instance was imported, checkpointed and restarted with
exact policy/list/audit readback. API-first startup succeeded and original wallet
and private configuration hashes matched. Evidence and exports stay under ignored
`artifacts/private/mail-policy-afs-20261105/`. Do not copy these into documentation
or packages. Backups/restores must coordinate policy and business aggregates with all
writers stopped; never restore either participant online or select stale D1
policy as a fallback.

## Verification

The following actual ARC test creates/removes its own disposable evidence
instances and uses isolated business fixtures with outbound traffic denied.
Temporary Miniflare test hosting does not provide a production runtime:

```sh
DIDMAIL_ARC_PROVIDER_TEST=1 node --test scripts/arc-mail-policy-live.test.mjs
```

It verifies private/public boundaries, guest/member denial, hostile origin,
concurrent administrator edits/audit, list persistence, a writer paused before
relational fence registration across ARC restart, fenced recovery, rejection of the resumed
writer, and native edits with the disposable HTTP test host disposed. Positive role tests
use ARC's explicit synthetic-caller facility only on disposable instances; they
do not establish real DID-Connect login. Never enable it on `didmail-web`.

Business regressions cover signed external and member delivery, session/CSRF,
policy/list races, link revocation and rebind races, accepted retries/download,
object cleanup and simultaneous identical uploads with the old D1 policy tables
absent. Store tests cover CAS, audit atomicity, all supported canonical DID
checksums, privacy and failure to revoke; importer tests cover exact transfer,
source preservation and duplicate rejection. Browser fixtures cover native
initialization, edits and conflicts without legacy policy HTTP calls.

Local encrypted mail, tasks, account links, keys, nonces and reservations use
[AFS business storage](afs-business-storage.md), including coordinated backup and
restore. Native HTTP, signing, delivery and admission recovery execute inside
ARC. See [instance migration](instance-afs-migration.md) and
[runtime ownership](server-architecture.md).

References: ArcBlock's [Data and AFS](https://www.arcblock.io/en/docs/blocklets/data-and-afs/),
[provider authoring](https://www.arcblock.io/en/docs/afs/author-a-provider/) and
[access tiers](https://www.arcblock.io/en/docs/agent-access/access-tiers/).
ArcBlog's public/private split remains the reference; ArcBlog was not modified.
