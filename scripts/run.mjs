import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { setup, dataDir } from './setup.mjs';
const require = createRequire(import.meta.url);
require('dotenv-flow').config();
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
};
setup();
run('pnpm', ['build:legacy']);
const instance = process.env.ARC_INSTANCE || 'didmail-arc-local';
if (!/^[a-zA-Z0-9_-]+$/.test(instance)) throw new Error('Invalid ARC_INSTANCE name');
const arcUrl = new URL(process.env.ARC_URL || 'http://127.0.0.1:4961');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(arcUrl.hostname)) throw new Error('Launcher manages local ARC only; use a local ARC_URL');
const port = process.env.DIDMAIL_PORT || '3140';
const publicUrl = process.env.DIDMAIL_URL || `http://didmail-arc.localhost:${port}`;
mkdirSync(path.join(dataDir, 'logs'), { recursive: true });
const log = openSync(path.join(dataDir, 'logs/api.log'), 'a', 0o600);
const api = spawn(process.execPath, ['api/dist/index.js'], { stdio: ['ignore', log, log], env: process.env });
let stopping = false;
const stop = () => { stopping = true; api.kill('SIGTERM'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('exit', (code) => { if (!stopping) console.error(`DIDMail API exited (${code}); see .data/logs/api.log`); process.exit(stopping ? (process.exitCode || 0) : (code || 1)); });
try {
  let ready = false;
  for (let i = 0; i < 100 && api.exitCode === null; i++) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error('DIDMail API did not become ready; see .data/logs/api.log');
  // Start is idempotent and does not restart any already-running ARC instance.
  run('arc', ['service', 'start', '--instance', instance, '--home', path.resolve('.arc', instance), '--port', arcUrl.port || '80', '--blocklet', path.resolve('blocklet/dist')], {
    env: { ...process.env, ARC_DEV_LIVE_RENDER: '0' },
  });
  const status = spawnSync('arc', ['service', 'status', '--instance', instance, '--json'], { encoding: 'utf8' });
  if (status.status !== 0) throw new Error('ARC instance is not running');
  const jsonStart = status.stdout.indexOf('{');
  const record = JSON.parse(status.stdout.slice(jsonStart));
  if (record.port !== Number(arcUrl.port || 80) || !record.blocklets?.includes(path.resolve('blocklet/dist'))) {
    throw new Error('Existing ARC instance uses another port or package. Select a new ARC_INSTANCE and ARC_URL.');
  }
  console.log(`DIDMail ready: ${publicUrl}\nAdmin: ${publicUrl}/admin\nARC instance: ${instance}. Ctrl-C stops the API; the ARC instance remains available.`);
} catch (error) {
  console.error(error.message);
  stop();
  process.exitCode = 1;
}
