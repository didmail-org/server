// Experimental local ARC slice. The existing Worker remains the policy authority.
// The mutation action is not mounted in the production package.
const policyPath = '/instance/didmail/attachment-config.json';
const resource = '/attachment-config.json';
const action = '/.actions/update-attachment-config';
const meta = { capabilities: ['list', 'read', 'stat', 'explain'], accessMode: 'readonly' };
const actionMeta = { kind: 'afs:executable', kinds: ['afs:executable', 'afs:node'], name: 'update-attachment-config', effect: 'write', severity: 'ambient' };
const error = (code, message) => Object.assign(new Error(message), { code });
const notFound = path => error('AFS_NOT_FOUND', `DIDMail native resource not found: ${path}`);

function parsePolicy(content) {
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
  description = 'Experimental attachment policy backed by instance data';
  accessMode = 'readwrite';
  static async load() { return new DIDMailNativeProvider(); }
  onMount(root) { this.root = root; }

  async list(path) {
    if (path === '/.actions') return { data: [{ id: 'update-attachment-config', path: action, meta: actionMeta }] };
    if (path !== '/' && path !== resource) throw notFound(path);
    return { data: path === '/' ? [{ id: resource, path: resource, meta }, { id: '.actions', path: '/.actions', meta: { kind: 'afs:node' } }] : [] };
  }

  async stat(path) {
    if (path === action) return { data: { id: 'update-attachment-config', path, meta: actionMeta } };
    if (path === '/.actions') return { data: { id: '.actions', path, meta: { kind: 'afs:node', childrenCount: 1 } } };
    if (path !== '/' && path !== resource) throw notFound(path);
    return { data: { id: path, path, meta: { ...meta, ...(path === '/' ? { childrenCount: 2 } : { mimeType: 'application/json' }) } } };
  }

  async read(path, options) {
    if (path !== resource) throw notFound(path);
    const afs = options?.context?.afs;
    if (!afs || typeof afs.read !== 'function') throw error('AFS_NOT_SUPPORTED', 'Instance data is unavailable');
    const result = await afs.read(policyPath, { context: options.context });
    const content = JSON.stringify(parsePolicy(result?.data?.content));
    const version = result?.data?.meta?.version;
    return { data: { id: path, path, content, mimeType: 'application/json', meta: { ...meta, ...(typeof version === 'string' && version ? { version } : {}) } } };
  }

  async explain(path) {
    if (path !== '/' && path !== resource) throw notFound(path);
    return { data: 'Experimental attachment policy from the ARC instance. The update action requires an authorized caller and conditional writes. It is not the active Worker policy.' };
  }

  // Only call through an ARC runtime that stamps caller identity and applies
  // instance permissions. A role supplied in action arguments is never trusted.
  async exec(path, args, options) {
    if (path !== action) throw error('AFS_ACTION_NOT_FOUND', 'Unknown DIDMail action');
    const context = options?.context;
    const caller = context?.caller;
    const roles = [...(Array.isArray(caller?.roles) ? caller.roles : []), caller?.role];
    if (typeof caller?.did !== 'string' || !caller.did.trim() || !roles.some(role => role === 'owner' || role === 'admin'))
      throw error('AFS_FORBIDDEN', 'An authenticated owner or administrator is required');
    if (!args || typeof args.version !== 'string' || !args.version || args.version === '!absent' || !args.config || typeof args.config !== 'object')
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
    const current = await afs.read(policyPath, { context });
    parsePolicy(current?.data?.content);
    if (typeof current?.data?.meta?.version !== 'string' || current.data.meta.version !== args.version)
      throw error('AFS_CONFLICT', 'Policy version has changed or is unavailable');
    // ARC blocks network-origin base-space writes; after caller authorization,
    // use the runtime-provided internal AFS root, never a caller-supplied root.
    await this.root.write(policyPath, { content: JSON.stringify(policy) }, { ifMatch: args.version });
    return { success: true, data: policy };
  }
}
