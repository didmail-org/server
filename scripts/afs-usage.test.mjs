import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryBusinessRoot } from './afs-business-fixture.mjs';
import { AfsBusinessStore, AfsObjectStore } from './afs-business-store.mjs';
import { createStorageOperations } from '../blocklet/providers/didmail-business/operations.mjs';
test('AFS usage reports UTF-8 metadata separately from ciphertext without changing state', async () => {
  const root = memoryBusinessRoot(),
    store = new AfsBusinessStore(root);
  await store.initialize({
    schemaVersion: 1,
    schema: [{ type: 'table', name: 'fixture', sql: 'CREATE TABLE fixture(value TEXT)' }],
    tables: { fixture: [{ value: '邮件 metadata' }] },
  });
  const before = await store.read(),
    op = createStorageOperations(root),
    usage = await op({ op: 'usage' });
  assert.equal(usage.basis, 'afs-json');
  assert.equal(usage.includesObjects, false);
  assert.equal(usage.sizeBytes, Buffer.byteLength(JSON.stringify(before.state), 'utf8'));
  await new AfsObjectStore(root).put('fixture/ciphertext', Buffer.alloc(100000));
  assert.deepEqual(await op({ op: 'usage' }), usage, 'Ciphertext is a separate storage category');
  const after = await store.read();
  assert.equal(after.version, before.version);
  assert.deepEqual(after.state, before.state);
});
