import test from 'node:test';
import assert from 'node:assert/strict';
import createChainForward from './arc-chain-bridge.mjs';
const rpc = (method, path) =>
  new Request('https://didmail.test/afs', {
    method: 'POST',
    headers: { cookie: 'private-user-session', authorization: 'Bearer browser', 'x-forwarded-host': 'untrusted' },
    body: JSON.stringify({ method, params: { path } }),
  });
test('internal bridge forwards only canonical read/list requests without browser credentials', async () => {
  const calls = [];
  const bridge = createChainForward('http://127.0.0.1:64867', async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json({ success: true });
  });
  for (const method of ['read', 'list'])
    assert.equal((await bridge(rpc(method, '/dev/chain/beta/factories/factory'))).status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'http://127.0.0.1:64867/afs');
  assert.deepEqual(calls[0].options.headers, { 'content-type': 'application/json', accept: 'application/json' });
  assert.equal(calls[0].options.redirect, 'manual');
  for (const [method, path] of [
    ['exec', '/dev/chain/beta/.actions/foo'],
    ['write', '/dev/chain/beta/accounts/node'],
    ['read', '/work/private'],
    ['read', '/dev/chain/beta/../../vault'],
    ['read', '/dev/chain/beta/%2e%2e/vault'],
    ['read', '/dev/chain/beta//accounts/node'],
  ])
    assert.equal((await bridge(rpc(method, path))).status, 403);
  assert.equal(calls.length, 2);
});
