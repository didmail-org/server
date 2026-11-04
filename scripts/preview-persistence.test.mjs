import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { previewPersistenceOptions, snapshotPreviewPersistence } from './preview-persistence.mjs';

test(
  'preview D1/R2 snapshots preserve committed data and reopen under the production persistence option',
  { timeout: 30000 },
  async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-preview-state-'));
    const source = path.join(root, 'source'),
      destination = path.join(root, 'snapshot');
    const options = (state) =>
      convertV4MiniflareOptions({
        modules: true,
        script: 'export default {fetch(){return new Response("ok")}}',
        compatibilityDate: '2026-10-24',
        d1Databases: { DB: 'preserved-preview' },
        r2Buckets: { BLOBS: 'preserved-preview' },
        ...previewPersistenceOptions(state),
      });
    let mf = new Miniflare(options(source));
    try {
      const db = await mf.getD1Database('DB'),
        blobs = await mf.getR2Bucket('BLOBS');
      await db.prepare('CREATE TABLE immutable_evidence(id TEXT PRIMARY KEY, payload BLOB)').run();
      await db
        .prepare('INSERT INTO immutable_evidence VALUES(?,?)')
        .bind('public-fixture', new Uint8Array([0, 255, 42]))
        .run();
      await blobs.put('opaque/ciphertext', new Uint8Array([9, 0, 128, 255]));
      // No writes are in flight. Snapshot the open SQLite/WAL databases with the online backup API.
      const report = await snapshotPreviewPersistence({ source, destination });
      assert.ok(report.files.some((file) => file.path.endsWith('.sqlite')));
      assert.ok(report.files.every((file) => !/-wal$|-shm$/.test(file.path)));
      assert.equal((await fs.stat(destination)).mode & 0o777, 0o700);
      for (const file of report.files)
        assert.equal((await fs.stat(path.join(destination, file.path))).mode & 0o777, 0o600);
      await assert.rejects(snapshotPreviewPersistence({ source, destination }), /EEXIST/);
      await mf.dispose();
      mf = new Miniflare(options(destination));
      const restored = await mf.getD1Database('DB');
      assert.deepEqual(
        (await restored.prepare('SELECT payload FROM immutable_evidence WHERE id=?').bind('public-fixture').first())
          .payload,
        [0, 255, 42],
      );
      assert.deepEqual(
        new Uint8Array(await (await (await mf.getR2Bucket('BLOBS')).get('opaque/ciphertext')).arrayBuffer()),
        new Uint8Array([9, 0, 128, 255]),
      );
      await mf.dispose();
      mf = new Miniflare(options(destination));
      assert.equal(
        (await (await mf.getD1Database('DB')).prepare('SELECT COUNT(*) AS count FROM immutable_evidence').first())
          .count,
        1,
      );
    } finally {
      await mf.dispose();
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test('preview checkpoint rejects symlinks without leaving an incomplete destination', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-preview-links-'));
  try {
    const source = path.join(root, 'source'),
      destination = path.join(root, 'destination');
    await fs.mkdir(path.join(source, 'd1'), { recursive: true });
    await fs.mkdir(path.join(source, 'r2'));
    await fs.symlink(root, path.join(source, 'd1', 'outside'));
    await assert.rejects(snapshotPreviewPersistence({ source, destination }), /symlink/);
    await assert.rejects(fs.stat(destination), /ENOENT/);
    await assert.rejects(snapshotPreviewPersistence({ source, destination: path.join(source, 'nested') }), /separate/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
