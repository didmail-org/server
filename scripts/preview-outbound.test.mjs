import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewChainOutbound } from './preview-outbound.mjs';
test('opt-in preview bridge forwards only the configured chain RPC and never follows redirects', async () => {
  const calls = [];
  const bridge = previewChainOutbound('https://beta.abtnetwork.io/api/', async (url, init) => {
    calls.push({ url, init });
    return new Response('{"data":{}}', { headers: { 'content-type': 'application/json' } });
  });
  for (const url of [
    'https://other.example/api/',
    'https://beta.abtnetwork.io/private',
    'https://beta.abtnetwork.io/api/?redirect=1',
  ])
    assert.equal((await bridge(new Request(url, { method: 'POST', body: '{}' }))).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await bridge(new Request('https://beta.abtnetwork.io/api/'))).status, 403);
  const response = await bridge(
    new Request('https://beta.abtnetwork.io/api/', { method: 'POST', body: '{"query":"read"}' }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(new TextDecoder().decode(calls[0].init.body), '{"query":"read"}');
});

test('preview regenerates connection framing while preserving exact body and chain headers', async () => {
  const body = '{"query":"mutation { sendTx(tx: \\"PUBLIC_FIXTURE\\") { code } }"}';
  let observed;
  const bridge = previewChainOutbound('https://beta.abtnetwork.io/api/', async (url, init) => {
    observed = { url, ...init };
    return new Response('{}');
  });
  await bridge(new Request('https://beta.abtnetwork.io/api/', {
    method: 'POST', body,
    headers: {
      'content-type': 'application/json',
      'content-length': 'invalid-workerd-framing',
      'transfer-encoding': 'chunked',
      connection: 'keep-alive',
      host: 'old-connection.invalid',
      'x-gas-payer-pk': 'PUBLIC_KEY_FIXTURE',
      'x-gas-payer-sig': 'PUBLIC_SIGNATURE_FIXTURE',
    },
  }));
  assert.equal(observed.url, 'https://beta.abtnetwork.io/api/');
  assert.equal(observed.method, 'POST');
  assert.equal(observed.redirect, 'manual');
  for (const name of ['content-length', 'transfer-encoding', 'connection', 'host'])
    assert.equal(observed.headers.has(name), false, name);
  assert.equal(observed.headers.get('content-type'), 'application/json');
  assert.equal(observed.headers.get('x-gas-payer-pk'), 'PUBLIC_KEY_FIXTURE');
  assert.equal(observed.headers.get('x-gas-payer-sig'), 'PUBLIC_SIGNATURE_FIXTURE');
  assert.equal(Buffer.from(observed.body).toString(), body);
});
