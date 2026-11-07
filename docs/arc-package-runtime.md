# Native ARC operations

For operators configuring an installation, diagnosing ingress or restoring data.
Ordinary build/run commands belong to the [development guide](local-arc-development.md).
The [architecture](server-architecture.md) owns source and provider responsibilities.

## Capability status

This is the single status summary; implementation guides link here rather than
append run diaries. Detailed run records remain in Git history/protected artifacts.

| Scope | Evidence and limit |
| --- | --- |
| Local native package | Isolated ARC build/run covers original signatures, encrypted member delivery, WebSockets, replay denial, timer completion and accepted-task recovery across restart. |
| Real local accounts | Recorded operator acceptance covers DID Connect, mailbox association, bidirectional member mail, decryption and restart. This is not an automated fixture or hosted acceptance. |
| Paid external delivery | Real external paid-mail settlement has not been accepted. Local beta stake/funding operations do not establish that flow. |
| Hosted ARC | Not accepted; see [target-runtime requirements](arc-native-migration.md). |
| Public distribution | Blocked by the [license/provenance review](distribution-license-audit.md); a build or audit success does not clear it. |

## Activation and health

Use the named installation's existing home/Space. On the development installation
that is `didmail-web`; the configured mail/UI origin is
`http://didmail-server.localhost:8788`. The ARC control port is discovered from
`arc service status --instance didmail-web --json`, not assumed from a past run.

ARC beta.74 activates package mounts lazily. Open the app URL printed by ARC,
or perform this safe activation read against its actual control port:

```sh
curl -sS -X POST \
  'http://127.0.0.1:<ARC_PORT>/api/afs/rpc?blocklet=didmail-server' \
  -H 'content-type: application/json' \
  --data '{"type":"read","path":"/didmail-http/health.json"}'
```

`protocolIngress: true` means the enabled listener started. Use `publicOrigin`
for mail APIs: the parent ARC control/UI origin does not register the raw mail
REST routes. Missing/invalid private configuration, an uninitialized store or a
wallet/address mismatch keeps ingress unavailable without creating replacement
state. A port conflict may be retried before immutable environment/key setup;
an unknown later startup failure needs reconciliation and restart.

Host and Origin allowlists, caller-header stripping, ARC session/CSRF checks and
WebSocket credentials remain enforced. Never use supplied role/DID headers as
operator authorization or expose private loopback descriptors/SQL ports.

## Rebind an existing installation

