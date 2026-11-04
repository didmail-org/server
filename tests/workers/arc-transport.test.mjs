import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArcTransport } from '../../api/src/runtime/arc-transport.ts';

test('ARC binding takes precedence and derives Host from the request URL', async () => {
  let received;
  const transport = createArcTransport({
    origin: 'https://other.example',
    binding: { async fetch(request) { received = request; return new Response('binding'); } },
    fetch: async () => { throw new Error('origin must not be called'); },
  });
  const response = await transport.fetch(new Request('https://arc.example/path?q=1', {
    headers: { host: 'attacker.example', cookie: 'fixture=session' },
  }));
  assert.equal(transport.available, true);
  assert.equal(await response.text(), 'binding');
  assert.equal(received.headers.get('host'), 'arc.example');
  assert.equal(received.headers.get('cookie'), 'fixture=session');
});

test('ARC origin preserves path, query and request method without following redirects', async () => {
  let received, init;
  const transport = createArcTransport({ origin: 'https://arc.example/', fetch: async (request, options) => {
    received = request; init = options; return new Response(null, { status: 302 });
  } });
  const response = await transport.fetch(new Request('https://public.example/test?q=1', { method: 'POST', body: 'fixture' }));
  assert.equal(response.status, 302);
  assert.equal(received.url, 'https://arc.example/test?q=1');
  assert.equal(received.method, 'POST');
  assert.equal(await received.text(), 'fixture');
  assert.equal(init.redirect, 'manual');
});

test('missing or invalid ARC configuration fails closed', async () => {
  const missing = createArcTransport({});
  assert.equal(missing.available, false);
  await assert.rejects(() => missing.fetch(new Request('https://example.test/')), /required/);
  for (const origin of ['http://arc.example', 'https://user:pass@arc.example/', 'https://arc.example/path']) {
    const transport = createArcTransport({ origin });
    await assert.rejects(() => transport.fetch(new Request('https://example.test/')), /HTTPS origin/);
  }
});
