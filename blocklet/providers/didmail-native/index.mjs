// Instance-backed attachment configuration. No business Worker is used here.
import { MailPolicyStore, snapshotOf, requireAdmin, defaultPolicy } from './mail-policy.mjs';
export const policyPath = '/instance/app/didmail/public/attachment-config.json';
const resource = '/attachment-config.json';
const action = '/.actions/update-attachment-config';
const initialize = '/.actions/initialize-attachment-config';
const policyResources = ['/mail-policy.json', '/access-list.json', '/policy-audit.json', '/mail-policy-public.json'];
const policyActions = ['update-mail-policy', 'update-access-entry', 'remove-access-entry', 'list-access-entries', 'initialize-mail-policy'];
const resources = [resource, '/session.json', ...policyResources];
const meta = { capabilities: ['list', 'read', 'stat', 'explain'], accessMode: 'readonly' };
const actionMeta = { kind: 'afs:executable', kinds: ['afs:executable', 'afs:node'], name: 'update-attachment-config', effect: 'write', severity: 'ambient' };
const error = (code, message) => Object.assign(new Error(message), { code });
const notFound = path => error('AFS_NOT_FOUND', `DIDMail native resource not found: ${path}`);

export function parsePolicy(content) {
  let value;
  try { value = typeof content === 'string' ? JSON.parse(content) : content; } catch { throw error('AFS_VALIDATION_ERROR', 'Invalid attachment policy'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Number.isSafeInteger(value.maxFileSizeBytes) || value.maxFileSizeBytes <= 0 ||
      !Number.isSafeInteger(value.maxFileCount) || value.maxFileCount <= 0 ||
      typeof value.pricePerBytePerDay !== 'string' || !/^\d+$/.test(value.pricePerBytePerDay) ||
      typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) {
    throw error('AFS_VALIDATION_ERROR', 'Invalid attachment policy');
  }
  return {
    maxFileSizeBytes: value.maxFileSizeBytes,
    maxFileCount: value.maxFileCount,
    pricePerBytePerDay: value.pricePerBytePerDay,
    updatedAt: value.updatedAt,
  };
}

export default class DIDMailNativeProvider {
  name = 'didmail-native';
  description = 'DIDMail instance configuration and verified caller session';
  accessMode = 'readwrite';
  static async load() { return new DIDMailNativeProvider(); }
  onMount(root) { this.root = root; }

  async list(path) {
    if (path === '/.actions') return { data: [action, initialize, ...policyActions.map(name => '/.actions/' + name)].map(path => ({ id: path.split('/').at(-1), path, meta: { ...actionMeta, name: path.split('/').at(-1), effect: path.endsWith('list-access-entries') ? 'read' : 'write' } })) };
    if (path !== '/' && !resources.includes(path)) throw notFound(path);
    return { data: path === '/' ? [...resources.map(path => ({ id: path, path, meta })), { id: '.actions', path: '/.actions', meta: { kind: 'afs:node' } }] : [] };
  }

  async stat(path) {
    if ([action, initialize, ...policyActions.map(name => '/.actions/' + name)].includes(path)) return { data: { id: path.split('/').at(-1), path, meta: { ...actionMeta, name: path.split('/').at(-1), effect: path.endsWith('list-access-entries') ? 'read' : 'write' } } };
    if (path === '/.actions') return { data: { id: '.actions', path, meta: { kind: 'afs:node', childrenCount: 2 + policyActions.length } } };
    if (path !== '/' && !resources.includes(path)) throw notFound(path);
    return { data: { id: path, path, meta: { ...meta, ...(path === '/' ? { childrenCount: resources.length + 1 } : { mimeType: 'application/json' }) } } };
  }

  async read(path, options) {
    if (policyResources.includes(path)) {
      if (path !== '/mail-policy-public.json') requireAdmin(options?.context?.caller);
      const { state, version } = await new MailPolicyStore(this.root).read();
      let data = path === '/access-list.json' ? { revision: state.revision, entries: state.entries } : path === '/policy-audit.json' ? state.audit : snapshotOf(state);
      if (path === '/mail-policy-public.json') { const { updatedBy: _actor, ...publicData } = data; data = publicData; }
      return { data: { id: path, path, content: JSON.stringify(data), mimeType: 'application/json', meta: { ...meta, ...(path === '/mail-policy-public.json' ? {} : { version }) } } };
    }
    if (path === '/session.json') {
      const caller = options?.context?.caller;
      const did = typeof caller?.did === 'string' && caller.did.trim() ? caller.did : null;
      const roles = [...(Array.isArray(caller?.roles) ? caller.roles : []), caller?.role];
      const role = ['owner', 'admin', 'member'].find(role => roles.includes(role)) || 'guest';
      const authenticated = Boolean(did && role !== 'guest');
      return { data: { id: path, path, content: JSON.stringify({ authenticated, user: authenticated ? { did, role, fullName: did } : null }), mimeType: 'application/json', meta } };
    }
    if (path !== resource) throw notFound(path);
    const afs = options?.context?.afs;
    if (!afs || typeof afs.read !== 'function') throw error('AFS_NOT_SUPPORTED', 'Instance data is unavailable');
    const result = await afs.read(policyPath, { context: options.context });
    const content = JSON.stringify(parsePolicy(result?.data?.content));
    const version = result?.data?.meta?.version;
    return { data: { id: path, path, content, mimeType: 'application/json', meta: { ...meta, ...(typeof version === 'string' && version ? { version } : {}) } } };
  }

  async explain(path) {
    if (path !== '/' && !resources.includes(path)) throw notFound(path);
    return { data: 'Attachment policy from the ARC instance. Public reads contain only validated policy fields. Updates require a verified ARC owner/admin and the current object version. No direct network writes or Worker fallback.' };
  }

  // Only call through an ARC runtime that stamps caller identity and applies
  // instance permissions. A role supplied in action arguments is never trusted.
  async exec(path, args, options) {
    if (policyActions.some(name => path === '/.actions/' + name)) {
      const caller = options?.context?.caller; requireAdmin(caller);
      // ARC injects _scope_afs into action arguments. Never treat an argument
      // (including a caller-supplied lookalike) as identity or an AFS capability.
      const { _scope_afs: _unusedScope, ...input } = args || {};
      args = input;
      if (Object.hasOwn(args, 'type')) throw error('AFS_VALIDATION_ERROR', 'Unexpected action field');
      const store = new MailPolicyStore(this.root);
      let data;
      if (path.endsWith('/initialize-mail-policy')) {
        if (!args || Object.keys(args).join(',') !== 'expectedVersion' || args.expectedVersion !== '!absent') throw error('AFS_VALIDATION_ERROR', 'Explicit conditional initialization required');
        data = await store.initialize({ schemaVersion: 1, revision: 1, policy: defaultPolicy(), updatedAt: new Date().toISOString(), updatedBy: caller.did, accessSource: 'arc', entries: [], audit: [], admissions: {} });
      } else if (path.endsWith('/list-access-entries')) data = await store.list(args);
      else data = await store.edit({ ...args, type: path.endsWith('/update-mail-policy') ? 'policy' : path.endsWith('/update-access-entry') ? 'put' : 'delete' }, caller);
      return { success: true, data };
    }
    if (![action, initialize].includes(path)) throw error('AFS_ACTION_NOT_FOUND', 'Unknown DIDMail action');
    const context = options?.context;
    const caller = context?.caller;
    const roles = [...(Array.isArray(caller?.roles) ? caller.roles : []), caller?.role];
    if (typeof caller?.did !== 'string' || !caller.did.trim() || !roles.some(role => role === 'owner' || role === 'admin'))
      throw error('AFS_FORBIDDEN', 'An authenticated owner or administrator is required');
    if (!args || typeof args.version !== 'string' || !args.version ||
        (path === initialize ? args.version !== '!absent' : args.version === '!absent') || !args.config || typeof args.config !== 'object')
      throw error('AFS_VALIDATION_ERROR', 'A policy and its current version are required');
    const afs = context?.afs;
    if (!afs || typeof afs.read !== 'function' || typeof this.root?.write !== 'function')
      throw error('AFS_NOT_SUPPORTED', 'Instance data is unavailable');
    const policy = parsePolicy({ ...args.config, updatedAt: new Date().toISOString() });
    let capabilities;
    try {
      const response = await afs.read('/instance/.meta/.capabilities', { context });
      const content = response?.data?.content;
      capabilities = typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
      throw error('AFS_NOT_SUPPORTED', 'Instance conditional writes are unavailable');
    }
    const features = (capabilities?.operations ?? capabilities)?.write?.features;
    if (features?.ifMatch !== true || features?.treeIncrement !== true)
      throw error('AFS_NOT_SUPPORTED', 'Instance conditional writes are unavailable');
    if (path !== initialize) {
      const current = await afs.read(policyPath, { context });
      parsePolicy(current?.data?.content);
      if (typeof current?.data?.meta?.version !== 'string' || current.data.meta.version !== args.version)
        throw error('AFS_CONFLICT', 'Policy version has changed or is unavailable');
    }
    // ARC blocks network-origin base-space writes; after caller authorization,
    // use the runtime-provided internal AFS root, never a caller-supplied root.
    await this.root.write(policyPath, { content: JSON.stringify(policy) }, { ifMatch: args.version });
    return { success: true, data: policy };
  }
}
