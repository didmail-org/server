import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
test('public mint vectors reproduce without wallet/config/network and leave the temporary directory empty', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-mint-vector-'));
  try {
    const { stdout, stderr } = await exec(
      process.execPath,
      [fileURLToPath(new URL('./generate-contact-mint-vector.mjs', import.meta.url))],
      { cwd: directory, timeout: 120000, maxBuffer: 2 * 1024 * 1024 },
    );
    assert.equal(stderr, '');
    const expected = JSON.parse(
      await fs.readFile(new URL('../tests/fixtures/contact-mint-vectors.json', import.meta.url), 'utf8'),
    );
    assert.deepEqual(JSON.parse(stdout), expected);
    assert.equal(expected.cases.length, 4);
    assert.equal(expected.large.ciphertextPattern.length, 65536);
    assert.deepEqual(await fs.readdir(directory), []);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
