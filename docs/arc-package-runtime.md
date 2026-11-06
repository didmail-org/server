# Packaged local ARC runtime

Status: the package now hosts protocol HTTP, the original signing identity,
transactions, ciphertext objects, policy operations and delivery scheduling
inside the local ARC process. The owned workerd preview on `didmail-web` was
retired on 2026-11-06. Verified on ARC `2.0.0-beta.74 (49c9125c)`; this does not
establish hosted Cloudflare execution or Store distribution acceptance.

## Build and activation

The application source and pinned dependency assets are inside `blocklet/`.
There is no application preparation script, generated application snapshot, runtime
npm installation or repository dependency needed to build/run that package:

```sh
arc dsl validate blocklet
arc blocklet check blocklet
arc blocklet build blocklet
arc blocklet run blocklet/dist --instance didmail-web
```

ARC beta.74 activates application providers lazily. Opening the printed ARC app
URL activates the mounts. A Launcher or operator can also perform this safe read
using the actual ARC port after each cold ARC restart:

```sh
curl -sS -X POST \
  'http://127.0.0.1:<ARC_PORT>/api/afs/rpc?blocklet=didmail-server' \
  -H 'content-type: application/json' \
  --data '{"type":"read","path":"/didmail-http/health.json"}'
```

An enabled, correctly configured provider reports `protocolIngress: true`.
Open its configured public origin for the complete UI and business APIs. On the
approved local instance this is `http://didmail-server.localhost:8788`; the ARC
control/UI origin is port 64867. The parent ARC origin serves native pages/login
and AFS, but beta.74 does not register the package's raw REST endpoints there.
Do not advertise the parent origin as the mail endpoint. Activation starts the
HTTP listener inside ARC; no executor process is launched. `pnpm preview:local`
invokes standard ARC run. The former external executor and Workers deployment
are retired; no alternate startup path is supported.

## Source and dependency ownership

`providers/didmail-http/source/` owns production protocol/API modules and the
locale registry. HTTP, protocol, identity, policy, storage, configuration and
runtime modules have separate directories; retained REST handlers live under
`source/api/src`. Remaining `api/src` and `ui/locales/config.js` compatibility
links point inward. The native loader and isolated test builder resolve the same
production modules. See [source ownership](server-architecture.md).

The HTTP provider uses the runtime's built-in TypeScript parser and a scoped
Bun module loader to resolve that source, host adapters and fixed dependency
facades. It does not compile an application bundle before ARC build. The loader
applies only to this package. Unknown dependencies fail closed; another
application's imports are unaffected. This beta.74 virtual-loader path needs
explicit module specifiers and CommonJS interop; tests exercise the actual
compiled ARC binary rather than assuming current Bun documentation is sufficient.

`providers/didmail-http/vendor/manifest.json` records the dependency-only asset
hash, facade hashes and 157 exact installed package versions, terms and license
sidecars. No application source is included in `dependencies.mjs`. This is a
checked-in versioned dependency asset, similar to vendored browser libraries;
normal ARC build neither regenerates it nor reads node_modules. Dependency
updates require deliberate inventory/hash/license review. The pinned protocol
SDK and installed `@ocap/client` retry patch are retained. Existing unresolved
license/provenance gates still block public distribution; copying these assets
is not release approval. See [distribution audit](distribution-license-audit.md).

## Configuration, keys and installation

Protocol configuration is private instance data at
`/instance/app/didmail/private/protocol-runtime.json`. It contains schemaVersion,
enabled, publicOrigin, arcOrigin, listenHost/listenPort, explicit aliases,
jobsIntervalSeconds, allowlisted vars, the **original** node key/address and the
optional instance-scoped ARC membership credential. None belongs in the package,
public health, process arguments or public runtime configuration.

The owner/admin-only `/didmail-http/.actions/install-config` accepts a validated
configuration through an authenticated request body and conditionally creates
that fixed object with `!absent`. It cannot overwrite another installation or
read back keys. The listener validates the original wallet's seed/public-key
consistency and exact expected address before serving protocol requests. ARC login identity remains
separate. Invalid/missing configuration or storage leaves ingress unavailable;
there is no wallet generation, empty-store seeding or D1/R2 fallback.

For an existing repository preview, the explicit operator migration tool reads
ignored `.dev.vars` and `.data/node-wallet.json`, checks their identity agrees,
and stages a disabled configuration without exposing values:

```sh
node scripts/install-arc-protocol.mjs \
  --arc-origin http://127.0.0.1:64867 \
  --public-origin http://didmail-server.localhost:8788 --interval 0
```

