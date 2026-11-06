import test from 'node:test';
import assert from 'node:assert/strict';
import { toBase58 } from '@ocap/util';
import { decodeOcapReference } from '../tests/business/ocap-reference-codec.mjs';

test('reference codec transfers exact bytes while the host event loop runs', async () => {
  const bytes = Uint8Array.from({ length: 512 }, (_, i) => i % 256);
  let responsive = false;
  const turn = setImmediate(() => { responsive = true; });
  try {
    assert.deepEqual(await decodeOcapReference(toBase58(bytes)), bytes);
    assert.equal(responsive, true);
  } finally {
    clearImmediate(turn);
  }
});

test('independent reference codec workers propagate invalid-input errors', async () => {
  await assert.rejects(decodeOcapReference('z0OIl'), /base58|Non-base58/i);
});
