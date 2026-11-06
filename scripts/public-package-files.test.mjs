import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createPublicPackageWriter } from './public-package-files.mjs';

const dummyWallet = '{"fixtureOnly":true,"dummy":"NOT_A_KEY_PUBLIC_PACKAGE_SAFETY_CANARY"}\n';
async function fixture(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-public-package-'));
  const cwd = path.join(root, 'server');
  const target = path.join(cwd, 'blocklet');
  const wallet = path.join(cwd, '.data/node-wallet.json');
  await fs.mkdir(path.join(target, 'providers/didmail'), { recursive: true });
  await fs.mkdir(path.dirname(wallet), { mode: 0o700 });
  await fs.writeFile(wallet, dummyWallet, { mode: 0o600 });
  await fs.writeFile(path.join(cwd, '.env.local'), 'NODE_WALLET_SK=PUBLIC_DUMMY_NOT_A_KEY\n');
  await fs.writeFile(path.join(cwd, 'LICENSE'), 'Public fixture license\n');
  await fs.writeFile(path.join(cwd, 'NOTICE'), 'Public fixture notice\n');
  await fs.writeFile(path.join(cwd, 'THIRD_PARTY_NOTICES.md'), 'Public fixture third-party notices\n');
  await fs.mkdir(path.join(cwd, 'third_party_licenses'));
  for (const name of [
    'qrcode-generator1.4.4.txt',
    'qrcode-generator1.4.4-source-header.txt',
    'google-protobuf3.21.0-Closure-header.txt',
    'google-closure-library-Apache-2.0.txt',
    'blocklet-bundle-licenses.txt',
    'boolbase1.0.0.txt',
    'express-async-errors3.1.1.txt',
    'jsonify0.0.1-README-license.txt',
    'deepmerge4.3.1.txt',
    'minimatch11.0.3.txt',
    'ocap-client1.19.15.txt',
    'worker-bundle-licenses.txt',
    'cookie-signature1.0.6-README-license.txt',
    'cisco-go-hpke-bsd2.txt',
  ]) {
    await fs.writeFile(path.join(cwd, 'third_party_licenses', name), 'Public fixture dependency license\n');
  }
  await fs.writeFile(path.join(cwd, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg">PUBLIC</svg>');
  await fs.writeFile(path.join(target, 'authored.txt'), 'Keep this authored file byte-for-byte\n', { mode: 0o640 });
  try {
    await run({ root, cwd, target, wallet });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
test('writer confines traversal and rechecks aliases introduced after preflight', () =>
  fixture(async ({ root, target, wallet }) => {
    const writer = createPublicPackageWriter(target);
    for (const relative of [
      '../outside.json',
      'nested/../../outside.json',
      '/outside.json',
      'nested\\..\\outside.json',
    ])
      assert.throws(() => writer.write(relative, 'public'), /confined relative path/);
    for (const kind of ['symlink', 'hardlink']) {
      const relative = `late-${kind}.json`,
        output = path.join(target, relative);
      if (kind === 'symlink') await fs.symlink(wallet, output);
      else await fs.link(wallet, output);
      assert.throws(() => writer.write(relative, 'public'), /without links/);
      await fs.unlink(output);
    }
    assert.equal(await fs.readFile(wallet, 'utf8'), dummyWallet);
    await assert.rejects(fs.stat(path.join(root, 'outside.json')), /ENOENT/);
  }));
test('atomic output retains existing permissions and cleans only its new temporary file on failure', () =>
  fixture(async ({ target }) => {
    const writer = createPublicPackageWriter(target),
      file = path.join(target, 'existing.json');
    await fs.writeFile(file, 'original', { mode: 0o640 });
    writer.write('existing.json', 'updated');
    assert.equal(await fs.readFile(file, 'utf8'), 'updated');
    assert.equal((await fs.stat(file)).mode & 0o777, 0o640);
    assert.throws(() => writer.write('existing.json', { invalidDataType: true }), TypeError);
    assert.equal(await fs.readFile(file, 'utf8'), 'updated');
    assert(!(await fs.readdir(target)).some((name) => name.endsWith('.tmp')));
    assert.equal(
      await fs.readFile(path.join(target, 'authored.txt'), 'utf8'),
      'Keep this authored file byte-for-byte\n',
    );
  }));

test('an exclusive temporary-file collision never removes the existing file', (context) =>
  fixture(async ({ target }) => {
    const writer = createPublicPackageWriter(target);
    const open = syncFs.openSync;
    let collision;
    context.mock.method(syncFs, 'openSync', (file, flags, mode) => {
      if (flags & syncFs.constants.O_EXCL) {
        collision = file;
        syncFs.writeFileSync(file, 'pre-existing public collision marker', { flag: 'wx', mode: 0o600 });
      }
      return open(file, flags, mode);
    });
    assert.throws(() => writer.write('new-output.json', 'public'), { code: 'EEXIST' });
    context.mock.restoreAll();
    assert.equal(await fs.readFile(collision, 'utf8'), 'pre-existing public collision marker');
    await assert.rejects(fs.stat(path.join(target, 'new-output.json')), /ENOENT/);
  }));
