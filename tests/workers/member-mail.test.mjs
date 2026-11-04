import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fromRandom,fromPublicKey,fromAddress} from '@ocap/wallet';
import {toUint8Array} from '@ocap/util';
import {DmpClient,identityId,validateServerReceipt,canonicalize,utf8,signRequest} from '@didmail/protocol';

test('member direct storage: offline credential, separate inbox, restart, revocation and zero chain transactions',async()=>{
 const node=fromRandom(),alice=fromRandom(),bob=fromRandom(),arc=identityId(fromRandom().address),origin='https://sponsored.test';
 const options=convertV4MiniflareOptions({workers:[
 {name:'app',modules:true,scriptPath:'.worker/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:node.secretKey,DIDMAIL_URL:origin,DIDMAIL_ACCOUNT_LINKS_ENABLED:'1',DIDMAIL_ARC_INSTANCE_ID:'fixture',DIDMAIL_ACCOUNT_ORIGIN:origin,DMP_TEST_ENVELOPE_AMOUNT:'0',FACTORY_OWNER:'0x73AEAc8Be08298fD383152335A182E3e307Eb95a'},d1Databases:{DB:'sponsored'},r2Buckets:{BLOBS:'sponsored'},serviceBindings:{ARC_MEMBERS:'members'},outboundService:'deny'},
 {name:'members',modules:true,compatibilityDate:'2026-10-24',script:`let mode='member';export default{async fetch(r){if(new URL(r.url).pathname==='/mode'){mode=await r.text();return Response.json({ok:true});}if(mode==='unavailable')return new Response('offline',{status:503});return Response.json({did:new URL(r.url).searchParams.get('did'),instanceId:'fixture',role:mode==='guest'?'guest':'member',active:mode!=='disabled'});}}`},
 {name:'deny',modules:true,compatibilityDate:'2026-10-24',script:`export default{fetch(){throw Error('Real chain forbidden');}}`}
 ]});const mf=new Miniflare(options);
 try{
 let db=await mf.getD1Database('DB');
 for(const file of(await fs.readdir('workers/migrations')).sort())for(const sql of(await fs.readFile('workers/migrations/'+file,'utf8')).split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare('CREATE TABLE dmp_test_chain(hash TEXT PRIMARY KEY,broadcasts INTEGER NOT NULL)').run();
 await db.prepare("INSERT INTO envelopes(address,name,price,token,retentionPeriod,enabled,category,createdAt,updatedAt) VALUES('zPaidPlan','Member','0','{}',0,1,'members','fixture','fixture')").run();
 await db.prepare("INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','fixture','fixture')").bind(arc,identityId(alice.address),'fixture').run();
 const client=wallet=>new DmpClient({endpoint:origin,identityId:identityId(wallet.address),secretKey:toUint8Array(wallet.secretKey),matches:(pk,did)=>fromPublicKey(pk,fromAddress(did.slice(8)).type).address===did.slice(8),pinService:async()=>{},store:{put:async()=>{},get:async()=>{},remove:async()=>{}},transport:async(url,method,headers,body)=>{const r=await mf.dispatchFetch(url,{method,headers,...(method==='GET'?{}:{body})});return{status:r.status,headers:r.headers,body:new Uint8Array(await r.arrayBuffer())};}});
 await db.prepare("INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','fixture','fixture')").bind(identityId(fromRandom().address),identityId(bob.address),'fixture').run();
 const sender=client(alice),recipient=client(bob);await sender.connect();await recipient.connect();await recipient.ownKey();
 const task=await sender.create({recipientId:identityId(bob.address),planId:'auto',subject:'Private fixture',body:'Fixture',attachments:[{fileName:'fixture.txt',mediaType:'text/plain',bytes:new Uint8Array([1,2,3])}]});
 const request=await sender.prepare(task);assert.equal(request.mode,'server');assert.equal(task.quote.indexAmount,'0');assert.equal(task.quote.settlement.profile,'none');assert.equal(task.quote.funding,undefined);
 await assert.rejects(sender.submit(task,'unwanted-payment'),/must not include/);
 await sender.prepare(task);assert.equal((await db.prepare('SELECT count(*) n FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first()).n,1,'Repeated preparation preserves one original message');
 await Promise.all([sender.submit(task,''),sender.submit(task,'')]);
 for(let i=0;i<3;i++)await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
 const status=await sender.status(task.manifest.messageId);assert.equal(status.state,'delivered');validateServerReceipt(status.receipt,task.manifest,(pk,did)=>fromPublicKey(pk,fromAddress(did.slice(8)).type).address===did.slice(8));
 assert.equal(status.receipt.index,undefined);assert.equal(status.receipt.payment,undefined);assert.equal(status.receipt.funding,undefined);
 assert.equal((await recipient.list('inbox')).items.length,0);const page=await recipient.list('inbox','',50,'server');assert.equal(page.items.length,1);
 assert.equal((await db.prepare('SELECT count(*) n FROM dmp_internal_deliveries').first()).n,1);
 assert.equal((await db.prepare('SELECT count(*) n FROM dmp_test_chain').first()).n,0);
 assert.equal((await db.prepare('SELECT count(*) n FROM dmp_wallet_lanes').first()).n,0);
 assert.deepEqual(await db.prepare('SELECT signed_payment,payment_hash,signed_index,index_hash,asset_id FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first(),{signed_payment:null,payment_hash:null,signed_index:null,index_hash:null,asset_id:null});
 const document=await recipient.document(task.manifest,status.receipt);assert.equal(document.subject,'Private fixture');assert.deepEqual([...await recipient.blob(task.manifest,document.attachments[0].blobId,status.receipt.acceptedAt)],[1,2,3]);
 const bridge=await mf.getWorker('members');
 for(const mode of ['guest','disabled','unavailable']){
  await bridge.fetch('https://members/mode',{method:'POST',body:mode});
  const denied=await sender.create({recipientId:identityId(bob.address),planId:'auto',subject:'Denied fixture',body:'Fixture'});
  await assert.rejects(sender.prepare(denied),e=>e.problem?.code===(mode==='unavailable'?'MEMBERSHIP_UNAVAILABLE':'ENVELOPE_REQUIRED'));
 }
 await bridge.fetch('https://members/mode',{method:'POST',body:'member'});
 const big=await Promise.all([1,2].map(()=>sender.create({recipientId:identityId(bob.address),planId:'auto',subject:'Concurrent internal fixture',body:'X'.repeat(2500)})));
 const results=await Promise.allSettled(big.map(t=>sender.prepare(t)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2,'Concurrent internal uploads have no member storage quota');
 const revoked=await sender.create({recipientId:identityId(bob.address),planId:'auto',subject:'Revocation',body:'Fixture'});await sender.prepare(revoked);
 await db.prepare('UPDATE account_links SET revoked=1,revision=revision+1 WHERE mailbox_id=?').bind(identityId(bob.address)).run();
 await assert.rejects(sender.submit(revoked,''),e=>e.problem?.code==='DELIVERY_TERMS_CHANGED');
 await sender.submit(task,'');assert.equal((await recipient.list('inbox','',50,'server')).items.length,1,'Accepted history remains downloadable after revocation');
 await mf.setOptions({...options,workers:options.workers.map(worker=>({...worker,config:{...worker.config,env:{...worker.config.env,TEST_RESTART:{type:'text',value:'1'}}}}))});db=await mf.getD1Database('DB');
 assert.equal((await sender.status(task.manifest.messageId)).state,'delivered');assert.equal((await db.prepare('SELECT count(*) n FROM dmp_internal_deliveries').first()).n,1);
 assert.equal((await db.prepare('SELECT count(*) n FROM dmp_test_chain').first()).n,0);
 }finally{await mf.dispose();}
});

test('private member-only node sends without any node NFT factory, envelope or developer configuration',async()=>{
 const node=fromRandom(),alice=fromRandom(),bob=fromRandom(),arc=identityId(fromRandom().address),origin='https://sponsored.test';
 const options=convertV4MiniflareOptions({workers:[
 {name:'app',modules:true,scriptPath:'.worker/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:node.secretKey,DIDMAIL_URL:origin,DIDMAIL_ACCOUNT_LINKS_ENABLED:'1',DIDMAIL_ARC_INSTANCE_ID:'fixture',DIDMAIL_ACCOUNT_ORIGIN:origin,DMP_TEST_ENVELOPE_AMOUNT:'0',DIDMAIL_MEMBER_ACCESS:'arc'},d1Databases:{DB:'sponsored'},r2Buckets:{BLOBS:'sponsored'},serviceBindings:{ARC_MEMBERS:'members'},outboundService:'deny'},
 {name:'members',modules:true,compatibilityDate:'2026-10-24',script:`let mode='member';export default{async fetch(r){if(new URL(r.url).pathname==='/mode'){mode=await r.text();return Response.json({ok:true});}if(mode==='unavailable')return new Response('offline',{status:503});return Response.json({did:new URL(r.url).searchParams.get('did'),instanceId:'fixture',role:mode==='guest'?'guest':'member',active:mode!=='disabled'});}}`},
 {name:'deny',modules:true,compatibilityDate:'2026-10-24',script:`export default{fetch(){throw Error('Real chain forbidden');}}`}
 ]});const mf=new Miniflare(options);
 try{
 let db=await mf.getD1Database('DB');
 for(const file of(await fs.readdir('workers/migrations')).sort())for(const sql of(await fs.readFile('workers/migrations/'+file,'utf8')).split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare('CREATE TABLE dmp_test_chain(hash TEXT PRIMARY KEY,broadcasts INTEGER NOT NULL)').run();
 await db.prepare("INSERT INTO envelopes(address,name,price,token,retentionPeriod,enabled,category,createdAt,updatedAt) VALUES('zPaidPlan','Member','0','{}',0,1,'members','fixture','fixture')").run();
 await db.prepare("INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','fixture','fixture')").bind(arc,identityId(alice.address),'fixture').run();
 const client=wallet=>new DmpClient({endpoint:origin,identityId:identityId(wallet.address),secretKey:toUint8Array(wallet.secretKey),matches:(pk,did)=>fromPublicKey(pk,fromAddress(did.slice(8)).type).address===did.slice(8),pinService:async()=>{},store:{put:async()=>{},get:async()=>{},remove:async()=>{}},transport:async(url,method,headers,body)=>{const r=await mf.dispatchFetch(url,{method,headers,...(method==='GET'?{}:{body})});return{status:r.status,headers:r.headers,body:new Uint8Array(await r.arrayBuffer())};}});
 await db.prepare("INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','fixture','fixture')").bind(identityId(fromRandom().address),identityId(bob.address),'fixture').run();
 const sender=client(alice),recipient=client(bob);await sender.connect();await recipient.connect();await recipient.ownKey();
 await db.prepare("INSERT INTO envelopes(address,name,price,token,retentionPeriod,enabled,category,createdAt,updatedAt) VALUES('zPublicNoRPC','Cached public estimate','0.01','{}',30,1,'public','fixture','fixture')").run();
 const discovery=await mf.dispatchFetch(origin+'/__member-discovery');assert.equal(discovery.status,200);const summary=await discovery.json();assert.equal(summary.defaultPlan.planId,'zPublicNoRPC');assert.equal(summary.defaultPlan.envelopeAmount,'10000000000000000');assert.ok(summary.features.includes('server-mail'));
 await db.prepare('DELETE FROM envelopes').run();
 const task=await sender.create({recipientId:identityId(bob.address),planId:'auto',subject:'Private only fixture',body:'No NFT dependency'});
 assert.equal((await sender.prepare(task)).mode,'server');await sender.submit(task,'');
 await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
 assert.equal((await sender.status(task.manifest.messageId)).state,'delivered');
 assert.equal((await db.prepare('SELECT count(*) n FROM dmp_test_chain').first()).n,0);
 }finally{await mf.dispose();}
});

// Tiny obsolete deployment quotas must not restrict any internal path.
test('internal delivery has no count or storage quotas and keeps external upload admission isolated',async()=>{
 const node=fromRandom(),alice=fromRandom(),bob=fromRandom(),arc=identityId(fromRandom().address),origin='https://sponsored.test';
 const options=convertV4MiniflareOptions({workers:[
 {name:'app',modules:true,scriptPath:'.worker/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:node.secretKey,DIDMAIL_URL:origin,DIDMAIL_ACCOUNT_LINKS_ENABLED:'1',DIDMAIL_ARC_INSTANCE_ID:'fixture',DIDMAIL_ACCOUNT_ORIGIN:origin,DMP_TEST_ENVELOPE_AMOUNT:'0',DMP_INTERNAL_MEMBER_BYTES:'1',DMP_INTERNAL_NODE_BYTES:'1',DMP_INTERNAL_DAILY_MESSAGES:'1',FACTORY_OWNER:'0x73AEAc8Be08298fD383152335A182E3e307Eb95a'},d1Databases:{DB:'sponsored'},r2Buckets:{BLOBS:'sponsored'},serviceBindings:{ARC_MEMBERS:'members'},outboundService:'deny'},
 {name:'members',modules:true,compatibilityDate:'2026-10-24',script:`let mode='member';export default{async fetch(r){if(new URL(r.url).pathname==='/mode'){mode=await r.text();return Response.json({ok:true});}if(mode==='unavailable')return new Response('offline',{status:503});return Response.json({did:new URL(r.url).searchParams.get('did'),instanceId:'fixture',role:mode==='guest'?'guest':'member',active:mode!=='disabled'});}}`},
 {name:'deny',modules:true,compatibilityDate:'2026-10-24',script:`export default{fetch(){throw Error('Real chain forbidden');}}`}
 ]});const mf=new Miniflare(options);
 try{
 let db=await mf.getD1Database('DB');
 for(const file of(await fs.readdir('workers/migrations')).sort())for(const sql of(await fs.readFile('workers/migrations/'+file,'utf8')).split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare('CREATE TABLE dmp_test_chain(hash TEXT PRIMARY KEY,broadcasts INTEGER NOT NULL)').run();
 await db.prepare("INSERT INTO envelopes(address,name,price,token,retentionPeriod,enabled,category,createdAt,updatedAt) VALUES('zPaidPlan','Member','0','{}',0,1,'members','fixture','fixture')").run();
 await db.prepare("INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','fixture','fixture')").bind(arc,identityId(alice.address),'fixture').run();
 const client=wallet=>new DmpClient({endpoint:origin,identityId:identityId(wallet.address),secretKey:toUint8Array(wallet.secretKey),matches:(pk,did)=>fromPublicKey(pk,fromAddress(did.slice(8)).type).address===did.slice(8),pinService:async()=>{},store:{put:async()=>{},get:async()=>{},remove:async()=>{}},transport:async(url,method,headers,body)=>{const r=await mf.dispatchFetch(url,{method,headers,...(method==='GET'?{}:{body})});return{status:r.status,headers:r.headers,body:new Uint8Array(await r.arrayBuffer())};}});
 await db.prepare("INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','fixture','fixture')").bind(identityId(fromRandom().address),identityId(bob.address),'fixture').run();
 const sender=client(alice),recipient=client(bob);await sender.connect();await recipient.connect();await recipient.ownKey();

 const internal=[];
 for(let i=0;i<10;i++){
  const task=await sender.create({recipientId:identityId(bob.address),planId:'zPaidPlan',subject:`Unlimited internal ${i}`,body:'X'.repeat(2500)});
  assert.equal((await sender.prepare(task)).mode,'server');internal.push(task);
 }
 assert.equal((await db.prepare("SELECT count(*) n FROM dmp_messages WHERE delivery_kind='server' AND accepted_at IS NULL").first()).n,10,'Internal uploads have no pending-session cap');
 for(const task of internal.slice(0,2))await sender.submit(task,'');
 await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
 assert.equal((await recipient.list('inbox','',50,'server')).items.length,2,'Internal delivery has no daily cap');
 const refresh=async task=>{
  const status=await sender.status(task.manifest.messageId),url=origin+'/v1/messages/'+task.manifest.messageId+'/quotes';
  const body=utf8(canonicalize({expectedRevision:status.revision,previousQuoteId:task.quote.quoteId}));
  const response=await mf.dispatchFetch(url,{method:'POST',headers:{'content-type':'application/json',...signRequest('POST',url,body,identityId(alice.address),toUint8Array(alice.secretKey))},body});
  return {status:response.status,body:await response.json()};
 };
 await db.prepare('UPDATE account_links SET revoked=1,revision=revision+1 WHERE mailbox_id=?').bind(identityId(bob.address)).run();
 const external=[];
 for(let i=0;i<8;i++){
  const task=await sender.create({recipientId:identityId(bob.address),planId:'zPaidPlan',subject:`External ${i}`,body:'Fixture'});
  assert.equal((await sender.prepare(task)).mode,'node-sponsored');external.push(task);
 }
 const ninth=await sender.create({recipientId:identityId(bob.address),planId:'zPaidPlan',subject:'External quota',body:'Fixture'});
 await assert.rejects(sender.prepare(ninth),e=>e.problem?.code==='UPLOAD_QUOTA_EXCEEDED');
 const unchanged=await refresh(external[0]);assert.equal(unchanged.status,200,'Refreshing an existing external session does not count it twice');
 external[0].quote=unchanged.body.quote;
 await db.prepare('UPDATE account_links SET revoked=0,revision=revision+1 WHERE mailbox_id=?').bind(identityId(bob.address)).run();
 const converted=await refresh(external[0]);assert.equal(converted.status,200);assert.equal(converted.body.quote.delivery,'server','External-to-internal refresh has no internal quota');
 external[0].quote=converted.body.quote;
 await sender.prepare(external[0]);await sender.submit(external[0],'');
 await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
 assert.equal((await recipient.list('inbox','',50,'server')).items.length,3);
 await db.prepare('UPDATE account_links SET revoked=1,revision=revision+1 WHERE mailbox_id=?').bind(identityId(bob.address)).run();
 const lastExternalSlot=await refresh(internal[2]);assert.equal(lastExternalSlot.status,200);assert.notEqual(lastExternalSlot.body.quote.delivery,'server');
 const overExternalQuota=await refresh(internal[3]);assert.equal(overExternalQuota.status,409);assert.equal(overExternalQuota.body.code,'QUOTE_CONFLICT');
 assert.equal((await db.prepare('SELECT delivery_kind FROM dmp_messages WHERE id=?').bind(internal[3].manifest.messageId).first()).delivery_kind,'server','Failed conversion preserves the original internal terms');
 assert.equal((await db.prepare('SELECT count(*) n FROM dmp_test_chain').first()).n,0);
 assert.equal((await db.prepare('SELECT count(*) n FROM dmp_wallet_lanes').first()).n,0);
 }finally{await mf.dispose();}
});
