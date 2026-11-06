import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from './host/miniflare.mjs';
import { fromRandom } from '@ocap/wallet';

test('AFS payment nonces are unique across concurrent HTTP isolates and survive a backwards clock', async () => {
  const node = fromRandom();
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: ['first','second'].map(name => ({
    name, modules: true, scriptPath: 'artifacts/business-tests/test.mjs', compatibilityDate: '2026-10-24', compatibilityFlags: ['nodejs_compat'],
    bindings: { NODE_SECRET_KEY: node.secretKey, DIDMAIL_URL: 'https://nonce.test' }, databaseFixtures: { DB: 'shared-nonce' },
  })) }));
  try {
    const db = await mf.getDatabase('DB', 'first');
    await db.prepare(await fs.readFile('blocklet/providers/didmail-business/migrations/0020_legacy_payment_nonce.sql','utf8')).run();
    const floor = Date.now() + 100000;
    await db.prepare('INSERT INTO legacy_payment_nonce(id,last_nonce) VALUES(1,?)').bind(floor).run();
    const workers = await Promise.all(['first','second'].map(name => mf.getWorker(name)));
    const nonces = await Promise.all(Array.from({length: 32}, async (_,i) => {
      const response = await workers[i % 2].fetch('https://nonce.test/__payment-nonce');
      assert.equal(response.status,200);
      return (await response.json()).nonce;
    }));
    assert.deepEqual([...nonces].sort((a,b) => a-b),Array.from({length: 32},(_,i) => floor+i+1));
    assert.equal((await db.prepare('SELECT last_nonce FROM legacy_payment_nonce').first()).last_nonce,floor+32);
    await db.prepare('UPDATE legacy_payment_nonce SET last_nonce=9007199254740991').run();
    await assert.rejects(workers[0].fetch('https://nonce.test/__payment-nonce'), /Payment nonce exhausted/);
  } finally { await mf.dispose(); }
});
