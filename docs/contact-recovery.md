# Internal contact recovery reference

Status: implemented internal contract; not advertised, routed or scheduled by
the production entry. Audience: protocol and settlement maintainers. This is the
single API, persistence and recovery reference; its existence enables no capability.

The repository has authenticated preparations, original-payment verification/storage, signed preparation proofs, read-only status and durable settlement jobs. The native production entry does not advertise `contact-recovery/1`, expose the private preparation handlers or schedule their consumer. Existing `/api/contact/send/sign` does not acquire these guarantees just because the new modules exist.

## Why preserve original bytes

Modern client OCAP CBOR cannot be passed through the node's older transaction decoder and treated as unchanged. The dedicated modern codec validates canonical original bytes and both signatures without recreating a payment. A timeout, missing service record or deleted ciphertext cannot authorize a replacement payment. A digest alone cannot reconstruct original encrypted content.

Preparations freeze the complete ciphertext, recipients, factories, prices, chain fees, original network/confirmation model and expiry. Payment acceptance is durable evidence storage, not a financial terminal state. Wallet-lane exclusion and fenced jobs preserve one signed mint intent through crashes.


## Internal API

### Authentication and resources

Resources use `/v1/contact-preparations/<lowercase-v4-uuid>`. The client creates and retains one ID for one explicitly approved sending intent. Every request uses DMP-style DID HTTP signatures, exact full URL/body digest, a 60-second validity interval and a fresh nonce. JSON must be canonical and writes use `application/json`. Historical identity headers alone cannot authorize access.

