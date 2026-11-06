import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from './host/miniflare.mjs';
import {fromRandom,fromAddress,fromPublicKey} from '@ocap/wallet';
import {toUint8Array} from '@ocap/util';
import {DmpClient,b64u,utf8,unb64u,canonicalize,signRequest,identityId,addressOf,verifyArtifact,createKeyRecord,signArtifact,unsignedArtifact,sealMessage} from '@didmail/protocol';
const origin='https://dmp.test';
const match=(pk,did)=>{try{const address=addressOf(did);return fromPublicKey(pk,fromAddress(address).type).address===address;}catch{return false;}};
for(const confirmationPolicy of ['arcblock-committed','arcblock-dolt-ledger/1'])test(`DMP/1 HTTP fixture: ${confirmationPolicy}, E2EE, replay isolation and original payment recovery`,{timeout:60000},async()=>{
 const application=fromRandom(),alice=fromRandom(),bob=fromRandom(),mallory=fromRandom();
 const storage=await fs.mkdtemp(path.join(os.tmpdir(),'didmail-dmp-policy-'));
 const options=convertV4MiniflareOptions({modules:true,scriptPath:'artifacts/business-tests/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:application.secretKey,DIDMAIL_URL:origin,DMP_CONFIRMATION_POLICY:confirmationPolicy},databaseFixtures:{DB:'dmp-test'},objectFixtures:{BLOBS:'dmp-test'},resourcePersistencePath:storage,outboundService:()=>new Response('External chain forbidden',{status:502})});
 const mf=new Miniflare(options);
 try{
  let db=await mf.getDatabase('DB');for(const file of(await fs.readdir('blocklet/providers/didmail-business/migrations')).sort()){const sql=await fs.readFile('blocklet/providers/didmail-business/migrations/'+file,'utf8');for(const statement of sql.split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean))await db.prepare(statement).run();}
  await db.prepare('CREATE TABLE dmp_test_chain(hash TEXT PRIMARY KEY,broadcasts INTEGER NOT NULL)').run();
  const transport=async(url,method,headers,body)=>{const response=await mf.dispatchFetch(url,{method,headers,body:method==='GET'?undefined:body});return{status:response.status,headers:response.headers,body:new Uint8Array(await response.arrayBuffer())};};
  const clients=new Map();
  const make=w=>{const memory=new Map();const c=new DmpClient({endpoint:origin,identityId:identityId(w.address),secretKey:toUint8Array(w.secretKey),matches:match,pinService:async()=>{},store:{put:async task=>memory.set(task.manifest.messageId,structuredClone(task)),get:async id=>memory.get(id),remove:async id=>memory.delete(id)},transport});clients.set(w.address,c);return c;};
  const a=make(alice),b=make(bob),m=make(mallory);await a.connect();await b.ownKey();
  const file=new Uint8Array(27*1024).fill(77);const task=await a.create({recipientId:identityId(bob.address),subject:'秘密 Résumé 👋',body:'<p>End-to-end encrypted</p>',attachments:[{fileName:'私密.bin',mediaType:'application/octet-stream',bytes:file}]});
  // Both roles use the same chain nonce sequence, including reservations owned by contact recovery.
  await db.prepare("INSERT INTO dmp_wallet_lanes(chain_id,wallet_id,lane,message_id) VALUES('beta',?,'operator','contact:test-payer')").bind(identityId(alice.address)).run();
  await assert.rejects(()=>a.prepare(task),e=>e.problem.status===409&&e.problem.code==='PAYER_BUSY');
  await db.prepare("DELETE FROM dmp_wallet_lanes WHERE message_id='contact:test-payer'").run();
  const payment=await a.prepare(task);assert.ok(payment.unsignedTransaction);assert.equal(task.quote.totalAmount,'10000000000000000');assert.equal(task.quote.retention.mode,'indefinite');
  // Neither unauthenticated nor another identity may inspect a private pending task.
  assert.equal((await mf.dispatchFetch(origin+'/v1/messages/'+task.manifest.messageId+'/status')).status,401);
  await assert.rejects(()=>m.status(task.manifest.messageId),e=>e.problem.status===404);
  await assert.rejects(()=>b.manifest(task.manifest.messageId),e=>e.problem.status===404);
  const id=task.manifest.messageId,body=utf8(canonicalize({quoteId:task.quote.quoteId})),url=origin+`/v1/messages/${id}/prepare`;
  const headers={...signRequest('POST',url,body,identityId(alice.address),toUint8Array(alice.secretKey)),'content-type':'application/json'};
  assert.equal((await mf.dispatchFetch(url,{method:'POST',headers,body})).status,200);
  assert.equal((await mf.dispatchFetch(url,{method:'POST',headers,body})).status,409);
  // Replay protection and transaction idempotency have independent identities.
  const signed=b64u(utf8('signed:'+payment.unsignedTransaction));let status=await a.submit(task,signed);assert.ok(['queued','payment_pending'].includes(status.state));
  const again=await a.submit(task,signed);assert.equal(again.messageId,id);
  await assert.rejects(()=>a.submit(task,b64u(utf8('different-signed-transaction'))),e=>e.problem.status===409);
  if(confirmationPolicy==='arcblock-dolt-ledger/1'){
    await mf.setOptions({...options,workers:options.workers.map(worker=>({...worker,config:{...worker.config,env:{...worker.config.env,DMP_CONFIRMATION_POLICY:{type:'text',value:'arcblock-committed'}}}}))});
    db=await mf.getDatabase('DB');
  }
  await db.prepare("INSERT INTO dmp_wallet_lanes(chain_id,wallet_id,lane,message_id) VALUES('beta',?,'payer','contact:test-operator')").bind(task.manifest.serviceId).run();
  for(let i=0;i<4;i++)await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
  assert.equal((await a.status(id)).state,'payment_confirmed');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM dmp_test_chain').first()).n,1);
  await db.prepare("DELETE FROM dmp_wallet_lanes WHERE message_id='contact:test-operator'").run();
  for(let i=0;i<4;i++)await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
  status=await a.status(id);assert.equal(status.state,'delivered');assert.ok(status.receipt);assert.equal(status.receipt.retentionExpiresAt,null);
  for(const kind of ['payment','index'])if(confirmationPolicy==='arcblock-dolt-ledger/1'){
    assert.equal(status.receipt[kind].confirmationPolicy,confirmationPolicy);assert.equal(status.receipt[kind].ledgerBackend,'@ocap/statedb-dolt v1.20.2');assert.equal('blockHeight' in status.receipt[kind],false);
  }else assert.equal(status.receipt[kind].blockHeight,'123');
  assert.ok(verifyArtifact('DMP1-RECEIPT',status.receipt,status.receipt.serviceId,match));
  const broadcasts=await db.prepare('SELECT broadcasts FROM dmp_test_chain').all();assert.equal(broadcasts.results.length,2);assert.deepEqual(broadcasts.results.map(r=>r.broadcasts),[1,1]);
  const received=await b.manifest(id);const doc=await b.document(received.manifest,received.receipt);assert.equal(doc.subject,'秘密 Résumé 👋');assert.equal(doc.attachments[0].fileName,'私密.bin');assert.deepEqual(await b.blob(received.manifest,doc.attachments[0].blobId,received.receipt.acceptedAt),file);
  assert.equal((await b.list('inbox')).items.length,1);assert.equal((await m.list('inbox')).items.length,0);
  // Regression for the reported self-send: positive NFT payment, one recipient NFT,
  // retrievable ciphertext and idempotent retry; no real chain is contacted.
  const self=await a.create({recipientId:identityId(alice.address),subject:'NFT self-send',body:'Stored and downloadable'});
  const selfPayment=await a.prepare(self);assert.ok(BigInt(self.quote.totalAmount)>0n);
  const selfSigned=b64u(utf8('signed:'+selfPayment.unsignedTransaction));
  await a.submit(self,selfSigned);
  for(let i=0;i<8;i++)await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
  const selfStatus=await a.status(self.manifest.messageId);assert.equal(selfStatus.state,'delivered');
  assert.ok(selfStatus.receipt.index.assetId);
  const selfBundle=await a.manifest(self.manifest.messageId);
  assert.equal((await a.document(selfBundle.manifest,selfBundle.receipt)).body.text,'Stored and downloadable');
  assert.equal((await a.list('inbox')).items.filter(item=>item.manifest.messageId===self.manifest.messageId).length,1);
  await a.submit(self,selfSigned);
  for(let i=0;i<2;i++)await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
  const allBroadcasts=await db.prepare('SELECT broadcasts FROM dmp_test_chain').all();
  assert.equal(allBroadcasts.results.length,4);assert.ok(allBroadcasts.results.every(row=>row.broadcasts===1));
  // Accepted jobs are pinned even if their original unpaid-upload TTL is past.
  await db.prepare('UPDATE dmp_messages SET upload_expires_at=? WHERE id=?').bind('2000-01-01T00:00:00.000Z',id).run();await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});assert.equal((await b.manifest(id)).manifest.messageId,id);
  const unfinished=await a.create({recipientId:identityId(bob.address),subject:'abandoned',body:'unpaid'});await a.prepare(unfinished);const unpaidId=unfinished.manifest.messageId;await db.prepare('UPDATE dmp_messages SET upload_expires_at=? WHERE id=?').bind('2000-01-01T00:00:00.000Z',unpaidId).run();await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});assert.equal((await a.status(unpaidId)).state,'expired');assert.equal((await db.prepare('SELECT count(*) AS n FROM dmp_chunks WHERE message_id=?').bind(unpaidId).first()).n,0);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM dmp_test_chain').first()).n,4);
 }finally{await mf.dispose();await fs.rm(storage,{recursive:true,force:true});}
});

