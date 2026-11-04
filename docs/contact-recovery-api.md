# Internal contact-preparation API

Status: implemented internal contract, not mapped to production or advertised by discovery. Audience: protocol/server integrators. See [scope](contact-recovery.md) and [jobs](contact-recovery-jobs.md).

## Authentication and resources

Resources use `/v1/contact-preparations/<lowercase-v4-uuid>`. The client creates and retains one ID for one explicitly approved sending intent. Every request uses DMP-style DID HTTP signatures, exact full URL/body digest, a 60-second validity interval and a fresh nonce. JSON must be canonical and writes use `application/json`. Historical identity headers alone cannot authorize access.

| Method                   | Exact input and behavior                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PUT <resource>`         | `protocolVersion:1`, `receiver`, `namecard`, `ciphertext`; authenticated sender and server-verified economics; 201 first creation, 200 identical retry |
| `GET <resource>`         | Empty body; original payer only; returns stored evidence without chain reads or broadcast                                                              |
| `POST <resource>/submit` | `protocolVersion:1`, `signedOrigin`; verifies saved terms and both payment signatures, persists atomically, returns 202                                |
| `GET <resource>/status`  | Empty body; original payer only; read-only saved state and chain observations                                                                          |

Another identity and a missing ID both return 404. HTTP nonce replay returns `409 REQUEST_REPLAYED`; a fresh HTTP nonce carrying the same original payment is idempotent. Another valid payment cannot replace the accepted one.

## Immutable preparation

The response contains `protocolVersion`, `preparationId`, `state`, `snapshot`, `ciphertext`, `createdAt`, `expiresAt`, `payment` and `preparationProof`. Snapshot separates transaction `binding` from node `policy`; epoch times are milliseconds. Accepted payment records contain original `signedOrigin`, original de-signed `unsignedOrigin`, `transactionId`, authenticated `publicKey` and first `acceptedAt`.

The node signs canonical `{snapshot,ciphertext,createdAt,expiresAt}` in the `DIDMAIL-CONTACT-PREPARATION/1` domain. Verify the pinned service payee, public-key/DID derivation and actual Ed25519 signature, retaining account/application identity roles. New UUID preparation payment metadata includes `preparationSha256`, the lowercase SHA-256 of those canonical four fields without proof/payment. Acceptance and settlement recheck the complete commitment; unchanged payment amount cannot hide changed mint fees, confirmation model or deadline. Internal historical numeric-ID vectors do not create an HTTP downgrade path.

Server quotation independently verifies the published node-owned template/factory, unique token and decimals, exact prices/mint amount, recipient DID/key, configured network/sync state and TransferV3/AcquireAssetV3 fees. Clients independently verify the pinned proof and same economic conditions before explicit payment approval. Block and Dolt ledger confirmation are distinct policies.

## Bounds, errors and durability

Preparation lasts 10 minutes; first payment acceptance must occur before expiry, but an already accepted original payment remains readable/retryable. At most eight unexpired unpaid preparations per identity are admitted by atomic D1 conditions. Requests are bounded to 96 KiB, ciphertext to 64 KiB UTF-8, and original signatures to 68,000 characters. Responses are `private, no-store`.

Known problems use problem JSON: 400 invalid/canonical fields, 401 authentication, 404 missing/foreign record, 409 conflict/replay, 410 expired first acceptance, 413 size, 415 media type, 429 quota/rate, 503 unavailable quotation/storage. A 503 is not proof that nothing was saved; keep the original intent/bytes and query again.

`prepared` means unpaid preparation; `accepted` means original signed payment bytes are stored, not broadcast, charged, confirmed or delivered. These handlers do not sign or broadcast replacement payments.

## Status projection

Status returns `protocolVersion,preparationId,state,preparation,preparationProof,mint,paymentConfirmation,delivery,problemCode`. Missing mint/chain evidence is null. Mint evidence includes original signed bytes, hash and asset address. States include prepared, accepted, queued, payment_pending, payment_confirmed, mint_pending, delivered, payment_rejected and reconciliation_required. Do not expose leases, fences or internal error text. Contradictory/corrupt stored evidence returns 503 while retaining the original record.

A node's state label is not independently verified delivery. Clients must validate original payment/mint bytes and signatures, original chain/model evidence and NFT owner/parent/content before marking delivered. The production capability stays disabled until its integration gates are met.
