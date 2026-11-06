import { env } from '../../host/environment.mjs';
import { createAfsStorage } from '../storage/afs-storage';
import type { FetchPort, SqlDatabase, ObjectStore } from './contracts';
export interface Bindings {
  DB: SqlDatabase;
  BLOBS: ObjectStore;
  ARC?: FetchPort;
  ARC_CHAIN?: FetchPort;
  ARC_MEMBERS?: FetchPort;
  ARC_STORAGE: FetchPort;
  ARC_MAIL_POLICY?: FetchPort;
  NODE_SECRET_KEY?: string;
  NODE_ADDRESS?: string;
  DIDMAIL_URL: string;
  [key: string]: unknown;
}
const runtime = env as unknown as Bindings;
if (runtime.DIDMAIL_STORAGE_BACKEND !== 'afs') throw new Error('Native DIDMail requires instance AFS business storage');
const storage = createAfsStorage(runtime.ARC_STORAGE);
export const bindings: Bindings = new Proxy(runtime, {
  get(target, key) { return key === 'DB' ? storage.database : key === 'BLOBS' ? storage.objects : Reflect.get(target, key); },
});
export const value = (name: string, fallback = ''): string => String(bindings[name] ?? fallback);
