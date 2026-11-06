// Read-only acceptance of the native ARC protocol API and pages.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function runSmoke({ origin, fetcher = fetch, report = console.log }) {
  const endpoint = new URL(origin);
  assert.ok(['http:', 'https:'].includes(endpoint.protocol));
  assert.ok(!endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash);
  assert.equal(endpoint.pathname, '/', 'Supply the server origin without a path');
  const request = (path, headers) => fetcher(new URL(path, endpoint), {
    method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  const checks = [];
  const check = async (name, action) => {
    await action(); checks.push(name); report(`PASS ${name}`);
  };
  const nativePage = (html) => {
    assert.match(html, /<header\b[^>]*class="aup-app-header"/);
    assert.equal((html.match(/<header\b/g) || []).length, 1);
    assert.match(html, /data-action-kind="theme-toggle"/);
    assert.doesNotMatch(html, /id="app"|react-dom|runtime-config\.js/);
  };
  let arc;
  await check('Business storage readiness', async () => {
    const res = await request('/api/health'); assert.equal(res.status, 200);
    const health = await res.json();
    assert.equal(health.status, 'ok');
    assert.equal(health.runtime, 'arc-native');
    assert.ok(['d1+r2','instance-afs'].includes(health.storage));
    assert.equal(typeof health.node, 'string'); assert.ok(health.node);
    assert.equal(typeof health.arc, 'boolean'); arc = health.arc;
  });
  let html;
  await check('Native ARC landing page', async () => {
    const res = await request('/'); assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    html = await res.text(); nativePage(html); assert.match(html, /DIDMail Server/);
  });
  await check('Native JavaScript and core/component stylesheets', async () => {
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/(?:_arc\/assets\/|aup-core\.)[^"?#]+\.(?:js|css))"/g)].map((m) => m[1]))];
    assert.ok(assets.some((p) => p.endsWith('.js')));
    assert.ok(assets.some((p) => p.startsWith('/aup-core.')));
    for (const asset of assets) {
      const res = await request(asset); assert.equal(res.status, 200, asset);
      assert.match(res.headers.get('content-type') || '', asset.endsWith('.css') ? /css/ : /javascript/, asset);
    }
  });
  await check('Help and all native admin deep links', async () => {
    for (const path of ['/help', '/admin', ...['account', 'server', 'envelope', 'namecard', 'storage', 'attachment', 'members'].map((name) => '/admin/' + name)]) {
      const res = await request(path); assert.equal(res.status, 200, path);
      const page = await res.text(); nativePage(page);
      assert.ok(page.includes(path === '/help' ? 'data-didmail-help' : 'data-didmail-admin'), path);
    }
  });
  await check(arc ? 'ARC login and anonymous session' : 'Missing ARC identity fails closed', async () => {
    const session = await request('/api/runtime/session');
    assert.equal(session.status, arc ? 200 : 503);
    if (arc) {
      const body = await session.json(); assert.equal(body.authenticated, false); assert.equal(body.user, null);
      const login = await request('/.well-known/service/login'); assert.equal(login.status, 200);
      assert.match(await login.text(), /sign in/i);
    }
  });
  await check('Forged owner headers cannot authorize administration', async () => {
    for (const path of ['/api/account/state', '/api/admin/attachment-config', '/api/storage/mails']) {
      const res = await request(path, { 'x-arc-role': 'owner', 'x-arc-did': 'smoke-forged-owner' });
      assert.equal(res.status, arc ? 401 : 503, path);
    }
  });
  await check('Retired legacy mail protocol returns 410', async () => {
    const res = await request('/api/mail/download/1'); assert.equal(res.status, 410);
    assert.equal((await res.json()).code, 'PROTOCOL_RETIRED');
  });
  await check('Public attachment policy and domains', async () => {
    const policy = await request('/api/mail/attachment-config'); assert.equal(policy.status, 200);
    assert.equal(typeof (await policy.json()).pricePerBytePerDay, 'string');
    assert.equal((await request('/api/servers/domains')).status, 200);
  });
  await check('Unknown API has a JSON 404', async () => {
    const res = await request('/api/not-found'); assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') || '', /json/);
  });
  report(`Verified ${checks.length} read-only smoke checks against ${endpoint.origin}`);
  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runSmoke({ origin: process.env.DIDMAIL_SMOKE_URL || process.env.DIDMAIL_BROWSER_URL || 'http://didmail-server.localhost:8788' });
}
