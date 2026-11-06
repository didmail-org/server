import fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { AfsBusinessStore, dumpDatabase } from './store.mjs';

export async function initializeBusinessStorage(root) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE didmail_preview_migrations(name TEXT PRIMARY KEY)');
    const directory = new URL('./migrations/', import.meta.url);
    for (const name of (await fs.readdir(directory)).sort()) {
      if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(name)) throw Error('Unexpected packaged migration');
      db.exec(await fs.readFile(new URL(name, directory), 'utf8'));
      db.prepare('INSERT INTO didmail_preview_migrations VALUES(?)').run(name);
    }
    for (const table of ['mail_service_policy', 'mail_access_entries', 'mail_policy_audit']) db.exec('DROP TABLE ' + table);
    await new AfsBusinessStore(root).initialize(dumpDatabase(db));
  } finally { db.close(); }
}

// Additive upgrade only: never initialize or replace an existing installation.
export async function upgradeDeliveryStorage(root) {
  const store = new AfsBusinessStore(root);
  let state;
  try { ({ state } = await store.read()); }
  catch (error) { if (['AFS_NOT_FOUND', 1].includes(error.code)) return; throw error; }
  if (!state.tables.dmp_messages || state.tables.dmp_index_attempts) return;
  const name = '0022_dmp_index_attempts.sql';
  const migration = await fs.readFile(new URL('./migrations/' + name, import.meta.url), 'utf8');
  await store.transaction([
    { sql: migration, params: [] },
    { sql: 'CREATE TABLE IF NOT EXISTS didmail_preview_migrations(name TEXT PRIMARY KEY)', params: [] },
    { sql: 'INSERT OR IGNORE INTO didmail_preview_migrations VALUES(?)', params: [name] },
  ]);
}
