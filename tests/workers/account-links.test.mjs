import {chromium} from 'playwright-core';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fromRandom,fromPublicKey,fromAddress,fromSecretKey,WalletType } from '@ocap/wallet';
import {types} from '@ocap/mcrypto';
import { toUint8Array } from '@ocap/util';
import { AccountLinkClient, identityId, utf8, canonicalize, signRequest, uuid, createAccountVerifier, accountPkceChallenge, signAccountLink, encryptAccountRecovery, accountRecoveryBody, b64u, signingPublicKey } from '@didmail/protocol';
const origin='https://accounts.test';
async function setup(enabled=true){
 const node=fromSecretKey(fromRandom().secretKey,WalletType({role:types.RoleType.ROLE_APPLICATION,pk:types.KeyType.ED25519,hash:types.HashType.SHA3})),arc=fromRandom(),mail=fromRandom(),device=fromRandom();
 const arcId=identityId(arc.address), mailId=identityId(mail.address);
 const fixture=`let mode='member',nodeMode='private';export default {async fetch(r){const u=new URL(r.url);if(u.pathname==='/node-mode'){nodeMode=await r.text();return new Response('ok')}if(u.pathname==='/afs'){
 if(nodeMode==='offline')return new Response('',{status:503});
 const {params}=await r.json(),path=params.path,kind=path.split('/').at(-2),address=path.split('/').at(-1);
 if(path.endsWith('/.meta/.capabilities'))return Response.json({success:true,data:{data:{meta:{provenance:{provider:'ocap'}},content:{operations:{read:true,list:{supported:true}}}}}});
 if(kind==='stakes'&&nodeMode==='private')return Response.json({success:false,error:{code:1}});
 const content=kind==='stakes'?{address,sender:nodeMode==='foreign-sender'?'foreign':'${node.address}',receiver:'0x73AEAc8Be08298fD383152335A182E3e307Eb95a',assets:nodeMode==='token-only'?[]:['fixture-node-nft'],revokedAssets:nodeMode==='revoked'?['fixture-node-nft']:[],tokens:[],revokedTokens:[]}:kind==='assets'?{address,parent:nodeMode==='wrong-factory'?'foreign-factory':'fixture-node-factory'}:null;
 if(!content)return new Response('',{status:500});
 return Response.json({success:true,data:{data:{path,meta:{kind:'ocap:'+(kind==='stakes'?'stake':'asset'),provenance:{provider:'ocap'}},content}}});
 }if(u.pathname==='/mode'){mode=await r.text();return new Response('ok')}if(u.pathname==='/.well-known/service/api/did/session')return Response.json({authenticated:r.headers.has('cookie'),user:{did:'${arc.address}',role:r.headers.get('cookie')==='session=admin'?'admin':'member'}});if(u.pathname==='/members'){if(mode==='offline')return new Response('',{status:503});return Response.json({instanceId:'test-instance',page:Number(u.searchParams.get('page')),pageSize:20,total:1,members:[{did:'${arcId}',name:'Fixture member',role:'member',active:true}]});}if(u.pathname==='/member'){if(mode==='offline')return new Response('',{status:503});if(mode==='missing')return new Response('',{status:404});return Response.json({instanceId:'test-instance',did:u.searchParams.get('did'),role:mode==='guest'?'guest':'member',...(mode==='unknown'?{}:{active:mode!=='disabled'})});}return new Response('',{status:404})}}`;
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'didmail',modules:true,scriptPath:'.worker/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:node.secretKey,DIDMAIL_URL:origin,DIDMAIL_ACCOUNT_ORIGIN:origin,DIDMAIL_ACCOUNT_LINKS_ENABLED:enabled?'1':'0',DIDMAIL_ARC_INSTANCE_ID:'test-instance',DIDMAIL_MEMBER_ACCESS:'arc',FACTORY_OWNER:'0x73AEAc8Be08298fD383152335A182E3e307Eb95a',SERVER_NODE_FACTORY:'fixture-node-factory'},d1Databases:{DB:'accounts'},r2Buckets:{BLOBS:'accounts'},serviceBindings:{ARC:'arc',ARC_MEMBERS:'arc'},outboundService:'deny'},{name:'arc',modules:true,script:fixture,compatibilityDate:'2026-10-24'},{name:'deny',modules:true,script:`export default{fetch(){throw Error('External calls forbidden')}}`,compatibilityDate:'2026-10-24'}]}));
 const db=await mf.getD1Database('DB');
 for(const file of(await fs.readdir('workers/migrations')).sort())for(const sql of(await fs.readFile('workers/migrations/'+file,'utf8')).split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean))await db.prepare(sql).run();
 const signed=(path,body,wallet=mail)=>{const bytes=utf8(canonicalize(body));return mf.dispatchFetch(origin+path,{method:path.endsWith('/backup')?'PUT':'POST',headers:{'content-type':'application/json',...signRequest(path.endsWith('/backup')?'PUT':'POST',origin+path,bytes,identityId(wallet.address),toUint8Array(wallet.secretKey))},body:bytes});};
 const create=async(operation='link',wallet=mail)=>{const verifier=createAccountVerifier(),intentId=uuid();const body={intentId,operation,pkceChallenge:accountPkceChallenge(verifier)};const r=await signed('/v1/account-links/intents',body,wallet);assert.equal(r.status,200);return{...await r.json(),verifier,body,wallet};};
 const approve=async intent=>{const page=await mf.dispatchFetch(intent.authorizationUrl,{headers:{cookie:'session=fixture'}});assert.equal(page.status,200,await page.clone().text());assert.equal(page.headers.get('access-control-allow-origin'),null);const text=await page.text(),csrf=/name="csrf" value="([^"]+)"/.exec(text)?.[1];if(!csrf)return page;return mf.dispatchFetch(origin+'/account/approve',{method:'POST',headers:{cookie:'session=fixture',origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id:intent.intentId,csrf,consent:'yes'}).toString()});};
 const status=async intent=>{const r=await signed('/v1/account-links/intents/'+intent.intentId+'/status',{verifier:intent.verifier},intent.wallet);assert.equal(r.status,200);return r.json()};
 const complete=async(intent,capsule=null)=>{const state=await status(intent);assert.equal(state.status,'approved');return signed('/v1/account-links/intents/'+intent.intentId+'/complete',{verifier:intent.verifier,proof:intent.body.operation==='recover'?null:signAccountLink(state.statement,toUint8Array(intent.wallet.secretKey)),capsule},intent.wallet)};
 return{mf,db,arcId,mailId,mail,device,nodeMode:async mode=>(await mf.getWorker('arc')).fetch('https://arc/node-mode',{method:'POST',body:mode}),signed,create,approve,status,complete,mode:async mode=>(await mf.getWorker('arc')).fetch('https://arc/mode',{method:'POST',body:mode})};
}
test('account link explicit ARC approval, two-key binding, lost response retry, encrypted recovery and CAS',async()=>{
 const c=await setup();try{
  const intent=await c.create();assert.equal((await c.status(intent)).status,'pending');
  assert.equal((await c.signed('/v1/account-links/intents',intent.body)).status,200);
  const bad=await c.signed('/v1/account-links/intents/'+intent.intentId+'/status',{verifier:createAccountVerifier()});assert.equal(bad.status,403);
  assert.equal((await c.approve(intent)).status,200);
  const state=await c.status(intent);assert.equal(state.statement.arcId,c.arcId);assert.equal(state.statement.mailboxId,c.mailId);
  // Public fixture keys only. No real chain, private account or invitation is used.
  const matches=(pk,id)=>id===c.mailId&&b64u(pk)===b64u(signingPublicKey(toUint8Array(c.mail.secretKey)));
  const capsule=await encryptAccountRecovery(accountRecoveryBody(c.mailId,toUint8Array(c.mail.secretKey),[],[]),'fixture recovery password',matches);
  const done=await c.complete(intent,capsule);assert.equal(done.status,200);const result=await done.json();assert.deepEqual(result,{mailboxId:c.mailId,revision:1,revoked:false,capsule:null});
  assert.deepEqual(await(await c.complete(intent,capsule)).json(),result);
  assert.equal((await c.db.prepare('SELECT count(*) n FROM account_links').first()).n,1);
  const recovery=await c.create('recover',c.device);await c.mode('missing');assert.equal((await c.approve(recovery)).status,200);
  assert.deepEqual((await(await c.complete(recovery)).json()).capsule,capsule);await c.mode('member');
  const stale=await c.create('recover',c.device);await c.approve(stale);
  assert.equal((await c.signed('/v1/account-links/backup',{expectedRevision:1,capsule})).status,200);
  assert.equal((await c.complete(stale)).status,409);
  assert.equal((await c.complete(recovery)).status,409);
  const different=await c.create('link',c.device);assert.equal((await c.approve(different)).status,409);
 }finally{await c.mf.dispose()}
});
test('ARC active status is mandatory, disabled/guest forbidden, source errors fail closed',async()=>{
 const c=await setup();try{for(const [mode,expected]of[['guest',403],['disabled',403],['missing',403],['offline',503],['unknown',503]]){await c.mode(mode);const i=await c.create();const page=await c.mf.dispatchFetch(i.authorizationUrl,{headers:{cookie:'session=fixture'}});assert.equal(page.status,expected,mode)}
 }finally{await c.mf.dispose()}
});
test('browser CSRF, wrong signatures, HTTP replay, tombstones and capability privacy',async()=>{
 const c=await setup();try{
  const i=await c.create();const path='/v1/account-links/intents/'+i.intentId+'/status',body=utf8(canonicalize({verifier:i.verifier})),headers={'content-type':'application/json',...signRequest('POST',origin+path,body,c.mailId,toUint8Array(c.mail.secretKey))};
  assert.equal((await c.mf.dispatchFetch(origin+path,{method:'POST',headers,body})).status,200);assert.equal((await c.mf.dispatchFetch(origin+path,{method:'POST',headers,body})).status,409);
  assert.equal((await c.mf.dispatchFetch(origin+'/account/approve',{method:'POST',headers:{cookie:'s=x',origin:'https://evil.test','content-type':'application/x-www-form-urlencoded'},body:'id='+i.intentId+'&csrf=bad&consent=yes'})).status,403);
  await c.approve(i);const state=await c.status(i);const proof=signAccountLink({...state.statement,origin:'https://foreign.test'},toUint8Array(c.mail.secretKey));assert.equal((await c.signed('/v1/account-links/intents/'+i.intentId+'/complete',{verifier:i.verifier,proof,capsule:null})).status,403);
  await c.complete(i);
  const revoke=await c.create('revoke');await c.approve(revoke);const revoked=await(await c.complete(revoke)).json();assert.equal(revoked.revoked,true);assert.equal((await c.db.prepare('SELECT count(*) n FROM account_links').first()).n,1);
  assert.equal((await c.complete(i)).status,409);
  const activate=await c.create();await c.approve(activate);assert.equal((await(await c.complete(activate)).json()).revoked,false);
  const capabilities=await(await c.mf.dispatchFetch(origin+'/v1/account-links/capabilities')).json();assert.deepEqual(Object.keys(capabilities).sort(),['authorizationOrigin','enabled','version']);
 }finally{await c.mf.dispose()}
 const disabled=await setup(false);try{assert.deepEqual(await(await disabled.mf.dispatchFetch(origin+'/v1/account-links/capabilities')).json(),{version:1,enabled:false,authorizationOrigin:null})}finally{await disabled.mf.dispose()}
});

