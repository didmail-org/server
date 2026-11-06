import { addressOf, type Manifest } from '@didmail/protocol';
import { isValid } from '@arcblock/did';
import { bindings, value } from '../runtime/bindings';
import { readNodeSendingAccess } from './node-sending-access';
import { activeArcMember } from '../identity/arc-members';
import { afsPolicyEnabled, readAfsPolicy } from '../storage/afs-mail-policy';

export interface MailPolicy {
  accessMode: 'public' | 'allowlist';
  ordinary: { enabled: boolean; baseFee: string; retentionDays: number; attachmentPricePerBytePerDay: string };
  attachments: { enabled: boolean; maxCount: number; maxFileBytes: number; maxTotalBytes: number };
  maxMessageCiphertextBytes: number;
}
export interface PolicySnapshot {
  revision: number;
  afsFence?: string;
  denyBinding?: { arc_id: string; revision: number; revoked: number } | null;
  policy: MailPolicy;
  updatedAt: string;
  updatedBy: string;
  sendingAccessState?: 'open' | 'members-only' | 'unavailable';
  authorization?: { mode: string; arcId: string; linkRevision: number; member: boolean; public?: boolean };
}
export function admissionError(status: number, code: string, detail: string, recoveryAction = 'none'): never {
  throw Object.assign(new Error(detail), { status, code, recoveryAction });
}
function object(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== keys.sort().join(',')
  )
    admissionError(400, 'INVALID_MAIL_POLICY', 'Unexpected policy fields');
}
function integer(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    admissionError(400, 'INVALID_MAIL_POLICY', 'Policy value is outside supported bounds');
}
export function validatePolicy(value: unknown): asserts value is MailPolicy {
  object(value, ['accessMode', 'ordinary', 'attachments', 'maxMessageCiphertextBytes']);
  if (!['public', 'allowlist'].includes(String(value.accessMode)))
    admissionError(400, 'INVALID_MAIL_POLICY', 'Invalid access mode');
  object(value.ordinary, ['enabled', 'baseFee', 'retentionDays', 'attachmentPricePerBytePerDay']);
  if (typeof value.ordinary.enabled !== 'boolean')
    admissionError(400, 'INVALID_MAIL_POLICY', 'Invalid ordinary switch');
  for (const amount of [value.ordinary.baseFee, value.ordinary.attachmentPricePerBytePerDay])
    if (typeof amount !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(amount))
      admissionError(400, 'INVALID_MAIL_POLICY', 'Amounts must be canonical unsigned integer strings');
  integer(value.ordinary.retentionDays, 1, 36500);
  object(value.attachments, ['enabled', 'maxCount', 'maxFileBytes', 'maxTotalBytes']);
  if (typeof value.attachments.enabled !== 'boolean')
    admissionError(400, 'INVALID_MAIL_POLICY', 'Invalid attachment switch');
  integer(value.attachments.maxCount, 0, 20);
  integer(value.attachments.maxFileBytes, 1, 64 * 1024 * 1024);
  integer(value.attachments.maxTotalBytes, 1, 64 * 1024 * 1024);
  if (Number(value.attachments.maxFileBytes) > Number(value.attachments.maxTotalBytes))
    admissionError(400, 'INVALID_MAIL_POLICY', 'Single-file limit exceeds total attachment limit');
  integer(value.maxMessageCiphertextBytes, 16, 64 * 1024 * 1024);
  if (
    BigInt(value.ordinary.baseFee as string) +
      BigInt(value.ordinary.attachmentPricePerBytePerDay as string) *
        BigInt(value.attachments.maxTotalBytes as number) *
        BigInt(value.ordinary.retentionDays as number) >=
    2n ** 256n
  )
    admissionError(400, 'INVALID_MAIL_POLICY', 'Maximum configured service fee exceeds chain amount bounds');
}
export function canonicalMailDid(value: unknown): string {
  if (typeof value !== 'string') return admissionError(400, 'INVALID_DID', 'Canonical ArcBlock DID required');
  try {
    if (value !== 'did:abt:' + addressOf(value) || !isValid(addressOf(value))) throw new Error();
  } catch {
    return admissionError(400, 'INVALID_DID', 'Canonical ArcBlock DID required');
  }
  return value;
}
export async function readMailPolicy(): Promise<PolicySnapshot> {
  if (afsPolicyEnabled()) {
    const state = await readAfsPolicy(); validatePolicy(state.policy);
    return { revision: state.revision, policy: state.policy, updatedAt: state.updatedAt, updatedBy: state.updatedBy };
  }
  const row = await bindings.DB.prepare('SELECT * FROM mail_service_policy WHERE id=1').first<{
    revision: number;
    policy_json: string;
    updated_at: string;
    updated_by: string;
  }>();
  if (!row)
    return admissionError(503, 'MAIL_POLICY_UNAVAILABLE', 'Apply the mail admission migration before serving mail');
  const policy: unknown = JSON.parse(row.policy_json);
  validatePolicy(policy);
  return { revision: row.revision, policy, updatedAt: row.updated_at, updatedBy: row.updated_by };
}
// Used INSIDE writes accepting a task or an object, to serialize administrator
// edits against sender admission. Restriction is never applied to recipients.
export const arcMemberAccess = () => value('DIDMAIL_MEMBER_ACCESS') === 'arc';
export const ADMISSION_SQL = `EXISTS(SELECT 1 FROM mail_service_policy p WHERE p.id=1 AND p.revision=?
 AND NOT EXISTS(SELECT 1 FROM mail_access_entries WHERE kind='deny' AND did=?)
 AND NOT EXISTS(SELECT 1 FROM mail_access_entries d JOIN account_links l ON d.did=l.arc_id WHERE d.kind='deny' AND l.mailbox_id=?)
 AND ((?='legacy' AND (json_extract(p.policy_json,'$.accessMode')='public' OR EXISTS(SELECT 1 FROM mail_access_entries WHERE kind='allow' AND did=?)))
 OR (?='arc' AND (?=1 OR (?=1 AND EXISTS(SELECT 1 FROM account_links WHERE mailbox_id=? AND arc_id=? AND revision=? AND revoked=0))))))`;
