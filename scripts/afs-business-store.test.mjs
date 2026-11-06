import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { AfsBusinessStore, AfsObjectStore, businessPath, restoreDatabase } from './afs-business-store.mjs';
import { memoryBusinessRoot } from './afs-business-fixture.mjs';
import { exportBusinessStorage, exportInstanceStorage, importBusinessStorage, initializeBusinessStorage } from './migrate-arc-business.mjs';
import { upgradeDeliveryStorage } from '../blocklet/providers/didmail-business/initialize.mjs';
const empty = () => ({schemaVersion:1,schema:[],tables:{}});
const sql = (sql, ...params) => ({sql,params});

test('delivery upgrade preserves existing AFS state and is repeatable without initializing missing storage',async()=>{
  const absent=memoryBusinessRoot();await upgradeDeliveryStorage(absent);
  await assert.rejects(new AfsBusinessStore(absent).read(),{code:'AFS_NOT_FOUND'});
  const root=memoryBusinessRoot();await initializeBusinessStorage(root);const store=new AfsBusinessStore(root);
  await store.transaction([sql('DROP TABLE dmp_index_attempts'),sql("CREATE TABLE preserved(value TEXT)"),sql("INSERT INTO preserved VALUES('original ciphertext reference')")]);
  await Promise.all([upgradeDeliveryStorage(root),upgradeDeliveryStorage(root)]);
  assert.equal((await store.transaction([sql('SELECT value FROM preserved')]))[0].results[0].value,'original ciphertext reference');
  assert.equal((await store.transaction([sql('SELECT count(*) n FROM dmp_index_attempts')]))[0].results[0].n,0);
  const before=await store.read();await upgradeDeliveryStorage(root);assert.deepEqual(await store.read(),before);
});

test('untrusted imported schema cannot attach or write a host database',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'didmail-afs-host-')),file=path.join(directory,'forbidden.sqlite');
  try{assert.throws(()=>restoreDatabase({schemaVersion:1,schema:[{type:'table',name:'attack',sql:`ATTACH DATABASE '${file.replaceAll("'","''")}' AS stolen`}],tables:{}}));await assert.rejects(fs.stat(file),{code:'ENOENT'});}
  finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('explicit new-instance initialization creates complete schema once without policy mirrors',async()=>{
  const root=memoryBusinessRoot();await initializeBusinessStorage(root);const store=new AfsBusinessStore(root);
  assert.equal((await store.transaction([sql('SELECT count(*) n FROM dmp_messages')]))[0].results[0].n,0);
  assert.ok((await store.read()).state.tables.contact_jobs);assert.equal((await store.read()).state.tables.mail_service_policy,undefined);
  const original=(await store.read()).state;await assert.rejects(initializeBusinessStorage(root),{code:'AFS_CONFLICT'});assert.deepEqual((await store.read()).state,original);
});

