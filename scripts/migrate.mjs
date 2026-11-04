import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dataDir, walletFile, walletType } from './setup.mjs';
const require = createRequire(import.meta.url);
const { fromSecretKey } = require('@ocap/wallet');
const sqlite3 = require('sqlite3');
const open = (file, flags) => new Promise((resolve, reject) => {
  const db = new sqlite3.Database(file, flags, error => error ? reject(error) : resolve(db));
});
const run = (db, sql, args = []) => new Promise((resolve, reject) => db.run(sql, args, error => error ? reject(error) : resolve()));
const all = (db, sql) => new Promise((resolve, reject) => db.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
const close = db => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
export async function migrate({ source, keyFile, destination = dataDir, targetWallet = walletFile, expectedAddress }) {
  source = path.resolve(source);
  destination = path.resolve(destination);
  targetWallet = path.resolve(targetWallet);
  if (!fs.statSync(source).isFile()) throw new Error('Source must be a SQLite file');
  const targetDb = path.join(destination, 'didmail.sqlite');
  if ([targetDb, targetWallet].some(f => fs.existsSync(f))) throw new Error('Target wallet or database exists; import requires an empty destination');
  const saved = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  if (typeof saved.secretKey !== 'string') throw new Error('Wallet JSON must contain the original secretKey');
  const wallet = fromSecretKey(saved.secretKey, walletType);
  if ((saved.address && saved.address !== wallet.address) || (expectedAddress && expectedAddress !== wallet.address)) throw new Error('Original node address does not match the imported key');
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.dirname(targetWallet), { recursive: true, mode: 0o700 });
  const staging = path.join(destination, `.import-${process.pid}-${Date.now()}.sqlite`);
  let sourceDb;
  let copiedDb;
  let installedWallet = false;
  let installedDatabase = false;
  try {
    sourceDb = await open(source, sqlite3.OPEN_READONLY);
    await run(sourceDb, 'VACUUM INTO ?', [staging]);
    await close(sourceDb); sourceDb = null;
    fs.chmodSync(staging, 0o600);
    copiedDb = await open(staging, sqlite3.OPEN_READONLY);
    const integrity = await all(copiedDb, 'PRAGMA integrity_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('Imported SQLite integrity check failed');
    const tables = await all(copiedDb, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    if (!tables.some(t => t.name === 'mails')) throw new Error('Source is not a DIDMail database (mails table missing)');
    const counts = {};
    for (const { name } of tables) counts[name] = (await all(copiedDb, `SELECT COUNT(*) AS count FROM "${name.replaceAll('"', '""')}"`))[0].count;
    await close(copiedDb); copiedDb = null;
    fs.writeFileSync(targetWallet, JSON.stringify({ address: wallet.address, secretKey: wallet.secretKey }) + '\n', { mode: 0o600, flag: 'wx' });
    installedWallet = true;
    fs.copyFileSync(staging, targetDb, fs.constants.COPYFILE_EXCL);
    installedDatabase = true;
    fs.chmodSync(targetDb, 0o600);
    const report = { node: wallet.address, source, destination: targetDb, integrity: 'ok', counts, importedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(destination, 'migration-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return report;
  } catch (error) {
    if (installedWallet) fs.unlinkSync(targetWallet);
    if (installedDatabase) fs.unlinkSync(targetDb);
    throw error;
  } finally {
    if (sourceDb) await close(sourceDb);
    if (copiedDb) await close(copiedDb);
    fs.rmSync(staging, { force: true });
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const value = flag => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
  if (!value('--database') || !value('--wallet')) {
    console.error('Usage: pnpm migrate --database /export/didmail.sqlite --wallet /export/node-wallet.json [--expected-address z...]');
    process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify(await migrate({ source: value('--database'), keyFile: value('--wallet'), expectedAddress: value('--expected-address') }), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
