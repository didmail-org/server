import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { packageWorkerCore, verifyWorkerCore } from './package-worker-core.mjs';
const css = '.aup-app-header{display:block}.aup-app-header-bar{display:flex}.aup-app-header-action{width:24px}';
const hash = createHash('sha256').update(css).digest('hex');
const reference = `/aup-core.${hash.slice(0, 16)}.css`;
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-core-package-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'dist');
  await fs.mkdir(path.join(directory, 'zh'), { recursive: true });
  await fs.writeFile(path.join(directory, 'index.html'), `<link rel="stylesheet" href="${reference}">`);
  await fs.writeFile(path.join(directory, 'zh/index.html'), `<link href='${reference}' rel='stylesheet'>`);
  const cssFile = path.join(root, 'public-core.css');
  await fs.writeFile(cssFile, css);
  return { root, directory, cssFile };
}
test('standalone verification fails when native export omitted core CSS', async (t) => {
  const fixtureValue = await fixture(t);
  await assert.rejects(verifyWorkerCore(fixtureValue), /lack ARC core CSS/);
});
test('offline asset is copied exactly, shared references deduplicate and full digest is recorded', async (t) => {
  const value = await fixture(t);
  const assets = await packageWorkerCore(value);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].sha256, hash);
  assert.equal(await fs.readFile(path.join(value.directory, reference.slice(1)), 'utf8'), css);
  const manifest = JSON.parse(await fs.readFile(path.join(value.directory, 'worker-core-assets.json'), 'utf8'));
  assert.deepEqual(manifest.assets, assets);
  assert.equal(manifest.source, 'explicit-offline-public-arc-core-css');
  assert.deepEqual(await verifyWorkerCore(value), assets);
});
test('mismatched input is rejected before any core output is written', async (t) => {
  const value = await fixture(t);
  await fs.writeFile(value.cssFile, css + 'body{}');
  await assert.rejects(packageWorkerCore(value), /referenced hash/);
  await assert.rejects(fs.access(path.join(value.directory, reference.slice(1))));
});
test('matching hash alone does not accept unrelated CSS', async (t) => {
  const value = await fixture(t);
  const other = 'body{color:red}';
  const otherHash = createHash('sha256').update(other).digest('hex').slice(0, 16);
  await fs.writeFile(path.join(value.directory, 'index.html'), `<link href="/aup-core.${otherHash}.css">`);
  await fs.rm(path.join(value.directory, 'zh'), { recursive: true });
  await fs.writeFile(value.cssFile, other);
  await assert.rejects(packageWorkerCore(value), /genuine ARC/);
});
test('every locale reference must match the supplied official core', async (t) => {
  const value = await fixture(t);
  await fs.writeFile(path.join(value.directory, 'zh/index.html'), '<link href="/aup-core.1111111111111111.css">');
  await assert.rejects(packageWorkerCore(value), /referenced hash/);
  await assert.rejects(fs.access(path.join(value.directory, reference.slice(1))));
});
test('tampered packaged asset fails deployment verification', async (t) => {
  const value = await fixture(t);
  await packageWorkerCore(value);
  await fs.appendFile(path.join(value.directory, reference.slice(1)), 'body{}');
  await assert.rejects(verifyWorkerCore(value), /referenced hash/);
});
test('pages without an explicit core reference are refused', async (t) => {
  const value = await fixture(t);
  await fs.rm(path.join(value.directory, 'zh'), { recursive: true });
  await fs.writeFile(path.join(value.directory, 'index.html'), '<main>No native header</main>');
  await assert.rejects(packageWorkerCore(value), /must reference/);
});
