import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from './host/miniflare.mjs';
import { fromRandom } from '@ocap/wallet';
import { toBase58 } from '@ocap/util';

test(
  'direct endpoint selects the first published public envelope and excludes member envelopes',
  { timeout: 60000 },
  async () => {
    const member = fromRandom(),
      nft = fromRandom().address,
      nextNft = fromRandom().address;
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        workers: [
          {
            name: 'default-envelope',
            modules: true,
            scriptPath: 'artifacts/business-tests/test.mjs',
            compatibilityDate: '2026-10-24',
            compatibilityFlags: ['nodejs_compat'],
            bindings: { NODE_SECRET_KEY: member.secretKey, DIDMAIL_URL: 'https://default.test' },
            databaseFixtures: { DB: 'default-envelope' },
            objectFixtures: { BLOBS: 'default-envelope' },
            serviceBindings: { ARC: 'arc', ASSETS: 'arc' },
            outboundService: () => new Response('External chain forbidden', { status: 502 }),
          },
          {
            name: 'arc',
            modules: true,
            compatibilityDate: '2026-10-24',
            script: `export default {fetch(){return Response.json({authenticated:false,user:null});}};`,
          },
        ],
      }),
    );
    try {
      const db = await mf.getDatabase('DB', 'default-envelope');
      for (const file of (await fs.readdir('blocklet/providers/didmail-business/migrations')).sort()) {
        const sql = await fs.readFile(`blocklet/providers/didmail-business/migrations/${file}`, 'utf8');
        for (const statement of sql
          .split(';')
          .map((s) => s.replace(/^--.*$/gm, '').trim())
          .filter(Boolean))
          await db.prepare(statement).run();
      }
      const fetcher = (path, init) => mf.dispatchFetch('https://default.test' + path, init);
      for (const [path, method] of [
        ['/service-config', 'GET'], ['/messages', 'POST'], ['/messages/old', 'GET'],
        ['/messages/old/status', 'GET'], ['/messages/old/submit', 'POST'],
        ['/messages/old/blobs/body/chunks/0', 'GET'],
      ]) {
        const retired = await fetcher('/__production/v2/ordinary' + path, { method });
        assert.equal(retired.status, 404);
        assert.equal((await retired.json()).code, 'NOT_FOUND');
      }
      const initial = await (await fetcher('/api/mail/service-config')).json();
      assert.equal(initial.directEnabled, false);
      assert.equal(initial.defaultEnvelope, null);
      assert.equal(initial.sendingRestricted, false);
      assert.equal('membershipSource' in initial, false);
      await db
        .prepare(
          'INSERT INTO envelopes (address,name,price,token,retentionPeriod,svg,enabled,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          nft,
          'Paid default NFT',
          '0.001 TBA',
          JSON.stringify({ value: '1000000000000000', decimal: 18, symbol: 'TBA' }),
          30,
          'data:image/svg+xml;base64,PHN2Zy8+',
          1,
          new Date().toISOString(),
          new Date().toISOString(),
        )
        .run();
      const publicConfig = await (await fetcher('/api/mail/service-config')).json();
      assert.equal(publicConfig.directEnabled, true);
      assert.equal(publicConfig.sendingRestricted, false);
      assert.equal(publicConfig.defaultEnvelope.address, nft);
      assert.equal(publicConfig.defaultEnvelope.price, '0.001');
      assert.equal(publicConfig.defaultEnvelope.retentionPeriod, 30);
      assert.equal('allowedDids' in publicConfig, false);
      const headers = { 'X-DIDMail-did': member.address, 'X-DIDMail-pk': toBase58(member.publicKey) };
      const list = await (await fetcher('/api/envelopes', { headers })).json();
      assert.equal(list.defaultEnvelope.address, nft);
      assert.equal(list.total, 1);
      await db.prepare('UPDATE envelopes SET enabled=0 WHERE address=?').bind(nft).run();
      assert.equal((await (await fetcher('/api/mail/service-config')).json()).directEnabled, false);
      await db
        .prepare('INSERT INTO envelopes (address,name,price,token,retentionPeriod,enabled,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)')
        .bind(nextNft, 'Next paid NFT', '0.002 TBA', '{}', 14, 1, new Date().toISOString(), new Date().toISOString())
        .run();
      assert.equal((await (await fetcher('/api/mail/service-config')).json()).defaultEnvelope.address, nextNft);
      await db.prepare('UPDATE envelopes SET enabled=1 WHERE address=?').bind(nft).run();
      assert.equal((await (await fetcher('/api/mail/service-config')).json()).defaultEnvelope.address, nft);
      await db.prepare("UPDATE envelopes SET category='members' WHERE address=?").bind(nft).run();
      assert.equal((await (await fetcher('/api/mail/service-config')).json()).defaultEnvelope.address,nextNft);
    } finally {
      await mf.dispose();
    }
  },
);
