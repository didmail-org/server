// Explicit operator export/import; never a package build or automatic startup step.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { AfsBusinessStore, AfsObjectStore, dumpDatabase, restoreDatabase } from './afs-business-store.mjs';
import { localBusinessRoot } from './arc-storage-bridge.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const retiredPolicyTables = new Set(['mail_service_policy','mail_access_entries','mail_policy_audit']);
export { initializeBusinessStorage } from '../blocklet/providers/didmail-business/initialize.mjs';
import { initializeBusinessStorage } from '../blocklet/providers/didmail-business/initialize.mjs';

export async function exportBusinessStorage({ database, bucket, output }) {
  await fs.mkdir(output,{mode:0o700});
  const db = new DatabaseSync(database,{readOnly:true});
  try {
    db.exec('BEGIN'); const state = dumpDatabase(db); db.exec('ROLLBACK');
    state.schema = state.schema.filter(item => !retiredPolicyTables.has(item.name) && !retiredPolicyTables.has(/ON ["`]?([a-z_]+)/i.exec(item.sql)?.[1]));
    for (const table of retiredPolicyTables) delete state.tables[table];
    const check = restoreDatabase(state); check.close();
    const bytes = JSON.stringify(state); await fs.writeFile(path.join(output,'state.json'),bytes,{mode:0o600,flag:'wx'});
    await fs.mkdir(path.join(output,'objects'),{mode:0o700});
    const objects=[];let cursor;
    do {
      const page=await bucket.list({...(cursor?{cursor}:{})});
      for (const item of page.objects) {
        const object=await bucket.get(item.key);if(!object)throw Error('Object disappeared; quiesce all writers before exporting');
        const content=Buffer.from(await object.arrayBuffer()), file='objects/'+hash(item.key)+'.bin';
        await fs.writeFile(path.join(output,file),content,{mode:0o600,flag:'wx'});
        objects.push({key:item.key,file,size:content.length,sha256:hash(content),httpMetadata:object.httpMetadata||{},customMetadata:object.customMetadata||{},uploaded:object.uploaded.toISOString()});
      }
      cursor=page.truncated?page.cursor:undefined;
    } while(cursor);
    // Missing referenced objects must block publication, even for pending jobs.
    const keys=new Set(objects.map(o=>o.key));
    for(const key of referencedKeys(state))if(!keys.has(key))throw Error('Referenced encrypted object missing from source');
    const manifest={format:'didmail-instance-business-v1',stateSha256:hash(bytes),objects};
    await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest),{mode:0o600,flag:'wx'});return manifest;
  } catch(error) {await fs.rm(output,{recursive:true,force:true});throw error;}
  finally {db.close();}
}
export function referencedKeys(state) {
  const keys=new Set((state.tables.dmp_chunks||[]).map(row=>row.object_key));
  for(const table of ['mails','attachments'])for(const row of state.tables[table]||[])if(typeof row.content==='string'&&row.content.startsWith('r2://'))keys.add(row.content.slice(5));
  for(const row of state.tables.template_list_cache||[])keys.add(row.payload);
  return keys;
}
/** All writers must be quiesced. A version change rejects a racing backup. */
export async function exportInstanceStorage(root, output) {
  const store=new AfsBusinessStore(root),objects=new AfsObjectStore(root),initial=await store.read();
  await fs.mkdir(output,{mode:0o700});
  try{
    const bytes=JSON.stringify(initial.state);await fs.writeFile(path.join(output,'state.json'),bytes,{mode:0o600,flag:'wx'});
    await fs.mkdir(path.join(output,'objects'),{mode:0o700});const manifest={format:'didmail-instance-business-v1',stateSha256:hash(bytes),objects:[]};
    for(const key of referencedKeys(initial.state)){
      const value=(await objects.read(key)).value;if(!value||value.deleted)throw Error('Referenced instance object is missing');
      const content=Buffer.from(value.bytes,'base64'),file='objects/'+hash(key)+'.bin';await fs.writeFile(path.join(output,file),content,{mode:0o600,flag:'wx'});
      manifest.objects.push({key,file,size:value.size,sha256:value.sha256,httpMetadata:value.httpMetadata,customMetadata:value.customMetadata||{},uploaded:value.uploaded});
    }
    if((await store.read()).version!==initial.version)throw Error('Business state changed during backup; quiesce writers');
    await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest),{mode:0o600,flag:'wx'});return manifest;
  }catch(error){await fs.rm(output,{recursive:true,force:true});throw error;}
}
export async function importBusinessStorage(root, input) {
  const store=new AfsBusinessStore(root),objects=new AfsObjectStore(root);
  try {await store.read();throw Error('Target business state already exists');}catch(error){if(error.code!=='AFS_NOT_FOUND')throw error;}
  const manifest=JSON.parse(await fs.readFile(path.join(input,'manifest.json'),'utf8')),bytes=await fs.readFile(path.join(input,'state.json'));
  if(manifest.format!=='didmail-instance-business-v1'||hash(bytes)!==manifest.stateSha256||!Array.isArray(manifest.objects))throw Error('Invalid business export');
  const state=JSON.parse(bytes);const check=restoreDatabase(state);check.close();
  const keys=new Set();
  for(const item of manifest.objects){
    if(keys.has(item.key)||item.file!=='objects/'+hash(item.key)+'.bin')throw Error('Invalid object manifest');keys.add(item.key);
    const content=await fs.readFile(path.join(input,item.file));if(content.length!==item.size||hash(content)!==item.sha256)throw Error('Exported object digest mismatch');
  }
  for(const key of referencedKeys(state))if(!keys.has(key))throw Error('Incomplete object export');
  await store.capabilities();
  for(const item of manifest.objects){
    const previous=(await objects.read(item.key)).value;
    if(previous){if(previous.deleted||previous.sha256!==item.sha256||previous.size!==item.size||previous.uploaded!==item.uploaded||JSON.stringify(previous.httpMetadata)!==JSON.stringify(item.httpMetadata)||JSON.stringify(previous.customMetadata)!==JSON.stringify(item.customMetadata))throw Error('Target object conflicts with import');}
    else await objects.put(item.key,await fs.readFile(path.join(input,item.file)),item.httpMetadata,{createOnly:true,uploaded:item.uploaded,customMetadata:item.customMetadata});
    const actual=(await objects.read(item.key)).value;if(actual.sha256!==item.sha256||actual.size!==item.size)throw Error('Object readback mismatch');
  }
  // Publish the transaction aggregate last. Partial object copies are resumable
  // but cannot make an incomplete mailbox or job visible to business consumers.
  await store.initialize(state);return {tables:Object.keys(state.tables).length,objects:manifest.objects.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {values}=parseArgs({options:{instance:{type:'string'},database:{type:'string'},checkpoint:{type:'string'},out:{type:'string'},import:{type:'string'},backup:{type:'string'},initialize:{type:'boolean'}}});
  if(!values.instance)throw Error('Supply --instance and either --import or --database/--checkpoint/--out');
  const modes=[values.initialize,values.backup,values.import,values.database||values.checkpoint||values.out].filter(Boolean);
  if(modes.length!==1)throw Error('Choose exactly one of initialization, backup, import or source export');
  const {stdout}=await promisify(execFile)('arc',['service','status','--instance',values.instance,'--json']);const service=JSON.parse(stdout.slice(stdout.indexOf('{')));
  if(service.status!=='up'||!service.port)throw Error('Named ARC instance must be running');
  const origin='http://127.0.0.1:'+service.port;
  if(!(await fetch(origin+'/?blocklet=didmail-server')).ok)throw Error('Instance activation failed');
  if(values.initialize){await initializeBusinessStorage(localBusinessRoot(origin));console.log('Empty instance business state explicitly initialized.');process.exit(0);}
  if(values.backup){await exportInstanceStorage(localBusinessRoot(origin),values.backup);console.log('Instance business backup verified.');process.exit(0);}
  if(!values.import){
    if(!values.database||!values.checkpoint||!values.out)throw Error('Quiesce writers and supply --database, --checkpoint, --out');
    const {Miniflare,convertV4MiniflareOptions}=await import('miniflare');const {previewPersistenceOptions}=await import('./preview-persistence.mjs');
    const config=JSON.parse(await fs.readFile(new URL('./migration/legacy-resources.json',import.meta.url),'utf8'));
    const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("private export")}}',compatibilityDate:config.compatibilityDate,r2Buckets:{BLOBS:config.bucketName},...previewPersistenceOptions(values.checkpoint)}));
    try{await exportBusinessStorage({database:values.database,bucket:await mf.getR2Bucket('BLOBS'),output:values.out});}finally{await mf.dispose();}
  }
  await importBusinessStorage(localBusinessRoot(origin),values.import||values.out);
  console.log('Business state and encrypted object import verified. Original storage retained.');
}
