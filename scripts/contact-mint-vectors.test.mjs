// Native Node realm intentionally exercises real structuredClone. Jest's VM clone
// crosses Object prototypes and is incompatible with strict JSON canonicalization.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
require('ts-node').register({
  transpileOnly: true,
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
});
const { verifyContactMint } = require('../api/src/libs/contact-mint-evidence.ts');
const { fromBase58, toBase58 } = require('@ocap/util');
const { decodeTx } = require('@didmail/ocap-message-cbor/cbor');
const fixture = JSON.parse(
  await fs.readFile(new URL('../tests/fixtures/contact-mint-vectors.json', import.meta.url), 'utf8'),
);
const preparation = (record) => ({
  snapshot: record.recovery.snapshot,
  ciphertext: record.recovery.ciphertext,
  createdAt: record.recovery.createdAt,
  expiresAt: record.recovery.expiresAt,
  payment: {
    transactionId: record.id,
    signedOrigin: record.signedOrigin,
    unsignedOrigin: record.unsignedOrigin,
    publicKey: toBase58(decodeTx(fromBase58(record.signedOrigin)).pk),
    acceptedAt: record.recovery.createdAt + 1,
  },
});
for (const vector of [...fixture.cases, ...fixture.additionalCases]) {
  test(`native Node shared mint signatures: ${vector.name ?? vector.serviceRole} / ${vector.confirmationPolicy ?? 'boundary'}`, async () => {
    assert.deepEqual(
      await verifyContactMint(
        preparation(vector.record),
        vector.mint.signedOrigin,
        vector.mint.assetId,
        new Uint8Array(Buffer.from(vector.record.recovery.proof.publicKey, 'base64url')),
      ),
      vector.mint,
    );
  });
}
for (const mutation of fixture.mutations) {
  test(`native Node rejects re-signed malicious shared vector: ${mutation.name}`, async () => {
    const v = fixture.cases[0];
    await assert.rejects(
      () =>
        verifyContactMint(
          preparation(v.record),
          mutation.signedOrigin,
          v.mint.assetId,
          new Uint8Array(Buffer.from(v.record.recovery.proof.publicKey, 'base64url')),
        ),
      /INVALID_CONTACT_MINT/,
    );
  });
}
test('native Node shared 64 KiB context and signed mint validate with real structuredClone', async () => {
  const record = structuredClone(fixture.large.record),
    mint = fixture.large.mint;
  record.recovery.ciphertext = fixture.large.ciphertextPattern.character.repeat(fixture.large.ciphertextPattern.length);
  assert.deepEqual(
    await verifyContactMint(
      preparation(record),
      mint.signedOrigin,
      mint.assetId,
      new Uint8Array(Buffer.from(record.recovery.proof.publicKey, 'base64url')),
    ),
    mint,
  );
});
