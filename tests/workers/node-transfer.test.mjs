import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fromRandom } from '@ocap/wallet';
const wallet = fromRandom();
const owner = fromRandom().address;
const arcScript = `export default {async fetch(request) {
 const path=new URL(request.url).pathname;
 if(path==='/.well-known/service/api/did/session') {
  const auth=request.headers.get('authorization');
  return Response.json(auth==='Bearer owner'?{authenticated:true,user:{did:${JSON.stringify(owner)},role:'owner'}}:auth==='Bearer admin'?{authenticated:true,user:{did:'admin',role:'admin'}}:{authenticated:false,user:null});
 }
 if(path!=='/afs')return new Response('Unexpected request',{status:500});
 const {method,params}=await request.json();
 if(method!=='read')return new Response('Only reads allowed',{status:500});
 const p=params.path;
 if(p.endsWith('/.meta/.capabilities'))return Response.json({success:true,data:{data:{meta:{provenance:{provider:'ocap'}},content:{operations:{read:true,list:{supported:true}}}}}});
 const kind=p.split('/').at(-2),address=p.split('/').at(-1);
 const content=kind==='tokens'?{address,symbol:'TBA',decimal:18}:{address,tokens:[{address:'token',value:'2000000000000000000',symbol:'TBA',decimal:18}]};
 return Response.json({success:true,data:{data:{path:p,content,meta:{kind:kind==='tokens'?'ocap:token':'ocap:account',provenance:{provider:'ocap'}}}}});
}};`;
test('owner transfer authorization and balance checks run in workerd without broadcasting', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [
    { name: 'didmail', modules: true, scriptPath: '.worker/test.mjs', compatibilityDate: '2026-10-24', compatibilityFlags: ['nodejs_compat'],
      bindings: { NODE_SECRET_KEY: wallet.secretKey, DIDMAIL_URL: 'https://didmail.test', CHAIN_ID: 'beta', CHAIN_HOST: 'https://beta.abtnetwork.io/api/', LOCAL_TOKEN_ID: 'token' },
      d1Databases: { DB: 'transfer-test' }, r2Buckets: { BLOBS: 'transfer-test' }, serviceBindings: { ARC: 'arc', ARC_CHAIN: 'arc' }, outboundService: 'deny' },
    { name: 'arc', modules: true, script: arcScript, compatibilityDate: '2026-10-24' },
    { name: 'deny', modules: true, script: `export default {fetch(){throw new Error('No transaction broadcasts permitted')}}`, compatibilityDate: '2026-10-24' },
  ] }));
  const request = (role, method = 'GET', body) => mf.dispatchFetch('https://didmail.test/api/account/transfer', {
    method, headers: { authorization: `Bearer ${role}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    assert.equal((await request('anonymous')).status, 401);
    assert.equal((await request('admin')).status, 403);
    assert.equal((await request('admin', 'POST', { amount: '1', recipient: owner })).status, 403);
    const response = await request('owner');
    assert.equal(response.status, 200);
    const quote = await response.json();
    assert.equal(quote.recipient, owner);
    assert.equal(quote.token.value, '2000000000000000000');
    assert.equal(quote.token.address, 'token');
    assert.equal((await request('owner', 'POST', { amount: '3' })).status, 402);
    assert.equal((await request('owner', 'POST', { amount: '0' })).status, 400);
    const csrf = await mf.dispatchFetch('https://didmail.test/api/account/transfer', { method: 'POST', headers: { authorization: 'Bearer owner', cookie: 'session=example', origin: 'https://evil.test', 'content-type': 'application/json' }, body: JSON.stringify({ amount: '1' }) });
    assert.equal(csrf.status, 403);
  } finally { await mf.dispose(); }
});
