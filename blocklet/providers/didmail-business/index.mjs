import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AfsBusinessStore } from './store.mjs';
import { createStorageOperations, storageFailure } from './operations.mjs';
import { initializeBusinessStorage, upgradeDeliveryStorage } from './initialize.mjs';
import { requireAdmin } from '../didmail-native/mail-policy.mjs';
import { runtimePath } from './paths.mjs';
import { recoverNativeAdmissions } from './recover.mjs';

const healthPath = '/health.json', initializePath = '/.actions/initialize-business';
const meta = { capabilities: ['list','read','stat','explain'], accessMode: 'readonly' };
const actionMeta = { kind:'afs:executable',effect:'write',severity:'ambient' };
const failure = (code, message) => Object.assign(new Error(message), { code });
export function authorizePrivateRuntime(request, token) {
  if (request.headers.has('origin')) return false;
  const expected = Buffer.from('Bearer ' + token), actual = Buffer.from(request.headers.get('authorization') || '');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Local ARC provider. It has no public SQL action. The control listener lives
// inside ARC's process, is loopback-only and requires an instance-private token.
export default class DIDMailBusinessProvider {
  name = 'didmail-business';
  description = 'ARC-native private DIDMail transaction and encrypted-object engine';
  accessMode = 'readwrite';
  static async load() { return new DIDMailBusinessProvider(); }
  onMount(root) { this.stopped = false; this.root = root; }
  async onUnmount() {
    this.stopped = true;
    await this.starting?.catch(() => {});
    clearInterval(this.recoveryTimer);
    this.server?.stop(true);
    this.server = undefined;
    this.starting = undefined;
  }
  async start() {
    if (this.stopped) return;
    if (this.starting) return this.starting;
    this.starting = this.startRuntime().catch(error => { this.starting = undefined; throw error; });
    return this.starting;
  }
  async startRuntime() {
    if (typeof globalThis.Bun?.serve !== 'function') throw failure('AFS_NATIVE_RUNTIME_UNAVAILABLE','The local ARC native server runtime is required');
    const store = new AfsBusinessStore(this.root); await store.capabilities();
    if (this.stopped) return;
    await upgradeDeliveryStorage(this.root);
    if (this.stopped) return;
    const token = randomBytes(32).toString('hex'), operate = createStorageOperations(this.root);
    const server = Bun.serve({ hostname:'127.0.0.1',port:0,maxRequestBodySize:80*1024*1024,
      fetch: async request => {
        if (!authorizePrivateRuntime(request, token)) return new Response('Private runtime authorization required',{status:403});
        if (request.method !== 'POST' || new URL(request.url).pathname !== '/storage') return new Response('Private storage operation required',{status:403});
        try { return Response.json({data:await operate(await request.json())}); }
        catch(error) { const result=storageFailure(error);return Response.json(result,{status:result.status}); }
      },
    });
    try {
      let previous;
      try { previous=(await this.root.read(runtimePath)).data; }
      catch(error) { if (!['AFS_NOT_FOUND',1].includes(error.code)) throw error; }
      const descriptor = {schemaVersion:1,kind:'didmail-native-business',pid:process.pid,port:server.port,token};
      await this.root.write(runtimePath,{content:JSON.stringify(descriptor)},{ifMatch:previous?.meta?.version || '!absent'});
      this.server = server;
      let recovering=false;
      this.recoveryTimer=setInterval(async()=>{
        if(recovering)return;recovering=true;
        try{await recoverNativeAdmissions(this.root);}
        catch(error){if(!['AFS_NOT_FOUND',1].includes(error.code))console.error('DIDMail native admission recovery deferred');}
        finally{recovering=false;}
      },10000);
      this.recoveryTimer.unref?.();
    } catch(error) { server.stop(true); throw error; }
  }
  async list(path) {
    if (path === '/.actions') return {data:[{path:initializePath,meta:actionMeta}]};
    if (path !== '/') throw failure('AFS_NOT_FOUND','Native business resource not found');
    return {data:[{path:healthPath,meta},{path:'/.actions',meta:{kind:'afs:node'}}]};
  }
  async stat(path) {
    if (![healthPath,initializePath,'/','/.actions'].includes(path)) throw failure('AFS_NOT_FOUND','Native business resource not found');
    return {data:{path,meta:path===initializePath?actionMeta:meta}};
  }
  async read(path) {
    if (path !== healthPath) throw failure('AFS_NOT_FOUND','Native business resource not found');
    await this.start();
    let initialized = false;
    try { await new AfsBusinessStore(this.root).read(); initialized = true; }
    catch(error) { if (!['AFS_NOT_FOUND',1].includes(error.code)) throw error; }
    return {data:{path,content:JSON.stringify({runtime:'arc-native',storage:'instance-afs',initialized,protocolIngress:false}),mimeType:'application/json',meta}};
  }
  async exec(path, args, options) {
    if (path !== initializePath) throw failure('AFS_ACTION_NOT_FOUND','Native business action not found');
    requireAdmin(options?.context?.caller);
    const { _scope_afs: _scope, ...input } = args || {};
    if (Object.keys(input).length) throw failure('AFS_VALIDATION_ERROR','Initialization takes no caller-selected data or paths');
    await initializeBusinessStorage(this.root); return {data:{initialized:true}};
  }
  async explain() { return {data:'Local ARC-native transaction/object engine. Public health omits process/port/token and all business records. Explicit initialization requires an ARC owner/admin. SQL operations have no public AFS action. The private loopback control listener uses an instance-private capability; native protocol HTTP ingress is provided by didmail-http.'}; }
}
