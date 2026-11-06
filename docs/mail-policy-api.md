# Mail policy and admission API

Status: native ARC policy and retained HTTP compatibility contract. Audience: administrators and API maintainers.

## Administration and revisions

`/api/admin/mail-*` requires a server-verified ARC owner/admin session. Cookie-authenticated writes require the configured same-origin request. Self-reported DID/role headers cannot authorize administration; owner-only financial operations remain separate.

| Method/path                          | Contract                                                           |
| ------------------------------------ | ------------------------------------------------------------------ |
| `GET /api/admin/mail-policy`         | `{revision,policy,updatedAt,updatedBy}`                            |
| `PUT /api/admin/mail-policy`         | Complete `{expectedRevision,policy}`; returns new revision         |
| `GET /api/admin/mail-access-list`    | `kind=allow` or `kind=deny`, `limit=1..100`, optional canonical-DID `after`; ordered entries and next cursor |
| `PUT /api/admin/mail-access-list`    | `{expectedRevision,kind,did,remark}`; remarks up to 500 characters |
| `DELETE /api/admin/mail-access-list` | `{expectedRevision,kind,did}`; retains revision/audit semantics    |

Policy/list mutations share a revision. Native ARC commits the private instance policy aggregate with AFS conditional writes. Historical D1 policy/audit tables are migration inputs only. See [policy/admission guarantees](afs-policy-admission.md) for admission fencing and [instance migration](arc-package-runtime.md#existing-installation-import-before-initialization) for native actions and rejected legacy writes. A stale revision returns `409 MAIL_POLICY_CONFLICT`; reread and review rather than blindly retry. Canonical mailbox DIDs are required. In ARC mode, legacy allowlist writes are rejected; the UI exposes blocking and ARC membership administration remains upstream.

## Automatic admission

The default `DIDMAIL_MEMBER_ACCESS=arc` model derives public sending admission from an authoritative valid service-node NFT stake. Without one, eligible bound active non-guest members may send. Holding an unstaked/wrong-factory/revoked NFT or staking native tokens does not open public access. Blocking has priority, including during chain failure.

Changing historical `policy.accessMode` returns `409 ACCESS_MANAGED_BY_NODE_NFT`. Preserve that compatibility field during unrelated full-policy updates; it does not control actual ARC admission. Explicit legacy deployments retain migration behavior only.

Public `accessMode`, `restricted` and `sendingRestricted` are derived observations, with `sendingAccessState=open|members-only|unavailable`. Unavailable NFT state remains usable metadata for receiving/download initialization, but a new external send fails with `503 NODE_NFT_STATE_UNAVAILABLE`. Do not infer public discovery from token balance or a client cache. Internal direct storage has its own member admission path and does not require node NFT availability.

## Limits and eligibility

Current attachment settings enforce enabled/count/per-file/total plaintext limits and whole-message ciphertext limits. Validate units and exact bounded integers; accepted tasks keep their original terms. Internal retention/capacity/daily quotas are deployment policy in the [member extension](https://github.com/didmail-org/protocol/blob/main/docs/protocol/member-mail.md#deployment-and-limits).

DMP-authenticated `GET /v1/service-policy` exposes nonprivate policy/revision information. `GET /v1/sending-eligibility` checks the signed sender and reports the applicable gas observation; callers cannot supply another identity or RPC. Source failure is not missing membership/zero stake. A preflight result is not permission to skip acceptance-time checks.

Ordinary/chain-VC delivery is retired. Historical `ordinary` fields may remain in persisted compatibility records, but cannot enable VC delivery or override NFT/internal terms. The unpaid-upload session quota counts only current external NFT tasks, not internal tasks or retired ordinary-mail tables. Internal mail has no message-count, pending-task or cumulative-storage quotas; attachment/message size controls and request rate limits still apply.
