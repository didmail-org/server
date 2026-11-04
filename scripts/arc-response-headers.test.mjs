import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcResponseHeaders } from './arc-response-headers.mjs';
test('local ARC forwarding removes hop-specific proxy headers and retains application headers', () => {
  const result = arcResponseHeaders({
    connection: 'keep-alive, x-hop',
    'x-hop': 'private-hop-value',
    'proxy-connection': 'keep-alive',
    'keep-alive': 'timeout=5',
    'transfer-encoding': 'chunked',
    'content-length': '123',
    'content-type': 'text/html',
    'cache-control': 'no-cache',
    'set-cookie': ['a=1; Path=/', 'b=2; Path=/'],
  });
  for (const name of ['connection', 'x-hop', 'proxy-connection', 'keep-alive', 'transfer-encoding', 'content-length'])
    assert.equal(result.has(name), false);
  assert.equal(result.get('content-type'), 'text/html');
  assert.equal(result.get('cache-control'), 'no-cache');
  assert.deepEqual(result.getSetCookie(), ['a=1; Path=/', 'b=2; Path=/']);
});
