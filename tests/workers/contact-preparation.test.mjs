import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test(
  'contact preparation evidence survives workerd restart, lost responses and concurrent original submissions',
  { timeout: 60000 },
  async (t) => {
    const source = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment-record.json', 'utf8'));
    const f = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment.json', 'utf8'));
    const { record, record2 } = source;
    const now = 1800000000000,
      expiresAt = now + 600000;
    const snapshot = {
      binding: {
        chainId: f.policy.chainId,
        endpoint: record.endpoint,
        preparationId: record.preparationId,
        sender: record.owner,
        receiver: record.receiver,
        namecard: record.namecard,
        contentHash: record.contentHash,
        tokenAddress: f.policy.tokenAddress,
        totalAmount: f.terms.totalAmount,
        servicePayee: f.terms.servicePayee,
        serviceAmount: f.terms.serviceAmount,
        developerPayee: f.terms.developerPayee,
        developerAmount: f.terms.developerAmount,
        chainFee: f.terms.chainFee,
      },
      policy: {
        chainEndpoint: 'https://beta.abtnetwork.io/api/',
        namecardFactory: f.policy.namecardFactory,
        contactFactory: f.policy.contactFactory,
        mintAmount: f.terms.mintAmount,
        mintChainFee: '3',
        confirmationPolicy: 'arcblock-committed',
      },
    };
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-contact-preparation-'));
    let outboundRequests = 0;
    const options = convertV4MiniflareOptions({
      modules: true,
      scriptPath: '.worker/test.mjs',
      compatibilityDate: '2026-10-24',
      compatibilityFlags: ['nodejs_compat'],
      bindings: { NODE_SECRET_KEY: '0x' + '01'.repeat(32), DIDMAIL_URL: 'https://contact.test' },
      d1Databases: { DB: 'contact-preparations' },
      r2Buckets: { BLOBS: 'contact-preparations' },
      resourcePersistencePath: storage,
      outboundService: () => {
        outboundRequests++;
        throw Error('No external chain or node allowed');
      },
    });
    let mf = new Miniflare(options);
    const request = async (input) => {
      const response = await mf.dispatchFetch('https://contact.test/__contact/preparation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ now, ...input }),
      });
      return { status: response.status, body: await response.json() };
    };
    const create = (changes = {}) =>
      request({ operation: 'create', snapshot, ciphertext: f.encrypted, expiresAt, ...changes });
    const read = (changes = {}) =>
      request({ operation: 'read', id: record.preparationId, sender: record.owner, ...changes });
    const accept = (changes = {}) =>
      request({
        operation: 'accept',
        id: record.preparationId,
        sender: record.owner,
        signedOrigin: record.signedOrigin,
        publicKey: f.publicKey,
        ...changes,
      });
    try {
      let db = await mf.getD1Database('DB');
      const migration = await fs.readFile('workers/migrations/0006_contact_preparations.sql', 'utf8');
      for (const statement of migration
        .split(';')
        .map((s) => s.replace(/^--.*$/gm, '').trim())
        .filter(Boolean))
        await db.prepare(statement).run();
      await t.test('immutable ciphertext, economics and confirmation policy are persisted together', async () => {
        const original = await create();
        assert.equal(original.status, 200);
        assert.deepEqual(original.body, {
          snapshot,
          ciphertext: f.encrypted,
          createdAt: now,
          expiresAt,
          payment: null,
        });
        assert.deepEqual(await create(), original);
        for (const changed of [
          { policy: { ...snapshot.policy, confirmationPolicy: 'arcblock-dolt-ledger/1' } },
          { policy: { ...snapshot.policy, contactFactory: 'other-factory' } },
          { binding: { ...snapshot.binding, chainFee: '8' } },
        ]) {
          const result = await create({ snapshot: { ...snapshot, ...changed } });
          assert.equal(result.body.code, 'PREPARATION_CONFLICT');
        }
        assert.equal((await create({ expiresAt: expiresAt + 1 })).body.code, 'PREPARATION_CONFLICT');
        assert.deepEqual((await read()).body, original.body);
      });
      await t.test(
        'rejects mismatched content, oversized bodies and malformed snapshots before creating evidence',
        async () => {
          for (const input of [
            { ciphertext: f.encrypted + 'x' },
            { ciphertext: 'z'.repeat(65537) },
            { expiresAt: now },
            { expiresAt: now + 3600001 },
            { snapshot: { ...snapshot, extra: 'unexpected' } },
            { snapshot: { ...snapshot, policy: { ...snapshot.policy, confirmationPolicy: 'anything-successful' } } },
            { snapshot: { ...snapshot, policy: { ...snapshot.policy, mintAmount: '1e10' } } },
            { snapshot: { ...snapshot, policy: { ...snapshot.policy, chainEndpoint: 'http://untrusted.test/' } } },
          ])
            assert.equal((await create(input)).status, 400);
          assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM contact_preparations').first()).count, 1);
        },
      );
      await t.test('cross-identity lookup reveals no record and cannot reserve a payment', async () => {
        assert.equal((await read({ sender: record.receiver })).body, null);
        assert.equal((await accept({ sender: record.receiver })).body.code, 'PREPARATION_NOT_FOUND');
        assert.equal((await accept({ id: 'missing' })).body.code, 'PREPARATION_NOT_FOUND');
        assert.equal((await read()).body.payment, null);
      });
      await t.test('expiry and invalid original signatures cannot reserve an unpaid preparation', async () => {
        assert.equal((await accept({ now: expiresAt })).body.code, 'PREPARATION_EXPIRED');
        assert.equal((await accept({ publicKey: Array(32).fill(0) })).status, 400);
        assert.equal((await accept({ signedOrigin: record.signedOrigin.slice(0, -3) })).status, 400);
        assert.equal((await read()).body.payment, null);
      });
      let winner;
      await t.test(
        'two different valid original payments race; only one can become the permanent payment',
        async () => {
          // Both HTTP responses are discarded after a successful commit, so the winner
          // must be recovered by reading persisted evidence, never by making a new payment.
          const results = await Promise.all([
            accept({ operation: 'accept-lost-response' }),
            accept({ operation: 'accept-lost-response', signedOrigin: record2.signedOrigin }),
          ]);
          assert.equal(results.filter((r) => r.status === 503).length, 1);
          assert.equal(results.filter((r) => r.body.code === 'PREPARATION_CONFLICT').length, 1);
          winner = (await read()).body;
          const input = winner.payment.transactionId === record.id ? record : record2;
          assert.equal(winner.payment.signedOrigin, input.signedOrigin);
          assert.equal(winner.payment.unsignedOrigin, input.unsignedOrigin);
          assert.equal(winner.payment.acceptedAt, now);
          const repeat = await Promise.all(
            Array.from({ length: 8 }, () => accept({ signedOrigin: input.signedOrigin })),
          );
          assert.ok(repeat.every((r) => r.status === 200));
          assert.ok(repeat.every((r) => JSON.stringify(r.body) === JSON.stringify(winner)));
        },
      );
      await t.test(
        'database constraints reject partial payment evidence and reuse on another preparation',
        async () => {
          const other = { ...snapshot, binding: { ...snapshot.binding, preparationId: 'other' } };
          assert.equal((await create({ snapshot: other })).status, 200);
          await assert.rejects(
            db.prepare('UPDATE contact_preparations SET payment_hash=? WHERE id=?').bind('hash', 'other').run(),
            /CHECK constraint/,
          );
          await assert.rejects(
            db
              .prepare(
                `UPDATE contact_preparations SET accepted_at=?,payment_hash=?,signed_payment=?,unsigned_payment=?,public_key=? WHERE id=?`,
              )
              .bind(
                now,
                winner.payment.transactionId,
                winner.payment.signedOrigin,
                winner.payment.unsignedOrigin,
                winner.payment.publicKey,
                'other',
              )
              .run(),
            /UNIQUE constraint/,
          );
          assert.equal((await read({ id: 'other' })).body.payment, null);
          assert.deepEqual((await read()).body, winner);
        },
      );
      await t.test(
        'discarded response and caller key mutation leave the exact saved original recoverable',
        async () => {
          const original = winner.payment.signedOrigin;
          assert.equal((await accept({ operation: 'accept-lost-response', signedOrigin: original })).status, 503);
          assert.deepEqual(
            (await accept({ operation: 'accept-mutate-public-key', signedOrigin: original })).body,
            winner,
          );
        },
      );
      await t.test('fresh workerd instance reads and retries the same payment after preparation expiry', async () => {
        assert.ok((await fs.readdir(storage, { recursive: true })).some((file) => file.endsWith('.sqlite')));
        await mf.dispose();
        mf = new Miniflare(options);
        db = await mf.getD1Database('DB');
        assert.deepEqual((await read()).body, winner);
        assert.deepEqual(
          (await accept({ now: expiresAt + 3600000, signedOrigin: winner.payment.signedOrigin })).body,
          winner,
        );
        const replacement = winner.payment.transactionId === record.id ? record2 : record;
        assert.equal((await accept({ signedOrigin: replacement.signedOrigin })).body.code, 'PREPARATION_CONFLICT');
        assert.equal((await read()).body.ciphertext, f.encrypted);
        assert.equal(outboundRequests, 0);
      });
      await t.test('failures on both sides of the D1 commit retain a retryable, atomic evidence state', async () => {
        // A separate fixture lifecycle, after completing the full restart assertions above.
        await db.prepare('DELETE FROM contact_preparations').run();
        assert.equal((await create()).status, 200);
        assert.equal((await accept({ writeFault: 'before' })).body.code, 'SIMULATED_CONTACT_WRITE_FAILURE');
        assert.equal((await read()).body.payment, null);
        assert.equal((await accept({ writeFault: 'after' })).body.code, 'SIMULATED_CONTACT_WRITE_FAILURE');
        const saved = (await read()).body;
        assert.equal(saved.payment.transactionId, record.id);
        assert.equal(saved.payment.signedOrigin, record.signedOrigin);
        assert.equal(saved.payment.unsignedOrigin, record.unsignedOrigin);
        assert.deepEqual((await accept()).body, saved);
        assert.equal((await accept({ signedOrigin: record2.signedOrigin })).body.code, 'PREPARATION_CONFLICT');
        assert.equal(outboundRequests, 0);
      });
    } finally {
      await mf.dispose();
      await fs.rm(storage, { recursive: true, force: true });
    }
  },
);
