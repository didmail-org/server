import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test('external unpaid quotas use bounded index ranges excluding internal uploads and paid history', async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: { DB: 'quota-query-plans' },
    }),
  );
  try {
    const db = await mf.getD1Database('DB');
    for (const name of ['0005_dmp_protocol.sql', '0006_contact_preparations.sql', '0007_unpaid_session_indexes.sql', '0016_member_mail.sql', '0017_external_upload_sessions.sql']) {
      const sql = await fs.readFile('workers/migrations/' + name, 'utf8');
      for (const statement of sql
        .split(';')
        .map((s) => s.replace(/^--.*$/gm, '').trim())
        .filter(Boolean))
        await db.prepare(statement).run();
    }
    const queries = [
      [
        'SELECT COUNT(*) FROM contact_preparations WHERE sender=? AND payment_hash IS NULL AND expires_at>?',
        ['public-fixture-sender', Date.now()],
        'contact_preparations_unpaid',
      ],
      [
        "SELECT COUNT(*) FROM dmp_messages WHERE sender_id=? AND id<>? AND delivery_kind='nft' AND accepted_at IS NULL AND lifecycle='live' AND upload_expires_at>?",
        ['public-fixture-sender', 'public-fixture-message', new Date().toISOString()],
        'dmp_messages_unpaid',
      ],
    ];
    for (const [sql, parameters, index] of queries) {
      const plan = await db
        .prepare('EXPLAIN QUERY PLAN ' + sql)
        .bind(...parameters)
        .all();
      const detail = plan.results.map((row) => row.detail).join('\n');
      assert.match(detail, /SEARCH /);
      assert.ok(detail.includes(index), detail);
      assert.match(detail, /\(sender(?:_id)?=\? AND (?:upload_)?expires_at>\?\)/);
      assert.doesNotMatch(detail, /SCAN /);
    }
  } finally {
    await mf.dispose();
  }
});
