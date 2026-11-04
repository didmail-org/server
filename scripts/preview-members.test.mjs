import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewMembersConfiguration } from './preview-members.mjs';

test('private member credential never enters Worker bindings, including when disabled', () => {
  const result = previewMembersConfiguration({
    bindings: { NODE_ADDRESS: 'public-node' },
    arc: 'http://127.0.0.1:1234',
    publicOrigin: 'http://didmail-arc.localhost:8788',
  });
  assert.deepEqual(result.workerBindings, { NODE_ADDRESS: 'public-node' });
  assert.deepEqual(result.serviceBindings, {});
  const enabled = previewMembersConfiguration({
    bindings: {
      ARC_MEMBERS_TOKEN: 'fixture-secret',
      DIDMAIL_ARC_INSTANCE_ID: 'didmail-arc',
      DIDMAIL_ACCOUNT_LINKS_ENABLED: '1',
    },
    arc: 'http://127.0.0.1:1234',
    publicOrigin: 'http://didmail-arc.localhost:8788',
    fetcher: async () => new Response(null, { status: 403 }),
  });
  assert.equal('ARC_MEMBERS_TOKEN' in enabled.workerBindings, false);
  assert.equal(typeof enabled.serviceBindings.ARC_MEMBERS, 'function');
  assert.equal(enabled.workerBindings.DIDMAIL_ACCOUNT_LINKS_ENABLED, '1');
  assert.throws(() =>
    previewMembersConfiguration({ bindings: { ARC_MEMBERS_TOKEN: 'fixture-secret' }, arc: 'http://127.0.0.1:1234' }),
  );
});