test('peer AFS commits retain SQL constraints, batch rollback, sequences and fenced task ownership', async()=>{
  const root=memoryBusinessRoot(),a=new AfsBusinessStore(root),b=new AfsBusinessStore(root);
  await a.initialize(empty());
  await a.transaction([sql('CREATE TABLE jobs(id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT, fence INTEGER NOT NULL DEFAULT 0, amount TEXT UNIQUE)')]);
  await a.transaction([sql("INSERT INTO jobs(amount) VALUES('1000000000000000000000000000001')")]);
  const claims=await Promise.all(Array.from({length:12},(_,i)=>(i%2?a:b).transaction([sql('UPDATE jobs SET owner=?,fence=fence+1 WHERE id=1 AND owner IS NULL RETURNING *','owner-'+i)])));
  assert.equal(claims.filter(r=>r[0].results.length).length,1);
  const held=(await a.transaction([sql('SELECT * FROM jobs WHERE id=1')]))[0].results[0];
  await b.transaction([sql('UPDATE jobs SET owner=NULL,fence=fence+1 WHERE id=1')]);
  assert.equal((await a.transaction([sql('UPDATE jobs SET amount=? WHERE id=1 AND owner=? AND fence=?','stale',held.owner,held.fence)]))[0].meta.changes,0);
  await assert.rejects(a.transaction([sql("INSERT INTO jobs(amount) VALUES('new')"),sql("INSERT INTO jobs(amount) VALUES('new')")]),/UNIQUE/);
  assert.equal((await b.transaction([sql('SELECT count(*) n FROM jobs')]))[0].results[0].n,1);
  const next=await new AfsBusinessStore(root).transaction([sql("INSERT INTO jobs(amount) VALUES('new') RETURNING id")]);assert.equal(next[0].results[0].id,2);
  await assert.rejects(a.transaction([sql("ATTACH DATABASE '/tmp/forbidden' AS other")]));
});
test('unknown AFS commit outcome is not automatically replayed and missing state never initializes',async()=>{
  const root=memoryBusinessRoot(),store=new AfsBusinessStore(root);await assert.rejects(store.transaction([sql('SELECT 1')]),{code:'AFS_NOT_FOUND'});assert.equal(root.nodes.size,0);
  await store.initialize(empty());await store.transaction([sql('CREATE TABLE evidence(n INTEGER)')]);
  const write=root.write;let lose=true;root.write=async(...args)=>{await write(...args);if(lose){lose=false;throw Object.assign(Error('Lost response'),{code:'AFS_TIMEOUT'});}};
  await assert.rejects(store.transaction([sql('INSERT INTO evidence VALUES(1)')]),{code:'AFS_TIMEOUT'});
  assert.equal((await new AfsBusinessStore(root).transaction([sql('SELECT count(*) n FROM evidence')]))[0].results[0].n,1);
});
test('AFS ciphertext objects preserve binary bytes and metadata, detect corruption and condition concurrent writes',async()=>{
  const root=memoryBusinessRoot(),objects=new AfsObjectStore(root),bytes=Buffer.alloc(1024*1024);for(let i=0;i<bytes.length;i++)bytes[i]=i%256;
  const key='../opaque/密文',meta={contentType:'application/octet-stream'};await objects.put(key,bytes,meta);
  const stored=(await objects.read(key)).value;assert.ok(Buffer.from(stored.bytes,'base64').equals(bytes));assert.deepEqual(stored.httpMetadata,meta);
  const concurrent=await Promise.allSettled([objects.put(key,Buffer.from('a')),objects.put(key,Buffer.from('b'))]);assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
  const node=root.nodes.get(objects.path(key)),bad=JSON.parse(node.content);bad.bytes='AAAA';node.content=JSON.stringify(bad);await assert.rejects(objects.read(key),{code:'AFS_OBJECT_INVALID'});
  await objects.put('delete-fixture',bytes);await objects.delete(['delete-fixture']);assert.equal((await objects.read('delete-fixture')).value.deleted,true);
});
test('business export/import preserves private protocol/jobs/blobs and resumes partial copies before publishing',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'didmail-afs-import-'));const file=path.join(directory,'source.sqlite'),out=path.join(directory,'export');
  try{
    const db=new DatabaseSync(file);db.exec("CREATE TABLE dmp_chunks(message_id TEXT,object_key TEXT);CREATE TABLE jobs(id INTEGER PRIMARY KEY AUTOINCREMENT,lease_fence INTEGER,signed_payment TEXT);CREATE TABLE mail_policy_audit(revision INTEGER);INSERT INTO dmp_chunks VALUES('fixture','ciphertext');INSERT INTO jobs(lease_fence,signed_payment) VALUES(42,'original-signed-bytes');");db.close();
    const original=await fs.readFile(file),content=Buffer.from(Array.from({length:256},(_,i)=>i));
    const bucket={list:async()=>({objects:[{key:'ciphertext'}],truncated:false}),get:async()=>({arrayBuffer:async()=>Uint8Array.from(content).buffer,httpMetadata:{contentType:'application/octet-stream'},customMetadata:{fixture:'public'},uploaded:new Date('2026-01-01T00:00:00Z')})};
    await exportBusinessStorage({database:file,bucket,output:out});
    const root=memoryBusinessRoot(),write=root.write;let lose=true;
    root.write=async(...args)=>{if(args[0]===businessPath&&lose){lose=false;throw Error('Simulated interruption before publication');}return write(...args);};
    await assert.rejects(importBusinessStorage(root,out),/Simulated interruption/);assert.equal(root.nodes.has(businessPath),false);
    await importBusinessStorage(root,out);await assert.rejects(importBusinessStorage(root,out),/already exists/);
    const restored=new AfsBusinessStore(root),row=(await restored.transaction([sql('SELECT * FROM jobs')]))[0].results[0];assert.equal(row.lease_fence,42);assert.equal(row.signed_payment,'original-signed-bytes');
    assert.equal((await restored.read()).state.tables.mail_policy_audit,undefined);
    assert.ok(Buffer.from((await new AfsObjectStore(root).read('ciphertext')).value.bytes,'base64').equals(content));assert.ok((await fs.readFile(file)).equals(original));
    const backup=path.join(directory,'afs-backup');await exportInstanceStorage(root,backup);const recovered=memoryBusinessRoot();await importBusinessStorage(recovered,backup);
    assert.deepEqual((await new AfsBusinessStore(recovered).read()).state,(await restored.read()).state);
    assert.equal((await new AfsObjectStore(recovered).read('ciphertext')).value.sha256,createHash('sha256').update(content).digest('hex'));
    await fs.writeFile(path.join(out,'objects',createHash('sha256').update('ciphertext').digest('hex')+'.bin'),'corrupt');
    const untouched=memoryBusinessRoot();await assert.rejects(importBusinessStorage(untouched,out),/digest mismatch/);assert.equal(untouched.nodes.size,0);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
