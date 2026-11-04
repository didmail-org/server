import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { previewArcService } from './preview-arc-service.mjs';

function send(service, { url = 'http://didmail-arc.localhost:8788/admin/server', method = 'GET', body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { hostname: '127.0.0.1', port: Number(service.binding.external.address.split(':')[1]), path: url, method },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }),
        );
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}
test('external loopback transport preserves public URL, binary bodies, cookies and complete repeated HTML responses', async () => {
  const seen = [];
  const service = await previewArcService(async (request) => {
    seen.push({ url: request.url, method: request.method, body: Buffer.from(await request.arrayBuffer()) });
    return new Response('hello'.repeat(50000), {
      headers: [
        ['content-type', 'text/html'],
        ['set-cookie', 'a=1; Path=/'],
        ['set-cookie', 'b=2; Path=/'],
        ['connection', 'keep-alive'],
      ],
    });
  });
  try {
    assert.equal(service.binding.external.http.style, 1);
    for (let i = 0; i < 4; i++) {
      const result = await send(service);
      assert.equal(result.status, 200);
      assert.equal(result.body.length, 250000);
      assert.deepEqual(result.headers['set-cookie'], ['a=1; Path=/', 'b=2; Path=/']);
      assert.equal(Number(result.headers['content-length']), result.body.length);
    }
    const body = Buffer.from([0, 255, 3, 9]);
    await send(service, { method: 'POST', body });
    assert.deepEqual(seen.at(-1).body, body);
    assert.equal(seen[0].url, 'http://didmail-arc.localhost:8788/admin/server');
    const invalid = await send(service, { url: '/relative' });
    assert.equal(invalid.status, 502);
    assert.equal(seen.length, 5);
  } finally {
    await service.close();
  }
});
test('upstream failures return a generic uncached response', async () => {
  const service = await previewArcService(async () => {
    throw Error('private credential diagnostic');
  });
  try {
    const result = await send(service);
    assert.equal(result.status, 502);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.body.toString().includes('private'), false);
  } finally {
    await service.close();
  }
});

test('Worker-created ARC session requests preserve authentication through the external HTTP bridge', async () => {
  const seen = [];
  const service = await previewArcService(async (request) => {
    seen.push({
      url: request.url,
      host: request.headers.get('host'),
      cookie: request.headers.get('cookie'),
      authorization: request.headers.get('authorization'),
    });
    const authenticated =
      request.headers.get('cookie') === 'session=fixture-owner' ||
      request.headers.get('authorization') === 'Bearer fixture-owner';
    return Response.json(
      authenticated
        ? { authenticated: true, user: { did: 'fixture-owner', role: 'owner' } }
        : { authenticated: false, user: null },
    );
  });
  const result = await build({
    stdin: {
      contents: `import { arcFetch } from './workers/arc.ts';
      export default { async fetch(request) {
        const headers = new Headers({accept:'application/json'});
        for (const name of ['cookie','authorization']) if (request.headers.has(name)) headers.set(name,request.headers.get(name));
        return arcFetch(new Request('http://didmail-arc.localhost:8788/.well-known/service/api/did/session', {headers,signal:AbortSignal.timeout(5000)}));
      }};`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    external: ['cloudflare:*'],
    write: false,
  });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: result.outputFiles[0].text,
      compatibilityDate: '2026-10-24',
      serviceBindings: { ARC: service.binding },
    }),
  );
  try {
    for (const headers of [{}, { cookie: 'session=fixture-owner' }, { authorization: 'Bearer fixture-owner' }]) {
      const response = await mf.dispatchFetch('http://didmail-arc.localhost:8788/api/runtime/session', { headers });
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.authenticated, Object.keys(headers).length > 0);
      assert.equal(data.user?.role || null, Object.keys(headers).length ? 'owner' : null);
    }
    assert.equal(seen.length, 3);
    for (const request of seen) {
      assert.equal(request.host, 'didmail-arc.localhost:8788');
      assert.equal(request.url, 'http://didmail-arc.localhost:8788/.well-known/service/api/did/session');
    }
    assert.equal(seen[1].cookie, 'session=fixture-owner');
    assert.equal(seen[2].authorization, 'Bearer fixture-owner');
  } finally {
    await mf.dispose();
    await service.close();
  }
});
