import test from 'node:test';
import assert from 'node:assert/strict';
import { importAttachmentConfig } from './migrate-arc-config.mjs';

const policy = { maxFileSizeBytes: 10485760, maxFileCount: 5, pricePerBytePerDay: '900719925474099312345', updatedAt: '2026-11-05T00:00:00.000Z' };
test('configuration import preserves exact prices/timestamps and refuses an existing instance object', async () => {
  let stored;
  const arc = async args => {
    if (args[2].endsWith('.capabilities')) return { data: { content: { operations: { write: { features: { ifMatch: true, treeIncrement: true } } } } } };
    if (args[1] === 'write') {
      assert.equal(args[args.indexOf('--if-match') + 1], '!absent');
      assert.equal(args[args.indexOf('--mode') + 1], 'create');
      if (stored) throw Object.assign(new Error('Already exists'), { code: 'AFS_CONFLICT' });
      stored = args[args.indexOf('--content') + 1];
    }
    return { data: { content: stored } };
  };
  const options = { instance: 'fixture', sourceUrl: 'http://127.0.0.1:8788', arc, fetcher: async () => Response.json(policy) };
  assert.equal((await importAttachmentConfig(options)).imported, true);
  assert.deepEqual(JSON.parse(stored), policy);
  await assert.rejects(importAttachmentConfig(options), { code: 'AFS_CONFLICT' });
  assert.deepEqual(JSON.parse(stored), policy);
});
test('configuration import does not write when source or conditional-write capabilities are invalid', async () => {
  let writes = 0;
  const arc = async args => { if (args[1] === 'write') writes++; return { data: { content: {} } }; };
  for (const sourceUrl of ['https://example.com/', 'http://user:password@127.0.0.1/', 'http://127.0.0.1/private']) {
    await assert.rejects(importAttachmentConfig({ instance: 'fixture', sourceUrl, arc }));
  }
  for (const data of [{ ...policy, pricePerBytePerDay: 123 }, policy]) {
    await assert.rejects(importAttachmentConfig({ instance: 'fixture', sourceUrl: 'http://127.0.0.1/', arc, fetcher: async () => Response.json(data) }));
  }
  assert.equal(writes, 0);
});
