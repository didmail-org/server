import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const toolRequire = createRequire(require.resolve('jest'));
const fixture = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/legacy-dependency-compatibility.json', import.meta.url), 'utf8'));

test('legacy chain requests leave ambiguous mutation retries to the durable coordinator', async () => {
  const GraphQLClient = require('@ocap/client');
  const client = new GraphQLClient('https://example.invalid', false);
  assert.equal(client.config.retries, 0);
  let calls = 0;
  client._doRequest = async () => {
    calls++;
    throw Error('Public fixture: acknowledgement lost');
  };
  await assert.rejects(client.doRawQuery('mutation { sendTx(tx:"public-fixture") }'), /acknowledgement lost/);
  assert.equal(calls, 1);
});

test('maintained crypto preserves all public legacy signer keys and exact signatures', () => {
  const { getSigner } = require('@ocap/mcrypto');
  const message = Buffer.from(fixture.crypto.messageHex, 'hex');
  for (const vector of fixture.crypto.records) {
    const signer = getSigner(vector.type);
    assert.equal(signer.getPublicKey(vector.secretKey), vector.publicKey);
    assert.equal(signer.sign(message, vector.secretKey), vector.signature);
    assert.equal(signer.verify(message, vector.signature, vector.publicKey), true);
    assert.equal(signer.verify(Buffer.from('different public fixture'), vector.signature, vector.publicKey), false);
  }
});

test('deepmerge rejects poisoned target, null-prototype source, nested and array inputs in Node and browser entry points', () => {
  const root = path.dirname(toolRequire.resolve('deepmerge/package.json'));
  for (const entry of ['dist/cjs.js', 'dist/umd.js']) {
    const merge = require(path.join(root, entry));
    const payload = JSON.parse('{"__proto__":{"auditPolluted":true},"constructor":{"prototype":{"auditPolluted":true}},"safe":1}');
    for (const value of [merge(payload, {}), merge(Object.create(null), payload), merge.all([payload, {}])]) {
      assert.equal(Object.getPrototypeOf(value), Object.prototype, entry);
      assert.equal(value.auditPolluted, undefined, entry);
      assert.equal(Object.hasOwn(value, '__proto__'), false, entry);
      assert.equal(Object.hasOwn(value, 'constructor'), false, entry);
      assert.equal(value.safe, 1, entry);
    }
    const nested = merge({ settings: payload, array: [payload] }, {});
    assert.equal(nested.settings.auditPolluted, undefined, entry);
    assert.equal(nested.array[0].auditPolluted, undefined, entry);
    assert.equal({}.auditPolluted, undefined, entry);
    assert.deepEqual(merge({ list: [1], object: { a: 1 } }, { list: [2], object: { b: 2 } }), { list: [1, 2], object: { a: 1, b: 2 } });
  }
});

test('maintained minimatch retains callable and named CommonJS APIs and legacy glob results', () => {
  const match = toolRequire('minimatch');
  assert.equal(typeof match, 'function');
  assert.equal(match.minimatch, match);
  for (const item of fixture.minimatch.cases) {
    assert.equal(match(item.input, item.pattern, item.options), item.result, JSON.stringify(item));
    assert.equal(new match.Minimatch(item.pattern, item.options).match(item.input), item.result);
  }
  const legacyRequire = createRequire(toolRequire.resolve('jest-runtime'));
  const glob = legacyRequire('glob');
  assert.ok(glob.sync('api/src/routes/*.ts').includes('api/src/routes/contact.ts'));
  assert.ok(glob.sync('api/src/**/*.test.ts').includes('api/src/runtime/payment-nonce.test.ts'));
});

test('minimatch preprocessing of an adversarial glob stays bounded', () => {
  const script = `const m=require(${JSON.stringify(toolRequire.resolve('minimatch'))});const p='a/'+('**/../a/'.repeat(24));const matcher=new m.Minimatch(p,{optimizationLevel:2});if(typeof matcher.match('a')!=='boolean')process.exit(2);`;
  const result = spawnSync(process.execPath, ['-e', script], { timeout: 5000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
