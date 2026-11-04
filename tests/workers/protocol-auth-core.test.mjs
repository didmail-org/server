import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromRandom } from '@ocap/wallet';
import { toUint8Array } from '@ocap/util';
import { identityId, signRequest } from '@didmail/protocol';
import { authenticateProtocolRequest, readProtocolBody } from '../../api/src/runtime/protocol-auth.ts';

function request() {
  const wallet = fromRandom();
  const url = 'https://fixture.test/v1/service-policy';
  const headers = signRequest('GET', url, new Uint8Array(), identityId(wallet.address), toUint8Array(wallet.secretKey));
  return new Request(url, { headers });
}

test('signed requests consume a nonce once before the identity rate limit', async () => {
  const req = request();
  const seen = new Set();
  const operations = [];
  const storage = {
    async consumeNonce(identity, nonce, expires) {
      operations.push('nonce');
      assert.ok(expires > Date.now() / 1000);
      const key = `${identity}:${nonce}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    async allowIdentity() { operations.push('rate'); return true; },
  };
  const result = await authenticateProtocolRequest(req.clone(), 0, () => true, storage);
  assert.ok(result.auth.identityId);
  await assert.rejects(() => authenticateProtocolRequest(req.clone(), 0, () => true, storage), { code: 'REQUEST_REPLAYED', status: 409 });
  assert.deepEqual(operations, ['nonce', 'rate', 'nonce']);
});

test('invalid signatures do not access nonce storage and over-limit bodies are rejected', async () => {
  let accessed = false;
  const storage = { async consumeNonce() { accessed = true; return true; }, async allowIdentity() { return true; } };
  await assert.rejects(() => authenticateProtocolRequest(new Request('https://fixture.test/'), 0, () => true, storage), { code: 'AUTHENTICATION_FAILED', status: 401 });
  assert.equal(accessed, false);
  await assert.rejects(() => readProtocolBody(new Request('https://fixture.test/', { method: 'POST', body: '1234' }), 3), { code: 'BODY_TOO_LARGE', status: 413 });
});

test('a rate-limited signed request still consumes its nonce', async () => {
  const req = request();
  let used = false;
  const storage = {
    async consumeNonce() { if (used) return false; used = true; return true; },
    async allowIdentity() { return false; },
  };
  await assert.rejects(() => authenticateProtocolRequest(req.clone(), 0, () => true, storage), { code: 'RATE_LIMITED', status: 429 });
  await assert.rejects(() => authenticateProtocolRequest(req.clone(), 0, () => true, storage), { code: 'REQUEST_REPLAYED', status: 409 });
});
