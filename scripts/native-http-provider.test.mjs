import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { configureEnvironment, env } from '../blocklet/providers/didmail-http/host/environment.mjs';
import { registerLoader } from '../blocklet/providers/didmail-http/host/loader.mjs';
import Provider from '../blocklet/providers/didmail-http/index.mjs';
import { protocolConfigPath, validateProtocolConfig } from '../blocklet/providers/didmail-http/config.mjs';
const config = () => ({
  schemaVersion: 1,
  enabled: false,
  publicOrigin: 'http://127.0.0.1:8788',
  arcOrigin: 'http://127.0.0.1:64867',
  listenHost: '127.0.0.1',
  listenPort: 8788,
  aliases: '',
  jobsIntervalSeconds: 0,
  vars: { DIDMAIL_MEMBER_ACCESS: 'arc' },
  secrets: { NODE_SECRET_KEY: '0x' + '11'.repeat(32), NODE_ADDRESS: 'public-fixture' },
});
test('missing native configuration fails closed without creating a key/store or leaking control data', async () => {
  const provider = await Provider.load();
  let writes = 0;
  provider.root = {
    read: async () => {
      throw Object.assign(Error('missing'), { code: 'AFS_NOT_FOUND' });
    },
    write: async () => writes++,
  };
  const health = JSON.parse((await provider.read('/health.json')).data.content);
  assert.equal(health.protocolIngress, false);
  assert.equal(writes, 0);
  for (const field of ['token', 'pid', 'port', 'key', 'config']) assert.equal(field in health, false);
  await assert.rejects(provider.read(protocolConfigPath), { code: 'AFS_NOT_FOUND' });
});
test('protocol installation requires verified owner/admin, fixed private path and conditional creation', async () => {
  const provider = await Provider.load();
  let saved;
  provider.root = {
    write: async (path, input, options) => {
      assert.equal(path, protocolConfigPath);
      assert.equal(options.ifMatch, '!absent');
      if (saved) throw Object.assign(Error('conflict'), { code: 'AFS_CONFLICT' });
      saved = input.content;
    },
  };
  const action = '/.actions/install-config';
  for (const role of ['guest', 'member', undefined])
    await assert.rejects(
      provider.exec(action, { config: config() }, { context: { caller: { did: 'did:test:fixture', role } } }),
      { code: 'AFS_FORBIDDEN' },
    );
  const options = { context: { caller: { did: 'did:test:fixture', role: 'admin' } } };
  await assert.rejects(provider.exec(action, { config: config(), path: '/arbitrary' }, options), {
    code: 'AFS_VALIDATION_ERROR',
  });
  assert.equal((await provider.exec(action, { config: config() }, options)).data.installed, true);
  assert.deepEqual(JSON.parse(saved), config());
  await assert.rejects(provider.exec(action, { config: config() }, options), { code: 'AFS_CONFLICT' });
});
test('a second signing instance/configuration cannot share legacy process caches', async () => {
  const key = Symbol.for('didmail.native.protocol.runtime');
  assert.equal(globalThis[key], undefined);
  globalThis[key] = { fingerprint: 'different-instance', configHash: 'different-config', owners: new Set() };
  try {
    const provider = await Provider.load();
    provider.root = {
      read: async (path) => ({
        data: {
          content: JSON.stringify(
            path === protocolConfigPath ? { ...config(), enabled: true } : { token: 'fixture-token' },
          ),
        },
      }),
    };
    await assert.rejects(provider.start(), { code: 'DIDMAIL_INSTANCE_CONFLICT' });
  } finally {
    delete globalThis[key];
  }
});
test('private runtime configuration rejects unknown bindings, unsafe origins and invalid schedule/ports', () => {
  for (const edit of [
    (c) => (c.vars.UNDECLARED = 'x'),
    (c) => (c.publicOrigin = 'http://user:password@127.0.0.1'),
    (c) => (c.arcOrigin = 'https://remote.example'),
    (c) => (c.listenPort = 0),
    (c) => (c.jobsIntervalSeconds = 1),
    (c) => (c.secrets.EXTRA = 'x'),
  ]) {
    const c = config();
    edit(c);
    assert.throws(() => validateProtocolConfig(c));
  }
});
test('pinned dependency asset and import/require facades match their package inventory', async () => {
  const base = new URL('../blocklet/providers/didmail-http/vendor/', import.meta.url),
    manifest = JSON.parse(await fs.readFile(new URL('manifest.json', base), 'utf8'));
  const hash = async (file) =>
    createHash('sha256')
      .update(await fs.readFile(new URL(file, base)))
      .digest('hex');
  assert.equal(manifest.applicationModules, false);
  assert.equal(await hash('dependencies.mjs'), manifest.sha256);
  for (const [file, expected] of Object.entries(manifest.entryFiles)) assert.equal(await hash(file), expected, file);
  for (const p of manifest.packages)
    for (const file of p.licenseFiles) assert.ok((await fs.stat(new URL(file, base))).size);
});

