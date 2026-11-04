import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv-flow').config({ silent: true });
const endpoint = `http://127.0.0.1:${process.env.DIDMAIL_PORT || 3140}`;
const checks = [];
const request = (path, options) => fetch(endpoint + path, { ...options, signal: AbortSignal.timeout(15000) });
const check = async (name, action) => { await action(); checks.push(name); console.log(`PASS ${name}`); };
await check('API database readiness', async () => { const res = await request('/api/health'); assert.equal(res.status, 200); assert.equal((await res.json()).runtime, 'arc'); });
let html;
await check('React page is served by ARC Web Device', async () => {
  const res = await request('/'); assert.equal(res.status, 200);
  assert.match(res.headers.get('x-arc-version') || '', /^2\./);
  html = await res.text(); assert.match(html, /id="app"/); assert.match(html, /DIDMail Server/);
});
await check('JavaScript and CSS resources', async () => {
  const assets = [...html.matchAll(/(?:src|href)="(\/(?:assets|_arc\/assets)\/[^"]+)"/g)].map(x => x[1]);
  assert.ok(assets.some(p => p.endsWith('.js'))); assert.ok(assets.some(p => p.endsWith('.css')));
  for (const asset of assets) {
    const res = await request(asset); assert.equal(res.status, 200, asset);
    assert.match(res.headers.get('content-type') || '', asset.endsWith('.css') ? /css/ : /javascript/);
  }
});
await check('Client navigation deep links', async () => {
  for (const path of ['/admin', '/admin/account', '/admin/server', '/admin/envelope', '/admin/namecard', '/admin/storage', '/admin/attachment']) {
    const res = await request(path); assert.equal(res.status, 200); assert.match(await res.text(), /id="app"/);
  }
});
await check('ARC login and anonymous identity', async () => {
  const login = await request('/.well-known/service/login'); assert.equal(login.status, 200); assert.match(await login.text(), /Sign In/);
  const res = await request('/api/runtime/session'); assert.equal(res.status, 200); assert.equal((await res.json()).authenticated, false);
});
await check('Anonymous admin and mail requests rejected', async () => {
  for (const path of ['/api/account/state', '/api/admin/attachment-config', '/api/mail/download/1']) {
    const res = await request(path, { headers: { 'x-arc-role': 'owner' } }); assert.equal(res.status, 401, path);
  }
});
await check('Public client capabilities', async () => {
  const policy = await request('/api/mail/attachment-config'); assert.equal(policy.status, 200); assert.equal(typeof (await policy.json()).pricePerBytePerDay, 'string');
  assert.equal((await request('/api/servers/domains')).status, 200);
});
await check('ARC-mounted read-only provider', async () => {
  const res = await request('/api/afs/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'read', path: '/didmail/health.json', blocklet: 'didmail-arc' }) });
  const result = await res.json(); assert.equal(result.ok, true); assert.equal(JSON.parse(result.data.content).runtime, 'arc');
  const denied = await request('/api/afs/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'read', path: '/didmail/node-wallet.json', blocklet: 'didmail-arc' }) });
  assert.notEqual((await denied.json()).ok, true);
});
await check('Unknown API has a JSON 404', async () => { const res = await request('/api/not-found'); assert.equal(res.status, 404); assert.match(res.headers.get('content-type'), /json/); });
console.log(`Verified ${checks.length} live checks against ${endpoint}`);