Quiesce the owned old executor, make coordinated private backups, then use the
same command with `--enable` to conditionally activate the staged configuration.
Restart **only** the approved evidence instance and activate the app. Preserve
the original jobs interval; zero means disabled. Changing keys, origins, configuration or provider/source code requires ARC restart; the native module cache is not a hot-reload contract. The legacy modules cache signing/configuration,
so only **one DIDMail signing instance per ARC process** is supported. A different
instance/configuration is rejected before sharing that cache. Other ARC apps
are unaffected. Instance concurrency beyond that boundary needs further refactoring.

When migrating a configured ARC membership credential, the operator tool now
checks the scoped member directory before either staging or enabling the private
configuration. A rejected credential, retired site scope, malformed directory or
unavailable source prevents the write. Enabling checks the actual staged values,
not newer environment values that would otherwise leave a stale staged credential
in place. This check is an operator migration safeguard, not a build prerequisite
or permission to create/expand an access key. Keep the exact site's
`DIDMAIL_ARC_INSTANCE_ID` synchronized with its private credential and rotate
expiring keys before they expire.

A future Launcher must provision the required Space, explicitly initialize or
import the business/policy/attachment objects, supply the original private
configuration, reserve/route the public listener and activate the app. A fresh
Space never implicitly replaces an existing mailbox or key. Store installation,
hosted listener capabilities and public distribution are separate acceptance.

## Execution and security

The public Node-compatible HTTP listener, legacy Express router, wallet and
scheduler belong to the ARC PID. Original protocol handlers retain exact request
paths, methods, bytes/digests, signatures and replay predicates. Public Host is
allowlisted; forged caller/role/forwarding headers are stripped and client IP is
derived from the connection. ARC verifies sessions and original CSRF gates remain.
WebSocket upgrades preserve ARC's session protocol/cookies and reject foreign
Origins. ARC forwarding uses explicit HTTP Host routing, including repeated
Set-Cookie headers, rather than relying on Node fetch's Host override behavior.

Private bindings call the packaged AFS transaction/object/policy operations in
process. The existing loopback capability port remains for compatibility/operator
clients, with Origin rejection, private runtime descriptor and no public SQL
AFS action. The native storage/admission recovery guarantees remain those in
[business storage](afs-business-storage.md) and [policy fencing](afs-policy-admission.md).

A nonzero jobs interval invokes the original delivery/cleanup handler, tracks
waitUntil work and prevents overlapping scheduler ticks. Accepted jobs, leases,
fences, signed payments/index bytes and receipts remain durable AFS state; a
restart rotates only ephemeral control credentials. The active local instance
retains its original disabled scheduler. Isolated tests enable five-second ticks.

Backups must coordinate business state + referenced ciphertext objects, policy,
attachment configuration and private protocol configuration/original wallet.
`exportInstanceStorage` exports only business state/objects; back up the other
objects and identity separately in protected storage. Exclude ephemeral
`private/business/runtime.json`. Preserve immutable transaction evidence and do
not roll back a paid live installation to an older state after external effects.

## Local acceptance and limits

```sh
node --test scripts/native-http-provider.test.mjs scripts/arc-package.test.mjs
DIDMAIL_ARC_HTTP_TEST=1 node --test scripts/arc-http-package-live.test.mjs
```

The live test copies only package providers, builds with ARC alone, deletes the
source providers and runs dist without repository scripts/node_modules/workerd.
It proves the public listener PID is ARC, original SDK signature/HPKE behavior,
nonce replay rejection, guest/header denial, private-config read denial, real
ARC WebSocket reads/session behavior, foreign Origin/Host rejection, 1.1 MB
multi-chunk ciphertext, an accepted leased task across ARC restart, native timer
completion and exact decrypted download with one internal receipt. Its loopback
authority fixture supplies membership/readonly chain evidence and rejects chain
broadcasts. It uses the real production settlement/HTTP handlers, with no
production test endpoint or fake settlement adapter. Real paid chain broadcasts,
real DID-Connect acceptance and hosted deployment are not claimed by that test.

Original unit, script, business/AFS, UI and browser regressions remain required.
The main cutover retained exact business/policy/configuration/object digests and
original wallet/configuration files, then passed read-only smoke and native UI
browser checks. Private evidence is under ignored
`artifacts/private/native-http-20261106/`. The earlier Workers dry-run stopped at its missing core CSS gate; that runtime
is now retired and no deployment occurred.

