// Local trusted runtime adapter. Durable authority is JSON/objects in instance
// AFS; SQLite is an ephemeral evaluator of the existing transaction predicates.
import { DatabaseSync, constants } from 'node:sqlite';
import { createHash } from 'node:crypto';

import {businessPath,objectPrefix} from './paths.mjs';
export {businessPath,objectPrefix} from './paths.mjs';
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const failure = (code, status = 503) => Object.assign(new Error(code), { code, status });
const encode = value => value instanceof Uint8Array ? { bytes: Buffer.from(value).toString('base64') } : typeof value === 'bigint' ? Number.isSafeInteger(Number(value)) ? Number(value) : { integer: String(value) } : value;
const decode = value => value && typeof value === 'object' ? 'bytes' in value ? Buffer.from(value.bytes, 'base64') : BigInt(value.integer) : value;
export const encodeRow = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, encode(value)]));
// An imported schema is data, not authority to access the Node host filesystem.
const localSqlOnly = (action, arg1, arg2) =>
  [constants.SQLITE_ATTACH, constants.SQLITE_DETACH, constants.SQLITE_TRANSACTION, constants.SQLITE_SAVEPOINT, constants.SQLITE_CREATE_VTABLE, constants.SQLITE_DROP_VTABLE].includes(action) ||
  (action === constants.SQLITE_PRAGMA && !['quick_check','page_count','page_size'].includes(arg1)) ||
  (action === constants.SQLITE_FUNCTION && ['load_extension','writefile','readfile'].includes(arg2)) ? constants.SQLITE_DENY : constants.SQLITE_OK;

export function dumpDatabase(db) {
  const schema = db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name").all();
  const tables = Object.fromEntries(schema.filter(item => item.type === 'table').map(({ name }) => {
    const statement = db.prepare('SELECT * FROM ' + quote(name)); statement.setReadBigInts(true);
    return [name, statement.all().map(encodeRow)];
  }));
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").get()) tables.sqlite_sequence = db.prepare('SELECT * FROM sqlite_sequence').all().map(encodeRow);
  return { schemaVersion: 1, schema, tables };
}
export function restoreDatabase(state) {
  if (state?.schemaVersion !== 1 || !Array.isArray(state.schema) || !state.tables || typeof state.tables !== 'object') throw failure('AFS_BUSINESS_INVALID');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=OFF');
    db.setAuthorizer(localSqlOnly);
    for (const item of state.schema.filter(item => item.type === 'table')) db.exec(item.sql);
    for (const [table, rows] of Object.entries(state.tables)) {
      if (table === 'sqlite_sequence') db.exec('DELETE FROM sqlite_sequence');
      for (const row of rows) { const fields = Object.keys(row); db.prepare(`INSERT INTO ${quote(table)} (${fields.map(quote)}) VALUES (${fields.map(() => '?')})`).run(...fields.map(key => decode(row[key]))); }
    }
    for (const item of state.schema.filter(item => item.type !== 'table')) db.exec(item.sql);
    db.setAuthorizer(null);
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) throw failure('AFS_BUSINESS_INVALID');
    db.exec('PRAGMA foreign_keys=ON'); return db;
  } catch (error) { db.close(); throw error; }
}
const writes = new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,23,26,27,28,29,30]);
export class AfsBusinessStore {
  constructor(root) { this.root = root; this.queue = Promise.resolve(); }
  async capabilities() {
    let caps = (await this.root.read('/instance/.meta/.capabilities')).data.content;
    if (typeof caps === 'string') caps = JSON.parse(caps);
    const features = (caps.operations ?? caps)?.write?.features;
    if (features?.ifMatch !== true || features?.treeIncrement !== true) throw failure('AFS_NOT_SUPPORTED');
  }
  async read() {
    const node = (await this.root.read(businessPath)).data;
    if (typeof node.meta?.version !== 'string') throw failure('AFS_NOT_SUPPORTED');
    try { return { state: JSON.parse(node.content), version: node.meta.version }; }
    catch { throw failure('AFS_BUSINESS_INVALID'); }
  }
  async initialize(state) {
    const check = restoreDatabase(state); check.close(); await this.capabilities();
    await this.root.write(businessPath, { content: JSON.stringify(state) }, { ifMatch: '!absent' });
    if (JSON.stringify((await this.read()).state) !== JSON.stringify(state)) throw failure('AFS_IMPORT_MISMATCH');
  }
  transaction(statements) {
    const task = this.queue.then(() => this.execute(statements));
    this.queue = task.catch(() => {}); return task;
  }
  async execute(statements) {
    if (!Array.isArray(statements) || !statements.length || statements.length > 1000) throw failure('AFS_INVALID_TRANSACTION', 400);
    for (let attempt = 0; attempt < 16; attempt++) {
      const { state, version } = await this.read(); const db = restoreDatabase(state);
      let dirty = false, statementDirty = false;
      try {
        db.exec('BEGIN');
        db.setAuthorizer((action, arg1, arg2) => {
          if (localSqlOnly(action, arg1, arg2) === constants.SQLITE_DENY) return constants.SQLITE_DENY;
          if (writes.has(action)) { dirty = true; statementDirty = true; }
          return constants.SQLITE_OK;
        });
        const results = statements.map(({ sql, params = [] }) => {
          if (typeof sql !== 'string' || !Array.isArray(params)) throw failure('AFS_INVALID_TRANSACTION', 400);
          statementDirty = false;
          const statement = db.prepare(sql); const columns = statement.columns();
          let rows = [], changes = 0, last_row_id = 0;
          if (columns.length) rows = statement.all(...params.map(decode)).map(encodeRow);
          else { const result = statement.run(...params.map(decode)); changes = Number(result.changes); last_row_id = Number(result.lastInsertRowid); }
          // RETURNING also mutates; changes()/last_insert_rowid() are per evaluator.
          if (columns.length && statementDirty) { const meta = db.prepare('SELECT changes() AS changes,last_insert_rowid() AS last_row_id').get(); changes = meta.changes; last_row_id = meta.last_row_id; }
          return { success: true, results: rows, meta: { changes, last_row_id, duration: 0, changed_db: statementDirty } };
        });
        db.setAuthorizer(null);
        if (dirty) { await this.capabilities(); await this.root.write(businessPath, { content: JSON.stringify(dumpDatabase(db)) }, { ifMatch: version }); }
        db.exec('COMMIT'); return results;
      } catch (error) {
        // Retry only a definite conditional-write rejection. A lost commit
        // response has an unknown outcome and must be reconciled by protocol IDs.
        if (error.code !== 'AFS_CONFLICT') throw error;
      } finally { db.close(); }
    }
    throw failure('AFS_CONFLICT', 409);
  }
}

