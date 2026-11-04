import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fromRandom,fromPublicKey,fromAddress} from '@ocap/wallet';
import {toUint8Array} from '@ocap/util';
import {DmpClient,identityId,validateReceiptChainEvidence} from '@didmail/protocol';

test('zero member envelope mints one node-funded NFT without a sender payment; revoked bindings cannot submit',async()=>{
 const node=fromRandom(),alice=fromRandom(),bob=fromRandom(),arc=identityId(fromRandom().address),origin='https://sponsored.test';
 const options=convertV4MiniflareOptions({workers:[
 {name:'app',modules:true,scriptPath:'.worker/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:node.secretKey,DIDMAIL_URL:origin,DIDMAIL_ACCOUNT_LINKS_ENABLED:'1',DIDMAIL_ARC_INSTANCE_ID:'fixture',DIDMAIL_ACCOUNT_ORIGIN:origin,DMP_TEST_ENVELOPE_AMOUNT:'0',FACTORY_OWNER:'0x73AEAc8Be08298fD383152335A182E3e307Eb95a'},d1Databases:{DB:'sponsored'},r2Buckets:{BLOBS:'sponsored'},serviceBindings:{ARC_MEMBERS:'members'},outboundService:'deny'},
 {name:'members',modules:true,compatibilityDate:'2026-10-24',script:`export default{fetch(r){return Response.json({did:new URL(r.url).searchParams.get('did'),instanceId:'fixture',role:'member',active:true});}}`},
 {name:'deny',modules:true,compatibilityDate:'2026-10-24',script:`export default{fetch(){throw Error('Real chain forbidden');}}`}
 ]});const mf=new Miniflare(options);
 try{
 let db=await mf.getD1Database('DB');
 for(const file of(await fs.readdir('workers/migrations')).sort())for(const sql of(await fs.readFile('workers/migrations/'+file,'utf8')).split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare('CREATE TABLE dmp_test_chain(hash TEXT PRIMARY KEY,broadcasts INTEGER NOT NULL)').run();
 await db.prepare("INSERT INTO envelopes(address,name,price,token,retentionPeriod,enabled,category,createdAt,updatedAt) VALUES('zPaidPlan','Member','0','{}',0,1,'members','fixture','fixture')").run();
 await db.prepare("INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','fixture','fixture')").bind(arc,identityId(alice.address),'fixture').run();
 const client=wallet=>new DmpClient({endpoint:origin,identityId:identityId(wallet.address),secretKey:toUint8Array(wallet.secretKey),matches:(pk,did)=>fromPublicKey(pk,fromAddress(did.slice(8)).type).address===did.slice(8),pinService:async()=>{},store:{put:async()=>{},get:async()=>{},remove:async()=>{}},transport:async(url,method,headers,body)=>{const r=await mf.dispatchFetch(url,{method,headers,...(method==='GET'?{}:{body})});return{status:r.status,headers:r.headers,body:new Uint8Array(await r.arrayBuffer())};}});
 const sender=client(alice),recipient=client(bob);await sender.connect();await recipient.connect();await recipient.ownKey();
 const task=await sender.create({recipientId:identityId(bob.address),planId:'zPaidPlan',subject:'Fixture free NFT',body:'Fixture',attachments:[{fileName:'fixture.txt',mediaType:'text/plain',bytes:new Uint8Array([1,2,3])}]});
 const request=await sender.prepare(task);assert.equal(request.mode,'node-sponsored');assert.equal(request.unsignedTransaction,'');assert.equal(task.quote.totalAmount,'0');assert.ok(BigInt(task.quote.indexAmount)>0n);
 await assert.rejects(sender.submit(task,'unwanted-payment'),/must not include/);
 const first=await sender.submit(task,'');assert.ok(first.acceptedAt);await sender.submit(task,'');
 const deadline=Date.now()+3000;while(!(await db.prepare('SELECT count(*) AS n FROM dmp_test_chain').first()).n && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
 const beforeRestart=await db.prepare('SELECT signed_index,index_hash,state FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first();assert.ok(beforeRestart.signed_index);assert.equal(beforeRestart.state,'index_pending');
 await mf.setOptions({...options,workers:options.workers.map(worker=>({...worker,config:{...worker.config,env:{...worker.config.env,TEST_RESTART:{type:'text',value:'1'}}}}))});db=await mf.getD1Database('DB');
 assert.deepEqual(await db.prepare('SELECT signed_index,index_hash,state FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first(),beforeRestart,'Original signed mint survives a workerd restart');
 for(let i=0;i<4;i++)await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});
 const status=await sender.status(task.manifest.messageId);assert.equal(status.state,'delivered');assert.equal(status.payment,undefined);assert.equal(status.receipt.payment,undefined);assert.equal(status.receipt.funding.sponsorId,task.manifest.serviceId);validateReceiptChainEvidence(status.receipt,'beta');
 const saved=await db.prepare('SELECT signed_payment,payment_hash,signed_index,index_hash FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first();assert.equal(saved.signed_payment,null);assert.equal(saved.payment_hash,null);assert.ok(saved.signed_index);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM dmp_test_chain').first()).n,1,'Only the NFT mint is broadcast');
 const document=await recipient.document(task.manifest,status.receipt);assert.equal(document.subject,'Fixture free NFT');assert.deepEqual([...await recipient.blob(task.manifest,document.attachments[0].blobId,status.receipt.acceptedAt)],[1,2,3]);
 await mf.dispatchFetch(origin+'/__dmp/step',{method:'POST'});assert.deepEqual(await db.prepare('SELECT signed_payment,payment_hash,signed_index,index_hash FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first(),saved);
 const revoked=await sender.create({recipientId:identityId(bob.address),planId:'zPaidPlan',subject:'Revoked fixture',body:'Fixture'});await sender.prepare(revoked);await db.prepare('UPDATE account_links SET revoked=1,revision=2').run();await assert.rejects(sender.submit(revoked,''),error=>error.problem?.code==='ENVELOPE_MEMBER_REQUIRED');
 }finally{await mf.dispose();}
});