export async function memberAuthorization(sender: string, verifyMember = true) {
  const link = await bindings.DB.prepare('SELECT arc_id,revision,revoked FROM account_links WHERE mailbox_id=?')
    .bind(sender)
    .first<{ arc_id: string; revision: number; revoked: number }>();
  // Deny takes priority even during an upstream membership outage.
  const denied = afsPolicyEnabled()
    ? (await readAfsPolicy()).entries.some(entry => entry.kind === 'deny' && [sender, link?.arc_id || ''].includes(entry.did))
    : await bindings.DB.prepare("SELECT 1 FROM mail_access_entries WHERE kind='deny' AND did IN (?,?) LIMIT 1").bind(sender, link?.arc_id || '').first();
  // Remote active state is read for each sending operation; never cached as a permanent grant.
  const member = Boolean(verifyMember && !denied && link && !link.revoked && (await activeArcMember(link.arc_id)));
  return {
    mode: 'arc',
    arcId: link?.arc_id || '',
    linkRevision: link?.revision || 0,
    member,
    denied: !!denied,
    linkActive: !!link && !link.revoked,
  };
}
export async function checkSenderAdmission(sender: string, internal = false): Promise<PolicySnapshot> {
  const snapshot = await readMailPolicy();
  if (internal) {
    const auth=await memberAuthorization(sender);
    if(auth.denied || !auth.member)admissionError(403,'SENDER_NOT_ALLOWED','Active bound membership is required');
    snapshot.authorization={...auth,public:false};
    snapshot.policy.accessMode='allowlist';
  } else if (arcMemberAccess()) {
    const auth = await memberAuthorization(sender, false);
    if (auth.denied) admissionError(403, 'SENDER_NOT_ALLOWED', 'This account is blocked', 'choose_service');
    const open = await readNodeSendingAccess();
    if (!open && auth.linkActive) auth.member = await activeArcMember(auth.arcId);
    snapshot.authorization = { ...auth, public: open };
    snapshot.policy.accessMode = open ? 'public' : 'allowlist';
  }
  if (afsPolicyEnabled()) {
    // Even public/legacy senders can be denied by their current ARC binding.
    // Pin that observation in the relational commit, including the absence of a link.
    snapshot.denyBinding = await bindings.DB.prepare('SELECT arc_id,revision,revoked FROM account_links WHERE mailbox_id=?').bind(sender).first<{ arc_id: string; revision: number; revoked: number }>();
    const current = await readAfsPolicy();
    if (current.revision !== snapshot.revision) admissionError(409, 'MAIL_POLICY_CONFLICT', 'Policy changed during admission', 'refresh_policy');
    const auth = snapshot.authorization;
    const denied = current.entries.some(entry => entry.kind === 'deny' && [sender, snapshot.denyBinding?.arc_id || ''].includes(entry.did));
    const allowed = auth?.mode === 'arc' ? auth.public || auth.member : current.policy.accessMode === 'public' || current.entries.some(entry => entry.kind === 'allow' && entry.did === sender);
    if (denied || !allowed) admissionError(403, 'SENDER_NOT_ALLOWED', 'This DID cannot send new mail through this service', 'choose_service');
    return snapshot;
  }
  const result = await bindings.DB.prepare(`SELECT ${ADMISSION_SQL} AS allowed`)
    .bind(...admissionValues(snapshot, sender))
    .first<{ allowed: number }>();
  if (!result?.allowed)
    return admissionError(
      403,
      'SENDER_NOT_ALLOWED',
      'This DID cannot use this node to send and store new mail',
      'choose_service',
    );
  return snapshot;
}
export function checkMessageLimits(manifest: Pick<Manifest, 'blobs' | 'documentBlobId'>, policy: MailPolicy) {
  const files = manifest.blobs.filter((blob) => blob.blobId !== manifest.documentBlobId);
  if ((!policy.attachments.enabled && files.length) || files.length > policy.attachments.maxCount)
    admissionError(
      413,
      'ATTACHMENT_POLICY_EXCEEDED',
      'Attachments are disabled or their count exceeds node policy',
      'edit_message',
    );
  let total = 0;
  for (const blob of files) {
    const plain = blob.sizeBytes - 16 * blob.chunkCount;
    if (!Number.isSafeInteger(plain) || plain < 0 || plain > policy.attachments.maxFileBytes)
      admissionError(413, 'ATTACHMENT_POLICY_EXCEEDED', 'Attachment exceeds node file limit', 'edit_message');
    total += plain;
  }
  if (
    total > policy.attachments.maxTotalBytes ||
    manifest.blobs.reduce((sum, blob) => sum + blob.sizeBytes, 0) > policy.maxMessageCiphertextBytes
  )
    admissionError(413, 'MESSAGE_POLICY_EXCEEDED', 'Message exceeds node storage limits', 'edit_message');
}
export function admissionSql(snapshot: PolicySnapshot) {
  if (!afsPolicyEnabled()) return ADMISSION_SQL;
  if (!snapshot.afsFence) admissionError(503, 'ADMISSION_FENCE_REQUIRED', 'AFS admission must execute inside its commit fence');
  if (!Object.hasOwn(snapshot, 'denyBinding')) admissionError(503, 'ADMISSION_FENCE_REQUIRED', 'Binding observation is missing');
  return `EXISTS(SELECT 1 FROM didmail_admission_fences WHERE token=? AND policy_revision=? AND open=1)
    AND ((? IS NULL AND NOT EXISTS(SELECT 1 FROM account_links WHERE mailbox_id=?))
      OR EXISTS(SELECT 1 FROM account_links WHERE mailbox_id=? AND arc_id=? AND revision=? AND revoked=?))
    AND (?='legacy' OR ?=1 OR (?=1 AND EXISTS(SELECT 1 FROM account_links WHERE mailbox_id=? AND arc_id=? AND revision=? AND revoked=0)))`;
}
export const admissionValues = (snapshot: PolicySnapshot, sender: string) => {
  const auth = snapshot.authorization || { mode: 'legacy', arcId: '', linkRevision: 0, member: false, public: false };
  if (afsPolicyEnabled()) return [snapshot.afsFence, snapshot.revision, snapshot.denyBinding?.arc_id ?? null, sender, sender, snapshot.denyBinding?.arc_id ?? null, snapshot.denyBinding?.revision ?? 0, snapshot.denyBinding?.revoked ?? 0, auth.mode, auth.public ? 1 : 0, auth.member ? 1 : 0, sender, auth.arcId, auth.linkRevision];
  return [
    snapshot.revision,
    sender,
    sender,
    auth.mode,
    sender,
    auth.mode,
    auth.public ? 1 : 0,
    auth.member ? 1 : 0,
    sender,
    auth.arcId,
    auth.linkRevision,
  ];
};


