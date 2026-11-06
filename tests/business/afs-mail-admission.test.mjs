import test from 'node:test';
import assert from 'node:assert/strict';
import { identityId, b64u, utf8, signRequest } from '@didmail/protocol';
import { toUint8Array } from '@ocap/util';
import { fromRandom } from '@ocap/wallet';
import { setup } from './mail-admission-fixture.mjs';
import { memoryPolicyRoot } from '../../scripts/afs-policy-fixture.mjs';
import { createMailPolicyBinding } from '../../scripts/arc-mail-policy-bridge.mjs';

async function removeLegacyPolicyTables(db) {
  for (const table of ['mail_access_entries', 'mail_policy_audit', 'mail_service_policy']) await db.prepare('DROP TABLE ' + table).run();
}
test('AFS policy/list/audit own admission with legacy D1 policy tables absent', { timeout: 60000 }, async () => {
  const f = await setup({ afsPolicy: true });
  try {
    await removeLegacyPolicyTables(f.db);
    assert.equal((await f.admin('mail-policy', 'GET', undefined, {})).status, 401);
    assert.equal((await f.admin('mail-policy', 'GET', undefined, { authorization: 'Bearer member' })).status, 403);
    const original = await f.snapshot();
    assert.equal((await f.admin('mail-policy', 'PUT', { expectedRevision: original.revision, policy: original.policy }, { cookie: 'session=admin', origin: 'https://attacker.test' })).status, 403);
    assert.equal((await f.update(p => { p.ordinary.baseFee = '01'; })).status, 400);
    assert.equal((await f.update(p => { p.accessMode = 'allowlist'; })).status, 200);
    assert.equal((await f.signed(f.alice, '/v1/sending-eligibility')).status, 403);
    await f.list('allow', identityId(f.alice.address), 'exact remark');
    const revision = (await f.snapshot()).revision;
    const edits = await Promise.all([f.list('deny', identityId(f.bob.address), 'blocked', 'PUT', revision), f.list('allow', identityId(f.bob.address), '', 'PUT', revision)]);
    assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]);
    const a = f.client(f.alice), b = f.client(f.bob); await a.connect(); await b.ownKey();
    const task = await a.create({ recipientId: identityId(f.bob.address), subject: 'AFS fixture', body: 'encrypted content', attachments: [{ fileName: 'fixture.bin', mediaType: 'application/octet-stream', bytes: new Uint8Array([1, 2, 3]) }] });
    const prepared = await a.prepare(task);
    const signed = b64u(utf8('signed:' + prepared.unsignedTransaction));
    await f.list('deny', identityId(f.alice.address), 'revoked before submit');
    await assert.rejects(a.submit(task, signed), e => e.problem.code === 'SENDER_NOT_ALLOWED');
    assert.equal((await f.db.prepare('SELECT accepted_at FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first()).accepted_at, null);
    await f.list('deny', identityId(f.alice.address), '', 'DELETE');
    await a.submit(task, signed);
    await f.list('deny', identityId(f.alice.address), 'no new sends');
    assert.equal((await a.submit(task, signed)).messageId, task.manifest.messageId, 'accepted retries keep original terms');
    for (let i = 0; i < 5; i++) await f.mf.dispatchFetch('https://admission.test/__dmp/step', { method: 'POST' });
    const received = await b.manifest(task.manifest.messageId);
    assert.equal((await b.document(received.manifest, received.receipt)).subject, 'AFS fixture');
    const state = (await f.policyStore.read()).state;
    assert.equal(state.audit.length, state.revision - 1);
    assert.equal(Object.keys(state.admissions).length, 0);
    assert.equal((await f.db.prepare('SELECT count(*) n FROM didmail_admission_fences WHERE open=1').first()).n, 0);
  } finally { await f.mf.dispose(); }
});
test('AFS edit after payment verification fences the original acceptance read', async () => {
  const f = await setup({ afsPolicy: true, denyOnVerify: true });
  try {
    await removeLegacyPolicyTables(f.db);
    const a = f.client(f.alice), b = f.client(f.bob); await a.connect(); await b.ownKey();
    const task = await a.create({ recipientId: identityId(f.bob.address), subject: 'race', body: 'fixture' });
    const prepared = await a.prepare(task);
    await assert.rejects(a.submit(task, b64u(utf8('signed:' + prepared.unsignedTransaction))), e => e.problem.code === 'MAIL_POLICY_CONFLICT');
    assert.deepEqual(await f.db.prepare('SELECT accepted_at,signed_payment FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first(), { accepted_at: null, signed_payment: null });
  } finally { await f.mf.dispose(); }
});
test('crash recovery fences a request paused before relational registration before allowing policy edits', async () => {
  const root = memoryPolicyRoot(), binding = createMailPolicyBinding(root);
  let release, observed;
  const paused = new Promise(resolve => { observed = resolve; });
  const resume = new Promise(resolve => { release = resolve; });
  let intercepted = false;
  const f = await setup({ afsPolicy: true, policyRoot: root, policyBinding: async request => {
    const body = await request.clone().json(); const response = await binding(request);
    if (body.op === 'begin' && !intercepted) { intercepted = true; observed(body.token); await resume; }
    return response;
  } });
  try {
    const a = f.client(f.alice), b = f.client(f.bob); await a.connect(); await b.ownKey();
    const task = await a.create({ recipientId: identityId(f.bob.address), subject: 'late worker', body: 'fixture' });
    const pending = a.prepare(task).then(value => ({ value }), error => ({ error }));
    const token = await paused;
    assert.equal((await f.update(p => { p.attachments.maxCount = 2; })).status, 503, 'active admission blocks policy edits');
    const recovery = await f.mf.dispatchFetch('https://admission.test/__afs/recover-admissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now: Date.now() + 61000 }) });
    assert.equal(recovery.status, 200);
    assert.equal((await f.db.prepare('SELECT open FROM didmail_admission_fences WHERE token=?').bind(token).first()).open, 0);
    assert.equal((await f.list('deny', identityId(f.alice.address), 'revoked during recovery')).status, 200);
    release(); const result = await pending; assert.ok(result.error);
    assert.equal((await f.db.prepare('SELECT count(*) n FROM dmp_messages').first()).n, 0, 'delayed old registration cannot reopen its fence');
    assert.equal((await f.db.prepare('SELECT open FROM didmail_admission_fences WHERE token=?').bind(token).first()).open, 0);
  } finally { release(); await f.mf.dispose(); }
});
test('AFS member delivery preserves recipient binding checks, deny priority and accepted downloads', async () => {
  const f = await setup({ afsPolicy: true, memberAccess: true });
  try {
    await removeLegacyPolicyTables(f.db);
    for (const wallet of [f.alice, f.bob]) await f.db.prepare("INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','fixture','fixture')").bind(identityId(fromRandom().address), identityId(wallet.address), 'fixture').run();
    const a = f.client(f.alice), b = f.client(f.bob); await a.connect(); await b.connect(); await b.ownKey();
    const task = await a.create({ recipientId: identityId(f.bob.address), planId: 'auto', subject: 'AFS member', body: 'fixture' });
    assert.equal((await a.prepare(task)).mode, 'server');
    await f.db.prepare('UPDATE account_links SET revoked=1,revision=revision+1 WHERE mailbox_id=?').bind(identityId(f.bob.address)).run();
    await assert.rejects(a.submit(task, ''), e => e.problem.code === 'DELIVERY_TERMS_CHANGED');
    await f.db.prepare('UPDATE account_links SET revoked=0,revision=revision+1 WHERE mailbox_id=?').bind(identityId(f.bob.address)).run();
    const fresh = await a.create({ recipientId: identityId(f.bob.address), planId: 'auto', subject: 'AFS accepted', body: 'fixture' });
    await a.prepare(fresh); await a.submit(fresh, '');
    await f.list('deny', identityId(f.bob.address), 'deny new internal sends');
    await f.mf.dispatchFetch('https://admission.test/__dmp/step', { method: 'POST' });
    const received = await b.manifest(fresh.manifest.messageId);
    assert.equal((await b.document(received.manifest, received.receipt)).subject, 'AFS accepted');
    assert.equal((await f.db.prepare('SELECT count(*) n FROM dmp_test_chain').first()).n, 0);
    const denied = await a.create({ recipientId: identityId(f.bob.address), planId: 'auto', subject: 'denied', body: 'fixture' });
    await assert.rejects(a.prepare(denied));
  } finally { await f.mf.dispose(); }
});
test('AFS chunk admission cleans rejected uploads and concurrent retries never delete the winning ciphertext', async () => {
  const root = memoryPolicyRoot(), binding = createMailPolicyBinding(root);
  let f, rejectChunk = true, begins = 0;
  f = await setup({ afsPolicy: true, policyRoot: root, policyBinding: async request => {
    const body = await request.clone().json();
    if (body.op === 'begin' && ++begins === 2 && rejectChunk) {
      const state = (await f.policyStore.read()).state;
      await f.policyStore.edit({ type: 'put', expectedRevision: state.revision, kind: 'deny', did: identityId(f.alice.address), remark: 'changed after R2 upload' }, { did: 'fixture-admin', role: 'admin' });
    }
    return binding(request);
  } });
  try {
    const a = f.client(f.alice), b = f.client(f.bob); await a.connect(); await b.ownKey();
    const rejected = await a.create({ recipientId: identityId(f.bob.address), subject: 'R2 race', body: 'fixture' });
    await assert.rejects(a.prepare(rejected), e => e.problem.code === 'MAIL_POLICY_CONFLICT');
    const bucket = f.blobs || await f.mf.getObjects('BLOBS');
    assert.equal((await bucket.list()).objects.length, 0, 'rejected gate does not leave the newly uploaded object');
    await f.list('deny', identityId(f.alice.address), '', 'DELETE'); rejectChunk = false;
    const task = await a.create({ recipientId: identityId(f.bob.address), subject: 'concurrent ciphertext', body: 'fixture' });
    await a.prepare(task);
    const chunk = await f.db.prepare('SELECT * FROM dmp_chunks WHERE message_id=?').bind(task.manifest.messageId).first();
    const bytes = new Uint8Array(await (await bucket.get(chunk.object_key)).arrayBuffer());
    await f.db.prepare('DELETE FROM dmp_chunks WHERE message_id=?').bind(task.manifest.messageId).run(); await bucket.delete(chunk.object_key);
    const url = `https://admission.test/v1/messages/${task.manifest.messageId}/blobs/${chunk.blob_id}/chunks/${chunk.chunk_index}`;
    const upload = () => f.mf.dispatchFetch(url, { method: 'PUT', headers: { ...signRequest('PUT', url, bytes, identityId(f.alice.address), toUint8Array(f.alice.secretKey)), 'content-type': 'application/octet-stream' }, body: bytes });
    assert.deepEqual((await Promise.all([upload(), upload()])).map(r => r.status), [200, 200]);
    const winner = await f.db.prepare('SELECT object_key FROM dmp_chunks WHERE message_id=?').bind(task.manifest.messageId).first();
    assert.deepEqual(new Uint8Array(await (await bucket.get(winner.object_key)).arrayBuffer()), bytes);
    assert.equal((await bucket.list()).objects.length, 1, 'only the winning immutable upload is retained');
  } finally { await f.mf.dispose(); }
});
test('a public sender cannot rebind to a denied ARC identity between AFS validation and relational commit', async () => {
  const root = memoryPolicyRoot(), binding = createMailPolicyBinding(root);
  let release, observed;
  const paused = new Promise(resolve => { observed = resolve; });
  const resume = new Promise(resolve => { release = resolve; });
  let intercept = true;
  const f = await setup({ afsPolicy: true, policyRoot: root, policyBinding: async request => {
    const body = await request.clone().json(), response = await binding(request);
    if (intercept && body.op === 'begin') { intercept = false; observed(); await resume; }
    return response;
  } });
  try {
    const oldArc = identityId(fromRandom().address), deniedArc = identityId(fromRandom().address);
    await f.db.prepare("INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','fixture','fixture')").bind(oldArc, identityId(f.alice.address), 'fixture').run();
    await f.list('deny', deniedArc, 'blocked ARC identity');
    const a = f.client(f.alice), b = f.client(f.bob); await a.connect(); await b.ownKey();
    const task = await a.create({ recipientId: identityId(f.bob.address), subject: 'binding race', body: 'fixture' });
    const pending = a.prepare(task).then(value => ({ value }), error => ({ error }));
    await paused;
    await f.db.prepare('UPDATE account_links SET arc_id=?,revision=revision+1 WHERE mailbox_id=?').bind(deniedArc, identityId(f.alice.address)).run();
    release(); const result = await pending;
    assert.equal(result.error?.problem.code, 'SENDER_NOT_ALLOWED');
    assert.equal((await f.db.prepare('SELECT count(*) n FROM dmp_messages').first()).n, 0);
  } finally { release(); await f.mf.dispose(); }
});
