# ARC-native deployment contract

Status: the native ARC implementation is active locally. Hosted ARC execution,
installation and public distribution remain unverified. This retained path is
linked by other DIDMail repositories; it now records the remaining deployment
contract rather than the completed local implementation plan.

## Target and boundaries

The versioned Blocklet supplies UI, protocol HTTP, original signing and scheduled
work inside ARC, with durable data in an instance-scoped Space. The [Workers runtime is retired](workers-migration.md); its retained D1/R2 sources
are migration evidence, never an automatic fallback.

Current source ownership and adapters are described in [server architecture](server-architecture.md).
Use [local ARC development](local-arc-development.md) for commands,
[packaged runtime](arc-package-runtime.md) for activation, identity and local
acceptance, and [instance migration](instance-afs-migration.md) for explicit import.

## Verified baseline and gaps

The local baseline uses ARC `2.0.0-beta.74 (49c9125c)`. Package-only build and
native HTTP/restart tests exercise the actual ARC binary without repository
node_modules or a business Worker. The [runtime acceptance](arc-package-runtime.md#local-acceptance-and-limits)
records what these tests establish. Local business storage uses the
[AFS transaction aggregate](afs-business-storage.md), preserving SQL predicates
and conditional commits; [policy admission](afs-policy-admission.md) retains
CAS locks and relational fences.

The inspected beta.74 bundled `collections` and `work-board` notes state that
the Node daemon imports module mounts while the Cloudflare scope activator skips
module-target mounts. This version-specific limitation must be rechecked on the
actual hosted target. Local `./providers/...` execution is not hosted acceptance.
Static Pages package hosting, denied anonymous AFS probes and a successful basic
package check also do not establish executable hosting or storage guarantees.

Earlier scaffold, proxy, CAS and static-hosting probes were implementation
research. Their per-run evidence remains in ignored private artifacts and Git
history; they are superseded as operating instructions by the current runtime
documents. Reusable isolated checks remain in
[instance tests](../scripts/arc-instance-live.test.mjs),
[proxy tests](../scripts/arc-provider-live.test.mjs) and
[native HTTP tests](../scripts/arc-http-package-live.test.mjs).

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
fixtures and local deployment dry runs remain local evidence. Hosted ingress,
real authentication, paid-chain settlement and distribution need their own
explicit acceptance; automated checks must not send real mail or chain transactions.

Reference contracts: [manifest](https://www.arcblock.io/en/docs/blocklets/manifest-and-capabilities/),
[package and instance](https://www.arcblock.io/en/docs/blocklets/package-and-instance/),
[Data and AFS](https://www.arcblock.io/en/docs/blocklets/data-and-afs/),
[provider authoring](https://www.arcblock.io/en/docs/afs/author-a-provider/) and
[AFS over HTTP](https://www.arcblock.io/en/docs/agent-access/afs-over-http/).
These describe interfaces; the actual deployment must demonstrate their required semantics.
