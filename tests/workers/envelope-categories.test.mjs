import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fromRandom,fromPublicKey,fromAddress} from '@ocap/wallet';
import {toBase58,toUint8Array} from '@ocap/util';
import {DmpClient,signRequest,identityId,b64u,utf8} from '@didmail/protocol';

test('envelope categories require signed active membership and enforce authorization again before accepting payment',async()=>{
 const node=fromRandom(),alice=fromRandom(),bob=fromRandom(),arc=identityId(fromRandom().address),origin='https://categories.test',member='zPaidPlan';
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[
  {name:'app',modules:true,scriptPath:'.worker/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:node.secretKey,DIDMAIL_URL:origin,DIDMAIL_ACCOUNT_LINKS_ENABLED:'1',DIDMAIL_ARC_INSTANCE_ID:'fixture',DIDMAIL_ACCOUNT_ORIGIN:origin,FACTORY_OWNER:'0x73AEAc8Be08298fD383152335A182E3e307Eb95a'},d1Databases:{DB:'categories'},r2Buckets:{BLOBS:'categories'},serviceBindings:{ARC:'arc',ARC_MEMBERS:'members'},outboundService:'deny'},
  {name:'arc',modules:true,compatibilityDate:'2026-10-24',script:`export default{fetch(r){const role=r.headers.get('authorization')?.replace('Bearer ','');return Response.json({authenticated:!!role,user:role?{did:'fixture-admin',role}:null});}}`},
  {name:'members',modules:true,compatibilityDate:'2026-10-24',script:`let role='member';export default{async fetch(r){if(new URL(r.url).pathname==='/mode'){role=await r.text();return new Response('ok');}const u=new URL(r.url);return Response.json({did:u.searchParams.get('did'),instanceId:'fixture',role:role==='offline'?'member':role,active:role!=='offline'});}}`},
  {name:'deny',modules:true,compatibilityDate:'2026-10-24',script:`export default{fetch(){throw Error('External chain traffic forbidden');}}`}
 ]}));
 try{
  const db=await mf.getD1Database('DB');
  for(const file of(await fs.readdir('workers/migrations')).sort())for(const sql of(await fs.readFile('workers/migrations/'+file,'utf8')).split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean))await db.prepare(sql).run();
  const signed=(wallet,path)=>mf.dispatchFetch(origin+path,{headers:signRequest('GET',origin+path,new Uint8Array(),identityId(wallet.address),toUint8Array(wallet.secretKey))});
  const legacy=(wallet,path='/api/envelopes')=>mf.dispatchFetch(origin+path,{headers:{'x-didmail-did':wallet.address,'x-didmail-pk':toBase58(toUint8Array(wallet.publicKey))}});
  const insert=(id,category)=>db.prepare("INSERT INTO envelopes(address,name,price,token,retentionPeriod,enabled,category,createdAt,updatedAt) VALUES(?,?,?,'{}',10,1,?,'2026-10-30','2026-10-30')").bind(id,category+' fixture','0.01 TBA',category).run();
  await insert(member,'members');await insert('zPublicFixture','public');
  const update=(method,body,role='admin')=>mf.dispatchFetch(origin+'/api/envelope/db/update',{method,headers:{authorization:'Bearer '+role,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await update('PATCH',{address:member,category:'public'})).status,404,'Classification editing endpoint was removed');
  assert.equal((await update('POST',{address:member,category:'public'})).status,409,'Existing category cannot be changed');
  assert.equal((await update('POST',{address:'old-chain-envelope',category:'members'})).status,409,'Publishing an old envelope cannot assign member classification');
  assert.equal((await update('POST',{address:member,category:'members'},'member')).status,401);
  const publish={address:member,name:'Member fixture',price:'0.01 TBA',token:{},retentionPeriod:10,enabled:true};
  assert.equal((await update('POST',publish)).status,200,'Publication does not require editing category');
  assert.equal((await db.prepare('SELECT category FROM envelopes WHERE address=?').bind(member).first()).category,'members');
  assert.equal((await mf.dispatchFetch(origin+'/api/envelope/clean',{method:'DELETE',headers:{authorization:'Bearer admin'}})).status,200);
  assert.equal((await db.prepare('SELECT category FROM envelopes WHERE address=?').bind(member).first()).category,'members','Clearing publication settings retains immutable category');
  assert.equal((await db.prepare('SELECT enabled FROM envelopes WHERE address=?').bind(member).first()).enabled,0);
  assert.equal((await update('POST',publish)).status,200);
  await db.prepare("UPDATE envelopes SET enabled=1 WHERE address='zPublicFixture'").run();
  await db.prepare("INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','2026-10-30','2026-10-30')").bind(arc,identityId(alice.address),'fixture').run();
  assert.equal((await mf.dispatchFetch(origin+'/api/envelopes')).status,401);
  assert.equal((await(await legacy(alice)).json()).envelopes.length,1,'Public DID+PK cannot prove membership');
  let response=await(await signed(alice,'/api/envelopes')).json();assert.equal(response.member,true);assert.equal(response.envelopes.length,2);assert.equal(response.defaultEnvelope.category,'members');

  await db.prepare("INSERT INTO namecards(address,price,token,enabled,category,createdAt,updatedAt) VALUES('member-card','0.01 TBA','{}',1,'members','fixture','fixture'),('public-card','0.01 TBA','{}',1,'public','fixture','fixture')").run();
  assert.equal((await(await legacy(alice,'/api/namecards')).json()).namecards.length,1);
  assert.equal((await(await legacy(alice,'/api/NAMECARDS/')).json()).namecards.length,1,'Alternative route casing cannot reveal member templates');
  assert.equal((await(await signed(alice,'/api/namecards')).json()).namecards.length,2);
  assert.equal((await(await signed(bob,'/api/namecards')).json()).namecards.length,1);
  const cardPost=async(wallet,path,body,proof=true)=>{const bytes=utf8(JSON.stringify(body));return mf.dispatchFetch(origin+path,{method:'POST',body:bytes,headers:{'content-type':'application/json','x-didmail-did':wallet.address,'x-didmail-pk':toBase58(toUint8Array(wallet.publicKey)),...(proof?signRequest('POST',origin+path,bytes,identityId(wallet.address),toUint8Array(wallet.secretKey)): {})}});};
  assert.equal((await cardPost(alice,'/api/contact/send',{namecard:'public-card',contact:'x'.repeat(1024*1024)},false)).status,413,'Contact gate bounds anonymous JSON before parsing');
  const oversizedStream = new ReadableStream({start(controller){controller.enqueue(utf8('{"namecard":"public-card","contact":"'));controller.enqueue(new Uint8Array(1024*1024+1).fill(120));controller.enqueue(utf8('"}'));controller.close();}});
  assert.equal((await mf.dispatchFetch(origin+'/api/contact/send',{method:'POST',headers:{'content-type':'application/json'},body:oversizedStream,duplex:'half',signal:AbortSignal.timeout(5000)})).status,413,'Chunked body limits do not wait for the unread original request branch');
  assert.equal((await cardPost(alice,'/api/contact/send',{namecard:'member-card'},false)).status,403,'Public DID headers cannot use a member card');
  assert.equal((await cardPost(bob,'/api/CONTACT/SEND/',{namecard:'member-card'})).status,403,'Outsider blocked before any chain call');
  assert.equal((await(await cardPost(alice,'/__namecard-access/send',{namecard:'member-card'})).json()).allowed,true);
  await db.prepare("INSERT INTO contacts(sender,receiver,contact,namecard,hash,size,payment,credit,dividend,createdAt,updatedAt) VALUES(?,?,'fixture','member-card','card-hash',1,0.01,0.01,0,'fixture','fixture')").bind(alice.address,bob.address).run();
  const cardContact=await db.prepare("SELECT id FROM contacts WHERE hash='card-hash'").first();
  const categoryUpdate=await mf.dispatchFetch(origin+'/api/namecard/db/update',{method:'POST',headers:{authorization:'Bearer admin','content-type':'application/json'},body:JSON.stringify({address:'member-card',category:'public'})});assert.equal(categoryUpdate.status,409);
  assert.equal((await(await signed(bob,'/api/envelopes')).json()).envelopes.length,1);
  const invalid=signRequest('GET',origin+'/api/envelopes',new Uint8Array(),identityId(alice.address),toUint8Array(alice.secretKey));invalid.signature='dmp=:AAAA:';
  assert.equal((await mf.dispatchFetch(origin+'/api/envelopes',{headers:invalid})).status,401);
  const bridge=await mf.getWorker('members');await bridge.fetch('https://members/mode',{method:'POST',body:'guest'});
  assert.equal((await(await signed(alice,'/api/envelopes')).json()).member,false);
  await bridge.fetch('https://members/mode',{method:'POST',body:'member'});
  const admitted=await(await mf.dispatchFetch(origin+'/__envelope-admission',{method:'POST',body:JSON.stringify({planId:member,sender:identityId(alice.address)})})).json();
  assert.ok(await db.prepare('SELECT 1 AS ok WHERE '+admitted.sql).bind(...admitted.values).first());
  await db.prepare('UPDATE account_links SET revoked=1,revision=2 WHERE arc_id=?').bind(arc).run();
  assert.equal(await db.prepare('SELECT 1 AS ok WHERE '+admitted.sql).bind(...admitted.values).first(),null,'Revocation invalidates the acceptance predicate');
  assert.equal((await(await signed(alice,'/api/namecards')).json()).namecards.length,1);
  assert.equal((await cardPost(alice,'/api/contact/send/sign',{id:cardContact.id,hash:'card-hash'})).status,403,'Revoked member blocked at payment signature submission');
  assert.equal((await(await signed(alice,'/api/envelopes')).json()).member,false);
  await db.prepare('UPDATE account_links SET revoked=0,revision=3 WHERE arc_id=?').bind(arc).run();
  const makeClient=wallet=>new DmpClient({endpoint:origin,identityId:identityId(wallet.address),secretKey:toUint8Array(wallet.secretKey),matches:(pk,did)=>fromPublicKey(pk,fromAddress(did.slice(8)).type).address===did.slice(8),pinService:async()=>{},store:{put:async()=>{},get:async()=>{},remove:async()=>{}},transport:async(url,method,headers,body)=>{const r=await mf.dispatchFetch(url,{method,headers,...(method==='GET'?{}:{body})});if(url.endsWith('/.well-known/didmail')){const d=await r.json();d.features=d.features.filter(f=>f!=='server-mail');return {status:r.status,headers:r.headers,body:utf8(JSON.stringify(d))};}return {status:r.status,headers:r.headers,body:new Uint8Array(await r.arrayBuffer())};}});
  const outsider=makeClient(bob);await outsider.connect();const denied=await outsider.create({recipientId:identityId(bob.address),planId:member,subject:'Fixture',body:'No real chain broadcast'});
  await assert.rejects(outsider.prepare(denied),error=>error.problem?.code==='ENVELOPE_MEMBER_REQUIRED');
  const client=makeClient(alice);await client.connect();const task=await client.create({recipientId:identityId(alice.address),planId:member,subject:'Fixture',body:'No real chain broadcast'});await client.prepare(task);
  await db.prepare('UPDATE account_links SET revoked=1,revision=4 WHERE arc_id=?').bind(arc).run();
  await assert.rejects(client.submit(task,b64u(utf8('signed:'+task.paymentRequest.unsignedTransaction))),error=>error.problem?.code==='ENVELOPE_MEMBER_REQUIRED');
  assert.equal((await db.prepare('SELECT accepted_at FROM dmp_messages WHERE id=?').bind(task.manifest.messageId).first()).accepted_at,null);
 }finally{await mf.dispose();}
});