// Membership affects new ordinary quotes only; accepted signed terms stay immutable.
export async function isFreeMailSender(sender: string): Promise<boolean> {
  if (afsPolicyEnabled()) {
    const state = await readAfsPolicy();
    if (arcMemberAccess()) { const auth = await memberAuthorization(sender); return auth.member && !auth.denied; }
    return state.entries.some(entry => entry.kind === 'allow' && entry.did === sender) && !state.entries.some(entry => entry.kind === 'deny' && entry.did === sender);
  }
  if (arcMemberAccess()) {
    const auth = await memberAuthorization(sender);
    const denied = await bindings.DB.prepare(
      "SELECT 1 AS denied FROM mail_access_entries WHERE kind='deny' AND did IN (?,?) LIMIT 1",
    )
      .bind(sender, auth.arcId)
      .first();
    return auth.member && !denied;
  }
  const row = await bindings.DB.prepare(
    "SELECT EXISTS(SELECT 1 FROM mail_access_entries WHERE kind='allow' AND did=?) AND NOT EXISTS(SELECT 1 FROM mail_access_entries WHERE kind='deny' AND did=?) AS eligible",
  )
    .bind(sender, sender)
    .first<{ eligible: number }>();
  return row?.eligible === 1;
}

// Compatibility fields describe actual admission, rather than a stored legacy choice.
export async function readEffectiveMailPolicy(tolerateUnavailable = false): Promise<PolicySnapshot> {
  const snapshot = await readMailPolicy();
  if (arcMemberAccess()) {
    try {
      const open = await readNodeSendingAccess();
      snapshot.policy.accessMode = open ? 'public' : 'allowlist';
      snapshot.sendingAccessState = open ? 'open' : 'members-only';
    } catch (error) {
      if (!tolerateUnavailable) throw error;
      // Discovery/download setup remains available. Admission still fails closed.
      snapshot.policy.accessMode = 'allowlist';
      snapshot.sendingAccessState = 'unavailable';
    }
  }
  return snapshot;
}