export class AfsObjectStore {
  constructor(root) { this.root = root; }
  path(key) {
    if (typeof key !== 'string' || !key || key.length > 2048) throw failure('AFS_INVALID_OBJECT_KEY', 400);
    return objectPrefix + createHash('sha256').update(key).digest('hex') + '.json';
  }
  async read(key) {
    try {
      const node = (await this.root.read(this.path(key))).data;
      const value = JSON.parse(node.content);
      if (value.key !== key || typeof node.meta?.version !== 'string') throw failure('AFS_OBJECT_INVALID');
      if (!value.deleted) { const bytes = Buffer.from(value.bytes, 'base64'); if (bytes.length !== value.size || createHash('sha256').update(bytes).digest('hex') !== value.sha256) throw failure('AFS_OBJECT_INVALID'); }
      return { value, version: node.meta.version };
    } catch (error) { if (error.code === 'AFS_NOT_FOUND') return { value: null, version: '!absent' }; throw error; }
  }
  async put(key, bytes, httpMetadata = {}, { createOnly = false, uploaded = new Date().toISOString(), customMetadata = {} } = {}) {
    const previous = await this.read(key);
    if (createOnly && previous.version !== '!absent') throw failure('AFS_CONFLICT', 409);
    const value = { schemaVersion: 1, key, size: bytes.length, bytes: Buffer.from(bytes).toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex'), httpMetadata, customMetadata, uploaded };
    await this.root.write(this.path(key), { content: JSON.stringify(value) }, { ifMatch: previous.version });
    return value;
  }
  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const previous = await this.read(key);
      if (!previous.value || previous.value.deleted) continue;
      // Conditional tombstone is retryable and never resurrects object bytes.
      await this.root.write(this.path(key), { content: JSON.stringify({ schemaVersion: 1, key, deleted: true }) }, { ifMatch: previous.version });
    }
  }
}
