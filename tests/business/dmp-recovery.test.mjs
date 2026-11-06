import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare } from './host/miniflare.mjs';
import { fromRandom, fromPublicKey, fromAddress } from '@ocap/wallet';
import { toUint8Array } from '@ocap/util';
import { DmpClient, identityId, b64u, utf8 } from '@didmail/protocol';
import { storageOptions, storageDatabase } from './storage-fixture.mjs';

for (const model of ['arcblock-committed','arcblock-dolt-ledger/1']) {
 test(`rejected NFT is durably archived and retried without recharging (${model})`, {timeout:60000}, async () => {
  const operator=fromRandom(),sender=fromRandom(),origin='https://recovery.test';
  const options=await storageOptions({modules:true,scriptPath:'artifacts/business-tests/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:operator.secretKey,DIDMAIL_URL:origin,DMP_CONFIRMATION_POLICY:model,DMP_TEST_REJECT_FIRST_INDEX:'1'},databaseFixtures:{DB:'recovery'},objectFixtures:{BLOBS:'recovery'},outboundService:()=>{throw Error('Real chain forbidden');}});
  const mf=new Miniflare(options);
  try {
   let db=await storageDatabase(mf,options);
   for (const file of (await fs.readdir('blocklet/providers/didmail-business/migrations')).sort()) for (const sql of (await fs.readFile('blocklet/providers/didmail-business/migrations/'+file,'utf8')).split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean)) await db.prepare(sql).run();
   await db.prepare('CREATE TABLE dmp_test_chain(hash TEXT PRIMARY KEY,broadcasts INTEGER NOT NULL,rejected INTEGER DEFAULT 0)').run();
   const sdk=new DmpClient({endpoint:origin,identityId:identityId(sender.address),secretKey:toUint8Array(sender.secretKey),matches:(pk,did)=>fromPublicKey(pk,fromAddress(did.slice(8)).type).address===did.slice(8),pinService:async()=>{},store:{put:async()=>{},get:async()=>{},remove:async()=>{}},transport:async(url,method,headers,body)=>{const r=await mf.dispatchFetch(url,{method,headers,...(method==='GET'?{}:{body})});return{status:r.status,headers:r.headers,body:new Uint8Array(await r.arrayBuffer())};}});
   const task=await sdk.create({recipientId:identityId(sender.address),subject:'Recovery fixture',body:'No duplicate payment'}),id=task.manifest.messageId;
   const payment=await sdk.prepare(task),signed=b64u(utf8('signed:'+payment.unsignedTransaction));
   const waitInitial = async (messageId) => {
    for(let i=0;i<300;i++){
     const current=await db.prepare('SELECT last_problem_json,lease_owner FROM dmp_messages WHERE id=?').bind(messageId).first();
     if(current.last_problem_json && !current.lease_owner)return;
     await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.fail('Initial background job did not finish');
   };
   await sdk.submit(task,signed);await waitInitial(id);
   const step=()=>mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
   const read=()=>db.prepare('SELECT * FROM dmp_messages WHERE id=?').bind(id).first();
   for(let i=0;i<6 && (await read()).state!=='payment_confirmed';i++)await step();
   // A rejected mint is no longer a terminal reconciliation state.
   let row=await read();
   assert.equal(row.state,'payment_confirmed');assert.equal(row.index_hash,null);
   assert.equal(JSON.parse(row.last_problem_json).code,'INDEX_RETRY_SCHEDULED');
   const archived=await db.prepare('SELECT * FROM dmp_index_attempts WHERE message_id=?').bind(id).first();
   assert.ok(archived.signed_transaction);assert.equal(JSON.parse(archived.rejection_json).rejected,true);
   const originalPayment=row.signed_payment,paymentHash=row.payment_hash;
   assert.equal((await db.prepare('SELECT broadcasts FROM dmp_test_chain WHERE hash=?').bind(paymentHash).first()).broadcasts,1);
   // Restart the worker runtime: replacement must come from durable state.
   await mf.setOptions(options);db=await storageDatabase(mf,options);
   await step();row=await read();assert.equal(row.state,'index_pending');
   assert.notEqual(row.index_hash,archived.transaction_id);assert.notEqual(row.signed_index,archived.signed_transaction);
   assert.equal(row.signed_payment,originalPayment);assert.equal(row.payment_hash,paymentHash);
   const replacement=row.index_hash,bytes=row.signed_index;
   // Unknown outcome must reuse the same transaction across repeated scheduler runs.
   await db.prepare('UPDATE dmp_test_chain SET rejected=-1 WHERE hash=?').bind(replacement).run();
   for(let i=0;i<3;i++)await step();
   row=await read();assert.equal(row.index_hash,replacement);assert.equal(row.signed_index,bytes);
   assert.equal((await db.prepare('SELECT count(*) n FROM dmp_index_attempts').first()).n,1);
   await db.prepare('UPDATE dmp_test_chain SET rejected=0 WHERE hash=?').bind(replacement).run();
   await step();assert.equal((await sdk.status(id)).state,'delivered');
   await sdk.submit(task,signed);await step();
   assert.equal((await db.prepare('SELECT count(*) n FROM dmp_test_chain').first()).n,3);
   assert.equal((await db.prepare('SELECT broadcasts FROM dmp_test_chain WHERE hash=?').bind(paymentHash).first()).broadcasts,1);
   assert.equal((await db.prepare('SELECT count(*) n FROM dmp_wallet_lanes WHERE message_id=?').bind(id).first()).n,0);
   const conflicting=await sdk.create({recipientId:identityId(sender.address),subject:'Conflicting rejection',body:'Must retain the original NFT transaction'});
   const request=await sdk.prepare(conflicting);await sdk.submit(conflicting,b64u(utf8('signed:'+request.unsignedTransaction)));await waitInitial(conflicting.manifest.messageId);
   const other=()=>db.prepare('SELECT * FROM dmp_messages WHERE id=?').bind(conflicting.manifest.messageId).first();
   for(let i=0;i<4 && (await other()).state!=='index_pending';i++)await step();
   const saved=await other();assert.equal(saved.state,'index_pending');
   await db.prepare('UPDATE dmp_test_chain SET rejected=2 WHERE hash=?').bind(saved.index_hash).run();
   await step();const blocked=await other();assert.equal(blocked.state,'reconciliation_required');
   assert.equal(blocked.signed_index,saved.signed_index);assert.equal(blocked.index_hash,saved.index_hash);
   assert.equal((await db.prepare('SELECT count(*) n FROM dmp_index_attempts').first()).n,1);

  } finally { await mf.dispose(); }
 });
}
