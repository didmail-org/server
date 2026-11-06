import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { transform } from 'esbuild';

// Run the actual production functions over an ephemeral SQLite relational adapter.
// No Worker, persistent database, wallet, blob binding or network is created.
const source = await readFile(new URL('../../blocklet/providers/didmail-http/source/identity/wallet-lane.ts', import.meta.url), 'utf8');
const compiled = await transform(source, { loader: 'ts', format: 'esm', target: 'es2022' });
const { reserveWalletLane, cleanupExpiredPayerLanes } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`
);
const now = '2026-11-01T10:48:00.000Z';
const expired = '2026-11-01T10:27:46.000Z';
const future = '2026-11-01T11:14:09.728Z';

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE dmp_wallet_lanes(chain_id TEXT NOT NULL,wallet_id TEXT NOT NULL,lane TEXT NOT NULL,message_id TEXT NOT NULL,expires_at TEXT,PRIMARY KEY(chain_id,wallet_id,lane));
    CREATE TABLE dmp_messages(id TEXT PRIMARY KEY,accepted_at TEXT,lifecycle TEXT,state TEXT,manifest_json TEXT);
    CREATE TABLE dmp_chunks(message_id TEXT,blob_id TEXT,ciphertext_sha256 TEXT);
  `);
  const calls = [];
  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return {
            async run() {
              const result = sqlite.prepare(sql).run(...values);
              return { meta: { changes: Number(result.changes) } };
            },
            async first() {
              return sqlite.prepare(sql).get(...values) ?? null;
            },
          };
        },
      };
    },
  };
  function message(id, { accepted = null, lifecycle = 'live', state = 'uploading' } = {}) {
    sqlite
      .prepare('INSERT INTO dmp_messages VALUES(?,?,?,?,?)')
      .run(id, accepted, lifecycle, state, `public-manifest-${id}`);
    sqlite.prepare('INSERT INTO dmp_chunks VALUES(?,?,?)').run(id, 'public-blob', `public-ciphertext-hash-${id}`);
  }
  function lane(id, { role = 'payer', expiry = expired, wallet = 'did:abt:zPublicSender', chain = 'beta' } = {}) {
    sqlite.prepare('INSERT INTO dmp_wallet_lanes VALUES(?,?,?,?,?)').run(chain, wallet, role, id, expiry);
  }
  const rows = (table) => JSON.parse(JSON.stringify(sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
  return { sqlite, database, calls, message, lane, rows };
}
const reservation = (owner) => ({
  chainId: 'beta',
  walletId: 'did:abt:zPublicSender',
  lane: 'payer',
  owner,
  expiresAt: future,
});

test('expired unaccepted payer still blocks another original until normal expiry-only maintenance', async (t) => {
  const f = fixture(t);
  f.message('old-original');
  f.message('new-original');
  f.message('old-delivered', { accepted: expired, state: 'delivered' });
  f.lane('old-original');
  const messages = f.rows('dmp_messages'),
    chunks = f.rows('dmp_chunks');
  assert.equal(await reserveWalletLane(f.database, reservation('new-original')), false);
  assert.equal(await cleanupExpiredPayerLanes(f.database, now), 1);
  assert.deepEqual(f.rows('dmp_messages'), messages);
  assert.deepEqual(f.rows('dmp_chunks'), chunks);
  assert.equal(await reserveWalletLane(f.database, reservation('new-original')), true);
  assert.equal(await reserveWalletLane(f.database, reservation('new-original')), true);
  assert.equal(f.rows('dmp_wallet_lanes').length, 1);
});

test('active payer and an expired but accepted payer are preserved', async (t) => {
  const f = fixture(t);
  f.message('active');
  f.message('accepted', { accepted: expired, state: 'payment_pending' });
  f.lane('active', { expiry: future });
  f.lane('accepted', { wallet: 'did:abt:zAnotherSender' });
  const before = f.rows('dmp_wallet_lanes');
  assert.equal(await cleanupExpiredPayerLanes(f.database, now), 0);
  assert.deepEqual(f.rows('dmp_wallet_lanes'), before);
});

test('operator reservations never expire through the payer-only routine', async (t) => {
  const f = fixture(t);
  f.message('operator');
  f.lane('operator', { role: 'operator' });
  const before = f.rows('dmp_wallet_lanes');
  assert.equal(await cleanupExpiredPayerLanes(f.database, now), 0);
  assert.deepEqual(f.rows('dmp_wallet_lanes'), before);
  assert.equal(await reserveWalletLane(f.database, reservation('new-original')), false);
});

test('expiry boundary is inclusive while a one-millisecond-future lane remains reserved', async (t) => {
  const f = fixture(t);
  f.message('equal');
  f.message('later');
  f.lane('equal', { expiry: now });
  f.lane('later', { expiry: '2026-11-01T10:48:00.001Z', wallet: 'did:abt:zLaterSender' });
  assert.equal(await cleanupExpiredPayerLanes(f.database, now), 1);
  assert.deepEqual(
    f.rows('dmp_wallet_lanes').map((row) => row.message_id),
    ['later'],
  );
});

test('null expiry and orphan rows are not interpreted as permission to unlock', async (t) => {
  const f = fixture(t);
  f.message('no-expiry');
  f.lane('no-expiry', { expiry: null });
  f.lane('orphan', { wallet: 'did:abt:zOrphanSender' });
  const before = f.rows('dmp_wallet_lanes');
  assert.equal(await cleanupExpiredPayerLanes(f.database, now), 0);
  assert.deepEqual(f.rows('dmp_wallet_lanes'), before);
});

test('maintenance binds the timestamp as one SQL value and never patches result state', async (t) => {
  const f = fixture(t);
  f.message('original');
  f.lane('original');
  const before = f.rows('dmp_wallet_lanes');
  const untrustedText = "' OR 1=1; DROP TABLE dmp_messages; --";
  assert.equal(await cleanupExpiredPayerLanes(f.database, untrustedText), 0);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].values, [untrustedText]);
  assert.equal(f.calls[0].sql.includes(untrustedText), false);
  assert.match(f.calls[0].sql, /^DELETE FROM dmp_wallet_lanes WHERE lane='payer'/);
  assert.deepEqual(f.rows('dmp_wallet_lanes'), before);
  assert.equal(f.rows('dmp_messages')[0].state, 'uploading');
  assert.equal(f.rows('dmp_chunks').length, 1);
});

test('default invocation uses the real clock without a caller-supplied time override', async (t) => {
  const f = fixture(t);
  f.message('naturally-expired');
  f.lane('naturally-expired', { expiry: '1970-01-01T00:00:00.000Z' });
  const before = Date.now();
  assert.equal(await cleanupExpiredPayerLanes(f.database), 1);
  const boundTime = Date.parse(f.calls[0].values[0]);
  assert.ok(boundTime >= before && boundTime <= Date.now());
});
