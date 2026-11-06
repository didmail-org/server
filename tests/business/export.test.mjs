import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { exportWorkerData } from '../../scripts/migration/export-legacy-data.mjs';
const open = (file) =>
  new Promise((r, j) => {
    const db = new sqlite3.Database(file, (e) => (e ? j(e) : r(db)));
  });
const exec = (db, sql) => new Promise((r, j) => db.exec(sql, (e) => (e ? j(e) : r())));
const close = (db) => new Promise((r, j) => db.close((e) => (e ? j(e) : r())));
test('SQLite export preserves IDs, WAL rows, metadata, ciphertext and refuses overwrite', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-worker-export-'));
  const source = path.join(root, 'source.sqlite'),
    target = path.join(root, 'export');
  const db = await open(source);
  let restored;
  try {
    await exec(
      db,
      "PRAGMA journal_mode=WAL; CREATE TABLE mails(id INTEGER PRIMARY KEY,content TEXT,subject TEXT); CREATE TABLE attachments(id TEXT PRIMARY KEY,mailId INTEGER,content BLOB); INSERT INTO mails VALUES(42,'opaque-content','O''Brien'); INSERT INTO attachments VALUES('a',42,X'00FF1122');",
    );
    const nonceSchema = await fs.readFile('blocklet/providers/didmail-business/migrations/0020_legacy_payment_nonce.sql', 'utf8');
    await exec(db, nonceSchema);
    await exec(db, 'INSERT INTO legacy_payment_nonce(id,last_nonce) VALUES(1,1793402000000)');
    const report = await exportWorkerData(source, target);
    assert.equal(report.tables.mails, 1);
    assert.equal(report.tables.attachments, 1);
    assert.equal(report.tables.legacy_payment_nonce, 1);
    assert.equal(report.objects.length, 2);
    const blob = report.objects.find((o) => o.key.startsWith('attachments/'));
    assert.deepEqual(await fs.readFile(path.join(target, blob.file)), Buffer.from([0, 255, 17, 34]));
    restored = await open(path.join(root, 'restored.sqlite'));
    await exec(
      restored,
      "CREATE TABLE mails(id INTEGER PRIMARY KEY,content TEXT,subject TEXT,sendStatus TEXT NOT NULL DEFAULT 'prepared'); CREATE TABLE attachments(id TEXT PRIMARY KEY,mailId INTEGER,content BLOB);",
    );
    await exec(restored, nonceSchema);
    await exec(restored, await fs.readFile(path.join(target, 'data.sql'), 'utf8'));
    const row = await new Promise((r, j) => restored.get('SELECT * FROM mails', (e, row) => (e ? j(e) : r(row))));
    assert.equal(row.id, 42);
    assert.equal(row.sendStatus, 'prepared');
    assert.equal(row.subject, "O'Brien");
    assert.ok(row.content.startsWith('r2://mails/'));
    const nonce = await new Promise((r, j) => restored.get('SELECT last_nonce FROM legacy_payment_nonce WHERE id=1', (e, value) => (e ? j(e) : r(value))));
    assert.equal(nonce.last_nonce, 1793402000000, 'Node-to-Worker migration preserves the payment nonce high-water mark');
    await assert.rejects(exportWorkerData(source, target), /EEXIST/);
  } finally {
    await close(db);
    if (restored) await close(restored);
    await fs.rm(root, { recursive: true, force: true });
  }
});
