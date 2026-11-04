import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const tests = readdirSync('tests/workers')
  .filter((name) => name.endsWith('.test.mjs') && name !== 'dmp-codec.test.mjs')
  .sort()
  .map((name) => `tests/workers/${name}`);
if (tests.length === 0) throw new Error('No standalone Worker tests found');
console.log('Standalone Worker suite excludes the cross-client codec test; run pnpm test:worker with sibling client checkouts for complete coverage.');
for (const args of [['scripts/build-worker.mjs', '--test'], ['--test', '--test-concurrency=1', ...tests]]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