test('conflicting confirmation model retains original payment and cannot mint or report delivery',{timeout:60000},async()=>{
 const application=fromRandom(),sender=fromRandom();
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'artifacts/business-tests/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:application.secretKey,DIDMAIL_URL:origin,DMP_CONFIRMATION_POLICY:'arcblock-dolt-ledger/1',DMP_TEST_WRONG_EVIDENCE:'1'},databaseFixtures:{DB:'dmp-conflict'},objectFixtures:{BLOBS:'dmp-conflict'},outboundService:()=>new Response('External chain forbidden',{status:502})}));
 try{
  const db=await mf.getDatabase('DB');for(const file of(await fs.readdir('blocklet/providers/didmail-business/migrations')).sort())for(const statement of(await fs.readFile('blocklet/providers/didmail-business/migrations/'+file,'utf8')).split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean))await db.prepare(statement).run();
  await db.prepare('CREATE TABLE dmp_test_chain(hash TEXT PRIMARY KEY,broadcasts INTEGER NOT NULL)').run();
  const sdk=new DmpClient({endpoint:origin,identityId:identityId(sender.address),secretKey:toUint8Array(sender.secretKey),matches:match,pinService:async()=>{},store:{put:async()=>{},get:async()=>{},remove:async()=>{}},transport:async(url,method,headers,body)=>{const r=await mf.dispatchFetch(url,{method,headers,body:method==='GET'?undefined:body});return{status:r.status,headers:r.headers,body:new Uint8Array(await r.arrayBuffer())};}});
  const task=await sdk.create({recipientId:identityId(sender.address),subject:'Model conflict',body:'Retain original'});const request=await sdk.prepare(task),signed=b64u(utf8('signed:'+request.unsignedTransaction));await sdk.submit(task,signed);
  for(let i=0;i<3;i++)await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
  const status=await sdk.status(task.manifest.messageId);assert.equal(status.state,'reconciliation_required');assert.equal(status.problem.code,'RECONCILIATION_REQUIRED');assert.equal(status.receipt,undefined);
  const row=await db.prepare('SELECT signed_payment,signed_index,index_hash FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first();assert.equal(row.signed_payment,signed);assert.equal(row.signed_index,null);assert.equal(row.index_hash,null);
  const records=await db.prepare('SELECT broadcasts FROM dmp_test_chain').all();assert.equal(records.results.length,1);assert.equal(records.results[0].broadcasts,1);
 }finally{await mf.dispose();}
});

