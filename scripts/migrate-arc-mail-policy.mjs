// One-time operator import, separate from package building and runtime startup.
import { createRequire } from 'node:module';
import { promisify, parseArgs } from 'node:util';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { MailPolicyStore, validateState } from '../blocklet/providers/didmail-native/mail-policy.mjs';
import { localPolicyRoot } from './arc-mail-policy-bridge.mjs';
const require = createRequire(import.meta.url);

export async function exportMailPolicy(database, accessSource) {
  if (!['arc', 'legacy'].includes(accessSource)) throw new Error('Explicit access source is required');
  const sqlite3 = require('sqlite3');
  const db = await new Promise((resolve, reject) => { const db = new sqlite3.Database(database, sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(db)); });
  const all = promisify(db.all.bind(db));
  try {
    // One read transaction keeps policy, access-list and audit at one revision.
    await promisify(db.run.bind(db))('BEGIN');
    const [row] = await all('SELECT * FROM mail_service_policy WHERE id=1');
    if (!row) throw new Error('Original policy is missing');
    const entries = await all('SELECT kind,did,remark,created_at AS createdAt,created_by AS createdBy FROM mail_access_entries ORDER BY kind,did');
    const audit = await all('SELECT revision,actor,action,target,created_at AS createdAt FROM mail_policy_audit ORDER BY revision');
    const state = validateState({ schemaVersion: 1, revision: row.revision, policy: JSON.parse(row.policy_json), updatedAt: row.updated_at, updatedBy: row.updated_by, accessSource, entries, audit, admissions: {} });
    await promisify(db.run.bind(db))('COMMIT'); return state;
  } finally { await promisify(db.close.bind(db))(); }
}
export async function importMailPolicy(root, state) {
  validateState(state);
  if (Object.keys(state.admissions).length) throw new Error('Import cannot carry active admission locks');
  const store = new MailPolicyStore(root);
  await store.initialize(state);
  const actual = (await store.read()).state;
  if (JSON.stringify(actual) !== JSON.stringify(state)) throw new Error('Policy import readback mismatch');
  return { revision: state.revision, entries: state.entries.length, audit: state.audit.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { instance: { type: 'string' }, database: { type: 'string' }, 'access-source': { type: 'string' }, export: { type: 'string' } } });
  if (!values.instance || !values.database || !values.export) throw new Error('Supply --instance, --database, --access-source and --export');
  const { stdout } = await promisify(execFile)('arc', ['service', 'status', '--instance', values.instance, '--json']);
  const service = JSON.parse(stdout.slice(stdout.indexOf('{')));
  if (service.status !== 'up' || !service.port) throw new Error('Named ARC instance must be running');
  const activation = await fetch(`http://127.0.0.1:${service.port}/?blocklet=didmail-server`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!activation.ok) throw new Error('DIDMail ARC instance could not be activated');
  const state = await exportMailPolicy(values.database, values['access-source']);
  await fs.writeFile(values.export, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
  const result = await importMailPolicy(localPolicyRoot(`http://127.0.0.1:${service.port}`), state);
  console.log(`Policy import verified: revision ${result.revision}; ${result.entries} access entries; ${result.audit} audit records. Original database retained.`);
}
