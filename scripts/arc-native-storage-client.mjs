import {businessPath,objectPrefix,runtimePath} from '../blocklet/providers/didmail-business/paths.mjs';
export function businessDatabase(store) {
  class Statement {
    constructor(sql, params = []) { this.input = { sql, params }; }
    bind(...params) { return new Statement(this.input.sql, params); }
    async all() { return (await store.transaction([this.input]))[0]; }
    run() { return this.all(); }
    async first(column) { const row = (await this.all()).results[0] ?? null; return column && row ? row[column] : row; }
  }
  const database = { prepare: sql => new Statement(sql), batch: statements => store.transaction(statements.map(s => s.input)), withSession: () => ({ ...database, getBookmark: () => null }) };
  return database;
}

// Fixed loopback operator scope. Never route public requests to this adapter.
export function localBusinessRoot(origin, { fetcher = fetch } = {}) {
  const base = new URL(origin);
  if (base.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(base.hostname) || base.username || base.password || base.pathname !== '/') throw Error('Fixed local ARC origin required');
  const rpc = async (method, path, input, options) => {
    if (path !== '/instance/.meta/.capabilities' && path !== businessPath && path !== runtimePath && !(path.startsWith(objectPrefix) && /^[a-f0-9]{64}\.json$/.test(path.slice(objectPrefix.length)))) throw Error('Outside business storage scope');
    if (method === 'write' && path === '/instance/.meta/.capabilities') throw Error('Capabilities are read-only');
    const response = await fetcher(new URL('/afs', base), { method:'POST',headers:{'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(30000),body:JSON.stringify({method,params:{path:'/blocklets/didmail-server'+path,...(input?{content:input}:{}),...(options?{options}:{})}}) });
    const body = await response.json();
    if (!response.ok || !body.success) {
      const conflict = /conflict|version.*match|already exists/i.test(body.error?.message || '');
      throw Object.assign(new Error('Instance business storage unavailable'), { code:conflict?'AFS_CONFLICT':body.error?.code===1?'AFS_NOT_FOUND':typeof body.error?.code==='string'?body.error.code:'AFS_UNAVAILABLE',status:conflict?409:503 });
    }
    return body.data;
  };
  return {read:path=>rpc('read',path),write:(path,input,options)=>rpc('write',path,input,options)};
}
// Only transport stays outside ARC. There is no SQL evaluator or object store
// in this binding: every operation runs in the packaged ARC provider process.
export function createNativeStorageBinding(origin) {
  const base = new URL(origin),root=localBusinessRoot(origin);
  let activation;
  const activate=()=>activation ||= fetch(new URL('/api/afs/rpc?blocklet=didmail-server',base),{
    method:'POST',headers:{'content-type':'application/json',host:'didmail-server.localhost:'+base.port},
    body:JSON.stringify({type:'read',path:'/didmail-business/health.json'}),redirect:'error',signal:AbortSignal.timeout(30000),
  }).then(async response=>{const body=await response.json();if(!response.ok||!body.ok)throw Error('Native ARC business provider unavailable');}).finally(()=>{activation=undefined;});
  return async request=>{
    if(request.method!=='POST'||new URL(request.url).pathname!=='/storage')return new Response('Private storage operation required',{status:403});
    try{
      await activate();
      const descriptor=JSON.parse((await root.read(runtimePath)).data.content);
      if(descriptor.schemaVersion!==1||descriptor.kind!=='didmail-native-business'||!Number.isInteger(descriptor.port)||descriptor.port<1||descriptor.port>65535||!Number.isSafeInteger(descriptor.pid)||!/^[a-f0-9]{64}$/.test(descriptor.token))throw Error('Invalid native runtime descriptor');
      const response=await fetch('http://127.0.0.1:'+descriptor.port+'/storage',{
        method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+descriptor.token},
        body:await request.text(),redirect:'error',signal:AbortSignal.timeout(30000),
      });
      return new Response(response.body,{status:response.status,headers:{'content-type':'application/json'}});
    }catch{
      activation=undefined;
      // Never replay an unknown write. The caller must reconcile its original ID.
      return Response.json({code:'AFS_STORAGE_UNAVAILABLE',error:'Native ARC business runtime unavailable'},{status:503});
    }
  };
}
export async function nativeStorageOperation(binding,input) {
  const response=await binding(new Request('http://arc-storage.internal/storage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));
  const result=await response.json();
  if(!response.ok)throw Object.assign(new Error(result.error||'Native runtime unavailable'),{code:result.code,status:response.status});
  return result.data;
}
export function createNativePolicyBinding(storage) {
  return async request=>{
    if(request.method!=='POST'||new URL(request.url).pathname!=='/policy')return new Response('Private policy operation required',{status:403});
    try{return Response.json({data:await nativeStorageOperation(storage,{op:'policy',operation:await request.json()})});}
    catch(error){return Response.json({code:error.code||'MAIL_POLICY_UNAVAILABLE',detail:error.status<500?error.message:'Instance policy unavailable'},{status:error.status||503});}
  };
}