References: official [package/instance](https://www.arcblock.io/en/docs/blocklets/package-and-instance/),
[manifest](https://www.arcblock.io/en/docs/blocklets/manifest-and-capabilities/)
and [Bun runtime plugins](https://bun.sh/docs/runtime/plugins) contracts. Actual
local runtime observations above are established by the isolated acceptance test.

## Installation and recovery regression (2026-11-06)

The standalone dist test now installs configuration through the actual
owner/admin `install-config` action and rejects a second installation. It first
occupies the public port, verifies ingress stays unavailable, releases that port
and activates successfully in the same ARC process. Listener reservation now
precedes immutable environment/key configuration; only that known pre-configuration
failure can clear its failed registry entry. The bootstrap runtime retains one
module identity across retries. Invalid keys, another instance and unknown later
failures still fail closed and require operator reconciliation/restart.

AFS database usage no longer reads the D1-only `meta.size_after` field. The private
storage port reports the UTF-8 serialized business aggregate size. The existing
administrator-only `/api/storage/size` returns `basis: afs-json` and
`includesObjects: false`; this measures logical relational metadata, not the
physical SQLite image, total DID Space usage or ciphertext object storage. Guest
and member denial precede that measurement, and usage reads change no state.

Recovery regression also checks that consumed nonces remain rejected after ARC
restart and retrying a delivered SDK submission creates no second internal
receipt. Isolated membership/session/chain fixtures are explicitly synthetic;
they prove integration and permission handling, not a new real wallet login or
real dual-account acceptance. The existing user's real Chrome session was
observed loading protected settings before and after the owned ARC restart.
Private checkpoints and verification logs are retained under ignored
`artifacts/private/native-lifecycle-20261106/`. These isolated regressions do not
perform fresh wallet authentication or real two-mailbox acceptance. The separate
operator acceptance below uses explicitly authorized local test wallets.

The authenticated storage page was observed reporting its AFS metadata size after the restart, and a separate anonymous browser displayed only the sign-in gate for protected settings. No production policy was edited to obtain that evidence.

## Real local account acceptance (2026-11-06)

Separately from synthetic regressions, two operator-authorized test wallets
completed normal DID Connect challenge/profile signing and cookie completion
against the actual local ARC. The owner approved promoting only those two test
identities to active Member and creating a private Admin integration key with a
seven-day lifetime. This beta console exposes role-based keys rather than a
member-directory-only permission; rotate this local acceptance key before its
expiry. The application binding still exposes only its bounded, scoped directory
operations. No owner browser cookie is used as the service credential.

The migrated configuration had retained a retired instance scope. It now uses
the current `didmail-server` scope and a verified private credential. The recovered
mailbox's existing association to the original Owner remains intact; attempting
to bind that same mailbox to its newly logged-in ARC identity correctly returned
`BINDING_CONFLICT`. The second mailbox completed the normal authorization form,
CSRF check and mailbox-signed association proof. No association or ARC identity
database row was inserted by the operator.

Both directions of internal mail were submitted through the pinned protocol SDK
to the ARC-owned public listener. Recipient clients validated signed server
receipts and decrypted the exact document and 1.1 MB multi-chunk attachment.
Device encryption keys and pending client tasks were persisted in encrypted,
local private evidence. Chain reads used the instance's real OCAP AFS provider.
The recovered sender already had one active TBA stake; the operator separately
used the authorized beta test wallets to transfer two TBA and establish one
active TBA stake for the new sender. A rejected initial stake transaction was
retained as rejected evidence before correcting its slasher configuration. These
are explicit beta operator actions, not automated regression transactions or
paid/external mail acceptance.

Cold outbound chain reads intermittently exceeded the existing bounded timeout.
The service returned `GAS_STAKE_UNAVAILABLE` and retained the original tasks;
explicit retries of those same tasks completed. No cached eligibility override,
synthetic membership, disabled stake requirement or paid fallback was introduced.
This local network dependency remains an operational limit.

Owned ARC restart checks retained exact business/policy/attachment hashes and
the original node wallet. Both real Member sessions and the private directory
integration survived, both recipient clients decrypted their mail after restart,
and a previously consumed signed request nonce remained rejected. Members were
denied administrator storage reads (403); anonymous reads were denied (401).
The original disabled background scheduler was preserved. Protected evidence,
test wallets, encrypted client stores and coordinated backups remain outside
the public package under ignored `artifacts/private/native-real-accounts-20261106/`.
This acceptance does not establish Store distribution, hosted deployment or
external paid-mail settlement.

## Mail NFT retry recovery

Migration `0022_dmp_index_attempts.sql` retains rejected NFT transaction bytes,
hashes, asset IDs and verified rejection evidence. It remains in the ordered schema history. Native AFS adds this table through a conditional,
additive transaction on business-provider startup; it neither initializes missing
storage nor replaces existing data. The provider restart is required to adopt
changed runtime code, and the existing jobs interval remains unchanged.

Unknown NFT outcomes continue querying/rebroadcasting the original signed bytes.
Only a rejection validated against the accepted quote's confirmation policy can
archive that attempt and atomically requeue NFT creation. Replacements use the
same accepted terms and sender payment, with a 5-second initial delay increasing
to at most 5 minutes for repeated rejection. Node-sponsored delivery follows the
same rule without creating a sender payment. Conflicting evidence remains paused
for verification. Previously quarantined records are not blindly requeued.
The Storage record exposes progress, diagnostics, retry time and rejected hashes,
never the signed transaction bytes. No refund flow is introduced.
