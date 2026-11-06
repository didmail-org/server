import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const tests = readdirSync('tests/business')
  .filter((name) => name.endsWith('.test.mjs') && name !== 'dmp-codec.test.mjs')
  .sort()
  .map((name) => `tests/business/${name}`);
if (tests.length === 0) throw new Error('No business tests found');
console.log('Business suite excludes the cross-client codec test; run pnpm test:business with sibling client checkouts for complete coverage.');
for (const args of [['scripts/build-business-tests.mjs'], ['--test', '--test-concurrency=1', ...tests]]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