test('ARC membership replaces legacy allow, denies either identity, and changes sending eligibility live',async()=>{
 const c=await setup();try{
  await c.db.prepare("UPDATE mail_service_policy SET policy_json=json_set(policy_json,'$.accessMode','allowlist')").run();
  const admission=()=>c.mf.dispatchFetch(origin+'/__account/admission?did='+encodeURIComponent(c.mailId));
  await c.db.prepare("INSERT INTO mail_access_entries(kind,did,remark,created_at,created_by) VALUES('allow',?,'legacy','2026-01-01','fixture')").bind(c.mailId).run();
  assert.equal((await admission()).status,403);
  const i=await c.create();await c.approve(i);await c.complete(i);
  assert.equal((await(await admission()).json()).free,true);
  for(const mode of ['disabled','guest','missing']){await c.mode(mode);assert.equal((await admission()).status,403);}
  await c.mode('unknown');assert.equal((await admission()).status,503);
  await c.mode('member');
  for(const did of [c.mailId,c.arcId]){
   await c.db.prepare("INSERT INTO mail_access_entries(kind,did,remark,created_at,created_by) VALUES('deny',?,'blocked','2026-01-01','fixture')").bind(did).run();
   await c.mode('offline');assert.equal((await admission()).status,403);await c.mode('member');
   await c.db.prepare("DELETE FROM mail_access_entries WHERE kind='deny'").run();
  }
  assert.equal((await(await admission()).json()).free,true);
 }finally{await c.mf.dispose()}
});

