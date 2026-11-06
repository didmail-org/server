import { canonicalMailDid } from './did.mjs';
export { canonicalMailDid };
export const mailPolicyPath = '/instance/app/didmail/private/mail-policy.json';
export const failure = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
const fail = message => { throw failure('INVALID_MAIL_POLICY', message); };
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) fail('Unexpected policy fields: ' + (value && typeof value === 'object' ? Object.keys(value).join(', ') : 'object required'));
}
function integer(value, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) fail('Policy value is outside supported bounds'); }
export function validatePolicy(value) {
  object(value, ['accessMode', 'ordinary', 'attachments', 'maxMessageCiphertextBytes']);
  if (!['public', 'allowlist'].includes(value.accessMode)) fail('Invalid access mode');
  object(value.ordinary, ['enabled', 'baseFee', 'retentionDays', 'attachmentPricePerBytePerDay']);
  if (typeof value.ordinary.enabled !== 'boolean') fail('Invalid ordinary switch');
  for (const price of [value.ordinary.baseFee, value.ordinary.attachmentPricePerBytePerDay]) if (typeof price !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(price)) fail('Amounts must be canonical unsigned integer strings');
  integer(value.ordinary.retentionDays, 1, 36500);
  object(value.attachments, ['enabled', 'maxCount', 'maxFileBytes', 'maxTotalBytes']);
  if (typeof value.attachments.enabled !== 'boolean') fail('Invalid attachment switch');
  integer(value.attachments.maxCount, 0, 20);
  integer(value.attachments.maxFileBytes, 1, 67108864);
  integer(value.attachments.maxTotalBytes, 1, 67108864);
  if (value.attachments.maxFileBytes > value.attachments.maxTotalBytes) fail('Single-file limit exceeds total attachment limit');
  integer(value.maxMessageCiphertextBytes, 16, 67108864);
  if (BigInt(value.ordinary.baseFee) + BigInt(value.ordinary.attachmentPricePerBytePerDay) * BigInt(value.attachments.maxTotalBytes) * BigInt(value.ordinary.retentionDays) >= 2n ** 256n) fail('Maximum configured service fee exceeds chain amount bounds');
}
export const defaultPolicy = () => ({ accessMode: 'public', ordinary: { enabled: false, baseFee: '0', retentionDays: 10, attachmentPricePerBytePerDay: '0' }, attachments: { enabled: true, maxCount: 20, maxFileBytes: 33554432, maxTotalBytes: 62914560 }, maxMessageCiphertextBytes: 67108864 });
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const tokenValid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
export function validateState(value) {
  if (!value || value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1 || !['arc', 'legacy'].includes(value.accessSource) || !timestamp(value.updatedAt) || typeof value.updatedBy !== 'string' || !Array.isArray(value.entries) || !Array.isArray(value.audit) || !value.admissions || typeof value.admissions !== 'object' || Array.isArray(value.admissions)) throw failure('MAIL_POLICY_UNAVAILABLE', 'Invalid instance mail policy', 503);
  validatePolicy(value.policy);
  const seen = new Set();
  for (const entry of value.entries) {
    canonicalMailDid(entry.did);
    const key = entry.kind + ':' + entry.did;
    if (!['allow', 'deny'].includes(entry.kind) || typeof entry.remark !== 'string' || entry.remark.length > 500 || !timestamp(entry.createdAt) || typeof entry.createdBy !== 'string' || seen.has(key)) fail('Invalid access-list entry');
    seen.add(key);
  }
  const revisions = new Set();
  for (const entry of value.audit) {
    if (!Number.isSafeInteger(entry.revision) || entry.revision < 2 || entry.revision > value.revision || revisions.has(entry.revision) || typeof entry.actor !== 'string' || typeof entry.action !== 'string' || !(entry.target === null || typeof entry.target === 'string') || !timestamp(entry.createdAt)) fail('Invalid policy audit');
    revisions.add(entry.revision);
  }
  for (const [token, admission] of Object.entries(value.admissions)) if (!tokenValid(token) || admission.revision !== value.revision || !timestamp(admission.startedAt)) fail('Invalid admission lock');
  return value;
}
export const snapshotOf = state => ({ revision: state.revision, policy: structuredClone(state.policy), updatedAt: state.updatedAt, updatedBy: state.updatedBy, accessSource: state.accessSource });
export function deniedBy(state, ...identities) { return state.entries.some(entry => entry.kind === 'deny' && identities.includes(entry.did)); }
export function allowedBy(state, identity) { return !deniedBy(state, identity) && (state.policy.accessMode === 'public' || state.entries.some(entry => entry.kind === 'allow' && entry.did === identity)); }
export function requireAdmin(caller) {
  const roles = [...(Array.isArray(caller?.roles) ? caller.roles : []), caller?.role];
  if (typeof caller?.did !== 'string' || !caller.did.trim() || !roles.some(role => ['owner', 'admin'].includes(role))) throw failure('AFS_FORBIDDEN', 'An authenticated owner or administrator is required', 403);
}
export class MailPolicyStore {
  constructor(root) { this.root = root; }
  async read() {
    const result = await this.root.read(mailPolicyPath);
    const content = result?.data?.content;
    let state;
    try { state = validateState(typeof content === 'string' ? JSON.parse(content) : content); }
    catch { throw failure('MAIL_POLICY_UNAVAILABLE', 'Invalid instance mail policy', 503); }
    if (typeof result?.data?.meta?.version !== 'string') throw failure('AFS_NOT_SUPPORTED', 'Instance policy version unavailable', 503);
    return { state, version: result.data.meta.version };
  }
  async write(state, version) {
    const capabilities = await this.root.read('/instance/.meta/.capabilities');
    const content = capabilities?.data?.content;
    const caps = typeof content === 'string' ? JSON.parse(content) : content;
    const features = (caps?.operations ?? caps)?.write?.features;
    if (features?.ifMatch !== true || features?.treeIncrement !== true) throw failure('AFS_NOT_SUPPORTED', 'Instance conditional writes unavailable', 503);
    validateState(state);
    await this.root.write(mailPolicyPath, { content: JSON.stringify(state) }, { ifMatch: version });
  }
  async initialize(state) { validateState(state); await this.write(state, '!absent'); return snapshotOf(state); }
  async edit(args, caller) {
    requireAdmin(caller);
    const { state, version } = await this.read();
    if (!args || args.expectedRevision !== state.revision) throw failure('MAIL_POLICY_CONFLICT', 'Policy changed; reload before editing', 409);
    if (Object.keys(state.admissions).length) throw failure('MAIL_ADMISSION_BUSY', 'An admission transaction is pending; retry after recovery', 503);
    const now = new Date().toISOString();
    let action, target = null;
    if (args.type === 'policy') {
      object(args, ['type', 'expectedRevision', 'policy']); validatePolicy(args.policy);
      if (args.policy.ordinary.enabled) throw failure('INVALID_MAIL_POLICY', 'VC mail has been removed', 409);
      if (state.accessSource === 'arc' && args.policy.accessMode !== state.policy.accessMode) throw failure('ACCESS_MANAGED_BY_NODE_NFT', 'Sending access is determined by the service node NFT stake', 409);
      state.policy = structuredClone(args.policy); action = 'policy.update';
    } else {
      object(args, args.type === 'put' ? ['type', 'expectedRevision', 'kind', 'did', 'remark'] : ['type', 'expectedRevision', 'kind', 'did']);
      if (!['put', 'delete'].includes(args.type) || !['allow', 'deny'].includes(args.kind)) fail('Invalid access-list operation');
      canonicalMailDid(args.did);
      if (state.accessSource === 'arc' && args.type === 'put' && args.kind === 'allow') throw failure('ARC_MEMBERS_MANAGED', 'Manage members and invitations in ARC', 409);
      const current = state.entries.find(entry => entry.kind === args.kind && entry.did === args.did);
      if (args.type === 'put') {
        if (typeof args.remark !== 'string' || args.remark.length > 500) throw failure('INVALID_REMARK', 'Remark must be a string of at most 500 characters');
        if (current) current.remark = args.remark;
        else state.entries.push({ kind: args.kind, did: args.did, remark: args.remark, createdAt: now, createdBy: caller.did });
      } else state.entries = state.entries.filter(entry => !(entry.kind === args.kind && entry.did === args.did));
      action = 'list.' + args.type; target = args.kind + ':' + args.did;
    }
    state.revision++; state.updatedAt = now; state.updatedBy = caller.did;
    state.audit.push({ revision: state.revision, actor: caller.did, action, target, createdAt: now });
    await this.write(state, version); return { revision: state.revision };
  }
  async list({ kind, after = '', limit = 50 }) {
    if (!['allow', 'deny'].includes(kind) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw failure('INVALID_PAGINATION', 'Invalid access-list query');
    if (after) canonicalMailDid(after);
    const { state } = await this.read();
    const rows = state.entries.filter(entry => entry.kind === kind && entry.did > after).sort((a, b) => a.did < b.did ? -1 : a.did > b.did ? 1 : 0);
    return { revision: state.revision, kind, entries: rows.slice(0, limit).map(({ kind: _kind, ...entry }) => entry), nextCursor: rows.length > limit ? rows[limit - 1].did : null };
  }
  async changeAdmission(token, expectedRevision, add) {
    if (!tokenValid(token)) throw failure('INVALID_ADMISSION_TOKEN', 'Invalid admission token');
    for (let attempt = 0; attempt < 16; attempt++) {
      const { state, version } = await this.read();
      if (add) {
        if (state.revision !== expectedRevision) throw failure('MAIL_POLICY_CONFLICT', 'Policy changed before admission', 409);
        if (state.admissions[token]) return;
        state.admissions[token] = { revision: state.revision, startedAt: new Date().toISOString() };
      } else { if (!state.admissions[token]) return; delete state.admissions[token]; }
      try { await this.write(state, version); return; }
      catch (error) { if (error.code !== 'AFS_CONFLICT') throw error; }
    }
    throw failure('MAIL_ADMISSION_BUSY', 'Admission is busy; retry', 503);
  }
}
