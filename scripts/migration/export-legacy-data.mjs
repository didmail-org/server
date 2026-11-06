import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sqlite3 from 'sqlite3';
import { pathToFileURL } from 'node:url';
const tables = [
  'contacts',
  'mails',
  'envelopes',
  'namecards',
  'attachment_config',
  'attachments',
  'aliases',
  'domain_bindings',
  'legacy_payment_nonce',
];
const digest = (data) => createHash('sha256').update(data).digest('hex');
const literal = (value) =>
  value == null
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : Buffer.isBuffer(value)
        ? "X'" + value.toString('hex') + "'"
        : "'" + String(value).replaceAll("'", "''") + "'";
export async function exportWorkerData(database, output) {
  const target = path.resolve(output);
  // Refuse overwrite, including partially prepared backups.
  await fs.mkdir(target, { mode: 0o700 });
  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(path.resolve(database), sqlite3.OPEN_READONLY, (e) =>
      e ? reject(e) : resolve(connection),
    );
  });
  const all = (sql) => new Promise((resolve, reject) => db.all(sql, (e, rows) => (e ? reject(e) : resolve(rows))));
  const report = { format: 'didmail-workers-v1', createdAt: new Date().toISOString(), tables: {}, objects: [] };
  try {
    const integrity = await all('PRAGMA integrity_check');
    if (Object.values(integrity[0])[0] !== 'ok') throw new Error('Source database integrity check failed');
    await all('BEGIN'); // One read snapshot, including committed WAL data.
    await fs.mkdir(path.join(target, 'objects'), { mode: 0o700 });
    const sql = ['-- Import into an empty database using the preserved blocklet/providers/didmail-business/migrations sequence.'];
    for (const table of tables) {
      const present = await all(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`);
      if (!present.length) {
        report.tables[table] = 0;
        continue;
      }
      const rows = await all(`SELECT * FROM "${table}" ORDER BY id`);
      report.tables[table] = rows.length;
      for (const original of rows) {
        const row = { ...original };
        if (table === 'mails' && !row.sendStatus)
          row.sendStatus = row.asset ? 'sent' : row.paymentTx || row.assetTx ? 'review' : 'prepared';
        if (['mails', 'attachments'].includes(table)) {
          const bytes = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content, 'utf8');
          const key = `${table}/import-${row.id}-${digest(bytes)}`;
          const file = 'objects/' + key.replaceAll('/', '_');
          await fs.writeFile(path.join(target, file), bytes, { mode: 0o600, flag: 'wx' });
          report.objects.push({ key, file, size: bytes.length, sha256: digest(bytes) });
          row.content = 'r2://' + key;
        }
        const columns = Object.keys(row);
        sql.push(
          `INSERT INTO "${table}" (${columns.map((c) => '"' + c.replaceAll('"', '""') + '"').join(',')}) VALUES (${columns.map((c) => literal(row[c])).join(',')});`,
        );
      }
    }
    await all('ROLLBACK');
    const data = sql.join('\n') + '\n';
    await fs.writeFile(path.join(target, 'data.sql'), data, { mode: 0o600, flag: 'wx' });
    report.sqlSha256 = digest(data);
    await fs.writeFile(path.join(target, 'manifest.json'), JSON.stringify(report, null, 2) + '\n', {
      mode: 0o600,
      flag: 'wx',
    });
    return report;
  } catch (error) {
    await fs.rm(target, { recursive: true, force: true });
    throw error;
  } finally {
    await new Promise((resolve, reject) => db.close((e) => (e ? reject(e) : resolve())));
  }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const database = args[args.indexOf('--database') + 1],
    output = args[args.indexOf('--out') + 1];
  if (!args.includes('--database') || !args.includes('--out') || !database || !output)
    throw new Error(
      'Usage: node scripts/migration/export-legacy-data.mjs --database /safe/didmail.sqlite --out /safe/new-export',
    );
  const report = await exportWorkerData(database, output);
  console.log(JSON.stringify({ tables: report.tables, objects: report.objects.length, output: path.resolve(output) }));
}
