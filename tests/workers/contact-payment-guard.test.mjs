import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test('contact payment guard preserves historical evidence and closes submissions without an original preparation', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', compatibilityDate: '2026-10-24', d1Databases: { DB: 'contact-guard' } }));
  try {
    const db = await mf.getD1Database('DB');
    const apply = async file => {
      for (const sql of (await fs.readFile('workers/migrations/' + file, 'utf8')).split(';').map(s => s.replace(/^--.*$/gm, '').trim()).filter(Boolean)) await db.prepare(sql).run();
    };
    for (const file of (await fs.readdir('workers/migrations')).sort().filter(file => file < '0018')) await apply(file);
    for (const [id, payment, asset] of [[1, null, null], [2, 'payment-original', 'asset-original'], [3, 'payment-ambiguous', null]])
      await db.prepare("INSERT INTO contacts(id,sender,receiver,contact,namecard,paymentTx,asset,createdAt,updatedAt) VALUES(?,'sender','receiver','opaque-ciphertext','fixture',?,?,'2026-10-30','2026-10-30')").bind(id, payment, asset).run();
    const before = (await db.prepare('SELECT * FROM contacts ORDER BY id').all()).results;
    await apply('0018_contact_payment_guard.sql');
    const after = (await db.prepare('SELECT * FROM contacts ORDER BY id').all()).results;
    assert.deepEqual(after.map(({preparedOrigin, sendStatus, ...rest}) => rest), before);
    assert.deepEqual(after.map(r => r.sendStatus), ['review', 'sent', 'review']);
    assert.ok(after.every(r => r.preparedOrigin === null));
  } finally { await mf.dispose(); }
});