| Method                   | Exact input and behavior                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PUT <resource>`         | `protocolVersion:1`, `receiver`, `namecard`, `ciphertext`; authenticated sender and server-verified economics; 201 first creation, 200 identical retry |
| `GET <resource>`         | Empty body; original payer only; returns stored evidence without chain reads or broadcast                                                              |
| `POST <resource>/submit` | `protocolVersion:1`, `signedOrigin`; verifies saved terms and both payment signatures, persists atomically, returns 202                                |
| `GET <resource>/status`  | Empty body; original payer only; read-only saved state and chain observations                                                                          |

Another identity and a missing ID both return 404. HTTP nonce replay returns `409 REQUEST_REPLAYED`; a fresh HTTP nonce carrying the same original payment is idempotent. Another valid payment cannot replace the accepted one.

### Immutable preparation

The response contains `protocolVersion`, `preparationId`, `state`, `snapshot`, `ciphertext`, `createdAt`, `expiresAt`, `payment` and `preparationProof`. Snapshot separates transaction `binding` from node `policy`; epoch times are milliseconds. Accepted payment records contain original `signedOrigin`, original de-signed `unsignedOrigin`, `transactionId`, authenticated `publicKey` and first `acceptedAt`.

The node signs canonical `{snapshot,ciphertext,createdAt,expiresAt}` in the `DIDMAIL-CONTACT-PREPARATION/1` domain. Verify the pinned service payee, public-key/DID derivation and actual Ed25519 signature, retaining account/application identity roles. New UUID preparation payment metadata includes `preparationSha256`, the lowercase SHA-256 of those canonical four fields without proof/payment. Acceptance and settlement recheck the complete commitment; unchanged payment amount cannot hide changed mint fees, confirmation model or deadline. Internal historical numeric-ID vectors do not create an HTTP downgrade path.

Server quotation independently verifies the published node-owned template/factory, unique token and decimals, exact prices/mint amount, recipient DID/key, configured network/sync state and TransferV3/AcquireAssetV3 fees. Clients independently verify the pinned proof and same economic conditions before explicit payment approval. Block and Dolt ledger confirmation are distinct policies.

### Bounds, errors and durability

Preparation lasts 10 minutes; first payment acceptance must occur before expiry, but an already accepted original payment remains readable/retryable. At most eight unexpired unpaid preparations per identity are admitted by atomic relational conditions in the AFS transaction aggregate. Requests are bounded to 96 KiB, ciphertext to 64 KiB UTF-8, and original signatures to 68,000 characters. Responses are `private, no-store`.

Known problems use problem JSON: 400 invalid/canonical fields, 401 authentication, 404 missing/foreign record, 409 conflict/replay, 410 expired first acceptance, 413 size, 415 media type, 429 quota/rate, 503 unavailable quotation/storage. A 503 is not proof that nothing was saved; keep the original intent/bytes and query again.

`prepared` means unpaid preparation; `accepted` means original signed payment bytes are stored, not broadcast, charged, confirmed or delivered. These handlers do not sign or broadcast replacement payments.

### Status projection

Status returns `protocolVersion,preparationId,state,preparation,preparationProof,mint,paymentConfirmation,delivery,problemCode`. Missing mint/chain evidence is null. Mint evidence includes original signed bytes, hash and asset address. States include prepared, accepted, queued, payment_pending, payment_confirmed, mint_pending, delivered, payment_rejected and reconciliation_required. Do not expose leases, fences or internal error text. Contradictory/corrupt stored evidence returns 503 while retaining the original record.

A node's state label is not independently verified delivery. Clients must validate original payment/mint bytes and signatures, original chain/model evidence and NFT owner/parent/content before marking delivered. The production capability stays disabled until its integration gates are met.

## Settlement and recovery

Implementation: [jobs](../blocklet/providers/didmail-http/source/protocol/contact/contact-jobs.ts),
[settlement](../blocklet/providers/didmail-http/source/protocol/contact/contact-settlement.ts)
and [status](../blocklet/providers/didmail-http/source/protocol/contact/contact-status.ts).

### Persistence and exclusion

Preparations retain original ciphertext/payment; jobs reference their ID. A partial pending index discovers accepted work. Insert a unique job before clearing its pending marker so a lost enqueue acknowledgment cannot lose a payment.

Transitions `payment_pending → payment_confirmed → mint_pending → delivered` require the current lease owner, increasing fence, unexpired lease and previous state. Persist complete mint signature/hash/asset address together before broadcast and never replace them. Default leases last 120 seconds with stage renewal; RPC has a separate 20-second deadline. Old/expired task executors cannot renew or commit state.

DMP and contact jobs share `dmp_wallet_lanes`, with contact owner `contact:<id>`. Payer/node roles share a chain account's nonce sequence and exclude conflicting work. Release payer after confirmation or definitive rejection; release node after verified delivery. Unknown/conflicting results retain lanes until reconciliation. Final-state cleanup remains safe after restart.

### Original-byte verification

Revalidate canonical CBOR, inner/outer signatures, hash, de-signed bytes and frozen preparation before each attempt. Payment broadcast uses only the original signature. Prepared mint bytes use saved `mintChainFee`, not a new fee context or old SDK re-encoding.

Before signing, verify current factory owner, template output, unique native token/18 decimals, original mint amount, recipient and ciphertext. Nonce is at least chain nonce + 1. After signing, independently verify network, node role/key, exact factory/asset/recipient/fees, issuer fields, token input and nine original business variables, including preparation/payment/content/origin commitments. Even a valid node re-signature cannot authorize substituted terms.

Persisted mints only query/rebroadcast original bytes after restart, without creating another transaction from new factory data. Original-byte verifiers return frozen authenticated capabilities; an object copy or JSON round trip cannot impersonate the internal verified object.

### Confirmation and limits

Block confirmation requires the original network/hash and positive committed block evidence. Dolt confirmation requires the exact supported backend, original transaction membership/execution, network and canonical time. Height zero cannot substitute for block evidence. Check NFT owner, parent and content before delivery.

The contact-only read profile permits 72 KiB original mint bytes for a 64 KiB ciphertext; the DMP payment bound remains 48 KiB. RPC rejects redirects, private-key fields and oversized data. Bounded Base58 conversion has independent deterministic/OCAP compatibility vectors; local timing samples are not cloud or device performance guarantees.


## References and gates

Before production enablement complete capability-gated client wiring, independent
status/payment/mint/NFT verification, explicit original-byte retry authorization,
durable consumer routing and deployed acceptance. Preserve payer/node identity,
ciphertext and signed records. Public contact routes and read-only diagnostics
do not acquire these recovery guarantees.

[Desktop integration](https://github.com/didmail-org/desktop/blob/main/docs/namecard-recovery-protocol.md)
and [mobile payment policy](https://github.com/didmail-org/mobile/blob/main/docs/namecard-payment-policy.md)
consume this contract. Isolated regressions cover real codecs/signatures,
lost responses before/after persistence, enqueue loss, lease replacement,
concurrency, shared wallet lanes, rejection/conflicting evidence and full storage
teardown/reopen. Public fixed seeds are unfunded fixtures. These checks establish
neither live-chain settlement nor recovery after arbitrary operator data loss;
no real chain broadcasts belong in automated tests.
