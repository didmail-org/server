import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
async function run(command, args) {
  const child = spawn(command, args, { stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', resolve);
  });
  if (code !== 0) throw new Error(`${command} failed (${code})`);
}
try {
  await fs.access('.dev.vars');
} catch {
  await run('node', ['scripts/setup.mjs']);
  const wallet = JSON.parse(await fs.readFile('.data/node-wallet.json', 'utf8'));
  await fs.writeFile('.dev.vars', `NODE_SECRET_KEY=${wallet.secretKey}\nNODE_ADDRESS=${wallet.address}\n`, {
    mode: 0o600,
    flag: 'wx',
  });
}
await run('pnpm', ['build']);
await run('node', ['scripts/verify-worker-assets.mjs']);
await run('pnpm', ['worker:migrate:local']);
await run('pnpm', ['exec', 'wrangler', 'dev', '--port', '8787']);
