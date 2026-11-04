import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPublicPackageWriter } from './public-package-files.mjs';

const script = fileURLToPath(new URL('./package-arc.mjs', import.meta.url));
const dummyWallet = '{"fixtureOnly":true,"dummy":"NOT_A_KEY_PUBLIC_PACKAGE_SAFETY_CANARY"}\n';
const generated = [
  'LICENSE',
  'NOTICE',
  'THIRD_PARTY_NOTICES.md',
  'third_party_licenses/deepmerge4.3.1.txt',
  'third_party_licenses/minimatch11.0.3.txt',
  'third_party_licenses/ocap-client1.19.15.txt',
  'third_party_licenses/worker-bundle-licenses.txt',
  'third_party_licenses/cookie-signature1.0.6-README-license.txt',
  'third_party_licenses/cisco-go-hpke-bsd2.txt',
  'third_party_licenses/boolbase1.0.0.txt',
  'third_party_licenses/express-async-errors3.1.1.txt',
  'third_party_licenses/jsonify0.0.1-README-license.txt',
  'third_party_licenses/qrcode-generator1.4.4.txt',
  'third_party_licenses/qrcode-generator1.4.4-source-header.txt',
  'third_party_licenses/google-protobuf3.21.0-Closure-header.txt',
  'third_party_licenses/google-closure-library-Apache-2.0.txt',
  'third_party_licenses/blocklet-bundle-licenses.txt',
  'providers/didmail/config.json',
  '.web/template/logo.svg',
  '.web/seo/og-site-name',
  '.web/template/header-actions',
  '.web/template/navigation',
  '.web/seo/og-image',
  '.route/web',
  '.web/site.yaml',
  'blocklet.yaml',
];
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
const invoke = (cwd) =>
  spawnSync(process.execPath, [script], {
    cwd,
    env: {
      PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
      DIDMAIL_URL: 'http://public-fixture.invalid:3140',
      DIDMAIL_WORKER_URL: 'https://public-fixture.invalid/worker',
    },
    encoding: 'utf8',
    timeout: 15000,
  });

test('stock package preparation is repeatable and keeps authored files and dummy private data local', () =>
  fixture(async ({ cwd, target, wallet }) => {
    const authored = await fs.stat(path.join(target, 'authored.txt'));
    for (let n = 0; n < 2; n++) {
      const result = invoke(cwd);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(await fs.readFile(path.join(target, 'providers/didmail/config.json'), 'utf8')), {
        endpoint: 'https://public-fixture.invalid/worker',
      });
      assert.equal(await fs.readFile(wallet, 'utf8'), dummyWallet);
      assert.equal(
        await fs.readFile(path.join(target, 'authored.txt'), 'utf8'),
        'Keep this authored file byte-for-byte\n',
      );
      assert.equal((await fs.stat(path.join(target, 'authored.txt'))).ino, authored.ino);
      assert.equal((await fs.stat(path.join(target, 'authored.txt'))).mode & 0o777, 0o640);
      for (const name of generated) {
        assert(!(await fs.lstat(path.join(target, name))).isSymbolicLink());
        assert(!(await fs.readFile(path.join(target, name), 'utf8')).includes('PUBLIC_DUMMY_NOT_A_KEY'));
      }
    }
  }));
for (const kind of ['symlink', 'hardlink'])
  for (const relative of generated)
    test(`stock packager refuses ${kind} at ${relative} before any dummy wallet overwrite`, () =>
      fixture(async ({ cwd, target, wallet }) => {
        const output = path.join(target, relative);
        await fs.mkdir(path.dirname(output), { recursive: true });
        if (kind === 'symlink') await fs.symlink(wallet, output);
        else await fs.link(wallet, output);
        const result = invoke(cwd);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /without links/);
        assert.equal(await fs.readFile(wallet, 'utf8'), dummyWallet);
        assert.equal(
          await fs.readFile(path.join(target, 'authored.txt'), 'utf8'),
          'Keep this authored file byte-for-byte\n',
        );
      }));
test('stock packager refuses an aliased package root and parent directory', () =>
  fixture(async ({ root, cwd, target, wallet }) => {
    const outside = path.join(root, 'owned-outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'keep.txt'), 'Owned outside marker');
    await fs.symlink(outside, path.join(target, '.web'));
    assert.notEqual(invoke(cwd).status, 0);
    await fs.unlink(path.join(target, '.web'));
    await fs.rename(target, target + '-original');
    await fs.symlink(outside, target);
    assert.notEqual(invoke(cwd).status, 0);
    assert.deepEqual(await fs.readdir(outside), ['keep.txt']);
    assert.equal(await fs.readFile(wallet, 'utf8'), dummyWallet);
  }));
for (const kind of ['symlink', 'hardlink'])
  test(`stock packager refuses an aliased ${kind} public logo input`, () =>
    fixture(async ({ cwd, wallet }) => {
      const logo = path.join(cwd, 'logo.svg');
      await fs.unlink(logo);
      if (kind === 'symlink') await fs.symlink(wallet, logo);
      else await fs.link(wallet, logo);
      assert.notEqual(invoke(cwd).status, 0);
      assert.equal(await fs.readFile(wallet, 'utf8'), dummyWallet);
    }));
test(
  'special files in the package tree are rejected without opening them',
  { skip: process.platform === 'win32' },
  () =>
    fixture(async ({ cwd, target, wallet }) => {
      assert.equal(spawnSync('/usr/bin/mkfifo', [path.join(target, 'not-a-regular-asset')]).status, 0);
      assert.notEqual(invoke(cwd).status, 0);
      assert.equal(await fs.readFile(wallet, 'utf8'), dummyWallet);
    }),
);
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

for (const kind of ['symlink', 'hardlink'])
  test(`UI build rejects ${kind} output alias before the first esbuild write`, () =>
    fixture(async ({ cwd, target, wallet }) => {
      await fs.mkdir(path.join(cwd, 'ui'));
      await fs.writeFile(path.join(cwd, 'ui/admin-render.js'), "export const render = () => 'PUBLIC BUILD FIXTURE';\n");
      const output = path.join(target, '.web/components/didmail-admin/render.js');
      await fs.mkdir(path.dirname(output), { recursive: true });
      if (kind === 'symlink') await fs.symlink(wallet, output);
      else await fs.link(wallet, output);
      const result = spawnSync(process.execPath, [fileURLToPath(new URL('./build-ui.mjs', import.meta.url))], {
        cwd,
        env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` },
        encoding: 'utf8',
        timeout: 15000,
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /without links/);
      assert.equal(await fs.readFile(wallet, 'utf8'), dummyWallet);
      if (kind === 'symlink') assert((await fs.lstat(output)).isSymbolicLink());
      else assert.equal((await fs.stat(output)).ino, (await fs.stat(wallet)).ino);
      await assert.rejects(fs.stat(path.join(target, '.web/components/didmail-admin/script.js')), /ENOENT/);
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
