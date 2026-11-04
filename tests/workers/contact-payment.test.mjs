import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fromBase58 } from '@ocap/util';
import { fromPublicKey } from '@ocap/wallet';
import { decodeTx } from '@didmail/ocap-message-cbor/cbor';

test(
  'workerd independently verifies current SDK and Dart contact-payment bytes without network/signing',
  { timeout: 60000 },
  async () => {
    const records = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment-record.json', 'utf8'));
    const dart = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment-dart.json', 'utf8'));
    const f = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment.json', 'utf8'));
    const r = records.record;
    const binding = {
      chainId: f.policy.chainId,
      endpoint: r.endpoint,
      preparationId: r.preparationId,
      sender: r.owner,
      receiver: r.receiver,
      namecard: r.namecard,
      contentHash: r.contentHash,
      tokenAddress: f.policy.tokenAddress,
      totalAmount: f.terms.totalAmount,
      servicePayee: f.terms.servicePayee,
      serviceAmount: f.terms.serviceAmount,
      developerPayee: f.terms.developerPayee,
      developerAmount: f.terms.developerAmount,
      chainFee: f.terms.chainFee,
    };
    const publicKey = Array.from(decodeTx(fromBase58(r.signedOrigin)).pk);
    const options = convertV4MiniflareOptions({
      modules: true,
      scriptPath: '.worker/test.mjs',
      compatibilityDate: '2026-10-24',
      compatibilityFlags: ['nodejs_compat'],
      bindings: { NODE_SECRET_KEY: '0x' + '01'.repeat(32), DIDMAIL_URL: 'https://contact.test' },
      d1Databases: { DB: 'contact-test' },
      r2Buckets: { BLOBS: 'contact-test' },
      outboundService: () => {
        throw Error('Contact evidence must not contact a chain or external node');
      },
    });
    const mf = new Miniflare(options);
    const verify = (signedOrigin, expected = binding, key = publicKey) =>
      mf.dispatchFetch('https://contact.test/__contact/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedOrigin, binding: expected, publicKey: key }),
      });
    try {
      assert.equal(fromPublicKey(new Uint8Array(publicKey), { pk: 0, hash: 1 }).address, binding.sender);
      for (const record of [r, dart.record]) {
        const response = await verify(record.signedOrigin);
        assert.equal(response.status, 200);
        const actual = await response.json();
        assert.equal(actual.verified, true);
        assert.equal(actual.transactionId, record.id);
        assert.equal(actual.signedOrigin, record.signedOrigin);
        assert.equal(actual.unsignedOrigin, record.unsignedOrigin);
      }
      for (const field of [
        'endpoint',
        'preparationId',
        'receiver',
        'namecard',
        'contentHash',
        'chainFee',
        'tokenAddress',
        'servicePayee',
      ])
        assert.equal((await verify(r.signedOrigin, { ...binding, [field]: 'changed' })).status, 400);
      assert.equal((await verify(r.signedOrigin, binding, Array(32).fill(0))).status, 400);
      assert.equal(
        (await verify(r.signedOrigin.slice(0, -1) + (r.signedOrigin.endsWith('1') ? '2' : '1'))).status,
        400,
      );
    } finally {
      await mf.dispose();
    }
  },
);