test('shared client persists before network, retries original intent after response loss, and keeps pending until local commit',async()=>{
 const c=await setup();let pending,drop=true;try{
  const client=new AccountLinkClient({endpoint:origin,clientId:c.mailId,secretKey:toUint8Array(c.mail.secretKey),matches:(pk,id)=>{try{return fromPublicKey(pk,fromAddress(id.slice(8)).type).address===id.slice(8);}catch{return false;}},store:{load:async()=>pending,save:async value=>{pending=JSON.parse(canonicalize(value));},remove:async()=>{pending=undefined;}},transport:async(url,method,headers,body)=>{
   if(method==='POST')assert.ok(pending,'intent MUST be durable before any signed mutation');
   const r=await c.mf.dispatchFetch(url,{method,headers,body:method==='GET'?undefined:body});
   if(url.endsWith('/intents')&&drop){drop=false;throw Error('simulated response loss after server commit');}
   return{status:r.status,headers:r.headers,body:new Uint8Array(await r.arrayBuffer())};
  }});
  await assert.rejects(()=>client.start('link'),/simulated response loss/);const id=pending.intentId;
  const approval=await client.start('link');assert.equal(approval.intentId,id);
  assert.equal((await c.db.prepare('SELECT count(*) n FROM account_link_intents').first()).n,1);
  assert.equal(await client.approved(),undefined);
  await c.approve(approval);assert.equal((await client.approved()).mailboxId,c.mailId);
  const result=await client.complete();assert.equal(result.mailboxId,c.mailId);assert.ok(pending.completion);
  assert.deepEqual(await client.complete(),result);await client.clearPending();assert.equal(pending,undefined);
 }finally{await c.mf.dispose()}
});

