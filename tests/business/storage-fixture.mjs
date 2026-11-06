// Protocol assertions use the private AFS port only; no D1/R2 resources exist.
import { convertV4MiniflareOptions } from './host/miniflare.mjs';
import { AfsBusinessStore } from '../../scripts/afs-business-store.mjs';
import { memoryBusinessRoot } from '../../scripts/afs-business-fixture.mjs';
import { businessDatabase, createStorageBinding } from '../../scripts/arc-storage-bridge.mjs';
const databases = new WeakMap();
export async function storageOptions(input) {
  const root=memoryBusinessRoot(),store=new AfsBusinessStore(root);
  await store.initialize({schemaVersion:1,schema:[],tables:{}});
  const {databaseFixtures: _d1,objectFixtures: _r2,...rest}=input;
  const options=convertV4MiniflareOptions({...rest,bindings:{...input.bindings,DIDMAIL_STORAGE_BACKEND:'afs'},serviceBindings:{...input.serviceBindings,ARC_STORAGE:createStorageBinding(root)}});
  databases.set(options,businessDatabase(store));return options;
}
export async function storageDatabase(mf,options) {const database = databases.get(options); if (!database) throw Error('Missing AFS test fixture'); return database;}
