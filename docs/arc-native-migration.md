# ARC-native deployment contract

Status: the native ARC implementation is active locally. Hosted ARC installation
and execution remain unverified; public distribution remains gated. This retained path is
linked by other DIDMail repositories; it now records the remaining deployment
contract rather than the completed local implementation plan.

## Target and boundaries

The versioned Blocklet supplies UI, protocol HTTP, original signing and scheduled
work inside ARC, with durable data in an instance-scoped Space. The Workers runtime is retired; its retained [D1/R2 recovery sources](local-preview-persistence.md)
are migration evidence, never an automatic fallback.

Current source ownership and adapters are described in [server architecture](server-architecture.md).
Use [local ARC development](local-arc-development.md) for commands,
[packaged runtime](arc-package-runtime.md) for activation, identity and local
acceptance, and [instance migration](arc-package-runtime.md#existing-installation-import-before-initialization) for explicit import.

## Target-runtime evidence

The [capability table](arc-package-runtime.md#capability-status) owns the current
acceptance summary. For a hosted target, recheck its exact module-mount activation,
listener, scheduling and instance storage contracts; the local CLI's Node/Bun
provider loading is not hosted evidence. Static Pages and a basic package check
cannot establish executable hosting or durability.

## Required contracts before cutover

Before advertising a hosted installation, verify these properties on its exact
runtime and storage-provider versions:

1. **Execution and ingress.** Load the actual business providers and preserve
   existing routes, bodies, streaming, headers, WebSockets and error behavior.
   Unsupported capabilities must fail closed. Reserve and route the listener;
   static pages alone cannot serve the protocol.
2. **Instance data.** Verify byte fidelity, object limits, private access,
   conditional-write atomicity, pagination, restart recovery and backup/restore.
   An AFS batch is not automatically an atomic database transaction. The current
   whole-aggregate evaluator has no large-mailbox or hosted multi-daemon acceptance.
3. **Durable state and payment safety.** Retain unique nonces/messages, exact
   amounts, original signed bytes, payment lanes, leases, fences and idempotent
   reconciliation. Preserve both policy and relational participants and never
   reopen a closed fence or infer nonpayment from a timeout.
4. **Identity and secrets.** Keep ARC callers, mailbox identities and the original
   node signing identity distinct. Verify membership/session/CSRF boundaries and
   key custody. Never regenerate or replace the node key implicitly. The local
   implementation supports one signing instance per ARC process.
5. **Background work.** Verify scheduling, retries, leases and request lifetime.
   A manifest declaration alone does not establish execution guarantees.
6. **Migration and reversibility.** Quiesce writers, coordinate metadata,
   ciphertext, policy, configuration, identity and transaction evidence, compare
   counts/digests, and restore an isolated copy. Do not roll back paid live state
   after external effects without reconciliation.
7. **Public distribution.** Verify installation, upgrades, permissions, domains,
   resource provisioning and terms. Resolve the [distribution gates](distribution-license-audit.md)
   separately from local build acceptance; do not infer APIs from retired services.

## Acceptance and regression

Use focused existing compatibility, authorization, concurrent-write, interruption,
restart and encrypted-delivery checks for the capability being changed. Synthetic
fixtures and local deployment dry runs remain local evidence. Hosted ingress/authentication, paid-chain settlement and distribution need
target-specific acceptance; automated checks must not send real mail or chain transactions.

Reference contracts: [manifest](https://www.arcblock.io/en/docs/blocklets/manifest-and-capabilities/),
[package and instance](https://www.arcblock.io/en/docs/blocklets/package-and-instance/),
[Data and AFS](https://www.arcblock.io/en/docs/blocklets/data-and-afs/),
[provider authoring](https://www.arcblock.io/en/docs/afs/author-a-provider/) and
[AFS over HTTP](https://www.arcblock.io/en/docs/agent-access/afs-over-http/).
These describe interfaces; the actual deployment must demonstrate their required semantics.
