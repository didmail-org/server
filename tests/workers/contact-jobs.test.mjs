import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test(
  'contact coordinator preserves original payments and a single durable mint across interruptions',
  { timeout: 90000 },
  async (t) => {
    const f = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment.json', 'utf8'));
    const { record } = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment-record.json', 'utf8'));
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-contact-jobs-'));
    let outboundRequests = 0;
    const options = convertV4MiniflareOptions({
      modules: true,
      scriptPath: '.worker/test.mjs',
      compatibilityDate: '2026-10-24',
      compatibilityFlags: ['nodejs_compat'],
      bindings: { NODE_SECRET_KEY: '0x' + '01'.repeat(32), DIDMAIL_URL: 'https://contact.test' },
      d1Databases: { DB: 'contact-jobs' },
      r2Buckets: { BLOBS: 'contact-jobs' },
      resourcePersistencePath: storage,
      outboundService() {
        outboundRequests++;
        throw Error('External chain or node prohibited');
      },
    });
    let mf = new Miniflare(options),
      db = await mf.getD1Database('DB'),
      now = 1800000000000;
    const request = async (route, body) => {
      const response = await mf.dispatchFetch('https://contact.test/__contact/' + route, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ now, ...body }),
      });
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    const step = async (input = {}) => {
      now += 11000;
      return request('jobs', input);
    };
    const read = () =>
      db.prepare('SELECT * FROM contact_jobs WHERE preparation_id=?').bind(record.preparationId).first();
    const signings = async () =>
      (await db.prepare('SELECT count FROM contact_test_signings WHERE id=?').bind(record.preparationId).first())
        ?.count ?? 0;
    const lanes = () => db.prepare('SELECT * FROM dmp_wallet_lanes').all();
    const confirmPayment = async (rejected = 0) =>
      db
        .prepare('INSERT INTO contact_test_chain(hash,original,broadcasts,rejected) VALUES(?,?,0,?)')
        .bind(record.id, record.signedOrigin, rejected)
        .run();
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
    const reset = async (policy = 'arcblock-committed') => {
      for (const table of [
        'contact_jobs',
        'contact_preparations',
        'dmp_wallet_lanes',
        'contact_test_chain',
        'contact_test_signings',
      ])
        await db.prepare('DELETE FROM ' + table).run();
      await request('preparation', {
        operation: 'create',
        snapshot: { ...snapshot, policy: { ...snapshot.policy, confirmationPolicy: policy } },
        ciphertext: f.encrypted,
        expiresAt: now + 600000,
      });
      await request('preparation', {
        operation: 'accept',
        id: record.preparationId,
        sender: record.owner,
        signedOrigin: record.signedOrigin,
        publicKey: f.publicKey,
      });
    };
    try {
      for (const file of (await fs.readdir('workers/migrations')).sort()) {
        const sql = await fs.readFile('workers/migrations/' + file, 'utf8');
        for (const statement of sql
          .split(';')
          .map((s) => s.replace(/^--.*$/gm, '').trim())
          .filter(Boolean))
          await db.prepare(statement).run();
      }
      await db
        .prepare(
          'CREATE TABLE contact_test_chain(hash TEXT PRIMARY KEY,original TEXT,broadcasts INTEGER,rejected INTEGER)',
        )
        .run();
      await db.prepare('CREATE TABLE contact_test_signings(id TEXT PRIMARY KEY,count INTEGER)').run();
      await t.test(
        'payment acceptance is rediscovered; lost broadcast responses and restart never sign another mint',
        async () => {
          await reset();
          assert.equal(await read(), null);
          await step();
          assert.equal((await read()).state, 'payment_pending');
          assert.equal(
            (
              await db
                .prepare('SELECT original,broadcasts FROM contact_test_chain WHERE hash=?')
                .bind(record.id)
                .first()
            ).original,
            record.signedOrigin,
          );
          assert.equal((await lanes()).results[0].message_id, 'contact:' + record.preparationId);
          await step();
          const stored = await read();
          assert.equal(stored.state, 'mint_pending');
          assert.equal(await signings(), 1);
          assert.equal((await lanes()).results[0].lane, 'operator');
          await mf.dispose();
          mf = new Miniflare(options);
          db = await mf.getD1Database('DB');
          assert.equal((await read()).signed_mint, stored.signed_mint);
          await step();
          const delivered = await read();
          assert.equal(delivered.state, 'delivered');
          assert.equal(delivered.signed_mint, stored.signed_mint);
          assert.equal(await signings(), 1);
          assert.equal((await lanes()).results.length, 0);
          const proof = JSON.parse(delivered.delivery_evidence);
          assert.equal(proof.payment.transactionId, record.id);
          assert.equal(proof.mint.transactionId, stored.mint_hash);
          const original = await request('preparation', {
            operation: 'read',
            id: record.preparationId,
            sender: record.owner,
          });
          assert.equal(original.payment.signedOrigin, record.signedOrigin);
          assert.equal(original.ciphertext, f.encrypted);
          await step();
          assert.deepEqual(await read(), delivered);
        },
      );
      await t.test(
        'lost enqueue acknowledgment leaves the indexed pending marker until the durable job is rediscovered',
        async () => {
          await reset();
          const plan = await db
            .prepare(
              `EXPLAIN QUERY PLAN SELECT id FROM contact_preparations
          WHERE payment_hash IS NOT NULL AND job_pending=1 ORDER BY accepted_at,id LIMIT 4`,
            )
            .all();
          assert.ok(plan.results.some((row) => row.detail.includes('contact_preparations_job_pending')));
          now += 11000;
          const response = await mf.dispatchFetch('https://contact.test/__contact/jobs', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ now, fault: 'after-enqueue' }),
          });
          assert.equal(response.status, 503);
          assert.equal((await read()).state, 'queued');
          assert.equal((await db.prepare('SELECT job_pending FROM contact_preparations').first()).job_pending, 1);
          await step();
          assert.equal((await db.prepare('SELECT job_pending FROM contact_preparations').first()).job_pending, 0);
          assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contact_jobs').first()).n, 1);
          await step();
          await step();
          assert.equal((await read()).state, 'delivered');
          assert.equal(await signings(), 1);
        },
      );
      await t.test(
        'failure BEFORE storing mint bytes permits preparation again but never broadcasts the abandoned bytes',
        async () => {
          await reset();
          await confirmPayment();
          await step({ fault: 'before-mint' });
          assert.equal((await read()).state, 'payment_confirmed');
          assert.equal((await read()).signed_mint, null);
          assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contact_test_chain').first()).n, 1);
          assert.equal(await signings(), 1);
          await step();
          const stored = await read();
          assert.equal(stored.state, 'mint_pending');
          assert.equal(await signings(), 2);
          assert.equal(
            (await db.prepare('SELECT original FROM contact_test_chain WHERE hash=?').bind(stored.mint_hash).first())
              .original,
            stored.signed_mint,
          );
        },
      );
      await t.test('lost storage acknowledgment AFTER mint persistence retries exact stored bytes', async () => {
        await reset();
        await confirmPayment();
        await step({ fault: 'after-mint' });
        const stored = await read();
        assert.equal(stored.state, 'mint_pending');
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contact_test_chain').first()).n, 1);
        await step();
        await step();
        assert.equal((await read()).state, 'delivered');
        assert.equal((await read()).signed_mint, stored.signed_mint);
        assert.equal(await signings(), 1);
      });
      await t.test('fenced lease replacement prevents stale mint persistence and broadcast', async () => {
        await reset();
        await confirmPayment();
        await step({ mode: 'expire-mint' });
        const lost = await read();
        assert.equal(lost.state, 'payment_confirmed');
        assert.equal(lost.signed_mint, null);
        assert.equal(lost.lease_owner, 'new-worker');
        assert.equal(lost.lease_fence, 2);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contact_test_chain').first()).n, 1);
        await step();
        assert.equal((await read()).state, 'mint_pending');
        assert.equal(await signings(), 2);
      });
      await t.test('concurrent workers prepare at most one durably accepted mint', async () => {
        await reset();
        await confirmPayment();
        now += 11000;
        await Promise.all(Array.from({ length: 8 }, () => request('jobs', {})));
        assert.equal((await read()).state, 'mint_pending');
        assert.equal(await signings(), 1);
        await step();
        assert.equal((await read()).state, 'delivered');
      });
      await t.test(
        'DMP payer and operator reservations exclude contact processing without stealing lanes',
        async () => {
          await reset();
          await db
            .prepare("INSERT INTO dmp_wallet_lanes(chain_id,wallet_id,lane,message_id) VALUES(?,?,'payer','dmp-payer')")
            .bind(snapshot.binding.chainId, 'did:abt:' + record.owner)
            .run();
          await step();
          assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contact_test_chain').first()).n, 0);
          assert.equal(await signings(), 0);
          assert.equal((await lanes()).results[0].message_id, 'dmp-payer');
          await db.prepare("DELETE FROM dmp_wallet_lanes WHERE message_id='dmp-payer'").run();
          await confirmPayment();
          await db
            .prepare(
              "INSERT INTO dmp_wallet_lanes(chain_id,wallet_id,lane,message_id) VALUES(?,?,'operator','dmp-operator')",
            )
            .bind(snapshot.binding.chainId, 'did:abt:' + snapshot.binding.servicePayee)
            .run();
          await step();
          assert.equal((await read()).state, 'payment_confirmed');
          assert.equal(await signings(), 0);
          assert.equal((await lanes()).results[0].message_id, 'dmp-operator');
          await db.prepare("DELETE FROM dmp_wallet_lanes WHERE message_id='dmp-operator'").run();
          await step();
          assert.equal(await signings(), 1);
        },
      );
      await t.test('definitively rejected payment releases payer, keeps evidence and never signs mint', async () => {
        await reset();
        await confirmPayment(1);
        await step();
        assert.equal((await read()).state, 'payment_rejected');
        assert.equal(await signings(), 0);
        assert.equal((await lanes()).results.length, 0);
        await step();
        assert.equal((await read()).state, 'payment_rejected');
      });
      for (const mode of ['wrong-network', 'wrong-hash', 'zero-height'])
        await t.test(mode + ' requires reconciliation and keeps payer reserved', async () => {
          await reset();
          await confirmPayment();
          await step({ mode });
          assert.equal((await read()).state, 'reconciliation_required');
          assert.equal((await read()).problem_code, 'CONFLICTING_CHAIN_EVIDENCE');
          assert.equal(await signings(), 0);
          assert.equal((await lanes()).results.length, 1);
        });
      await t.test('Dolt membership policy works without a fabricated block height', async () => {
        await reset('arcblock-dolt-ledger/1');
        await step();
        await step();
        await step();
        const delivered = await read();
        assert.equal(delivered.state, 'delivered');
        const proof = JSON.parse(delivered.delivery_evidence);
        assert.equal(proof.payment.confirmationPolicy, 'arcblock-dolt-ledger/1');
        assert.equal(proof.payment.ledgerBackend, '@ocap/statedb-dolt v1.20.2');
        assert.equal(proof.payment.blockHeight, undefined);
      });
      await t.test('committed block evidence cannot replace accepted Dolt membership policy', async () => {
        await reset('arcblock-dolt-ledger/1');
        await confirmPayment();
        await step({ mode: 'wrong-policy' });
        assert.equal((await read()).state, 'reconciliation_required');
        assert.equal(await signings(), 0);
      });
      await t.test('invalid mint cannot be persisted or broadcast', async () => {
        await reset();
        await confirmPayment();
        await step({ mode: 'invalid-mint' });
        const job = await read();
        assert.equal(job.state, 'reconciliation_required');
        assert.equal(job.signed_mint, null);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contact_test_chain').first()).n, 1);
      });
      await t.test('conflicting asset evidence retains original mint and operator reservation', async () => {
        await reset();
        await confirmPayment();
        await step();
        const mint = await read();
        await step({ mode: 'wrong-asset' });
        assert.equal((await read()).state, 'reconciliation_required');
        assert.equal((await read()).signed_mint, mint.signed_mint);
        assert.equal(await signings(), 1);
        assert.equal((await lanes()).results[0].lane, 'operator');
      });
      assert.equal(outboundRequests, 0);
    } finally {
      await mf.dispose();
      await fs.rm(storage, { recursive: true, force: true });
    }
  },
);
