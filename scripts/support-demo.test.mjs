import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { initializePrivateHome, assertOwned } from '../examples/support-community-docker/demo.mjs';

function isolated(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'support-demo-test-'));
  try {
    fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('first initialization creates private keys; subsequent initialization preserves existing keys and state', () =>
  isolated((root) => {
    const env = initializePrivateHome(root);
    const before = fs.readFileSync(env);
    fs.writeFileSync(path.join(root, 'state/probe'), 'persistent-fixture');
    initializePrivateHome(root);
    assert.ok(fs.readFileSync(env).equals(before));
    assert.equal(fs.readFileSync(path.join(root, 'state/probe'), 'utf8'), 'persistent-fixture');
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(env).mode & 0o777, 0o600);
      assert.equal(fs.statSync(path.join(root, 'credentials')).mode & 0o777, 0o700);
    }
  }));

test('missing or malformed keys with existing data are refused without replacing keys', () =>
  isolated((root) => {
    const env = initializePrivateHome(root);
    fs.writeFileSync(path.join(root, 'state/probe'), 'keep-this-state');
    fs.unlinkSync(env);
    assert.throws(() => initializePrivateHome(root), /refusing to generate replacements/);
    assert.equal(fs.existsSync(env), false);
    fs.writeFileSync(env, 'invalid-key-fixture');
    assert.throws(() => initializePrivateHome(root), /key file is invalid/);
    assert.equal(fs.readFileSync(env, 'utf8'), 'invalid-key-fixture');
  }));

test('symlinked private files cannot redirect key writes', () =>
  isolated((root) => {
    const privateHome = path.join(root, 'home');
    initializePrivateHome(privateHome);
    const target = path.join(root, 'target');
    fs.writeFileSync(target, 'do-not-overwrite');
    const env = path.join(privateHome, 'credentials/runtime.env');
    fs.unlinkSync(env);
    fs.symlinkSync(target, env);
    assert.throws(() => initializePrivateHome(privateHome), /cannot be a symlink/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'do-not-overwrite');
  }));

test('container mutation requires both demo purpose and exact checkout ownership', () => {
  const labels = { 'org.didmail.demo': 'support-community', 'org.didmail.demo.home': '/test/checkout' };
  assert.doesNotThrow(() => assertOwned(labels, '/test/checkout'));
  for (const unowned of [
    null,
    {},
    { ...labels, 'org.didmail.demo.home': '/another/checkout' },
    { ...labels, 'org.didmail.demo': 'another-service' },
  ]) {
    assert.throws(() => assertOwned(unowned, '/test/checkout'), /Refusing to modify/);
  }
});

test('Docker context permits only explicit public build inputs; private host tooling is not copied', () => {
  const root = path.resolve('examples/support-community-docker');
  const rules = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8').trim().split('\n');
  assert.equal(rules[0], '**');
  const allowed = rules.slice(1).map((line) => line.slice(1));
  assert.deepEqual(
    allowed.sort(),
    ['Dockerfile', 'config.json', 'entrypoint.sh', 'nginx.conf', 'prepare-demo.mjs', 'warmup.mjs'].sort(),
  );
  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  for (const match of dockerfile.matchAll(/^COPY (\S+) /gm)) assert.ok(allowed.includes(match[1]));
  assert.doesNotMatch(dockerfile, /COPY\s+(?:\.|\.\.|\*)\s|ADD\s/);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
  assert.match(config.archiveSha256, /^[a-f0-9]{64}$/);
  assert.match(dockerfile, /sha256sum --check --strict/);
});
