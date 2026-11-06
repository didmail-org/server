import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

test('legacy wallet/import modules and help are read-only until an explicit operation', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-legacy-help-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, '.env.example'), 'PUBLIC_FIXTURE=example\n');
  const before = await fs.readdir(directory);
  const scripts = ['scripts/legacy-wallet-setup.mjs', 'scripts/migration/import-legacy-sqlite.mjs', 'scripts/chain-status.mjs'].map(file => path.resolve(file));
  for (const file of scripts) {
    const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(file).href)})`], { cwd: directory, encoding: 'utf8' });
    assert.equal(imported.status, 0, imported.stderr);
    assert.deepEqual(await fs.readdir(directory), before, 'import must not create wallet, state or .env.local');
    const help = spawnSync(process.execPath, [file, '--help'], { cwd: directory, encoding: 'utf8' });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Usage: pnpm (?:legacy:|chain:status)/);
    assert.deepEqual(await fs.readdir(directory), before, 'help must not require or create a wallet');
  }
});
