import test from 'node:test';
import assert from 'node:assert/strict';
import { runSmoke } from './smoke.mjs';

// Public synthetic responses only. Native runtime/artifact acceptance is
// run separately; these cases make sure the smoke gate rejects regressions.
function fixture({ arc = true, override = () => undefined } = {}) {
  const calls = [];
  const shell = '<header class="aup-app-header"><button data-action-kind="theme-toggle"></button></header>';
  const html = (body) => new Response(shell + body, { headers: { 'content-type': 'text/html' } });
  const fetcher = async (url, options) => {
    const path = url.pathname; calls.push({ path, options });
    const changed = override(path); if (changed) return changed;
    if (path === '/api/health') return Response.json({ status: 'ok', runtime: 'arc-native', storage: 'instance-afs', node: 'public-fixture', arc });
    if (path === '/') return html('DIDMail Server<link href="/aup-core.0123456789abcdef.css"><script src="/_arc/assets/native.js"></script>');
    if (path.endsWith('.css')) return new Response('.aup-app-header{}', { headers: { 'content-type': 'text/css' } });
    if (path.endsWith('.js')) return new Response('', { headers: { 'content-type': 'application/javascript' } });
    if (path === '/help') return html('<main data-didmail-help></main>');
    if (/^\/admin(?:\/|$)/.test(path)) return html('<main data-didmail-admin></main>');
    if (path === '/api/runtime/session') return Response.json({ authenticated: false, user: null }, { status: arc ? 200 : 503 });
    if (path === '/.well-known/service/login') return html('Sign In');
    if (['/api/account/state', '/api/admin/attachment-config', '/api/storage/mails'].includes(path)) return Response.json({}, { status: arc ? 401 : 503 });
    if (path === '/api/mail/download/1') return Response.json({ code: 'PROTOCOL_RETIRED' }, { status: 410 });
    if (path === '/api/mail/attachment-config') return Response.json({ pricePerBytePerDay: '0' });
    if (path === '/api/servers/domains') return Response.json([]);
    return Response.json({}, { status: 404 });
  };
  return { calls, run: () => runSmoke({ origin: 'https://smoke.test', fetcher, report: () => {} }) };
}

for (const arc of [false, true]) {
  test(`smoke accepts native ARC runtime with membership ${arc ? 'connected' : 'unavailable'}, issuing only credential-free GETs`, async () => {
    const f = fixture({ arc }); assert.equal((await f.run()).length, 9);
    for (const { options } of f.calls) {
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      const headers = new Headers(options.headers);
      assert.equal(headers.has('authorization'), false); assert.equal(headers.has('cookie'), false);
    }
    assert.ok(f.calls.some(({ path }) => path === '/admin/members'));
  });
}

for (const [name, path, response] of [
  ['legacy ARC health', '/api/health', () => Response.json({ status: 'ok', runtime: 'arc', storage: 'instance-afs', node: 'fixture', arc: true })],
  ['React SPA deep-link fallback', '/admin/account', () => new Response('<div id="app">DIDMail Server</div>')],
  ['missing core stylesheet', '/aup-core.0123456789abcdef.css', () => new Response('Missing', { status: 404 })],
  ['forged owner authorization', '/api/account/state', () => Response.json({ address: 'private-account' })],
  ['old download authentication contract', '/api/mail/download/1', () => Response.json({}, { status: 401 })],
]) {
  test(`smoke rejects ${name}`, async () => {
    const f = fixture({ override: (requested) => requested === path ? response() : undefined });
    await assert.rejects(f.run(), { name: 'AssertionError' });
  });
}