test('DMP key registration tolerates bounded device clock drift without extending expiry',{timeout:60000},async()=>{
 const application=fromRandom(),alice=fromRandom(),bob=fromRandom();
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'artifacts/business-tests/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:application.secretKey,DIDMAIL_URL:origin},databaseFixtures:{DB:'dmp-clock-test'},objectFixtures:{BLOBS:'dmp-clock-test'},outboundService:()=>new Response('External chain forbidden',{status:502})}));
 try{
  const db=await mf.getDatabase('DB');for(const file of(await fs.readdir('blocklet/providers/didmail-business/migrations')).sort()){const sql=await fs.readFile('blocklet/providers/didmail-business/migrations/'+file,'utf8');for(const statement of sql.split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean))await db.prepare(statement).run();}
  const request=async(wallet,path,value)=>{const body=utf8(canonicalize(value)),url=origin+path;return mf.dispatchFetch(url,{method:'PUT',headers:{...signRequest('PUT',url,body,identityId(wallet.address),toUint8Array(wallet.secretKey)),'content-type':'application/json'},body});};
  const put=(w,record)=>request(w,`/v1/identities/${encodeURIComponent(identityId(w.address))}/encryption-keys/${record.keyId}`,record);
  const now=Date.now(),record=createKeyRecord(identityId(alice.address),toUint8Array(alice.secretKey),new Date(now+15000));
  assert.equal((await put(alice,record)).status,201);
  assert.equal((await put(alice,record)).status,200);
  const recipient=createKeyRecord(identityId(bob.address),toUint8Array(bob.secretKey));assert.equal((await put(bob,recipient)).status,201);
  const discovery=await (await mf.dispatchFetch(origin+'/.well-known/didmail')).json();
  const sealed=sealMessage({senderId:identityId(alice.address),recipientId:identityId(bob.address),serviceId:discovery.serviceId,planId:'zPaidPlan',secretKey:toUint8Array(alice.secretKey),senderKey:record,recipientKey:recipient,subject:'Public clock fixture',body:'No payment',matches:match});
  const response=await request(alice,`/v1/messages/${sealed.manifest.messageId}`,sealed.manifest);assert.equal(response.status,201,await response.text());
  const far=fromRandom(),future=createKeyRecord(identityId(far.address),toUint8Array(far.secretKey),new Date(Date.now()+120000));assert.equal((await put(far,future)).status,400);
  const expired=fromRandom(),past=createKeyRecord(identityId(expired.address),toUint8Array(expired.secretKey),new Date(now-10000));const invalid=signArtifact('DMP1-KEY-RECORD',{...unsignedArtifact(past),expiresAt:new Date(now-1000).toISOString()},identityId(expired.address),toUint8Array(expired.secretKey));assert.equal((await put(expired,invalid)).status,400);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM dmp_keys').first()).n,2);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM dmp_messages WHERE accepted_at IS NOT NULL').first()).n,0);
 }finally{await mf.dispose();}
});
