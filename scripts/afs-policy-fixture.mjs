import assert from 'node:assert/strict';
import { mailPolicyPath, defaultPolicy } from '../blocklet/providers/didmail-native/mail-policy.mjs';
export function memoryPolicyRoot() {
  let content, version = 0;
  return {
    async read(path) {
      if (path.endsWith('.capabilities')) return { data: { content: { operations: { write: { features: { ifMatch: true, treeIncrement: true } } } } } };
      assert.equal(path, mailPolicyPath);
      if (!content) throw Object.assign(new Error('Not found'), { code: 'AFS_NOT_FOUND' });
      return { data: { content, meta: { version: String(version) } } };
    },
    async write(path, input, options) {
      assert.equal(path, mailPolicyPath);
      if (options.ifMatch !== (content ? String(version) : '!absent')) throw Object.assign(new Error('Conflict'), { code: 'AFS_CONFLICT' });
      content = input.content; version++;
    },
  };
}
export function initialPolicyState(accessSource = 'legacy') { return { schemaVersion: 1, revision: 1, policy: defaultPolicy(), updatedAt: new Date().toISOString(), updatedBy: 'migration', accessSource, entries: [], audit: [], admissions: {} }; }
