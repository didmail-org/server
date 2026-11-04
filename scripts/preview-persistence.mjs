import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createReadStream } from 'node:fs';
const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3');

export const previewPersistenceOptions = (root) => ({ resourcePersistencePath: path.resolve(root) });
const open = (file) =>
  new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, sqlite3.OPEN_READONLY, (error) => (error ? reject(error) : resolve(db)));
  });
const close = (db) => new Promise((resolve, reject) => db.close((error) => (error ? reject(error) : resolve())));
const check = (db) =>
  new Promise((resolve, reject) =>
    db.all('PRAGMA integrity_check', (error, rows) =>
      error
        ? reject(error)
        : rows.length === 1 && rows[0].integrity_check === 'ok'
          ? resolve()
          : reject(Error('Invalid SQLite snapshot')),
    ),
  );
async function physicalPath(target) {
  const missing = [];
  let current = path.resolve(target);
  while (true) {
    try {
      return path.join(await fs.realpath(current), ...missing);
    } catch (error) {
      if (error.code !== 'ENOENT' || path.dirname(current) === current) throw error;
      missing.unshift(path.basename(current));
      current = path.dirname(current);
    }
  }
}
async function snapshotDatabase(source, destination) {
  const db = await open(source);
  let backup;
  try {
    await new Promise((resolve, reject) => {
      backup = db.backup(destination, (error) => (error ? reject(error) : resolve()));
    });
    await new Promise((resolve, reject) =>
      backup.step(-1, (error, done) =>
        error ? reject(error) : done ? resolve() : reject(Error('Incomplete SQLite snapshot')),
      ),
    );
  } finally {
    if (backup) await new Promise((resolve) => backup.finish(resolve));
    await close(db);
  }
  const copy = await open(destination);
  try {
    await check(copy);
  } finally {
    await close(copy);
  }
}

/** Caller must quiesce all writes across D1/R2. Never copy live WAL files as database snapshots. */
export async function snapshotPreviewPersistence({ source, destination }) {
  source = await fs.realpath(source);
  destination = await physicalPath(destination);
  if (source === destination || source.startsWith(destination + path.sep) || destination.startsWith(source + path.sep))
    throw Error('Snapshot destination must be separate from its source');
  for (const kind of ['d1', 'r2'])
    if (!(await fs.lstat(path.join(source, kind))).isDirectory()) throw Error('Missing preview storage');
  await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await fs.mkdir(destination, { mode: 0o700 }); // Exclusive ownership: never merge with or overwrite an existing state root.
  const files = [];
  try {
    async function copy(relative) {
      const input = path.join(source, relative),
        output = path.join(destination, relative),
        stat = await fs.lstat(input);
      if (stat.isSymbolicLink()) throw Error('Preview storage symlinks are not supported');
      if (stat.isDirectory()) {
        await fs.mkdir(output, { mode: 0o700 });
        for (const entry of (await fs.readdir(input)).sort()) await copy(path.join(relative, entry));
      } else if (stat.isFile()) {
        if (/-wal$|-shm$/.test(input)) return;
        if (input.endsWith('.sqlite')) await snapshotDatabase(input, output);
        else await fs.copyFile(input, output, fs.constants.COPYFILE_EXCL);
        await fs.chmod(output, 0o600);
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(output)) hash.update(chunk);
        files.push({ path: relative, size: (await fs.stat(output)).size, sha256: hash.digest('hex') });
      } else throw Error('Unsupported preview storage file');
    }
    for (const kind of ['d1', 'r2']) await copy(kind);
    const report = { createdAt: new Date().toISOString(), files };
    await fs.writeFile(path.join(destination, 'snapshot.json'), JSON.stringify(report, null, 2) + '\n', {
      mode: 0o600,
      flag: 'wx',
    });
    return report;
  } catch (error) {
    await fs.rm(destination, { recursive: true, force: true });
    throw error;
  }
}
