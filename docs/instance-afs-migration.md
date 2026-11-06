# Instance AFS migration

Status: attachment configuration, mail service policy, access lists and policy
audit are active on local ARC instance AFS. Mail admission now coordinates that
authority with fenced relational commits. Local mail, encrypted objects, jobs,
keys, links, nonces and reservations now use [instance business storage](afs-business-storage.md)
with no D1/R2 bindings. The [packaged native engine](arc-package-runtime.md) now executes transactions,
objects, policy operations and admission recovery inside ARC. The [HTTP/signing/scheduler provider](arc-package-runtime.md) now runs inside ARC and the owned workerd executor was retired. Hosted installation/distribution remain unverified.

## Active configuration contract

The package mounts `providers/didmail-native` at `/didmail-native`. Its durable
object is `/instance/app/didmail/public/attachment-config.json`, containing the
existing file limits, exact decimal price string and update timestamp.
`networkRead` publishes only this leaf. Never put private data under a public
prefix; ArcBlog's public/private collection split is the reference.

| Provider path | Contract |
| --- | --- |
| `/attachment-config.json` | Validated public fields and object version |
| `/session.json` | Current ARC caller's identity/role; no credentials |
| `/.actions/initialize-attachment-config` | Verified owner/admin; `!absent` conditional creation |
| `/.actions/update-attachment-config` | Verified owner/admin; current version required |

The retained attachment configuration client uses ARC's session WebSocket and AFS read/exec messages for
the historical attachment form. It does not depend on a Worker session or node
balance. Caller DID/role arguments cannot authorize writes. Direct network writes
remain denied; after checking ARC's caller, the provider writes the fixed path
through the injected internal AFS root. Unsupported conditional writes fail
closed; stale/concurrent losing updates return `AFS_CONFLICT` and preserve the
winning value. The browser retains its unsaved draft after a conflict.

The current Settings page edits mail service policy; it no longer renders the
historical attachment form. Initialize/import the retained attachment object
explicitly through the operator migration tool or authorized native action.
Reads never create it, and invalid stored data must not be replaced with defaults.
Automatic `instance.seed` initialization was not established on the checked
beta.74 service-start path and is not relied on.
Mail service policy and access lists now have separate native AFS actions; see
[policy/admission guarantees](afs-policy-admission.md). Delivery operations now run in the packaged ARC HTTP/signing/task provider locally. The historical attachment form does not change the newer
mail protocol's attachment policy.

## Existing-instance import

Import the original before initializing an existing installation:

```sh
node scripts/migrate-arc-config.mjs --instance didmail-web \
  --file /absolute/private/path/original-attachment-config.json
```

An explicit loopback `--source-url http://127.0.0.1:8788` may replace `--file`
while the original source runs. The importer validates fields, requires
conditional writes, uses create plus `!absent`, and checks exact readback. It
never overwrites a target, deletes the source or changes a wallet. This is a
one-time runtime operation, not a build/startup dependency. Packaging remains
`arc blocklet build blocklet`.

The local preview sets `DIDMAIL_CONFIG_BACKEND=afs`. Public/legacy admin reads
consume the same AFS object; old admin PUT returns 409. There is no D1 mirror or
fallback. The former Workers/D1 runtime is retired; existing D1/R2 state remains a
read-only migration source. The native HTTP transport preserves WebSocket credentials and enforces the
origin allowlist while stripping caller-role spoofing headers.

On 2026-11-05 the existing `didmail-web` configuration was imported exactly and
read through the actual ARC client with the business preview stopped. Two ARC
restarts retained it. D1/R2 were checkpointed before affected preview restarts;
the original wallet/private configuration hashes stayed unchanged. Private
exports/checkpoints remain under ignored
`artifacts/private/afs-config-migration-20261105/`.

## Verification boundaries

The opt-in command below tests an actual isolated ARC DID Space without a
business Worker:

```sh
DIDMAIL_ARC_PROVIDER_TEST=1 node --test scripts/arc-native-policy-live.test.mjs
```

It covers initialization, duplicate initialization, guest/member denial, forged
arguments, administrator updates, cross-origin refusal, stale/concurrent writes,
malformed-data recovery and restart persistence. Synthetic roles use ARC's
explicit test-header facility on that disposable evidence instance only. This
does not establish real DID-Connect login or hosted Cloudflare behavior. Never
enable that facility on `didmail-web`.

Business regressions omit D1 when verifying AFS reads and require failure if AFS
is unavailable. Browser fixtures cover explicit initialization, exact prices and
conflict recovery. The WebSocket bridge test uses workerd and a synthetic
loopback upstream, preserving binary bytes and denying unknown origins.

Local verification on 2026-11-05–06 after business storage migration: `pnpm lint`,
runtime type checking, native DSL/package checks and direct native build passed.
Unit tests: 362 passed; UI tests: 51 passed; script tests: 114 passed/4 opt-in
skips; Test-host business cases: 149 passed/1 opt-in skip. Native browser scenarios: 56
passed; administration scenarios: 4 passed; policy and native render checks
passed. Actual ARC attachment/policy tests passed separately; the policy test also passed
with no D1/R2 bindings, peer evaluators, a multi-chunk encrypted attachment and
accepted task recovery across workerd/ARC restart. The six admission regressions
and 38 contact preparation/job/API cases passed against AFS without D1/R2. The running preview passed 9 read-only smoke checks and API-first
restart with exact policy/list/audit readback and unchanged wallet/configuration
hashes. Chromium verified real AFS WebSocket public reads and denial of anonymous
private policy/raw instance reads. Positive administrator role checks use the
isolated synthetic-caller runtime, not a real DID-Connect login.

The historical Workers packaging check did not establish deployment; that
runtime is now retired. No remote deployment or real chain writes were attempted.
The policy transaction and remaining storage boundary are documented in
[policy/admission guarantees](afs-policy-admission.md).

## Remaining sequence

1. Policy/access-list migration with admission fencing is complete locally.
   Preserve its CAS lock, closed relational tombstone and account-link predicates when
   migrating the remaining storage; see [the transaction protocol](afs-policy-admission.md).
2. Local encrypted objects and relational mail/protocol/job state now use AFS.
   Preserve the [business transaction and backup contract](afs-business-storage.md);
   large-mailbox performance and hosted execution remain unverified.
3. Nonces, reservations, links and task fences share the AFS transaction aggregate.
   Keep their original SQL predicates and definite-conflict retry rules when
   partitioning storage or replacing the current local evaluator.
4. Native protocol HTTP, original key custody/signing and timer recovery are verified locally in standalone dist, including signed internal delivery and encrypted attachment restart recovery. The owned workerd preview is retired.
5. Preserve private protocol configuration/original identity in coordinated backups. Verify real paid-chain behavior, authenticated-user acceptance, hosted installation, multi-instance execution and public distribution separately; local acceptance does not clear these gates.

References: official [Data and AFS](https://www.arcblock.io/en/docs/blocklets/data-and-afs/),
[provider authoring](https://www.arcblock.io/en/docs/afs/author-a-provider/) and
[access tiers](https://www.arcblock.io/en/docs/agent-access/access-tiers/).
ArcBlog remains unchanged. The broader contract is
[ARC-native migration](arc-native-migration.md).
