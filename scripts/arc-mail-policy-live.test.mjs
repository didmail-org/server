import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import WebSocket from 'ws';
import { identityId, b64u, utf8 } from '@didmail/protocol';
import { setup } from '../tests/business/mail-admission-fixture.mjs';
import { createMailPolicyBinding, localPolicyRoot } from './arc-mail-policy-bridge.mjs';
import { localBusinessRoot, businessDatabase, createNativeStorageBinding, createNativePolicyBinding, nativeStorageOperation } from './arc-storage-bridge.mjs';
import { AfsBusinessStore } from './afs-business-store.mjs';
import { createInstanceConfigClient } from '../ui/instance-config.js';

const enabled = process.env.DIDMAIL_ARC_PROVIDER_TEST === '1';
test('real ARC policy/list authority coordinates fenced business admission through crash/restart', { skip: !enabled, timeout: 180000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arc-mail-policy-'));
  const instance = 'arc-mail-policy-' + randomUUID();
  const app = path.join(directory, 'app');
  const run = promisify(execFile);
  const arc = (...args) => run('arc', args, { timeout: 45000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, AFS_TEST_ALLOW_CALLER_HEADER: '1' } });
  let started = false, f, port, release;
  const client = (role = 'admin') => createInstanceConfigClient({ origin: `http://127.0.0.1:${port}`, Socket: class extends WebSocket { constructor(url) { super(url, { headers: { 'x-caller-did': 'did:test:policy-admin', 'x-caller-role': role } }); } } });
  try {
    await arc('blocklet', 'create', app, '--recipe', 'minimal-app', '--name', 'didmail-server');
    await cp('blocklet/providers/didmail-native', path.join(app, 'providers/didmail-native'), { recursive: true });
    await cp('blocklet/providers/didmail-business', path.join(app, 'providers/didmail-business'), { recursive: true });
    await writeFile(path.join(app, 'blocklet.yaml'), 'specVersion: 2\nid: didmail-server\nname: DIDMail Policy Evidence\ndid: did:blocklet:didmail-server\nversion: 0.1.0\nscope: app\ninstance:\n  required: true\nmounts:\n  - target: ./providers/didmail-business\n    path: /didmail-business\n    required: true\n    ops: [list, read, stat, exec, explain]\n  - target: ./providers/didmail-native\n    path: /didmail-native\n    required: true\n    ops: [list, read, stat, explain, exec]\n');
    await arc('dsl', 'validate', app); await arc('blocklet', 'check', app); await arc('blocklet', 'build', app);
    started = true;
    const result = await arc('service', 'start', '--instance', instance, '--home', path.join(directory, 'home'), '--blocklet', app, '--port', '0', '--purpose', 'evidence', '--no-advertise', '--print', 'port');
    port = Number(result.stdout.trim().split('\n').at(-1)); assert.ok(port > 0);
    await new Promise((resolve, reject) => { http.get({ host: '127.0.0.1', port, path: '/', headers: { Host: 'didmail-server.localhost' } }, r => { r.resume(); r.on('end', resolve); }).on('error', reject); });
    const root = localPolicyRoot(`http://127.0.0.1:${port}`, { fetcher: (url, options) => fetch(`http://127.0.0.1:${port}${url.pathname}`, options) });
    const native=process.env.DIDMAIL_TEST_NATIVE_ARC_STORAGE==='1'?createNativeStorageBinding(`http://127.0.0.1:${port}`):null;
    const binding = native?createNativePolicyBinding(native):createMailPolicyBinding(root);
    let intercept = false, observed;
    const paused = new Promise(resolve => { observed = resolve; });
    const resume = new Promise(resolve => { release = resolve; });
    f = await setup({ ...(native?{storageBinding:native,businessTransactions:statements=>nativeStorageOperation(native,{op:'transaction',statements})}:{}), afsStorage: process.env.DIDMAIL_TEST_AFS_STORAGE === '1', businessRoot: localBusinessRoot(`http://127.0.0.1:${port}`), afsPolicy: true, policyRoot: root, policyBinding: async request => {
      const body = await request.clone().json(), response = await binding(request);
      if (intercept && body.op === 'begin') { intercept = false; observed(body.token); await resume; }
      return response;
    } });
    for (const table of ['mail_access_entries', 'mail_policy_audit', 'mail_service_policy']) await f.db.prepare('DROP TABLE ' + table).run();
    for (const role of ['member', 'guest']) {
      await assert.rejects(client(role).mailPolicy());
      await assert.rejects(client(role).editMailPolicy({ expectedRevision: 1, policy: (await f.snapshot()).policy }));
    }
    const initial = await client().mailPolicy();
    await assert.rejects(createInstanceConfigClient({ origin: `http://127.0.0.1:${port}`, Socket: class extends WebSocket { constructor(url) { super(url, { headers: { 'x-caller-did': 'did:test:policy-admin', 'x-caller-role': 'admin', Origin: 'https://attacker.invalid' } }); } } }).editMailPolicy({ expectedRevision: initial.revision, policy: initial.policy }));
    const rpc = body => new Promise((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port, path: '/api/afs/rpc', method: 'POST', headers: { Host: 'didmail-server.localhost', 'content-type': 'application/json' } }, response => { let text = ''; response.on('data', chunk => text += chunk); response.on('end', () => resolve(JSON.parse(text))); });
      request.on('error', reject); request.end(JSON.stringify(body));
    });
    assert.notEqual((await rpc({ type: 'read', path: '/instance/app/didmail/private/mail-policy.json' })).ok, true);
    if (process.env.DIDMAIL_TEST_AFS_STORAGE === '1') {
      const blocked = await rpc({type:'read',path:'/instance/app/didmail/private/business/state.json'});
      assert.notEqual(blocked.ok,true);assert.equal(blocked.data,undefined);
    }
    const publicData = JSON.parse((await rpc({ type: 'read', path: '/didmail-native/mail-policy-public.json' })).data.content);
    for (const field of ['entries', 'audit', 'admissions', 'updatedBy']) assert.equal(field in publicData, false);
    const edits = await Promise.allSettled([7, 8].map(maxCount => client().editMailPolicy({ expectedRevision: initial.revision, policy: { ...initial.policy, attachments: { ...initial.policy.attachments, maxCount } } })));
    assert.equal(edits.filter(result => result.status === 'fulfilled').length, 1, JSON.stringify(edits.map(result => result.status === 'rejected' ? { code: result.reason.code, message: result.reason.message } : { ok: true })));
    assert.equal((await f.policyStore.read()).state.audit.length, 1);
    const next = await client().mailPolicy();
    await client().updateAccessEntry({ expectedRevision: next.revision, kind: 'deny', did: identityId(f.bob.address), remark: 'private audit fixture' });
    const list = await client().accessList({ kind: 'deny', limit: 1 });
    assert.equal(list.entries[0].remark, 'private audit fixture');
    const a = f.client(f.alice), b = f.client(f.bob); await a.connect(); await b.ownKey();
    if (process.env.DIDMAIL_TEST_AFS_STORAGE === '1') {
      const peer=businessDatabase(new AfsBusinessStore(localBusinessRoot(`http://127.0.0.1:${port}`)));
      await f.db.prepare('CREATE TABLE afs_peer_fixture(n INTEGER NOT NULL)').run();await f.db.prepare('INSERT INTO afs_peer_fixture VALUES(0)').run();
      await Promise.all(Array.from({length:8},(_,i)=>(i%2?peer:f.db).prepare('UPDATE afs_peer_fixture SET n=n+1').run()));
      assert.equal((await f.db.prepare('SELECT n FROM afs_peer_fixture').first()).n,8);await f.db.prepare('DROP TABLE afs_peer_fixture').run();
      const attachment = new Uint8Array(1100000).map((_, i) => i % 251);
      const delivery = await a.create({recipientId:identityId(f.bob.address),subject:'AFS restart fixture',body:'Private encrypted fixture',attachments:[{fileName:'fixture.bin',mediaType:'application/octet-stream',bytes:attachment}]});
      const prepared = await a.prepare(delivery);
      await a.submit(delivery,b64u(utf8('signed:'+prepared.unsignedTransaction)));
      const accepted = await f.db.prepare('SELECT accepted_at,signed_payment FROM dmp_messages WHERE id=?').bind(delivery.manifest.messageId).first();
      assert.ok(accepted.accepted_at); assert.ok(accepted.signed_payment);
      await f.restart(); await arc('service','restart','--instance',instance,'--json');
      await new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port,path:'/',headers:{Host:'didmail-server.localhost'}},r=>{r.resume();r.on('end',resolve);}).on('error',reject);});
      assert.deepEqual(await f.db.prepare('SELECT accepted_at,signed_payment FROM dmp_messages WHERE id=?').bind(delivery.manifest.messageId).first(),accepted);
      for(let i=0;i<6;i++)await f.mf.dispatchFetch('https://admission.test/__dmp/step',{method:'POST'});
      const bundle=await b.manifest(delivery.manifest.messageId),doc=await b.document(bundle.manifest,bundle.receipt);
      assert.equal(doc.subject,'AFS restart fixture');
      assert.deepEqual(await b.blob(bundle.manifest,doc.attachments[0].blobId,bundle.receipt.acceptedAt),attachment);
      assert.equal((await f.db.prepare('SELECT count(*) n FROM dmp_test_chain WHERE broadcasts<>1').first()).n,0);
      assert.equal((await f.db.prepare("SELECT count(*) n FROM dmp_messages WHERE id=? AND state='delivered'").bind(delivery.manifest.messageId).first()).n,1);
      for(const name of ['DB','BLOBS'])await assert.rejects(name==='DB'?f.mf.getD1Database(name):f.mf.getR2Bucket(name));
    }

    const task = await a.create({ recipientId: identityId(f.bob.address), subject: 'real AFS fence', body: 'public synthetic fixture' });
    intercept = true;
    const pending = a.prepare(task).then(value => ({ value }), error => ({ error }));
    const token = await paused;
    const beforeRestart = await client().mailPolicy();
    await assert.rejects(client().editMailPolicy({ expectedRevision: beforeRestart.revision, policy: beforeRestart.policy }), 'policy cannot overtake a held admission');
    const restart = await arc('service', 'restart', '--instance', instance, '--print', 'port');
    port = Number(restart.stdout.trim().split('\n').at(-1)); assert.ok(port > 0);
    assert.deepEqual(await client().mailPolicy(), beforeRestart, 'policy and audit revision persist through ARC restart');
    assert.ok((await f.policyStore.read()).state.admissions[token], 'the unresolved admission survives restart');
    const recovery = await f.mf.dispatchFetch('https://admission.test/__afs/recover-admissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now: Date.now() + 61000 }) });
    assert.equal(recovery.status, 200);
    await client().updateAccessEntry({ expectedRevision: beforeRestart.revision, kind: 'deny', did: identityId(f.alice.address), remark: 'revoked after recovery' });
    release(); const late = await pending; assert.ok(late.error);
    assert.equal((await f.db.prepare("SELECT count(*) n FROM dmp_messages WHERE state<>'delivered'").first()).n, 0);
    assert.equal((await f.db.prepare('SELECT open FROM didmail_admission_fences WHERE token=?').bind(token).first()).open, 0);
    const snapshot = await client().mailPolicy();
    await f.mf.dispose(); f = null;
    await client().removeAccessEntry({ expectedRevision: snapshot.revision, kind: 'deny', did: identityId(list.entries[0].did) });
    assert.equal((await client().mailPolicy()).revision, snapshot.revision + 1, 'native policy/list edits continue with the business Worker stopped');
  } finally {
    release?.(); if (f) await f.mf.dispose();
    let safe = !started;
    if (started) { await arc('service', 'delete', '--instance', instance, '--force', '--yes'); safe = true; }
    if (safe) await rm(directory, { recursive: true, force: true });
  }
});