test('native bindings retain enumeration and cannot change a configured identity', () => {
  assert.throws(() => env.FLAG, /unavailable/);
  configureEnvironment({ FLAG: 'fixture' });
  assert.equal(env.FLAG, 'fixture');
  assert.deepEqual(Object.keys(env), ['FLAG']);
  assert.equal('FLAG' in env, true);
  assert.equal(Object.isFrozen(env), true);
  assert.throws(() => configureEnvironment({ FLAG: 'replacement' }), /already configured/);
});

test('runtime loader leaves other apps alone and rejects unknown dependencies and out-of-package virtual files', () => {
  const before = globalThis.Bun,
    resolvers = [],
    loads = [];
  globalThis.Bun = {
    plugin: (plugin) =>
      plugin.setup({
        onResolve: (options, fn) => resolvers.push([options, fn]),
        onLoad: (options, fn) => loads.push([options, fn]),
      }),
  };
  try {
    registerLoader();
    const resolve = resolvers[0][1],
      load = loads[0][1];
    assert.equal(resolve({ path: 'unrelated', importer: '/another-app/index.mjs' }), undefined);
    const importer = fileURLToPath(new URL('../blocklet/providers/didmail-http/host/runtime.mjs', import.meta.url));
    assert.throws(() => resolve({ path: 'undeclared-dependency', importer }), /Unpackaged/);
    assert.throws(() => resolve({ path: process.execPath, importer }), /Outside packaged/);
    assert.throws(() => load({ path: process.execPath }), /Outside packaged/);
  } finally {
    globalThis.Bun = before;
  }
});

test('unmount during configuration loading prevents a late runtime from starting', async () => {
  const provider = await Provider.load();
  let release;
  provider.root = { read: () => new Promise(resolve => { release = resolve; }) };
  const starting = provider.start();
  const stopping = provider.onUnmount();
  release({ data: { content: JSON.stringify(config()) } });
  await Promise.all([starting, stopping]);
  assert.equal(globalThis[Symbol.for('didmail.native.protocol.runtime')], undefined);
  assert.equal(await provider.start(), undefined);
});

test('unmount retains ownership until an in-flight listener can be closed', async () => {
  const key = Symbol.for('didmail.native.protocol.runtime');
  const provider = await Provider.load();
  let release, closed = false;
  const current = { owners: new Set([provider]) };
  globalThis[key] = current;
  provider.starting = new Promise(resolve => { release = resolve; }).then(() => {
    current.handle = { close: async () => { closed = true; } };
  });
  try {
    const stopping = provider.onUnmount();
    assert.equal(globalThis[key], current);
    release();
    await stopping;
    assert.equal(closed, true);
    assert.equal(globalThis[key], undefined);
  } finally { delete globalThis[key]; }
});
