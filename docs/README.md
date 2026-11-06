# Documentation by task

## Start developing

Read [README](../README.md) → [development guide](local-arc-development.md) →
[architecture](server-architecture.md). These are the complete default path.
Do not read the references below as an installation checklist.

## Refer when needed

| Task | Authority |
| --- | --- |
| Run an installation, provision a new instance, configure signing or recover | [Operations and capability status](arc-package-runtime.md) |
| Change transactional storage or admission | [AFS business storage](afs-business-storage.md), [CAS/fence protocol](afs-policy-admission.md) |
| Associate a mailbox or maintain trusted membership | [Onboarding](arc-mailbox-onboarding.md), [member-source interface](arc-members-source-compatibility.md) |
| Manage node identity, funds, gas, NFT stake or diagnose chain reads | [Node operations](node-identity-and-transactions.md) |
| Change administration HTTP policy or native UI behavior | [Policy API](mail-policy-api.md), [native UI](native-ui.md) |
| Maintain internal contact recovery | [Internal contact recovery](contact-recovery.md); not an enabled product capability |
| Recover a historical SQLite/D1/R2 source | [Historical recovery](local-preview-persistence.md) |
| Review upgrades, patches or public distribution | [Dependency security](dependency-security.md), [distribution audit](distribution-license-audit.md) |
| Use the product or author help | [English help](help/en.md), [five-language help maintenance](help/README.md) |
| Test invitations across devices | [LAN guide](lan-invitation-testing.md) |

Client wire behavior belongs to the [protocol repository](https://github.com/didmail-org/protocol/blob/main/docs/protocol/README.md).
[Protocol compatibility tests](../tests/business/README.md#protocol-compatibility)
explain retained legacy assertions. [Route declarations](legacy-routes.json) and
[import provenance](origin.json) are compatibility evidence, not an API support
list or a current file map. [Hosted cutover requirements](arc-native-migration.md)
are a deployment reference, not the developer start path.