test('category migration preserves envelope data and imports the previous member reference',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-10-24',d1Databases:{DB:'migration-categories'}}));
 try{
  const db=await mf.getD1Database('DB');
  const apply=async file=>{for(const sql of(await fs.readFile('workers/migrations/'+file,'utf8')).split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean))await db.prepare(sql).run();};
  for(const file of(await fs.readdir('workers/migrations')).sort().filter(file=>file<'0014'))await apply(file);
  await db.prepare("INSERT INTO envelopes(address,name,price,token,retentionPeriod,enabled,createdAt,updatedAt) VALUES('public','Public','0.01 TBA','{}',10,1,'fixture','fixture'),('member','Member','0 TBA','{}',7,0,'fixture','fixture')").run();
  await db.prepare("UPDATE member_envelope_config SET member_plan_id='member'").run();
  const before=(await db.prepare('SELECT * FROM envelopes ORDER BY id').all()).results;
  await apply('0014_envelope_categories.sql');
  const after=(await db.prepare('SELECT * FROM envelopes ORDER BY id').all()).results;
  assert.deepEqual(after.map(({category,...rest})=>rest),before);
  assert.deepEqual(after.map(row=>row.category),['public','members']);
  assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE name='member_envelope_config'").first(),null);
  await db.prepare("INSERT INTO namecards(address,price,token,enabled,createdAt,updatedAt) VALUES('historical-card','0.01 TBA','{}',1,'fixture','fixture')").run();
  const cardBefore=await db.prepare('SELECT * FROM namecards').first();
  await apply('0015_namecard_categories.sql');
  const {category:cardCategory,...cardAfter}=await db.prepare('SELECT * FROM namecards').first();
  assert.equal(cardCategory,'public');assert.deepEqual(cardAfter,cardBefore,'Namecard migration preserves historical data');

 }finally{await mf.dispose();}
});
