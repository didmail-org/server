import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from './host/miniflare.mjs';
import { fromRandom, fromAddress, fromPublicKey, fromSecretKey, WalletType } from '@ocap/wallet';
import { toUint8Array } from '@ocap/util';
import { types } from '@ocap/mcrypto';
import { toStakeAddress } from '@arcblock/did-util';
import { DmpClient, identityId, addressOf, utf8, canonicalize, signRequest, b64u } from '@didmail/protocol';
import { memoryPolicyRoot, initialPolicyState } from '../../scripts/afs-policy-fixture.mjs';
import { MailPolicyStore } from '../../blocklet/providers/didmail-native/mail-policy.mjs';
import { createMailPolicyBinding } from '../../scripts/arc-mail-policy-bridge.mjs';
import { AfsObjectStore, AfsBusinessStore } from '../../scripts/afs-business-store.mjs';
import { businessDatabase, createStorageBinding } from '../../scripts/arc-storage-bridge.mjs';
import { memoryBusinessRoot } from '../../scripts/afs-business-fixture.mjs';
const origin = 'https://admission.test';
const match = (pk, did) => { try { const address = addressOf(did); return fromPublicKey(pk, fromAddress(address).type).address === address; } catch { return false; } };
export async function setup({ realGas = false, denyOnVerify = false, afsPolicy = false, policyRoot, policyBinding, memberAccess = false, afsStorage = true, businessRoot, storageBinding, businessTransactions } = {}) {
  const root = afsPolicy ? policyRoot || memoryPolicyRoot() : null;
  const policyStore = root ? new MailPolicyStore(root) : null;
  const application = fromSecretKey(fromRandom().secretKey, WalletType({ role: types.RoleType.ROLE_APPLICATION, pk: types.KeyType.ED25519, hash: types.HashType.SHA3 })), alice = fromRandom(), bob = fromRandom();
  const native = 'z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG';
  const owners = { [toStakeAddress(application.address, application.address)]: application.address, [toStakeAddress(alice.address, alice.address)]: alice.address };
  const arc = `let mode='ready';const owners=${JSON.stringify(owners)};export default {async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/member')return Response.json({did:new URL(request.url).searchParams.get('did'),instanceId:'fixture',role:'member',active:true});
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
  const dataRoot = afsStorage ? businessRoot || memoryBusinessRoot() : null;
  const dataStore = dataRoot ? new AfsBusinessStore(dataRoot) : null;
  if (dataStore) await dataStore.initialize({schemaVersion:1,schema:[],tables:{}});
  const mfOptions = convertV4MiniflareOptions({ workers: [
    { name: 'didmail', modules: true, scriptPath: 'artifacts/business-tests/test.mjs', compatibilityDate: '2026-10-24', compatibilityFlags: ['nodejs_compat'], bindings: { NODE_SECRET_KEY: application.secretKey, DIDMAIL_URL: origin, DMP_TEST_REAL_GAS: realGas ? '1' : '0', ...(afsStorage ? {DIDMAIL_STORAGE_BACKEND:'afs'} : {}), DMP_TEST_DENY_ON_VERIFY: denyOnVerify ? '1' : '0', LOCAL_TOKEN_ID: native, ...(afsPolicy ? {DIDMAIL_POLICY_BACKEND:'afs'} : {}), ...(memberAccess ? { DIDMAIL_ACCOUNT_LINKS_ENABLED:'1', DIDMAIL_ARC_INSTANCE_ID:'fixture', DIDMAIL_ACCOUNT_ORIGIN:origin, DIDMAIL_MEMBER_ACCESS:'arc' } : {}) }, ...(!afsStorage ? {databaseFixtures: { DB: 'admission' }, objectFixtures: { BLOBS: 'admission' }} : {}), serviceBindings: { ARC: 'arc', ARC_CHAIN: 'arc', ...(afsStorage ? {ARC_STORAGE:storageBinding || createStorageBinding(dataRoot)} : {}), ...(afsPolicy ? {ARC_MAIL_POLICY: policyBinding || createMailPolicyBinding(root)} : {}), ...(memberAccess ? {ARC_MEMBERS:'arc'} : {}) }, outboundService: 'deny' },
    { name: 'arc', modules: true, script: arc, compatibilityDate: '2026-10-24' },
    { name: 'deny', modules: true, script: `export default {fetch(){throw new Error('External traffic and broadcasts forbidden')}}`, compatibilityDate: '2026-10-24' },
  ] });
  let mf = new Miniflare(mfOptions);
  const db = dataStore ? businessDatabase(businessTransactions ? {transaction:businessTransactions} : dataStore) : await mf.getDatabase('DB');
  for (const file of (await fs.readdir('blocklet/providers/didmail-business/migrations')).sort())
    for (const sql of (await fs.readFile('blocklet/providers/didmail-business/migrations/' + file, 'utf8')).split(';').map(s => s.replace(/^--.*$/gm, '').trim()).filter(Boolean)) await db.prepare(sql).run();
  if (policyStore) await policyStore.initialize(initialPolicyState(memberAccess ? 'arc' : 'legacy'));
  await db.prepare('CREATE TABLE dmp_test_chain(hash TEXT PRIMARY KEY,broadcasts INTEGER NOT NULL)').run();
  const admin = (path, method = 'GET', body, headers = { authorization: 'Bearer admin' }) => mf.dispatchFetch(origin + '/api/admin/' + path, { method, headers: { 'content-type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const signed = (wallet, path, method = 'GET', input) => { const bytes = input === undefined ? new Uint8Array() : utf8(canonicalize(input)); return mf.dispatchFetch(origin + path, { method, headers: { ...signRequest(method, origin + path, bytes, identityId(wallet.address), toUint8Array(wallet.secretKey)), 'content-type': 'application/json' }, ...(method === 'GET' ? {} : { body: bytes }) }); };
  const client = wallet => new DmpClient({ endpoint: origin, identityId: identityId(wallet.address), secretKey: toUint8Array(wallet.secretKey), matches: match, pinService: async () => {}, store: { put: async () => {}, get: async () => {}, remove: async () => {} }, transport: async (url, method, headers, body) => { const r = await mf.dispatchFetch(url, { method, headers, ...(method === 'GET' ? {} : { body }) }); return { status: r.status, headers: r.headers, body: new Uint8Array(await r.arrayBuffer()) }; } });
  const snapshot = async () => (await admin('mail-policy')).json();
  const list = async (kind, did, remark = '', method = 'PUT', revision) => admin('mail-access-list', method, { expectedRevision: revision ?? (await snapshot()).revision, kind, did, ...(method === 'PUT' ? { remark } : {}) });
  const update = async modify => { const s = await snapshot(); modify(s.policy); return admin('mail-policy', 'PUT', { expectedRevision: s.revision, policy: s.policy }); };
  const objects = dataRoot ? new AfsObjectStore(dataRoot) : null;
  const blobs = objects ? { get: async key => { const value=(await objects.read(key)).value; return value && !value.deleted ? {arrayBuffer:async()=>Uint8Array.from(Buffer.from(value.bytes,'base64')).buffer} : null; }, delete:keys=>objects.delete(keys), list:async()=>({objects:[...dataRoot.nodes.values()].map(n=>JSON.parse(n.content)).filter(v=>v.key&&!v.deleted)}) } : null;
  return { get mf() {return mf;}, restart: async()=>{await mf.dispose();mf=new Miniflare(mfOptions);await mf.ready;}, db, dataStore, dataRoot, blobs, alice, bob, policyStore, policyRoot: root, admin, signed, client, snapshot, list, update, mode: async mode => (await mf.getWorker('arc')).fetch('https://arc/mode', { method: 'POST', body: mode }) };
}
