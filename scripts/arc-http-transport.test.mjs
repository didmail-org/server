import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { arcHttpTransport } from './arc-http-transport.mjs';
test('ARC credential transport sends the fixed public Host on the wire, preserves scope, and never follows redirects', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/redirect') {
      res.writeHead(302, { location: 'https://attacker.invalid' });
      return res.end('{}');
    }
    res.end(
      JSON.stringify({
        host: req.headers.host,
        forwarded: req.headers['x-forwarded-host'],
        proto: req.headers['x-forwarded-proto'],
        authorization: req.headers.authorization,
        path: req.url,
      }),
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`,
    f = arcHttpTransport(origin, 'https://mail.example.test');
  try {
    const result = await (
      await f(origin + '/member?instance=only', {
        method: 'GET',
        headers: { authorization: 'Bearer fixture', host: 'attacker.invalid' },
      })
    ).json();
    assert.deepEqual(result, {
      host: 'mail.example.test',
      forwarded: 'mail.example.test',
      proto: 'https',
      authorization: 'Bearer fixture',
      path: '/member?instance=only',
    });
    assert.equal((await f(origin + '/redirect', { method: 'GET', headers: {} })).status, 302);
    await assert.rejects(() => f('https://attacker.invalid/member', { headers: {} }));
  } finally {
    await new Promise((r) => server.close(r));
  }
});
