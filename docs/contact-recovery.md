# Contact recovery implementation scope

Status: internal implementation; not a published production capability. Audience: maintainers integrating namecard settlement/recovery.

The repository has authenticated preparations, original-payment verification/storage, signed preparation proofs, read-only status and durable settlement jobs. The native production entry does not advertise `contact-recovery/1`, expose the private preparation handlers or schedule their consumer. Existing `/api/contact/send/sign` does not acquire these guarantees just because the new modules exist.

## Why preserve original bytes

Modern client OCAP CBOR cannot be passed through the node's older transaction decoder and treated as unchanged. The dedicated modern codec validates canonical original bytes and both signatures without recreating a payment. A timeout, missing service record or deleted ciphertext cannot authorize a replacement payment. A digest alone cannot reconstruct original encrypted content.

Preparations freeze the complete ciphertext, recipients, factories, prices, chain fees, original network/confirmation model and expiry. Payment acceptance is durable evidence storage, not a financial terminal state. Wallet-lane exclusion and fenced jobs preserve one signed mint intent through crashes.

## References and gates

- [Internal API](contact-recovery-api.md): signed fields, bounds, status and privacy.
- [Durable jobs](contact-recovery-jobs.md): state transitions, original-byte verification and chain evidence.
- [Flutter client integration](https://github.com/didmail-org/desktop/blob/main/docs/namecard-recovery-protocol.md) and [mobile payment policy](https://github.com/didmail-org/mobile/blob/main/docs/namecard-payment-policy.md).

Before production enablement, complete capability-gated client wiring, independent status/payment/mint/NFT verification, explicit original-byte retry authorization, durable consumer routing and real deployed acceptance. Preserve the original payer, node identity, ciphertext and signed records. Current internal tests and public vectors establish implementation properties, not live-chain settlement or recovery after arbitrary operator data loss.
