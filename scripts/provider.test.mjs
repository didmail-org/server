import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Provider from '../blocklet/providers/didmail/index.mjs';

test('AFS provider enumerates exactly its public read-only resources', async () => {
  const provider = new Provider('http://127.0.0.1:1');
  assert.deepEqual((await provider.list('/')).data.map(x => x.path), ['/health.json', '/attachment-config.json']);
  assert.equal((await provider.stat('/')).data.meta.accessMode, 'readonly');
  assert.equal(provider.write, undefined);
  assert.equal(provider.exec, undefined);
  await assert.rejects(provider.read('/node-wallet.json'), /not found/);
  await assert.rejects(provider.read('/../../.data/node-wallet.json'), /not found/);
});

test('AFS provider reads the public HTTP endpoint and reports upstream failures', async () => {
  let status = 200;
  const server = http.createServer((req, res) => { assert.equal(req.url, '/api/mail/attachment-config'); res.statusCode = status; res.end('{"maxFileCount":5}'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const provider = new Provider(`http://127.0.0.1:${server.address().port}`);
    const result = await provider.read('/attachment-config.json');
    assert.deepEqual(JSON.parse(result.data.content), { maxFileCount: 5 });
    status = 503;
    await assert.rejects(provider.read('/attachment-config.json'), /unavailable/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
