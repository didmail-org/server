# Internal contact settlement jobs

Status: implemented and fault-tested internally; no production consumer/capability. Audience: settlement maintainers. Sources: [contact jobs](../workers/contact-jobs.ts), [settlement](../workers/contact-settlement.ts) and [API contract](contact-recovery-api.md).

## Persistence and exclusion

Preparations retain original ciphertext/payment; jobs reference their ID. A partial pending index discovers accepted work. Insert a unique job before clearing its pending marker so a lost enqueue acknowledgment cannot lose a payment.

Transitions `payment_pending → payment_confirmed → mint_pending → delivered` require the current lease owner, increasing fence, unexpired lease and previous state. Persist complete mint signature/hash/asset address together before broadcast and never replace them. Default leases last 120 seconds with stage renewal; RPC has a separate 20-second deadline. Old/expired workers cannot renew or commit state.

DMP and contact jobs share `dmp_wallet_lanes`, with contact owner `contact:<id>`. Payer/node roles share a chain account's nonce sequence and exclude conflicting work. Release payer after confirmation or definitive rejection; release node after verified delivery. Unknown/conflicting results retain lanes until reconciliation. Final-state cleanup remains safe after restart.

## Original-byte verification

Revalidate canonical CBOR, inner/outer signatures, hash, de-signed bytes and frozen preparation before each attempt. Payment broadcast uses only the original signature. Prepared mint bytes use saved `mintChainFee`, not a new fee context or old SDK re-encoding.

Before signing, verify current factory owner, template output, unique native token/18 decimals, original mint amount, recipient and ciphertext. Nonce is at least chain nonce + 1. After signing, independently verify network, node role/key, exact factory/asset/recipient/fees, issuer fields, token input and nine original business variables, including preparation/payment/content/origin commitments. Even a valid node re-signature cannot authorize substituted terms.

Persisted mints only query/rebroadcast original bytes after restart, without creating another transaction from new factory data. Original-byte verifiers return frozen authenticated capabilities; an object copy or JSON round trip cannot impersonate the internal verified object.

## Confirmation and limits

Block confirmation requires the original network/hash and positive committed block evidence. Dolt confirmation requires the exact supported backend, original transaction membership/execution, network and canonical time. Height zero cannot substitute for block evidence. Check NFT owner, parent and content before delivery.

The contact-only read profile permits 72 KiB original mint bytes for a 64 KiB ciphertext; the DMP payment bound remains 48 KiB. RPC rejects redirects, private-key fields and oversized data. Bounded Base58 conversion has independent deterministic/OCAP compatibility vectors; local timing samples are not cloud or device performance guarantees.

## Evidence and enablement

Node/workerd tests exercise real codecs/signatures with isolated RPC fixtures, including lost responses before/after persistence, enqueue loss, lease replacement, concurrency, cross-protocol/role lanes, definite rejection, conflicting evidence and full persistence teardown/reopen. Public fixed seeds are not funded identities. No real chain broadcast is part of these tests.

Production enablement still requires the [integration gates](contact-recovery.md#references-and-gates). Existing public contact routes and a read-only client diagnostic do not imply that this durable protocol is enabled.
