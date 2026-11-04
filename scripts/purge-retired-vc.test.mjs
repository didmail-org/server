import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { purgeRetiredVc } from './purge-retired-vc.mjs';
test('VC purge removes ciphertext, metadata and orphan objects; preserves NFT mail and identities; can rerun', async () => {
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("isolated");}}',compatibilityDate:'2026-10-24',d1Databases:{DB:'purge-test'},r2Buckets:{BLOBS:'purge-test'},outboundService:()=>new Response('',{status:502})}));
 try {
  const db=await mf.getD1Database('DB'),blobs=await mf.getR2Bucket('BLOBS');
  for(const file of (await fs.readdir('workers/migrations')).sort()) for(const sql of (await fs.readFile('workers/migrations/'+file,'utf8')).split(';').map(s=>s.replace(/^--.*$/gm,'').trim()).filter(Boolean)) await db.prepare(sql).run();
  await db.prepare('CREATE TABLE preserved_identity(id TEXT PRIMARY KEY)').run();await db.prepare("INSERT INTO preserved_identity VALUES('fixture')").run();
  await db.prepare("INSERT INTO ordinary_messages(id,sender_id,recipient_id,service_id,manifest_hash,manifest_json,terms_id,terms_json,created_at,updated_at,upload_expires_at) VALUES('vc','sender','recipient','node','hash','{}','terms','{}','now','now','later')").run();
  await db.prepare("INSERT INTO ordinary_chunks VALUES('vc','blob',0,'hash','ordinary/fixture',3)").run();
  await blobs.put('ordinary/fixture','old');await blobs.put('ordinary/orphan','orphan');await blobs.put('dmp/retained','nft');
  await db.prepare("INSERT INTO dmp_messages(id,sender_id,recipient_id,service_id,manifest_hash,manifest_json,quote_id,quote_json,created_at,updated_at,upload_expires_at) VALUES('nft','sender','recipient','node','hash','{}','quote','{}','now','now','later')").run();
  const before=await db.prepare('SELECT count(*) AS n FROM dmp_messages').first();
  assert.deepEqual(await purgeRetiredVc(db,blobs),{messages:1,chunks:1,objects:2});
  assert.equal((await db.prepare('SELECT count(*) AS n FROM ordinary_messages').first()).n,0);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM ordinary_chunks').first()).n,0);
  assert.deepEqual(await db.prepare('SELECT count(*) AS n FROM dmp_messages').first(),before);
  assert.ok(await blobs.head('dmp/retained'));assert.equal((await db.prepare('SELECT count(*) AS n FROM preserved_identity').first()).n,1);
  assert.deepEqual(await purgeRetiredVc(db,blobs),{messages:0,chunks:0,objects:0});
  await db.prepare("INSERT INTO ordinary_chunks VALUES('corrupt','blob',0,'hash','dmp/retained',3)").run();
  await assert.rejects(()=>purgeRetiredVc(db,blobs),/Unexpected/);assert.ok(await blobs.head('dmp/retained'));
 } finally {await mf.dispose();}
});
