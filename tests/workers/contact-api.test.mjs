import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { canonicalize, utf8, signRequest, identityId, uuid, digest } from '@didmail/protocol';
import { fromSecretKey } from '@ocap/wallet';
import { getSigner, types, toTxHash } from '@ocap/mcrypto';
import { fromBase58, toBase58, toUint8Array } from '@ocap/util';
import { decodeTx, encodeTx } from '@didmail/ocap-message-cbor/cbor';

test(
  'signed contact API binds a verified node quote and preserves the original payment through replay and restart',
  { timeout: 60000 },
  async (t) => {
    const f = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment.json', 'utf8'));
    const { record } = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment-record.json', 'utf8'));
    const makeWallet = (value) =>
      fromSecretKey(getSigner(types.KeyType.ED25519).genKeyPair('hex', new Uint8Array(32).fill(value)).secretKey, {
        pk: 0,
        hash: 1,
      });
    const alice = makeWallet(1),
      mallory = makeWallet(3),
      origin = f.endpoint;
    assert.equal(alice.address, f.sender);
    const payload = { protocolVersion: 1, receiver: f.receiver, namecard: f.namecard, ciphertext: f.encrypted };
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-contact-api-'));
    let reads = 0,
      mode = 'valid',
      forbidden = 0;
    const options = convertV4MiniflareOptions({
      modules: true,
      scriptPath: '.worker/test.mjs',
      compatibilityDate: '2026-10-24',
      compatibilityFlags: ['nodejs_compat'],
      bindings: { NODE_SECRET_KEY: '0x' + '01'.repeat(32), DIDMAIL_URL: origin },
      d1Databases: { DB: 'contact-api' },
      r2Buckets: { BLOBS: 'contact-api' },
      resourcePersistencePath: storage,
      outboundService: async (request) => {
        const input = await request.json();
        if (
          request.url !== 'https://chain.test/api/' ||
          request.method !== 'POST' ||
          /\bmutation\b/.test(input.query)
        ) {
          forbidden++;
          throw Error('Only the configured quote read may leave workerd');
        }
        for (const header of ['signature', 'dmp-identity', 'cookie', 'authorization'])
          assert.equal(request.headers.has(header), false);
        assert.equal(input.variables.factory, f.policy.contactFactory);
        assert.equal(input.variables.namecard, f.namecard);
        assert.equal(input.variables.receiver, f.receiver);
        assert.match(input.query, /query ContactPreparationQuote/);
        reads++;
        if (mode === 'redirect')
          return new Response(null, { status: 302, headers: { location: 'https://other.test/' } });
        const data = {
          getAssetState: f.assetResult,
          getFactoryState: f.factoryResult,
          getAccountState: f.recipientResult,
          getChainInfo: {
            code: 'OK',
            info: {
              network: mode === 'bad-network' ? 'main' : 'beta',
              synced: true,
              blockHeight: '123',
              consensusVersion: 'tendermint',
            },
          },
          getForgeState: {
            code: 'OK',
            state: {
              txConfig: {
                txFee: [
                  { typeUrl: 'fg:t:transfer_v3', fee: '7' },
                  { typeUrl: 'fg:t:acquire_asset_v3', fee: '3' },
                ],
              },
            },
          },
        };
        return Response.json({ data });
      },
    });
    let mf = new Miniflare(options);
    const route = (id) => `${origin}/v1/contact-preparations/${id}`;
    const signed = (method, url, body, wallet = alice, extra = {}) => {
      const bytes =
        body instanceof Uint8Array ? body : body === undefined ? new Uint8Array() : utf8(canonicalize(body));
      const headers = {
        ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
        ...signRequest(method, url, bytes, identityId(wallet.address), toUint8Array(wallet.secretKey)),
        ...extra,
      };
      return { method, headers, ...(method === 'GET' ? {} : { body: bytes }) };
    };
    const dispatch = async (url, options) => {
      const response = await mf.dispatchFetch(url, options);
      return { status: response.status, headers: response.headers, body: await response.json() };
    };
    const call = (method, url, body, wallet = alice) => dispatch(url, signed(method, url, body, wallet));
    const payment = (preparation, nonce = 1800000000001, fee = '7') => {
      const tx = decodeTx(fromBase58(record.unsignedOrigin)),
        b = preparation.snapshot.binding;
      tx.nonce = nonce;
      tx.serviceFee = fee;
      tx.signature = undefined;
      tx.itx.data.value = {
        protocolVersion: 1,
        kind: 'didmail-namecard-payment',
        endpoint: b.endpoint,
        preparationId: b.preparationId,
        sender: b.sender,
        receiver: b.receiver,
        namecard: b.namecard,
        contentHash: b.contentHash,
        preparationSha256: digest(
          utf8(
            canonicalize({
              snapshot: preparation.snapshot,
              ciphertext: preparation.ciphertext,
              createdAt: preparation.createdAt,
              expiresAt: preparation.expiresAt,
            }),
          ),
        ),
      };
      const encode = (value) => encodeTx({ ...value, itx: { type: 'TransferV3Tx', value: value.itx } });
      const headers = [{ signer: tx.from, pk: tx.pk }];
      tx.signatures = headers;
      tx.signaturesList = headers;
      const signedHeaders = [{ ...headers[0], signature: toUint8Array(alice.sign(encode(tx))) }];
      tx.signatures = signedHeaders;
      tx.signaturesList = signedHeaders;
      tx.signature = toUint8Array(alice.sign(encode(tx)));
      const bytes = encode(tx);
      return { signedOrigin: toBase58(bytes), id: toTxHash(bytes) };
    };
    const id = uuid(),
      url = route(id);
    try {
      let db = await mf.getD1Database('DB');
      for (const file of (await fs.readdir('workers/migrations')).sort()) {
        const sql = await fs.readFile('workers/migrations/' + file, 'utf8');
        for (const statement of sql
          .split(';')
          .map((s) => s.replace(/^--.*$/gm, '').trim())
          .filter(Boolean))
          await db.prepare(statement).run();
      }
      await db
        .prepare('INSERT INTO namecards(address,price,token,enabled,createdAt,updatedAt) VALUES(?,?,?,1,?,?)')
        .bind(f.namecard, '0', f.policy.tokenAddress, new Date().toISOString(), new Date().toISOString())
        .run();
      await t.test('requires signed requests, canonical JSON and bounded bodies before obtaining a quote', async () => {
        assert.equal(
          (
            await dispatch(url, {
              method: 'PUT',
              headers: { 'content-type': 'application/json' },
              body: canonicalize(payload),
            })
          ).status,
          401,
        );
        const legacy = await dispatch(url, {
          method: 'GET',
          headers: { 'X-DIDMail-did': alice.address, 'X-DIDMail-pk': alice.publicKey },
        });
        assert.equal(legacy.status, 401);
        assert.equal((await call('PUT', url, utf8(JSON.stringify(payload)))).body.code, 'INVALID_CONTACT_REQUEST');
        assert.equal((await call('PUT', url, { ...payload, totalAmount: '1' })).status, 400);
        assert.equal((await call('PUT', url, { ...payload, servicePayee: mallory.address })).status, 400);
        assert.equal((await call('PUT', url, { ...payload, ciphertext: 'z'.repeat(96 * 1024 + 1) })).status, 413);
        assert.equal(reads, 0);
      });
      let prepared;
      await t.test(
        'fresh chain evidence, enabled template and exact wei amounts produce a private immutable preparation',
        async () => {
          const response = await call('PUT', url, payload);
          assert.equal(response.status, 201);
          assert.equal(response.headers.get('cache-control'), 'private, no-store');
          assert.equal(response.headers.get('location'), `/v1/contact-preparations/${id}`);
          prepared = response.body;
          assert.equal(prepared.state, 'prepared');
          assert.equal(prepared.payment, null);
          assert.equal(prepared.snapshot.binding.sender, alice.address);
          assert.equal(prepared.snapshot.binding.totalAmount, f.terms.totalAmount);
          assert.equal(prepared.snapshot.binding.contentHash, f.contentHash);
          assert.equal(prepared.snapshot.policy.mintChainFee, '3');
          assert.equal(reads, 1);
          assert.deepEqual((await call('PUT', url, payload)).body, prepared);
          assert.equal(reads, 1);
        },
      );
      await t.test('authenticated status is read-only and private across identities', async () => {
        assert.deepEqual((await call('GET', url)).body, prepared);
        assert.equal((await call('GET', url, undefined, mallory)).status, 404);
        assert.equal((await call('GET', route(uuid()), undefined, mallory)).status, 404);
        assert.equal(
          (await call('POST', url + '/submit', { protocolVersion: 1, signedOrigin: record.signedOrigin }, mallory))
            .status,
          404,
        );
        assert.equal(reads, 1);
      });
      const replay = signed('GET', url);
      await t.test('HTTP nonce is durable and signatures bind the exact URL, identity and body', async () => {
        assert.equal((await dispatch(url + '/submit', replay)).status, 405);
        assert.equal((await dispatch(route(uuid()), replay)).status, 401);
        assert.equal((await dispatch(url, replay)).status, 200);
        assert.equal((await dispatch(url, replay)).body.code, 'REQUEST_REPLAYED');
        const tamperedUrl = route(uuid()),
          tampered = signed('PUT', tamperedUrl, payload);
        tampered.body = utf8(canonicalize({ ...payload, receiver: mallory.address }));
        assert.equal((await dispatch(tamperedUrl, tampered)).status, 401);
      });
      await t.test(
        'content replacement, unavailable chain policy and redirects never overwrite a preparation',
        async () => {
          assert.equal(
            (await call('PUT', url, { ...payload, ciphertext: payload.ciphertext + 'x' })).body.code,
            'PREPARATION_CONFLICT',
          );
          assert.deepEqual((await call('GET', url)).body, prepared);
          for (const bad of ['bad-network', 'redirect']) {
            mode = bad;
            const failed = route(uuid());
            assert.equal((await call('PUT', failed, payload)).status, 503);
            assert.equal((await call('GET', failed)).status, 404);
          }
          mode = 'valid';
          const previousReads = reads;
          await db.prepare('UPDATE namecards SET enabled=0').run();
          assert.equal((await call('PUT', route(uuid()), payload)).status, 503);
          await db.prepare('UPDATE namecards SET enabled=1').run();
          assert.equal(reads, previousReads);
        },
      );
      let accepted, original;
      await t.test(
        'a quote cannot claim another node wallet without possessing its preparation signing identity',
        async () => {
          const foreign = route(uuid());
          const result = await dispatch(
            foreign,
            signed('PUT', foreign, payload, alice, { 'x-fixture-node-signer': 'foreign' }),
          );
          assert.equal(result.status, 503);
          assert.equal(result.body.code, 'CONTACT_QUOTE_UNAVAILABLE');
          assert.equal((await call('GET', foreign)).status, 404);
        },
      );
      await t.test(
        'only the original authenticated payer and stored quote can reserve the signed payment',
        async () => {
          const bad = payment(prepared, 1800000000001, '8');
          assert.equal(
            (await call('POST', url + '/submit', { protocolVersion: 1, signedOrigin: bad.signedOrigin })).body.code,
            'INVALID_CONTACT_PAYMENT',
          );
          assert.equal((await call('GET', url)).body.payment, null);
          const changedPolicy = {
            ...prepared,
            snapshot: { ...prepared.snapshot, policy: { ...prepared.snapshot.policy, mintChainFee: '4' } },
          };
          const policyReplacement = payment(changedPolicy);
          assert.equal(
            (await call('POST', url + '/submit', { protocolVersion: 1, signedOrigin: policyReplacement.signedOrigin }))
              .body.code,
            'INVALID_CONTACT_PAYMENT',
          );
          assert.equal((await call('GET', url)).body.payment, null);
          original = payment(prepared);
          const body = { protocolVersion: 1, signedOrigin: original.signedOrigin };
          const first = signed('POST', url + '/submit', body);
          const discarded = await dispatch(url + '/submit', first);
          assert.equal(discarded.status, 202);
          assert.equal((await dispatch(url + '/submit', first)).body.code, 'REQUEST_REPLAYED');
          accepted = (await call('GET', url)).body;
          assert.equal(accepted.state, 'accepted');
          assert.equal(accepted.payment.transactionId, original.id);
          assert.equal(accepted.payment.signedOrigin, original.signedOrigin);
          const retry = await call('POST', url + '/submit', body);
          assert.equal(retry.status, 202);
          assert.deepEqual(retry.body, accepted);
          assert.equal(
            (
              await call('POST', url + '/submit', {
                protocolVersion: 1,
                signedOrigin: payment(prepared, 1800000000002).signedOrigin,
              })
            ).body.code,
            'PREPARATION_CONFLICT',
          );
        },
      );
      let deliveredStatus;
      await t.test(
        'private status binds the full signed URL, does not re-quote and never advances accepted work',
        async () => {
          const statusUrl = url + '/status',
            previousReads = reads;
          assert.equal((await mf.dispatchFetch(statusUrl)).status, 401);
          assert.equal((await call('GET', statusUrl, undefined, mallory)).status, 404);
          assert.equal((await call('GET', route(uuid()) + '/status')).status, 404);
          assert.equal((await dispatch(statusUrl, signed('GET', url))).status, 401);
          assert.equal((await call('PUT', statusUrl, payload)).status, 405);
          const result = await call('GET', statusUrl);
          assert.equal(result.status, 200);
          assert.equal(result.headers.get('cache-control'), 'private, no-store');
          assert.equal(result.body.state, 'accepted');
          assert.deepEqual(result.body.preparation.payment, accepted.payment);
          assert.equal(result.body.mint, null);
          assert.equal(result.body.paymentConfirmation, null);
          assert.equal(result.body.delivery, null);
          assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM contact_jobs').first()).n, 0);
          assert.equal(reads, previousReads);
        },
      );
      await t.test(
        'status exposes original mint evidence without lease tokens and fails closed on conflicting durable proof',
        async () => {
          const b = accepted.snapshot.binding,
            p = accepted.snapshot.policy,
            assetId = 'zPublicContact';
          const header = [{ signer: mallory.address, pk: toUint8Array(mallory.publicKey) }];
          const tx = {
            from: mallory.address,
            pk: toUint8Array(mallory.publicKey),
            nonce: 1800000000003,
            chainId: b.chainId,
            serviceFee: p.mintChainFee,
            signatures: header,
            itx: {
              factory: p.contactFactory,
              address: assetId,
              owner: b.receiver,
              issuer: { id: b.developerPayee, pk: 'z', name: 'Public issuer' },
              inputs: [{ owner: mallory.address, tokens: [{ address: b.tokenAddress, value: p.mintAmount }] }],
              variables: Object.entries({
                sender: b.sender,
                receiver: b.receiver,
                pk: accepted.payment.publicKey,
                contact: accepted.ciphertext,
                namecard: b.namecard,
                didmailPreparationId: id,
                didmailPaymentHash: original.id,
                didmailContentHash: b.contentHash,
                didmailEndpoint: b.endpoint,
              }).map(([name, value]) => ({ name, value })),
            },
          };
          const encode = (value) => encodeTx({ ...value, itx: { type: 'AcquireAssetV3Tx', value: value.itx } });
          tx.signatures = [{ ...header[0], signature: toUint8Array(mallory.sign(encode(tx))) }];
          tx.signature = toUint8Array(mallory.sign(encode(tx)));
          const bytes = encode(tx),
            mintHash = toTxHash(bytes),
            signedOrigin = toBase58(bytes);
          const paymentConfirmation = {
            chainId: b.chainId,
            transactionId: original.id,
            blockHeight: '123',
            confirmedAt: '2026-10-27T00:00:00.000Z',
          };
          const delivery = {
            payment: paymentConfirmation,
            mint: { ...paymentConfirmation, transactionId: mintHash },
            assetId,
          };
          await db
            .prepare(
              `INSERT INTO contact_jobs(preparation_id,state,payment_evidence,signed_mint,mint_hash,asset_id,lease_owner,lease_fence)
          VALUES(?,'mint_pending',?,?,?,?, 'private-fencing-token',7)`,
            )
            .bind(id, canonicalize(paymentConfirmation), signedOrigin, mintHash, assetId)
            .run();
          const previousReads = reads;
          const pending = (await call('GET', url + '/status')).body;
          assert.equal(pending.state, 'mint_pending');
          assert.deepEqual(pending.mint, { signedOrigin, transactionId: mintHash, assetId });
          assert.deepEqual(pending.paymentConfirmation, paymentConfirmation);
          assert.equal(pending.delivery, null);
          assert.ok(!JSON.stringify(pending).includes('private-fencing-token'));
          await db
            .prepare("UPDATE contact_jobs SET state='delivered',delivery_evidence=? WHERE preparation_id=?")
            .bind(canonicalize(delivery), id)
            .run();
          deliveredStatus = (await call('GET', url + '/status')).body;
          assert.equal(deliveredStatus.state, 'delivered');
          assert.deepEqual(deliveredStatus.delivery, delivery);
          await db
            .prepare('UPDATE contact_jobs SET delivery_evidence=? WHERE preparation_id=?')
            .bind(canonicalize({ ...delivery, mint: { ...delivery.mint, transactionId: 'A'.repeat(64) } }), id)
            .run();
          assert.equal((await call('GET', url + '/status')).status, 503);
          await db
            .prepare('UPDATE contact_jobs SET delivery_evidence=? WHERE preparation_id=?')
            .bind(canonicalize(delivery), id)
            .run();
          assert.equal(reads, previousReads);
          assert.deepEqual((await call('GET', url)).body, accepted);
        },
      );
      await t.test('unpaid preparation quota remains bounded under concurrent authenticated requests', async () => {
        const results = await Promise.all(Array.from({ length: 12 }, () => call('PUT', route(uuid()), payload)));
        assert.equal(results.filter((r) => r.status === 201).length, 8);
        assert.equal(results.filter((r) => r.body.code === 'PREPARATION_QUOTA_EXCEEDED').length, 4);
        const count = await db
          .prepare(
            'SELECT COUNT(*) AS count FROM contact_preparations WHERE sender=? AND payment_hash IS NULL AND expires_at>?',
          )
          .bind(alice.address, Date.now())
          .first();
        assert.equal(count.count, 8);
        assert.deepEqual(
          (await call('POST', url + '/submit', { protocolVersion: 1, signedOrigin: original.signedOrigin })).body,
          accepted,
        );
      });
      await t.test(
        'restart preserves the original record and replay history without any quote read or broadcast',
        async () => {
          const previousReads = reads;
          await mf.dispose();
          mf = new Miniflare(options);
          db = await mf.getD1Database('DB');
          assert.equal((await dispatch(url, replay)).body.code, 'REQUEST_REPLAYED');
          assert.deepEqual((await call('GET', url)).body, accepted);
          assert.deepEqual((await call('GET', url + '/status')).body, deliveredStatus);
          assert.deepEqual(
            (await call('POST', url + '/submit', { protocolVersion: 1, signedOrigin: original.signedOrigin })).body,
            accepted,
          );
          assert.equal(reads, previousReads);
          assert.equal(forbidden, 0);
        },
      );
    } finally {
      await mf.dispose();
      await fs.rm(storage, { recursive: true, force: true });
    }
  },
);