test('expired intent cannot exchange; concurrent different mailboxes cannot replace the primary binding',async()=>{
 const c=await setup();try{
  const expired=await c.create();await c.approve(expired);
  await c.db.prepare("UPDATE account_link_intents SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").bind(expired.intentId).run();
  assert.equal((await c.signed('/v1/account-links/intents/'+expired.intentId+'/status',{verifier:expired.verifier})).status,410);
  const a=await c.create(),b=await c.create('link',c.device);await c.approve(a);await c.approve(b);
  const [first,second]=await Promise.all([c.complete(a),c.complete(b)]);assert.deepEqual([first.status,second.status].sort(),[200,409]);
  assert.equal((await c.db.prepare('SELECT count(*) n FROM account_links').first()).n,1);
 }finally{await c.mf.dispose()}
});

test('native authorization page requires a real browser confirmation before mailbox binding',{timeout:30000,skip:!process.env.DIDMAIL_ACCOUNT_BROWSER_TEST},async()=>{
 const c=await setup();const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const i=await c.create(),context=await browser.newContext({viewport:{width:390,height:844}});await context.addCookies([{name:'session',value:'fixture',url:origin}]);
  await context.route('**/*',async route=>{
   const r=route.request();if(!r.url().startsWith(origin+'/'))return route.abort();
   const response=await c.mf.dispatchFetch(r.url(),{method:r.method(),headers:await r.allHeaders(),body:r.method()==='GET'?undefined:r.postDataBuffer()});
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  const page=await context.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(5000);await page.goto(i.authorizationUrl,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('strong').textContent(),i.displayCode);
  assert.equal((await c.db.prepare('SELECT count(*) n FROM account_links').first()).n,0);
  await page.getByRole('button',{name:'确认授权',exact:true}).click();assert.match(await page.locator('main').innerText(),/授权已确认/);
  assert.equal((await c.status(i)).status,'approved');assert.equal((await c.db.prepare('SELECT count(*) n FROM account_links').first()).n,0);
  assert.equal((await c.complete(i)).status,200);
  await context.close();
 }finally{await browser.close();await c.mf.dispose()}
});

test('mailbox-signed binding lookup restores existing associations without ARC approval and exposes no backup or peer identity',async()=>{
 const c=await setup();try{
  const path='/v1/account-links/binding';
  const empty=await c.signed(path,{});assert.equal(empty.status,200);assert.equal(empty.headers.get('cache-control'),'no-store');
  assert.deepEqual(await empty.json(),{mailboxId:c.mailId,linked:false,revision:0,revoked:false});
  const intent=await c.create();assert.equal((await c.approve(intent)).status,200);assert.equal((await c.complete(intent)).status,200);
  const linked=await c.signed(path,{});assert.equal(linked.status,200);assert.deepEqual(await linked.json(),{mailboxId:c.mailId,linked:true,revision:1,revoked:false});
  const foreign=await c.signed(path,{},c.device);assert.deepEqual(await foreign.json(),{mailboxId:identityId(c.device.address),linked:false,revision:0,revoked:false});
  assert.equal((await c.signed(path,{mailboxId:c.mailId})).status,400);
  assert.equal((await c.mf.dispatchFetch(origin+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
  await c.db.prepare('UPDATE account_links SET revoked=1,revision=2 WHERE mailbox_id=?').bind(c.mailId).run();
  assert.deepEqual(await(await c.signed(path,{})).json(),{mailboxId:c.mailId,linked:false,revision:2,revoked:true});
 }finally{await c.mf.dispose()}
});

test('admin member directory requires owner/admin, joins only scoped mailbox metadata and never writes links', async () => {
 const c=await setup();try {
  const query=(cookie='session=admin',path='/api/admin/members',method='GET')=>c.mf.dispatchFetch(origin+path,{method,headers:cookie?{cookie}:{}});
  assert.equal((await query('')).status,401);
  assert.equal((await query('session=fixture')).status,403);
  const i=await c.create();await c.approve(i);await c.complete(i);
  const response=await query();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await query('session=admin','/api/admin/members?role=member&active=active')).status,200);
  assert.equal((await query('session=admin','/api/admin/members?role=guest')).status,503);
  assert.equal((await query('session=admin','/api/admin/members?role=superadmin')).status,400);
  assert.equal((await query('session=admin','/api/admin/members?active=unknown')).status,400);
  const body=await response.json();assert.equal(body.members[0].did,c.arcId);assert.equal(body.members[0].binding.mailboxId,c.mailId);
  assert.deepEqual(Object.keys(body.members[0].binding).sort(),['mailboxId','revision','revoked','updatedAt']);
  assert.equal((await query('session=admin','/api/admin/members?page=0')).status,400);
  assert.equal((await query('session=admin','/api/admin/members?instanceId=another')).status,400);
  assert.equal((await query('session=admin','/api/admin/members?page=1&page=2')).status,400);
  assert.equal((await query('session=admin','/api/admin/members','POST')).status,403);
  assert.equal((await c.db.prepare('SELECT count(*) AS n FROM account_links').first()).n,1);
  await c.mode('offline');assert.equal((await query()).status,503);
 }finally{await c.mf.dispose();}
});

test('ARC sending scope follows live node NFT stake, ignores stored public mode and cannot be manually changed',async()=>{
 const c=await setup();try{
  const admission=()=>c.mf.dispatchFetch(origin+'/__account/admission?admissionOnly=1&did='+encodeURIComponent(c.mailId));
  // The old default is public, but an unstaked node still requires a linked member.
  assert.equal((await admission()).status,403);
  const i=await c.create();await c.approve(i);await c.complete(i);
  assert.equal((await admission()).status,200);
  await c.mode('guest');assert.equal((await admission()).status,403);
  await c.nodeMode('open');assert.equal((await admission()).status,200);
  for(const mode of ['token-only','revoked','wrong-factory']){await c.nodeMode(mode);assert.equal((await admission()).status,403,mode);}
  await c.nodeMode('foreign-sender');assert.equal((await admission()).status,503);
  await c.nodeMode('offline');assert.equal((await admission()).status,503);
  const unknown=await c.mf.dispatchFetch(origin+'/api/mail/service-config');assert.equal(unknown.status,200);assert.equal((await unknown.json()).sendingAccessState,'unavailable');
  // Denies remain authoritative even while chain reads are unavailable.
  await c.db.prepare("INSERT INTO mail_access_entries(kind,did,remark,created_at,created_by) VALUES('deny',?,'test','2026-01-01','fixture')").bind(c.mailId).run();
  assert.equal((await admission()).status,403);
  await c.db.prepare("DELETE FROM mail_access_entries WHERE kind='deny'").run();
  await c.nodeMode('open');await c.mode('member');
  const config=await c.mf.dispatchFetch(origin+'/api/mail/service-config');assert.equal(config.status,200);assert.equal((await config.json()).sendingRestricted,false);
  await c.nodeMode('private');const privateConfig=await c.mf.dispatchFetch(origin+'/api/mail/service-config');assert.equal((await privateConfig.json()).sendingRestricted,true);
  const get=await c.mf.dispatchFetch(origin+'/api/admin/mail-policy',{headers:{cookie:'session=admin'}});const snapshot=await get.json();
  snapshot.policy.accessMode=snapshot.policy.accessMode==='public'?'allowlist':'public';
  const change=await c.mf.dispatchFetch(origin+'/api/admin/mail-policy',{method:'PUT',headers:{cookie:'session=admin',origin,'content-type':'application/json'},body:JSON.stringify({expectedRevision:snapshot.revision,policy:snapshot.policy})});
  assert.equal(change.status,409);assert.equal((await change.json()).code,'ACCESS_MANAGED_BY_NODE_NFT');
 }finally{await c.mf.dispose();}
});

test('storage admin lists NFT mail with notification hashes, safe metadata and recoverable deletion',async()=>{
 const c=await setup();try{
  const id='00000000-0000-4000-8000-000000000001',now=new Date().toISOString(),hash='A'.repeat(64),key='dmp/fixture-chunk';
  await c.db.prepare("INSERT INTO dmp_messages(id,sender_id,recipient_id,service_id,manifest_hash,manifest_json,quote_id,quote_json,state,lifecycle,created_at,updated_at,upload_expires_at,accepted_at,index_hash,receipt_json) VALUES(?,?,?,?,?,?,'fixture-quote',?, 'delivered','live',?,?,?,?,?,?)").bind(id,c.mailId,c.mailId,c.arcId,hash,JSON.stringify({planId:'fixture-envelope'}),JSON.stringify({totalAmount:'1000'}),now,now,'2099-01-01',now,hash,JSON.stringify({index:{transactionId:hash}})).run();
  const blobs=await c.mf.getR2Bucket('BLOBS');await blobs.put(key,'fixture ciphertext');
  await c.db.prepare('INSERT INTO dmp_chunks(message_id,blob_id,chunk_index,ciphertext_sha256,object_key,size_bytes) VALUES(?,?,0,?,?,18)').bind(id,'fixture-blob',hash,key).run();
  const get=(path,headers={cookie:'session=admin'})=>c.mf.dispatchFetch(origin+path,{headers});
  assert.equal((await get('/api/storage/mails',{})).status,401);assert.equal((await get('/api/storage/mails',{cookie:'session=fixture'})).status,403);
  const list=await get('/api/storage/mails?search='+hash);assert.equal(list.status,200);const result=await list.json();assert.equal(result.total,1);assert.equal(result.mails[0].assetTx,hash);assert.equal(result.mails[0].envelope,'fixture-envelope');assert.equal(result.mails[0].size,18);assert.equal('manifest_json' in result.mails[0],false);assert.equal('content' in result.mails[0],false);
  assert.equal((await(await get('/api/storage/mails?search='+c.mailId.slice(8))).json()).total,1);
  assert.equal((await get('/api/storage/size')).status,200);assert.equal((await get('/api/storage/mails?pageSize=101')).status,400);
  const url=origin+'/api/storage/mails/delete/'+encodeURIComponent('dmp:'+id);
  assert.equal((await c.mf.dispatchFetch(url,{method:'DELETE',headers:{cookie:'session=admin',origin:'https://attacker.test'}})).status,403);
  await c.db.prepare("UPDATE dmp_messages SET state='index_pending' WHERE id=?").bind(id).run();
  assert.equal((await c.mf.dispatchFetch(url,{method:'DELETE',headers:{cookie:'session=admin',origin}})).status,409);
  await c.db.prepare("UPDATE dmp_messages SET state='delivered' WHERE id=?").bind(id).run();
  assert.equal((await c.mf.dispatchFetch(url,{method:'DELETE',headers:{cookie:'session=admin',origin}})).status,200);
  assert.equal(await blobs.head(key),null);assert.equal((await c.db.prepare('SELECT lifecycle FROM dmp_messages WHERE id=?').bind(id).first()).lifecycle,'deleted');
 }finally{await c.mf.dispose();}
});