For a path-only upgrade, build and audit the package using the
[development guide](local-arc-development.md#run-an-already-configured-package).
Copy the verified output to a stable, versioned installation directory outside
the checkout and audit that copy. Retain the exact previous package in a separate
rollback directory. For a binding that serves a source checkout, build and
retain the pinned previous revision in a separate clean directory before
taking downtime.

Record `arc service status --instance <instance-name> --json` privately, including
the instance ID, home, Space root, port, host, purpose and full ordered
`blocklets` list. Follow the [coordinated backup procedure](#backup-and-restore)
for the same instance. In the maintenance window, stop only the selected service and restart
with its recorded settings and replacement path:

```sh
arc service stop --instance <instance-name>
arc service start --instance <instance-name> \
  --home /absolute/path/to/existing-home \
  --port <recorded-port> --host <recorded-host> --purpose <recorded-purpose> \
  --blocklet /absolute/path/to/new-installed-package
```

Use one `--blocklet` flag per path. Replace the old DIDMail entries with the
single verified package path. Preserve any other entries in their original order,
along with the recorded advertise and peer-browse settings. Pass `--space-root`
only for an installation already configured with an explicit folder-as-DID-Space.
With the default Space root, ARC derives it from the existing home. Verify the instance ID,
home and Space, then activate the app and confirm the original node address,
provider health and ingress. Use the same stop/start sequence with the retained
previous package path to roll back. A path-only rollback keeps the current
instance data and wallet. Build or install the next package at a separate path
while the active package is serving.

## Private configuration

`/instance/app/didmail/private/protocol-runtime.json` is the validated protocol
configuration. Its [schema and allowlists](../blocklet/providers/didmail-http/config.mjs)
are authoritative for fields and bounds:

- `enabled`, public/control origins, listener host/port and explicit local aliases;
- `jobsIntervalSeconds`: zero disables scheduling, otherwise 5–3600 seconds;
- allowlisted string `vars`, original node key/address, and optional site-scoped
  membership credential in `secrets`.

Keys belong only in protected instance data and authenticated request bodies,
never package files, public health/configuration, logs or command arguments.
ARC login identity, mailbox identity and the original node wallet are distinct.
The listener verifies the expected node address before serving requests.

`/didmail-http/.actions/install-config` requires ARC's verified owner/admin
caller and accepts `{config: ...}` through the authenticated AFS client. It
conditionally creates the fixed private object with `!absent`; it cannot read
keys or overwrite another installation. This is the fresh-install path, not a
wallet creator. A deliberately new node needs an operator-provisioned signing
identity; an existing node must retain its original identity.

The runtime fixes storage, policy and attachment backends to AFS. Environment
variables on `pnpm start` cannot override the installed configuration. Private
configuration/provider/source changes need a controlled restart of the affected
ARC process; the module cache is not a hot-reload contract. Only one DIDMail
signing instance per process is supported. Preserve the configured scheduler
interval on every change. Ticks do not overlap, but shutdown does not promise a
complete drain: durable leases, original signed bytes and fenced recovery remain
necessary after interruption.

Keep `DIDMAIL_ARC_INSTANCE_ID` aligned with the credential's exact site scope,
and rotate expiring credentials. The migration installer validates the scoped
member directory before staging/enabling; failure leaves the target unchanged.
This does not authorize creating or broadening a credential.

## New installation

Provision a real instance Space mounted at `/instance` and verified ARC
owner/admin access. Package installation alone supplies neither mail state nor
keys. A fresh local installation requires these explicit steps:

1. Activate the package with protocol ingress disabled/unconfigured.
2. Initialize the empty business aggregate using the native
   `/didmail-business/.actions/initialize-business` action, or the operator tool:
   `node scripts/migrate-arc-business.mjs --instance <installation> --initialize`.
   It creates the complete ordered schema once and rejects existing state.
3. Explicitly initialize mail policy in Settings (Save invokes the authorized
   native action). Reads never create policy. Initialize the retained attachment
   configuration through its native action or the file importer below; Settings
   does not render the historical attachment form.
4. Install the validated private protocol configuration with the chosen identity,
   origins, membership scope and intended scheduler interval. Enable only after
   prerequisites are present; restart the affected ARC process and check health.

There is no turnkey public Launcher/Store provisioning acceptance. The actions
above require actual authorized access; synthetic test callers are restricted to
disposable regression instances. Developers should use `pnpm test:arc` instead
of initializing their machine's existing instance for a test.

## Existing installation: import before initialization

Quiesce all business and administrator writers and take a coordinated backup.
For a historical SQLite/D1/R2 source, first obtain a
[consistent checkpoint](local-preview-persistence.md). Never run the new-instance
initializer against an installation with existing mail.

1. Import the original attachment object, validating exact limits/decimal price:

   ```sh
   node scripts/migrate-arc-config.mjs --instance <installation> \
     --file /absolute/private/original-attachment-config.json
   ```

   An explicit loopback `--source-url` may replace `--file`. The importer validates
   conditional-write capability, creates with `!absent`, verifies exact readback
   and retains the original source. Invalid state never becomes a default draft.

2. Import policy, entries and audit from the same read-only SQLite snapshot:

   ```sh
   node scripts/migrate-arc-mail-policy.mjs --instance <installation> \
     --database /absolute/private/checkpoint/database.sqlite \
     --access-source arc --export /absolute/private/original-policy.json
   ```

   Select the actual `arc` or `legacy` access source. Revision, amounts, entry
   metadata and retained audit history/gaps are preserved. Active tokens reject
   import; target creation and exact readback are conditional.

3. Import business state and referenced ciphertext objects:

   ```sh
   node scripts/migrate-arc-business.mjs --instance <installation> \
     --database /absolute/private/checkpoint/d1/business.sqlite \
     --checkpoint /absolute/private/checkpoint \
     --out /absolute/private/original-business-export
   ```

   Every object is hash-checked before publication; objects are copied first and
   the aggregate is published last. A validated partial copy is resumable.
   Conflicting targets fail without deleting source data. Read the
   [transaction/import invariants](afs-business-storage.md) before changing this.

4. Install/stage the original private configuration, then enable it only after
   validating identity, scope and imported state. For an existing repository's
   protected `.dev.vars` and `.data/node-wallet.json`, the explicit migration tool is:

   ```sh
   node scripts/install-arc-protocol.mjs \
     --arc-origin http://127.0.0.1:<ARC_PORT> \
     --public-origin <mail-origin> --interval <original-seconds>
   ```

   It requires the two source identities to agree and stages disabled state.
   Reuse the command with `--enable` to validate and conditionally enable the
   staged values. It is not ordinary startup or new-wallet provisioning.

Before traffic resumes, compare counts/digests, policy/configuration readback and
original identity; restart only the affected service and verify access and
recovery. No online backend fallback, implicit seeding or destructive cutover is
part of these tools.

## Backup and restore

Stop all writers and coordinate these authorities: business aggregate plus
referenced ciphertext; policy/list/audit; attachment configuration; private
protocol configuration and original wallet. Preserve both transaction participants
and immutable payments/receipts together. Do not roll back paid state after
external effects without reconciliation.

```sh
node scripts/migrate-arc-business.mjs --instance <installation> \
  --backup /absolute/private/new-business-backup
node scripts/migrate-arc-business.mjs --instance <empty-target> \
  --import /absolute/private/new-business-backup
```

The tool captures business state/objects only. Export the other private objects
and identity separately into protected storage; it is not a whole-instance backup.
A version change during backup fails. Retain closed fences; omit unreferenced
orphans, deletion tombstones and ephemeral `private/business/runtime.json`.
Restore into an empty target and verify coordinated state before traffic. Never
restore policy or business state independently while writers are active.

## Recovery behavior

Original nonces, leases, account links, signed transaction bytes and receipts are
durable. Restart rotates ephemeral control credentials, not the wallet. Storage
usage reports `basis: afs-json`, `includesObjects: false`: serialized relational
metadata size, not ciphertext/physical Space size; authorization precedes reads.

For NFT retries, migration `0022_dmp_index_attempts.sql` preserves rejected
transaction bytes, hashes, asset IDs and rejection evidence. Native startup adds
that schema conditionally without initializing missing storage. Unknown outcomes
query/rebroadcast original bytes. Only validated rejection under the accepted
confirmation policy permits archiving an attempt and atomically requeuing with
the same terms/payment (also for sponsored mail). Retry delay grows from five
seconds to at most five minutes. Conflicting evidence stays paused; quarantined
records are not blindly requeued. UI diagnostics expose hashes/progress, not
signed bytes. No replacement payment or refund flow is inferred.

Cold chain reads can exceed bounded timeouts. `GAS_STAKE_UNAVAILABLE` preserves
the original task; reconcile/retry that task rather than override eligibility or
create another payment. [Node operations](node-identity-and-transactions.md)
covers identity, funds and chain diagnosis. The deeper
[admission fencing contract](afs-policy-admission.md) governs delayed writers.
