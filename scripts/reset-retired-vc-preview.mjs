import fs from 'node:fs/promises';
import net from 'node:net';
import legacyResources from './migration/legacy-resources.json' with { type: 'json' };
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { snapshotPreviewPersistence, previewPersistenceOptions } from './preview-persistence.mjs';
import { purgeRetiredVc } from './purge-retired-vc.mjs';
if (process.argv.slice(2).join(' ') !== '--apply') throw Error('Usage: node scripts/reset-retired-vc-preview.mjs --apply (local DIDMail preview must be stopped)');
const listening = await new Promise(resolve => {
  const socket=net.createConnection({host:'127.0.0.1',port:8788});
  socket.setTimeout(2000);
  socket.once('connect',()=>{socket.destroy();resolve(true);});
  socket.once('error',()=>resolve(false));
  socket.once('timeout',()=>{socket.destroy();resolve(true);});
});
if(listening) throw Error('Stop the DIDMail preview before local data maintenance');
const config=legacyResources;
await snapshotPreviewPersistence({source:'.wrangler/state/arc-preview',destination:'.data/before-vc-reset-'+Date.now()});
console.log('Private local recovery checkpoint verified');
const mf=new Miniflare(convertV4MiniflareOptions({name:'didmail-arc-preview',modules:true,script:'export default {fetch(){return new Response("offline maintenance");}}',compatibilityDate:config.compatibilityDate,compatibilityFlags:['nodejs_compat'],d1Databases:{DB:config.databaseId},r2Buckets:{BLOBS:config.bucketName},...previewPersistenceOptions('.wrangler/state/arc-preview'),outboundService:()=>new Response('',{status:502})}));
try {
 const db=await mf.getD1Database('DB'),blobs=await mf.getR2Bucket('BLOBS');
 const tables=['account_links','dmp_keys','dmp_messages','dmp_chunks','mails','mail_access_entries'];
 const counts=async()=>Object.fromEntries(await Promise.all(tables.map(async name=>[name,Number((await db.prepare('SELECT count(*) AS n FROM '+name).first()).n)])));
 const before=await counts();
 const deleted=await purgeRetiredVc(db,blobs);
 assert.deepEqual(await counts(),before);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM ordinary_messages').first()).n,0);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM ordinary_chunks').first()).n,0);
 assert.equal((await blobs.list({prefix:'ordinary/',limit:1})).objects.length,0);
 console.log(JSON.stringify({deleted,preserved:before,verified:true}));
 const vars=await fs.readFile('.dev.vars','utf8');
 await fs.writeFile('.dev.vars',vars.split('\n').filter(line=>!/^DMP2_VC_ENABLED\s*=/.test(line)).join('\n'));
}finally{await mf.dispose();}
