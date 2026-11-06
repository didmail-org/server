import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from './host/miniflare.mjs';
import { fromBase58, toBase58, toUint8Array } from '@ocap/util';
import { toTxHash, getHasher, getSigner, types } from '@ocap/mcrypto';
import { fromSecretKey } from '@ocap/wallet';
import { decodeTx, encodeTx } from '@didmail/ocap-message-cbor/cbor';
import { DOLT_COMMITTED_RECORD_QUERY } from '@didmail/protocol';
import { decodeOcapReference } from './ocap-reference-codec.mjs';

test(
  'actual contact settlement adapter signs modern CBOR, uses bounded configured RPC and recovers original broadcasts',
  { timeout: 60000 },
  async (t) => {
    const f = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment.json', 'utf8'));
    const { record } = JSON.parse(await fs.readFile('tests/fixtures/namecard-payment-record.json', 'utf8'));
    const policy = {
      ...f.policy,
      servicePayee: f.terms.servicePayee,
      endpoint: record.endpoint,
      chainEndpoint: 'https://chain.test/api/',
      confirmationPolicy: 'arcblock-committed',
    };
    const preparation = {
      snapshot: {
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
          chainEndpoint: policy.chainEndpoint,
          namecardFactory: f.policy.namecardFactory,
          contactFactory: f.policy.contactFactory,
          mintAmount: f.terms.mintAmount,
          mintChainFee: '3',
          confirmationPolicy: 'arcblock-committed',
        },
      },
      ciphertext: f.encrypted,
      createdAt: 1800000000000,
      expiresAt: 1800000600000,
      payment: {
        transactionId: record.id,
        signedOrigin: record.signedOrigin,
        unsignedOrigin: record.unsignedOrigin,
        publicKey: toBase58(new Uint8Array(f.publicKey)),
        acceptedAt: 1800000000001,
      },
    };
    const factory = {
      address: policy.contactFactory,
      owner: policy.developerPayee,
      numMinted: 1,
      data: { value: '{}' },
      input: {
        value: '0',
        assets: [],
        tokens: [{ address: policy.tokenAddress, value: f.terms.mintAmount, decimal: 18 }],
      },
      output: {
        address: null,
        issuer: '{{ctx.issuer.id}}',
        moniker: 'contact#{{ctx.id}}',
        parent: '{{ctx.factory}}',
        readonly: true,
        tags: ['DIDMailContactNFT'],
        transferrable: false,
        ttl: 0,
        data: {
          typeUrl: 'json',
          value: JSON.stringify({
            contact: '{{input.contact}}',
            namecard: '{{input.namecard}}',
            pk: '{{input.pk}}',
            sender: '{{input.sender}}',
          }),
        },
        display: null,
        endpoint: null,
      },
    };
    const reads = [],
      broadcasts = [],
      ledger = new Map();
    let assetPreparation = preparation;
    let mode = '',
      assetId = '',
      accountNonce = '0';
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-contact-settlement-'));
    const options = convertV4MiniflareOptions({
      modules: true,
      scriptPath: 'artifacts/business-tests/test.mjs',
      compatibilityDate: '2026-10-24',
      compatibilityFlags: ['nodejs_compat'],
      bindings: { NODE_SECRET_KEY: '0x' + '01'.repeat(32), DIDMAIL_URL: 'https://contact.test' },
      databaseFixtures: { DB: 'contact-settlement' },
      objectFixtures: { BLOBS: 'contact-settlement' },
      resourcePersistencePath: storage,
      outboundService: async (request) => {
        assert.equal(request.url, policy.chainEndpoint);
        const body = await request.json(),
          query = body.query;
        assert.ok(!/\b(?:sk|secretKey|secret_key|mnemonic)\s*:/.test(query));
        if (mode === 'redirect')
          return new Response('', { status: 302, headers: { location: 'https://foreign.invalid' } });
        if (query === DOLT_COMMITTED_RECORD_QUERY) {
          const hash = body.variables.hash,
            row = ledger.get(hash);
          return Response.json({
            data: {
              getChainInfo: {
                code: 'OK',
                info: { network: 'beta', synced: true, consensusVersion: '@ocap/statedb-dolt v1.20.2' },
              },
              getTx: {
                code: 'OK',
                info: row
                  ? {
                      hash: mode === 'bad-ledger-hash' ? 'A'.repeat(64) : hash,
                      height: '0',
                      code: row.rejected ? 'INVALID_SIGNATURE' : 'OK',
                      time: '2026-10-27T00:00:00.000Z',
                      tx: { chainId: 'beta' },
                    }
                  : null,
              },
            },
          });
        }
        if (query.includes('sendTx(')) {
          const encoded = /\btx:\s*"([^"]+)"/.exec(query)?.[1];
          assert.ok(encoded, 'public signed tx must be present: ' + query.slice(0, 250));
          const bytes = new Uint8Array(Buffer.from(encoded, 'base64')),
            hash = toTxHash(bytes);
          broadcasts.push(toBase58(bytes));
          ledger.set(hash, { bytes, rejected: false });
          if (mode === 'lost-response') throw Error('Simulated chain response lost after acceptance');
          return Response.json({
            data: { sendTx: { code: 'OK', hash: mode === 'wrong-broadcast-hash' ? 'A'.repeat(64) : hash } },
          });
        }
        assert.ok(!/\bmutation\b/.test(query), 'reads may not mutate chain');
        reads.push(query);
        if (query.includes('getFactoryState(')) {
          const state = structuredClone(factory);
          if (mode === 'changed-price') state.input.tokens[0].value = '1';
          if (mode === 'wrong-factory-owner') state.owner = record.owner;
          if (mode === 'wrong-template') state.output.data.value = JSON.stringify({ contact: 'replacement' });
          return Response.json({ data: { getFactoryState: { code: 'OK', state } } });
        }
        if (query.includes('getAccountState(')) {
          const operator = query.includes(policy.servicePayee);
          return Response.json({
            data: {
              getAccountState: {
                code: 'OK',
                state: {
                  address: operator ? policy.servicePayee : policy.developerPayee,
                  moniker: 'Public fixture',
                  nonce: operator ? accountNonce : '0',
                },
              },
            },
          });
        }
        if (query.includes('getChainInfo'))
          return Response.json({
            data: {
              getChainInfo: {
                code: 'OK',
                info: {
                  network: mode === 'wrong-network' ? 'foreign' : 'beta',
                  synced: true,
                  consensusVersion: mode === 'dolt-as-blocks' ? '@ocap/statedb-dolt v1.20.2' : 'public-fixture',
                  blockHeight: '1234',
                },
              },
            },
          });
        if (query.includes('getTx(')) {
          const hash = /\bhash:\s*"([^"]+)"/.exec(query)?.[1],
            tx = ledger.get(hash);
          return Response.json({
            data: {
              getTx: {
                code: 'OK',
                info: tx
                  ? {
                      hash,
                      height: mode === 'zero-height' ? '0' : '123',
                      time: '2026-10-28T00:00:00.000Z',
                      code: tx.rejected ? 'INVALID_NONCE' : 'OK',
                    }
                  : null,
              },
            },
          });
        }
        if (query.includes('getAssetState('))
          return Response.json({
            data: {
              getAssetState: {
                code: 'OK',
                state: {
                  address: assetId,
                  owner: mode === 'wrong-recipient' ? record.owner : record.receiver,
                  parent: policy.contactFactory,
                  data: {
                    typeUrl: 'json',
                    value: JSON.stringify({
                      sender: record.owner,
                      pk: preparation.payment.publicKey,
                      contact: mode === 'wrong-content' ? 'replacement' : assetPreparation.ciphertext,
                      namecard: record.namecard,
                    }),
                  },
                },
              },
            },
          });
        throw Error('Unexpected chain read: ' + query.slice(0, 250));
      },
    });
    let mf = new Miniflare(options);
    const request = async (operation, extra = {}) => {
      const response = await mf.dispatchFetch('https://contact.test/__contact/settlement', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operation, policy, preparation, ...extra }),
      });
      return { status: response.status, body: await response.json() };
    };
    let mint;
    try {
      await t.test('prepares actual asset address and fully verified signature with persisted fee', async () => {
        const result = await request('prepare');
        assert.equal(result.status, 200, JSON.stringify(result.body));
        mint = result.body;
        assetId = mint.assetId;
        assert.match(mint.assetId, /^z/);
        const tx = decodeTx(fromBase58(mint.signedOrigin));
        assert.equal(tx.itx.address, mint.assetId);
        assert.equal(tx.serviceFee, '3');
        assert.equal(tx.itx.owner, record.receiver);
        assert.equal(tx.itx.variables.find((v) => v.name === 'didmailPaymentHash').value, record.id);
        assert.equal(broadcasts.length, 0);
      });
      await t.test('nonce advances past existing chain account nonce even when local time is behind', async () => {
        accountNonce = '1800000000100';
        const result = await request('prepare');
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(decodeTx(fromBase58(result.body.signedOrigin)).nonce, 1800000000101);
        accountNonce = '0';
      });
      await t.test(
        'payment broadcast is exactly original signed bytes; a lost response can be reconciled',
        async () => {
          assert.equal((await request('payment')).body, null);
          mode = 'lost-response';
          assert.equal((await request('broadcast', { signedOrigin: record.signedOrigin })).status, 409);
          mode = '';
          const result = await request('payment');
          assert.equal(result.status, 200);
          assert.equal(result.body.confirmation.transactionId, record.id);
          assert.equal(broadcasts.at(-1), record.signedOrigin);
        },
      );
      await t.test('mint broadcast preserves exact bytes and delivery verifies asset content and owner', async () => {
        assert.equal((await request('broadcast', { signedOrigin: mint.signedOrigin })).status, 200);
        assert.equal(broadcasts.at(-1), mint.signedOrigin);
        const result = await request('mint', { mint });
        assert.equal(result.status, 200);
        assert.equal(result.body.assetId, mint.assetId);
        assert.equal(result.body.confirmation.transactionId, mint.transactionId);
      });
      for (const failure of ['changed-price', 'wrong-factory-owner', 'wrong-template'])
        await t.test(failure + ' cannot return a signed mint or broadcast', async () => {
          mode = failure;
          const previous = broadcasts.length,
            result = await request('prepare');
          assert.equal(result.status, 409);
          assert.equal(broadcasts.length, previous);
          mode = '';
        });
      for (const failure of ['wrong-network', 'dolt-as-blocks', 'redirect'])
        await t.test(failure + ' cannot establish payment confirmation', async () => {
          mode = failure;
          assert.equal((await request('payment')).status, 409);
          mode = '';
        });
      for (const failure of ['wrong-recipient', 'wrong-content'])
        await t.test(failure + ' cannot establish delivery', async () => {
          mode = failure;
          assert.equal((await request('mint', { mint })).status, 409);
          mode = '';
        });
      await t.test('height zero remains pending; final chain rejection remains explicit', async () => {
        mode = 'zero-height';
        assert.equal((await request('payment')).body, null);
        mode = '';
        ledger.get(record.id).rejected = true;
        assert.equal((await request('payment')).body.rejected, true);
        ledger.get(record.id).rejected = false;
      });
      await t.test('a changed configured chain profile is rejected before any read', async () => {
        const before = reads.length;
        const result = await request('payment', { policy: { ...policy, chainId: 'foreign' } });
        assert.equal(result.status, 409);
        assert.equal(result.body.code, 'ACCEPTED_CHAIN_PROFILE_CHANGED');
        assert.equal(reads.length, before);
      });
      await t.test('broadcast acknowledgment cannot replace original hash', async () => {
        mode = 'wrong-broadcast-hash';
        assert.equal(
          (await request('broadcast', { signedOrigin: record.signedOrigin })).body.code,
          'CONFLICTING_CHAIN_EVIDENCE',
        );
        mode = '';
      });
      await t.test(
        'actual Dolt membership confirms the exact payment and mint without a fabricated block',
        async () => {
          const p = structuredClone(preparation);
          p.snapshot.policy.confirmationPolicy = 'arcblock-dolt-ledger/1';
          const selected = { ...policy, confirmationPolicy: 'arcblock-dolt-ledger/1' };
          const payment = await request('payment', { preparation: p, policy: selected });
          assert.equal(payment.status, 200, JSON.stringify(payment.body));
          assert.equal(payment.body.confirmation.confirmationPolicy, 'arcblock-dolt-ledger/1');
          assert.equal(payment.body.confirmation.blockHeight, undefined);
          const result = await request('mint', { preparation: p, policy: selected, mint });
          assert.equal(result.status, 200, JSON.stringify(result.body));
          assert.equal(result.body.assetId, mint.assetId);
          mode = 'bad-ledger-hash';
          assert.equal((await request('payment', { preparation: p, policy: selected })).status, 409);
          mode = '';
        },
      );
      await t.test(
        'the full 64 KiB contact contract supports signed mint and Dolt membership beyond the DMP-only 48 KiB limit',
        async () => {
          const p = structuredClone(preparation);
          p.ciphertext = 'C'.repeat(64 * 1024);
          const b = p.snapshot.binding;
          b.contentHash = getHasher(types.HashType.SHA3)(
            new TextEncoder().encode(b.sender + b.receiver + p.ciphertext + b.namecard),
            1,
          )
            .slice(-64)
            .toUpperCase();
          const payerKey = getSigner(types.KeyType.ED25519).genKeyPair('hex', new Uint8Array(32).fill(1));
          const payer = fromSecretKey(payerKey.secretKey, { pk: 0, hash: 1 });
          const tx = decodeTx(fromBase58(record.signedOrigin));
          tx.signature = undefined;
          tx.itx.data.value.contentHash = b.contentHash;
          const headers = [{ signer: tx.from, pk: tx.pk }];
          tx.signatures = headers;
          tx.signaturesList = headers;
          const encode = (value) => encodeTx({ ...value, itx: { type: 'TransferV3Tx', value: value.itx } });
          const unsigned = encode(tx);
          const multi = [{ ...headers[0], signature: toUint8Array(payer.sign(unsigned)) }];
          tx.signatures = multi;
          tx.signaturesList = multi;
          tx.signature = toUint8Array(payer.sign(encode(tx)));
          const signed = encode(tx);
          p.payment = {
            ...p.payment,
            signedOrigin: toBase58(signed),
            unsignedOrigin: toBase58(unsigned),
            transactionId: toTxHash(signed),
          };
          const result = await request('prepare', { preparation: p });
          assert.equal(result.status, 200, JSON.stringify(result.body));
          const large = result.body;
          let hostLoopResponsive = false;
          const hostTurn = setImmediate(() => { hostLoopResponsive = true; });
          let bytes;
          try {
            bytes = await decodeOcapReference(large.signedOrigin);
          } finally {
            clearImmediate(hostTurn);
          }
          assert.equal(hostLoopResponsive, true, 'reference decoding must let Miniflare service its host event loop');
          assert.ok(bytes.length > 48 * 1024);
          assert.ok(bytes.length < 72 * 1024);
          const oldAssetId = assetId;
          assetId = large.assetId;
          assetPreparation = p;
          ledger.set(large.transactionId, { bytes, rejected: false });
          p.snapshot.policy.confirmationPolicy = 'arcblock-dolt-ledger/1';
          try {
            const proof = await request('mint', {
              preparation: p,
              policy: { ...policy, confirmationPolicy: 'arcblock-dolt-ledger/1' },
              mint: large,
            });
            assert.equal(proof.status, 200, JSON.stringify(proof.body));
            assert.equal(proof.body.confirmation.transactionId, large.transactionId);
          } finally {
            assetId = oldAssetId;
            assetPreparation = preparation;
            ledger.delete(large.transactionId);
          }
        },
      );
      await t.test('actual adapter and durable coordinator recover both lost broadcasts to delivered', async () => {
        let db = await mf.getDatabase('DB');
        for (const file of (await fs.readdir('blocklet/providers/didmail-business/migrations')).sort()) {
          for (const sql of (await fs.readFile('blocklet/providers/didmail-business/migrations/' + file, 'utf8'))
            .split(';')
            .map((s) => s.replace(/^--.*$/gm, '').trim())
            .filter(Boolean))
            await db.prepare(sql).run();
        }
        const call = async (body) => {
          const response = await mf.dispatchFetch('https://contact.test/__contact/preparation', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          assert.equal(response.status, 200);
          return response.json();
        };
        await call({
          operation: 'create',
          snapshot: preparation.snapshot,
          ciphertext: f.encrypted,
          expiresAt: preparation.expiresAt,
          now: preparation.createdAt,
        });
        await call({
          operation: 'accept',
          id: record.preparationId,
          sender: record.owner,
          signedOrigin: record.signedOrigin,
          publicKey: f.publicKey,
          now: preparation.payment.acceptedAt,
        });
        ledger.clear();
        broadcasts.length = 0;
        mode = 'lost-response';
        await request('jobs', { now: 1800000011000 });
        assert.equal((await db.prepare('SELECT state FROM contact_jobs').first()).state, 'payment_pending');
        await request('jobs', { now: 1800000022000 });
        const pending = await db.prepare('SELECT * FROM contact_jobs').first();
        assert.equal(pending.state, 'mint_pending');
        assetId = pending.asset_id;
        const factoryReadCount = reads.filter((query) => query.includes('getFactoryState(')).length;
        await mf.dispose();
        mf = new Miniflare(options);
        db = await mf.getDatabase('DB');
        assert.equal(
          (await db.prepare('SELECT signed_mint FROM contact_jobs').first()).signed_mint,
          pending.signed_mint,
        );
        await request('jobs', { now: 1800000033000 });
        const delivered = await db.prepare('SELECT * FROM contact_jobs').first();
        assert.equal(delivered.state, 'delivered');
        assert.equal(delivered.signed_mint, pending.signed_mint);
        assert.deepEqual(broadcasts, [record.signedOrigin, pending.signed_mint]);
        assert.equal(reads.filter((query) => query.includes('getFactoryState(')).length, factoryReadCount);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM dmp_wallet_lanes').first()).n, 0);
        mode = '';
      });
    } finally {
      await mf.dispose();
      await fs.rm(storage, { recursive: true, force: true });
    }
  },
);
