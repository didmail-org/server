import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstanceConfigClient } from '../../ui/instance-config.js';

function socketFixture(reply) {
  return class extends EventTarget {
    constructor(url) { super(); assert.equal(new URL(url).protocol, 'wss:'); queueMicrotask(() => this.dispatchEvent(new Event('open'))); }
    send(raw) {
      const message = JSON.parse(raw);
      queueMicrotask(() => {
        const response = message.type === 'join_session' ? { type: 'session' } : reply(message);
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) }));
      });
    }
    close() { this.dispatchEvent(new Event('close')); }
  };
}
test('native configuration writes carry the version and config, never a caller-selected identity or path', async () => {
  const config = { maxFileSizeBytes: 1, maxFileCount: 2, pricePerBytePerDay: '900719925474099312345' };
  const client = createInstanceConfigClient({ origin: 'https://fixture.test', Socket: socketFixture(message => {
    assert.equal(message.path, '/didmail-native/.actions/update-attachment-config');
    assert.deepEqual(message.args, { version: 'v1', config });
    return { type: 'afs_result', reqId: message.reqId, data: { success: true } };
  }) });
  assert.deepEqual(await client.update('v1', config), { success: true });
});
test('native configuration surfaces stale writes and refuses reads without a version', async () => {
  const client = createInstanceConfigClient({ origin: 'https://fixture.test', Socket: socketFixture(message => ({ type: 'afs_error', reqId: message.reqId, code: 'AFS_CONFLICT', error: 'Policy changed' })) });
  await assert.rejects(client.update('old', {}), { code: 'AFS_CONFLICT', status: 409 });
  const unversioned = createInstanceConfigClient({ origin: 'https://fixture.test', Socket: socketFixture(message => ({ type: 'afs_result', reqId: message.reqId, data: { content: '{}' } })) });
  await assert.rejects(unversioned.read(), /version is unavailable/);
});
