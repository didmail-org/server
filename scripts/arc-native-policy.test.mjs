import test from 'node:test';
import assert from 'node:assert/strict';
import Provider from '../blocklet/providers/didmail-native/index.mjs';

const policy = { maxFileSizeBytes: 1024, maxFileCount: 3, pricePerBytePerDay: '10', updatedAt: '2026-11-03T00:00:00.000Z' };
const options = data => ({ context: { afs: { read: async () => ({ data: { content: data } }) } } });

test('native policy returns validated public fields from instance data', async () => {
  const provider = await Provider.load();
  const response = await provider.read('/attachment-config.json', options(JSON.stringify({ ...policy, privateField: 'hidden' })));
  assert.deepEqual(JSON.parse(response.data.content), policy);
  assert.equal(provider.write, undefined);
  const versioned = await provider.read('/attachment-config.json', { context: { afs: { read: async () => ({ data: { content: policy, meta: { version: 'v1' } } }) } } });
  assert.equal(versioned.data.meta.version, 'v1');
  await assert.rejects(provider.read('/unexpected', options(policy)), { code: 'AFS_NOT_FOUND' });
});

test('policy updates require an ARC administrator and conditional instance writes', async () => {
  const provider = await Provider.load();
  const path = '/.actions/update-attachment-config';
  const calls = [];
  const afs = {
    read: async (path) => path.endsWith('.capabilities')
      ? ({ data: { content: JSON.stringify({ operations: { write: { features: { ifMatch: true, treeIncrement: true } } } }) } })
      : ({ data: { content: JSON.stringify(policy), meta: { version: 'v1' } } }),
    write: async (...args) => { calls.push(args); },
  };
  provider.onMount(afs);
  const invoke = (caller, args = { version: 'v1', config: policy }, backend = afs) =>
    provider.exec(path, args, { context: { caller, afs: backend } });
  for (const caller of [undefined, { did: 'did:test:user', role: 'member' }, { role: 'admin' }]) {
    await assert.rejects(invoke(caller), { code: 'AFS_FORBIDDEN' });
  }
  await assert.rejects(invoke({ did: 'did:test:admin', role: 'admin' }, { config: policy }), { code: 'AFS_VALIDATION_ERROR' });
  await assert.rejects(invoke({ did: 'did:test:admin', role: 'admin' }, { version: 'v1', config: { ...policy, maxFileCount: 0 } }), { code: 'AFS_VALIDATION_ERROR' });
  await assert.rejects(invoke({ did: 'did:test:admin', role: 'admin' }, { version: 'v1', config: policy }, {
    ...afs, read: async () => ({ data: { content: '{}' } }),
  }), { code: 'AFS_NOT_SUPPORTED' });
  assert.equal(calls.length, 0);
  const result = await invoke({ did: 'did:test:admin', roles: ['admin'] });
  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/instance/app/didmail/public/attachment-config.json');
  assert.equal(calls[0][2].ifMatch, 'v1');
  const stored = JSON.parse(calls[0][1].content);
  assert.equal(stored.maxFileCount, policy.maxFileCount);
  assert.ok(!Number.isNaN(Date.parse(stored.updatedAt)));
  await assert.rejects(invoke({ did: 'did:test:owner', role: 'owner' }, { version: 'stale', config: policy }), { code: 'AFS_CONFLICT' });
  provider.onMount({ write: async () => { throw Object.assign(new Error('conflict'), { code: 'AFS_CONFLICT' }); } });
  await assert.rejects(invoke({ did: 'did:test:owner', role: 'owner' }, { version: 'v1', config: policy }), { code: 'AFS_CONFLICT' });
});

test('native policy rejects missing context and invalid data', async () => {
  const provider = await Provider.load();
  await assert.rejects(provider.read('/attachment-config.json'), { code: 'AFS_NOT_SUPPORTED' });
  for (const value of [null, '{', { ...policy, maxFileCount: 0 }, { ...policy, maxFileCount: Number.MAX_SAFE_INTEGER + 1 }, { ...policy, maxFileSizeBytes: 1.5 }, { ...policy, pricePerBytePerDay: '-1' }, { ...policy, pricePerBytePerDay: '' }, { ...policy, updatedAt: 'invalid' }]) {
    await assert.rejects(provider.read('/attachment-config.json', options(value)), { code: 'AFS_VALIDATION_ERROR' });
  }
  await assert.rejects(provider.read('/attachment-config.json', { context: { afs: { read: async () => { throw Object.assign(new Error('denied'), { code: 'AFS_FORBIDDEN' }); } } } }), { code: 'AFS_FORBIDDEN' });
});

test('native policy preserves prices beyond JavaScript integer precision', async () => {
  const provider = await Provider.load();
  const largePrice = '900719925474099312345';
  const response = await provider.read('/attachment-config.json', options({ ...policy, pricePerBytePerDay: largePrice }));
  assert.equal(JSON.parse(response.data.content).pricePerBytePerDay, largePrice);
});
