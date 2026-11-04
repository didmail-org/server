import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewRouting } from './preview-routing.mjs';
const options = { origin: 'http://didmail-arc.localhost:8788', arc: 'http://127.0.0.1:64867' };
test('default preview stays loopback and preserves existing desktop routing', () => {
  const routing = previewRouting(options);
  assert.equal(routing.listenHost, '127.0.0.1');
  const result = routing.resolve(options.origin + '/__blocklet__.js');
  assert.equal(result.target.href, options.arc + '/__blocklet__.js');
  assert.equal(result.publicOrigin, options.origin);
});
test('configured LAN origin preserves invite query and pins ARC namespace and callback origin', () => {
  const routing = previewRouting({ ...options, aliases: 'http://192.168.1.23:8788', listenHost: '0.0.0.0' });
  const result = routing.resolve(
    'http://192.168.1.23:8788/.well-known/service/invite?id=synthetic-invite&blocklet=another-app',
  );
  assert.equal(result.target.origin, options.arc);
  assert.equal(result.target.searchParams.get('id'), 'synthetic-invite');
  assert.equal(result.target.searchParams.get('blocklet'), 'didmail-arc');
  assert.equal(result.publicOrigin, 'http://192.168.1.23:8788');
  assert.throws(() => routing.resolve('http://attacker.example:8788/'), /Unconfigured/);
});
test('LAN configuration rejects public hosts, credentials, paths, extra queries and wrong ports', () => {
  for (const alias of [
    'http://example.com:8788',
    'http://8.8.8.8:8788',
    'http://user:secret@192.168.1.23:8788',
    'http://192.168.1.23:8788/path',
    'http://192.168.1.23:8788/?x=1',
    'http://192.168.1.23:9999',
  ]) {
    assert.throws(() => previewRouting({ ...options, aliases: alias }));
  }
  assert.throws(() => previewRouting({ ...options, listenHost: '8.8.8.8' }));
});

test('explicit loopback aliases support Android USB reverse without DNS or hosts changes', () => {
  const routing = previewRouting({ ...options, aliases: 'http://localhost:8788,http://127.0.0.1:8788' });
  for (const host of ['localhost', '127.0.0.1']) {
    const result = routing.resolve(`http://${host}:8788/__blocklet__.js`);
    assert.equal(result.publicOrigin, `http://${host}:8788`);
    assert.equal(result.target.searchParams.get('blocklet'), 'didmail-arc');
  }
});
