import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from './host/miniflare.mjs';
import { fromRandom, fromAddress, fromPublicKey, fromSecretKey, WalletType } from '@ocap/wallet';
import { toUint8Array } from '@ocap/util';
import { types } from '@ocap/mcrypto';
import { toStakeAddress } from '@arcblock/did-util';
import { DmpClient, identityId, addressOf, utf8, canonicalize, signRequest, b64u } from '@didmail/protocol';
const origin = 'https://admission.test';
const match = (pk, did) => { try { const address = addressOf(did); return fromPublicKey(pk, fromAddress(address).type).address === address; } catch { return false; } };
import { setup } from './mail-admission-fixture.mjs';

test('sender-only access lists: admin CAS, CSRF, empty allowlist, upload limits and external recipient downloads', { timeout: 60000 }, async () => {
  const f = await setup();
  try {
    const { mf, db, alice, bob, admin, signed, client, snapshot, list, update } = f;
    assert.equal((await admin('mail-policy', 'GET', undefined, {})).status, 401);
    assert.equal((await admin('mail-policy', 'GET', undefined, { authorization: 'Bearer member' })).status, 403);
    const initial = await snapshot();
    assert.equal(initial.policy.ordinary.retentionDays, 10);
    assert.equal((await admin('mail-policy', 'PUT', { expectedRevision: initial.revision, policy: initial.policy }, { cookie: 'session=admin', origin: 'https://attacker.test' })).status, 403);
    assert.equal((await update(p => { p.ordinary.enabled = true; })).status, 409);
    assert.equal((await update(p => { p.ordinary.baseFee = '01'; })).status, 400);
    assert.equal((await update(p => { p.accessMode = 'allowlist'; })).status, 200);
    assert.equal((await signed(alice, '/v1/sending-eligibility')).status, 403);
    const a = client(alice), b = client(bob); await a.connect(); await b.ownKey();
    const task = await a.create({ recipientId: identityId(bob.address), subject: 'Cross-node semantics', body: 'External recipient is not a member', attachments: [{ fileName: 'private.bin', mediaType: 'application/octet-stream', bytes: new Uint8Array(100) }] });
    await assert.rejects(() => a.prepare(task), e => e.problem.code === 'SENDER_NOT_ALLOWED');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM dmp_messages').first()).n, 0);
    assert.equal((await list('allow', identityId(alice.address), 'employee')).status, 200);
    const first = await (await admin('mail-access-list?kind=allow&limit=1')).json();
    assert.equal(first.entries[0].remark, 'employee');
    await list('allow', identityId(alice.address), 'updated');
    const amended = await (await admin('mail-access-list?kind=allow')).json();
    assert.equal(amended.entries[0].createdAt, first.entries[0].createdAt);
    assert.equal(amended.entries[0].remark, 'updated');
    const s = await snapshot();
    const edits = await Promise.all([list('deny', identityId(alice.address), 'blocked', 'PUT', s.revision), list('allow', identityId(bob.address), '', 'PUT', s.revision)]);
    assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]);
    assert.equal((await list('deny', 'did:abt:not-a-real-address')).status, 400);
    await list('allow', identityId(bob.address), '', 'DELETE');
    await list('deny', identityId(alice.address), 'blocked');
    await assert.rejects(() => a.prepare(task), e => e.problem.code === 'SENDER_NOT_ALLOWED');
    await list('deny', identityId(alice.address), '', 'DELETE');
    await update(p => { p.attachments.enabled = false; });
    await assert.rejects(() => a.prepare(task), e => e.problem.code === 'ATTACHMENT_POLICY_EXCEEDED');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM dmp_chunks').first()).n, 0);
    await update(p => { p.attachments.enabled = true; p.attachments.maxFileBytes = 99; });
    await assert.rejects(() => a.prepare(task), e => e.problem.code === 'ATTACHMENT_POLICY_EXCEEDED');
    await update(p => { p.attachments.maxFileBytes = 100; });
    const payment = await a.prepare(task), signature = b64u(utf8('signed:' + payment.unsignedTransaction));
    await list('deny', identityId(alice.address), 'revoked before accept');
    await assert.rejects(() => a.submit(task, signature), e => e.problem.code === 'SENDER_NOT_ALLOWED');
    assert.equal((await db.prepare('SELECT accepted_at FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first()).accepted_at, null);
    await list('deny', identityId(alice.address), '', 'DELETE');
    await a.submit(task, signature);
    await list('deny', identityId(alice.address), 'no new sends');
    // Accepted retries bypass new sending permission, and original job can finish.
    assert.equal((await a.submit(task, signature)).messageId, task.manifest.messageId);
    for (let i = 0; i < 5; i++) await mf.dispatchFetch(origin + '/__dmp/step', { method: 'POST' });
    await list('deny', identityId(bob.address), 'receiver is not a service user');
    const received = await b.manifest(task.manifest.messageId);
    assert.equal((await b.document(received.manifest, received.receipt)).subject, 'Cross-node semantics');
    const actualMembers = await (await admin('mail-access-list?kind=allow')).json();
    assert.equal(actualMembers.entries.some(e => e.did === identityId(bob.address)), false);
    const stranger = client(fromRandom()); await assert.rejects(() => stranger.manifest(task.manifest.messageId), e => e.problem.status === 404);
    await list('allow', identityId(alice.address), '', 'DELETE');
    assert.equal((await snapshot()).policy.accessMode, 'allowlist');
    const policy = await (await signed(bob, '/v1/service-policy')).json();
    assert.equal(policy.sendingRestricted, true); assert.equal('ordinaryDeliveryAvailable' in policy, false); assert.equal('entries' in policy, false);
    assert.ok((await (await mf.dispatchFetch(origin + '/.well-known/didmail')).json()).features.includes('sender-allowlist'));
    // Expired mail is denied immediately, before any cleanup batch runs.
    await db.prepare('UPDATE dmp_messages SET retention_expires_at=? WHERE id=?').bind('2000-01-01T00:00:00.000Z', task.manifest.messageId).run();
    await assert.rejects(() => b.manifest(task.manifest.messageId), e => e.problem.status === 410);
    const count = await db.prepare('SELECT count(*) AS n FROM mail_policy_audit').first();
    assert.equal(count.n, (await snapshot()).revision - 1);
  } finally { await f.mf.dispose(); }
});

test('real admission gas reader: native self-stake, waiting withdrawals, exact threshold, higher chain minimum and fail closed', { timeout: 60000 }, async () => {
  const f = await setup({ realGas: true });
  try {
    const { alice, signed, client, db, mode } = f;
    for (const eligibleMode of ['ready', 'revoked', 'fraction']) {
      await mode(eligibleMode);
      const r = await signed(alice, '/v1/sending-eligibility'); assert.equal(r.status, 200, await r.clone().text());
      const result = await r.json(); assert.equal(result.policyRevision, (await db.prepare('SELECT revision FROM mail_service_policy WHERE id=1').first()).revision); assert.equal(result.gas.node.eligible, true); assert.equal(result.gas.sender.eligible, true);
      assert.equal(result.gas.minimumUnits, '1000000000000000000');
    }
    for (const ineligibleMode of ['higher', 'precision', 'missing', 'sender-missing']) {
      await mode(ineligibleMode);
      const r = await signed(alice, '/v1/sending-eligibility'); assert.equal(r.status, 200, await r.clone().text());
      assert.equal((await r.json()).gas.sender.eligible, false);
    }
    const a = client(alice); await mode('sender-missing');
    const task = await a.create({ recipientId: identityId(alice.address), subject: 'No unsafe gas fallback', body: 'No chain mutations' });
    await assert.rejects(() => a.prepare(task), e => e.problem.code === 'SENDER_GAS_STAKE_REQUIRED');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM dmp_messages').first()).n, 0);
    await mode('missing'); await assert.rejects(() => a.prepare(task), e => e.problem.code === 'NODE_GAS_STAKE_REQUIRED');
    for (const invalidMode of ['foreign', 'wrong-token', 'malformed', 'unavailable']) {
      await mode(invalidMode);
      assert.equal((await signed(alice, '/v1/sending-eligibility')).status, 503);
      await assert.rejects(() => a.prepare(task), e => e.problem.code === 'GAS_STAKE_UNAVAILABLE');
    }
    assert.equal((await db.prepare('SELECT count(*) AS n FROM dmp_test_chain').first()).n, 0);
  } finally { await f.mf.dispose(); }
});


test('an administrator denial racing payment verification cannot cross the atomic acceptance boundary', { timeout: 60000 }, async () => {
  const f = await setup({ denyOnVerify: true });
  try {
    const a = f.client(f.alice);
    await f.client(f.bob).ownKey();
    const task = await a.create({ recipientId: identityId(f.bob.address), subject: 'CAS boundary', body: 'Not accepted' });
    const request = await a.prepare(task);
    await assert.rejects(() => a.submit(task, b64u(utf8('signed:' + request.unsignedTransaction))), e => e.problem.status === 409 && e.problem.code === 'ACCEPTANCE_CONFLICT');
    const row = await f.db.prepare('SELECT accepted_at,signed_payment FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first();
    assert.equal(row.accepted_at, null); assert.equal(row.signed_payment, null);
    assert.equal((await f.db.prepare('SELECT count(*) AS n FROM dmp_test_chain').first()).n, 0);
  } finally { await f.mf.dispose(); }
});
