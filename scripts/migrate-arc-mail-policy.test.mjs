import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { fromRandom } from '@ocap/wallet';
import { exportMailPolicy, importMailPolicy } from './migrate-arc-mail-policy.mjs';
import { memoryPolicyRoot } from './afs-policy-fixture.mjs';
import { MailPolicyStore } from '../blocklet/providers/didmail-native/mail-policy.mjs';
const sqlite3 = createRequire(import.meta.url)('sqlite3');
test('policy import preserves revision, exact prices, original access metadata and audit, and never overwrites', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-import-'));
  const file = path.join(dir, 'source.sqlite');
  const db = await new Promise((resolve, reject) => { const db = new sqlite3.Database(file, error => error ? reject(error) : resolve(db)); });
  const run = promisify(db.run.bind(db)), get = promisify(db.get.bind(db));
  try {
    await promisify(db.exec.bind(db))(await fs.readFile('blocklet/providers/didmail-business/migrations/0009_mail_admission.sql', 'utf8'));
    const policy = JSON.parse((await get('SELECT policy_json FROM mail_service_policy')).policy_json);
    policy.ordinary.baseFee = '900719925474099312345';
    await run('UPDATE mail_service_policy SET revision=3,policy_json=?,updated_by=?,updated_at=?', JSON.stringify(policy), 'fixture-admin', '2026-11-05T00:00:00.000Z');
    const did = 'did:abt:' + fromRandom().address;
    await run("INSERT INTO mail_access_entries VALUES('deny',?,'original note','2026-11-04T00:00:00.000Z','original-actor')", did);
    await run("INSERT INTO mail_policy_audit VALUES(2,'original-actor','list.put',?,'2026-11-04T00:00:00.000Z')", 'deny:' + did);
    await run("INSERT INTO mail_policy_audit VALUES(3,'fixture-admin','policy.update',NULL,'2026-11-05T00:00:00.000Z')");
    const exported = await exportMailPolicy(file, 'arc');
    assert.equal(exported.revision, 3); assert.equal(exported.entries[0].createdBy, 'original-actor');
    assert.equal(exported.policy.ordinary.baseFee, '900719925474099312345'); assert.equal(exported.audit.length, 2);
    const root = memoryPolicyRoot();
    await importMailPolicy(root, exported);
    await assert.rejects(importMailPolicy(root, { ...exported, revision: 4 }), { code: 'AFS_CONFLICT' });
    assert.deepEqual((await new MailPolicyStore(root).read()).state, exported);
    assert.equal((await get('SELECT policy_json FROM mail_service_policy')).policy_json, JSON.stringify(policy));
    assert.equal((await get('SELECT count(*) n FROM mail_access_entries')).n, 1);
  } finally { await promisify(db.close.bind(db))(); await fs.rm(dir, { recursive: true, force: true }); }
});
test('policy import rejects unresolved admission state instead of restoring an unfenced writer', async () => {
  const { initialPolicyState } = await import('./afs-policy-fixture.mjs');
  const state = initialPolicyState();
  state.admissions['00000000-0000-4000-8000-000000000000'] = { revision: 1, startedAt: state.updatedAt };
  await assert.rejects(importMailPolicy(memoryPolicyRoot(), state), /active admission locks/);
});
