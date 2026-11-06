import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from './host/miniflare.mjs';
import { fromRandom } from '@ocap/wallet';

const policy = { maxFileSizeBytes: 1024, maxFileCount: 3, pricePerBytePerDay: '900719925474099312345', updatedAt: '2026-11-05T00:00:00.000Z' };
test('native business adapter reads the authoritative AFS config with no D1 binding and rejects legacy writes', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [
    { name: 'app', modules: true, scriptPath: 'artifacts/business-tests/test.mjs', compatibilityDate: '2026-10-24', compatibilityFlags: ['nodejs_compat'], bindings: { NODE_SECRET_KEY: fromRandom().secretKey, DIDMAIL_CONFIG_BACKEND: 'afs', DIDMAIL_URL: 'https://config.test' }, serviceBindings: { ARC: 'arc' }, outboundService: 'deny' },
    { name: 'arc', modules: true, script: `export default{async fetch(r){if(new URL(r.url).pathname.endsWith('/did/session'))return Response.json({authenticated:true,user:{did:'did:test:owner',role:'owner'}});const body=await r.json();if(body.type!=='read'||body.path!=='/didmail-native/attachment-config.json')throw Error('Unexpected ARC operation');return Response.json({ok:true,data:{content:JSON.stringify(${JSON.stringify(policy)})}})}}` },
    { name: 'deny', modules: true, script: `export default{fetch(){throw Error('External networking forbidden')}}` },
  ] }));
  try {
    const response = await mf.dispatchFetch('https://config.test/api/mail/attachment-config');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), policy);
    const denied = await mf.dispatchFetch('https://config.test/api/admin/attachment-config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxFileCount: 99 }) });
    assert.equal(denied.status, 409);
    assert.equal((await denied.json()).code, 'CONFIG_MANAGED_BY_ARC');
    assert.deepEqual(await (await mf.dispatchFetch('https://config.test/api/mail/attachment-config')).json(), policy);
  } finally { await mf.dispose(); }
});
test('missing AFS config fails closed instead of creating a D1 default', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [
    { name: 'app', modules: true, scriptPath: 'artifacts/business-tests/test.mjs', compatibilityDate: '2026-10-24', compatibilityFlags: ['nodejs_compat'], bindings: { NODE_SECRET_KEY: fromRandom().secretKey, DIDMAIL_CONFIG_BACKEND: 'afs', DIDMAIL_URL: 'https://config.test' }, serviceBindings: { ARC: 'arc' }, outboundService: 'deny' },
    { name: 'arc', modules: true, script: `export default{fetch(){return Response.json({ok:false,error:'Not configured'},{status:404})}}` },
    { name: 'deny', modules: true, script: `export default{fetch(){throw Error('External networking forbidden')}}` },
  ] }));
  try { assert.equal((await mf.dispatchFetch('https://config.test/api/mail/attachment-config')).status, 503); }
  finally { await mf.dispose(); }
});
