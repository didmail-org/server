import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fromRandom, fromAddress, fromPublicKey, fromSecretKey, WalletType } from '@ocap/wallet';
import { toUint8Array } from '@ocap/util';
import { types } from '@ocap/mcrypto';
import { toStakeAddress } from '@arcblock/did-util';
import { DmpClient, identityId, addressOf, utf8, canonicalize, signRequest, b64u } from '@didmail/protocol';
const origin = 'https://admission.test';
const match = (pk, did) => { try { const address = addressOf(did); return fromPublicKey(pk, fromAddress(address).type).address === address; } catch { return false; } };
async function setup({ realGas = false, denyOnVerify = false } = {}) {
  const application = fromSecretKey(fromRandom().secretKey, WalletType({ role: types.RoleType.ROLE_APPLICATION, pk: types.KeyType.ED25519, hash: types.HashType.SHA3 })), alice = fromRandom(), bob = fromRandom();
  const native = 'z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG';
  const owners = { [toStakeAddress(application.address, application.address)]: application.address, [toStakeAddress(alice.address, alice.address)]: alice.address };
  const arc = `let mode='ready';const owners=${JSON.stringify(owners)};export default {async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/mode'){mode=await request.text();return Response.json({ok:true});}
    if(path==='/.well-known/service/api/did/session'){const role=request.headers.get('authorization')?.replace('Bearer ','')||(request.headers.has('cookie')?'admin':'');return Response.json({authenticated:!!role,user:role?{did:'admin-did',role}:null});}
    if(path!=='/afs')return new Response('Unexpected network',{status:500});
    const {params}=await request.json(),p=params.path;
    if(mode==='unavailable')return new Response('offline',{status:503});
    if(p.endsWith('/.meta/.capabilities'))return Response.json({success:true,data:{data:{meta:{provenance:{provider:'ocap'}},content:{operations:{read:true,list:{supported:true}}}}}});
    const kind=p.endsWith('/config')?'config':p.split('/').at(-2),address=p.split('/').at(-1);
    let content=kind==='config'?{gasMinStake:mode==='higher'?2:mode==='fraction'?0.5:1,gasStakeLockPeriod:31536000}:kind==='tokens'?{address,symbol:'TBA',decimal:18}:null;
    if(kind==='stakes'){
      const owner=owners[address];
      if(!owner)return Response.json({success:false,error:{code:1,message:'not found'}});
      if(mode==='missing')return Response.json({success:false,error:{code:1,message:'not found'}});
      content={address,sender:owner,receiver:mode==='foreign'?'foreign':owner,nonce:'',revokeWaitingPeriod:31536000,assets:[],revokedAssets:[],tokens:[],revokedTokens:[]};
      const tokens=[{address:'${native}',value:mode==='precision'?'999999999999999999':mode==='malformed'?'1e18':'1000000000000000000'}];
      content[mode==='revoked'?'revokedTokens':'tokens']=tokens;
      if(mode==='wrong-token')content.tokens=[{address:'other-token',value:'1000000000000000000'}];
      if(mode==='sender-missing'&&owner==='${alice.address}')content.tokens=[];
    }
    return Response.json({success:true,data:{data:{path:p,content,meta:{kind:'ocap:'+(kind==='stakes'?'stake':kind==='tokens'?'token':'config'),provenance:{provider:'ocap'}}}}});
  }};`;
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [
    { name: 'didmail', modules: true, scriptPath: '.worker/test.mjs', compatibilityDate: '2026-10-24', compatibilityFlags: ['nodejs_compat'], bindings: { NODE_SECRET_KEY: application.secretKey, DIDMAIL_URL: origin, DMP_TEST_REAL_GAS: realGas ? '1' : '0', DMP_TEST_DENY_ON_VERIFY: denyOnVerify ? '1' : '0', LOCAL_TOKEN_ID: native }, d1Databases: { DB: 'admission' }, r2Buckets: { BLOBS: 'admission' }, serviceBindings: { ARC: 'arc', ARC_CHAIN: 'arc' }, outboundService: 'deny' },
    { name: 'arc', modules: true, script: arc, compatibilityDate: '2026-10-24' },
    { name: 'deny', modules: true, script: `export default {fetch(){throw new Error('External traffic and broadcasts forbidden')}}`, compatibilityDate: '2026-10-24' },
  ] }));
  const db = await mf.getD1Database('DB');
  for (const file of (await fs.readdir('workers/migrations')).sort())
    for (const sql of (await fs.readFile('workers/migrations/' + file, 'utf8')).split(';').map(s => s.replace(/^--.*$/gm, '').trim()).filter(Boolean)) await db.prepare(sql).run();
  await db.prepare('CREATE TABLE dmp_test_chain(hash TEXT PRIMARY KEY,broadcasts INTEGER NOT NULL)').run();
  const admin = (path, method = 'GET', body, headers = { authorization: 'Bearer admin' }) => mf.dispatchFetch(origin + '/api/admin/' + path, { method, headers: { 'content-type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const signed = (wallet, path, method = 'GET', input) => { const bytes = input === undefined ? new Uint8Array() : utf8(canonicalize(input)); return mf.dispatchFetch(origin + path, { method, headers: { ...signRequest(method, origin + path, bytes, identityId(wallet.address), toUint8Array(wallet.secretKey)), 'content-type': 'application/json' }, ...(method === 'GET' ? {} : { body: bytes }) }); };
  const client = wallet => new DmpClient({ endpoint: origin, identityId: identityId(wallet.address), secretKey: toUint8Array(wallet.secretKey), matches: match, pinService: async () => {}, store: { put: async () => {}, get: async () => {}, remove: async () => {} }, transport: async (url, method, headers, body) => { const r = await mf.dispatchFetch(url, { method, headers, ...(method === 'GET' ? {} : { body }) }); return { status: r.status, headers: r.headers, body: new Uint8Array(await r.arrayBuffer()) }; } });
  const snapshot = async () => (await admin('mail-policy')).json();
  const list = async (kind, did, remark = '', method = 'PUT', revision) => admin('mail-access-list', method, { expectedRevision: revision ?? (await snapshot()).revision, kind, did, ...(method === 'PUT' ? { remark } : {}) });
  const update = async modify => { const s = await snapshot(); modify(s.policy); return admin('mail-policy', 'PUT', { expectedRevision: s.revision, policy: s.policy }); };
  return { mf, db, alice, bob, admin, signed, client, snapshot, list, update, mode: async mode => (await mf.getWorker('arc')).fetch('https://arc/mode', { method: 'POST', body: mode }) };
}

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
