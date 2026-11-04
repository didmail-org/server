import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('complete public recovery vectors reproduce from an unrelated empty directory without chain/config/wallet access', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-public-recovery-vector-'));
  try {
    const script = fileURLToPath(new URL('./generate-contact-recovery-vector.mjs', import.meta.url));
    const actual = execFileSync(process.execPath, [script], { cwd: directory, encoding: 'utf8', timeout: 10000 });
    const expected = await fs.readFile(
      new URL('../tests/fixtures/contact-recovery-record.json', import.meta.url),
      'utf8',
    );
    assert.equal(actual, expected);
    const value = JSON.parse(actual);
    assert.equal(value.publicFixture, true);
    assert.equal(value.cases.length, 4);
    for (const vector of value.cases) assert.ok(vector.record.recovery.proof.signature);
    assert.deepEqual(await fs.readdir(directory), []);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
