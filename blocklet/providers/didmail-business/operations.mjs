import { AfsBusinessStore, AfsObjectStore } from './store.mjs';
import { createPolicyOperations } from './policy-port.mjs';

// This port is private. Caller authorization belongs to its native provider or
// the existing trusted local Service Binding; it is never a public SQL endpoint.
export function createStorageOperations(root) {
  const store = new AfsBusinessStore(root),
    objects = new AfsObjectStore(root);
  const policy = createPolicyOperations(root);
  return async (input) => {
    if (input.op === 'usage') {
      const { state } = await store.read();
      return { sizeBytes: Buffer.byteLength(JSON.stringify(state), 'utf8'), basis: 'afs-json', includesObjects: false };
    }
    if (input.op === 'policy') return policy(input.operation);
    if (input.op === 'transaction') return store.transaction(input.statements);
    if (input.op === 'get' || input.op === 'head') {
      const value = (await objects.read(input.key)).value;
      return !value || value.deleted ? null : input.op === 'head' ? { ...value, bytes: undefined } : value;
    }
    if (input.op === 'put') {
      await store.capabilities();
      return objects.put(input.key, Buffer.from(input.bytes, 'base64'), input.httpMetadata);
    }
    if (input.op === 'delete') {
      await store.capabilities();
      await objects.delete(input.keys);
      return null;
    }
    throw Object.assign(new Error('Unsupported private operation'), { code: 'AFS_FORBIDDEN', status: 403 });
  };
}
export function storageFailure(error) {
  const constraint = /constraint failed|UNIQUE constraint/.test(error.message);
  return {
    code: error.code || 'AFS_STORAGE_UNAVAILABLE',
    status: constraint ? 409 : error.status || 503,
    error: constraint
      ? 'SQLite constraint failed: ' + (/UNIQUE/.test(error.message) ? 'UNIQUE constraint' : 'constraint')
      : 'Instance business storage unavailable',
  };
}
