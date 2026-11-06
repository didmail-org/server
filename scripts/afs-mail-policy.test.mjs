import test from 'node:test';
import assert from 'node:assert/strict';
import { fromRandom, WalletType } from '@ocap/wallet';
import { types } from '@ocap/mcrypto';
import { isValid } from '@arcblock/did';
import { randomUUID } from 'node:crypto';
import Provider from '../blocklet/providers/didmail-native/index.mjs';
import { MailPolicyStore, defaultPolicy, mailPolicyPath, canonicalMailDid } from '../blocklet/providers/didmail-native/mail-policy.mjs';

import { memoryPolicyRoot, initialPolicyState } from './afs-policy-fixture.mjs';
import { recoverAdmissions } from '../blocklet/providers/didmail-native/recover.mjs';

test('native DID checksums match the canonical dependency for all supported hash types', () => {
  for (const hash of Object.values(types.HashType)) {
    const address = fromRandom(WalletType({ hash })).address;
    assert.equal(isValid(address), true); assert.equal(canonicalMailDid('did:abt:' + address), 'did:abt:' + address);
    const invalid = address.slice(0, -1) + (address.endsWith('1') ? '2' : '1');
    assert.equal(isValid(invalid), false); assert.throws(() => canonicalMailDid('did:abt:' + invalid));
  }
});
test('policy/list/audit CAS is atomic; admission locks do not increment policy revision', async () => {
  const root = memoryPolicyRoot(), store = new MailPolicyStore(root), state = initialPolicyState();
  await store.initialize(state);
  await assert.rejects(store.initialize(state), { code: 'AFS_CONFLICT' });
  const actor = { did: 'did:test:admin', role: 'admin' }, did = 'did:abt:' + fromRandom().address;
  const results = await Promise.allSettled(['one', 'two'].map(remark => store.edit({ type: 'put', expectedRevision: 1, kind: 'deny', did, remark }, actor)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  let data = (await store.read()).state;
  assert.equal(data.revision, 2); assert.equal(data.entries.length, 1); assert.equal(data.audit.length, 1);
  const createdAt = data.entries[0].createdAt;
  const tokens = [randomUUID(), randomUUID()];
  await Promise.all(tokens.map(token => store.changeAdmission(token, 2, true)));
  data = (await store.read()).state;
  assert.equal(data.revision, 2); assert.equal(Object.keys(data.admissions).length, 2);
  await assert.rejects(store.edit({ type: 'delete', expectedRevision: 2, kind: 'deny', did }, actor), { code: 'MAIL_ADMISSION_BUSY' });
  await Promise.all(tokens.map(token => store.changeAdmission(token, undefined, false)));
  await store.edit({ type: 'put', expectedRevision: 2, kind: 'deny', did, remark: 'amended' }, actor);
  data = (await store.read()).state;
  assert.equal(data.entries[0].createdAt, createdAt); assert.equal(data.audit.length, 2);
  await assert.rejects(store.changeAdmission(randomUUID(), 2, true), { code: 'MAIL_POLICY_CONFLICT' });
});
test('native policy provider gates private data and never publishes access-list or audit fields', async () => {
  const root = memoryPolicyRoot(), store = new MailPolicyStore(root);
  await store.initialize(initialPolicyState('arc'));
  const provider = await Provider.load(); provider.onMount(root);
  const guest = { context: { caller: { role: 'guest' } } }, member = { context: { caller: { did: 'did:test:member', role: 'member' } } };
  for (const options of [guest, member]) {
    for (const path of ['/mail-policy.json', '/access-list.json', '/policy-audit.json']) await assert.rejects(provider.read(path, options), { code: 'AFS_FORBIDDEN' });
    await assert.rejects(provider.exec('/.actions/update-mail-policy', { expectedRevision: 1, policy: defaultPolicy(), caller: { role: 'admin' } }, options), { code: 'AFS_FORBIDDEN' });
  }
  const publicNode = (await provider.read('/mail-policy-public.json', guest)).data;
  assert.equal(publicNode.meta.version, undefined, 'admission-only file version changes are private');
  const publicPolicy = JSON.parse(publicNode.content);
  for (const field of ['entries', 'audit', 'admissions', 'updatedBy']) assert.equal(field in publicPolicy, false);
  const admin = { context: { caller: { did: 'did:test:admin', role: 'admin' } } };
  const policy = defaultPolicy(); policy.attachments.maxCount = 12;
  await provider.exec('/.actions/update-mail-policy', { expectedRevision: 1, policy }, admin);
  assert.equal(JSON.parse((await provider.read('/mail-policy.json', admin)).data.content).policy.attachments.maxCount, 12);
  await assert.rejects(store.edit({ type: 'put', expectedRevision: 2, kind: 'allow', did: 'did:abt:' + fromRandom().address, remark: '' }, admin.context.caller), { code: 'ARC_MEMBERS_MANAGED' });
});
test('recovery never releases an AFS lock when D1 revocation fails or is unknown', async () => {
  const token = randomUUID(), calls = [];
  const read = async () => ({ admissions: { [token]: { revision: 4, startedAt: '2026-01-01T00:00:00.000Z' } } });
  await assert.rejects(recoverAdmissions({ read, revoke: async () => { calls.push('revoke'); throw new Error('Unknown D1 result'); }, release: async () => calls.push('release') }));
  assert.deepEqual(calls, ['revoke']);
  calls.length = 0;
  await recoverAdmissions({ read, revoke: async () => calls.push('revoke'), release: async () => calls.push('release') });
  assert.deepEqual(calls, ['revoke', 'release']);
});
