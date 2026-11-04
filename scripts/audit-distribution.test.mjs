import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const script = fileURLToPath(new URL('./audit-distribution.mjs', import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function fixture(run) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'didmail-notice-evidence-'));
  const write = (name, bytes) => {
    fs.mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
    fs.writeFileSync(path.join(cwd, name), bytes);
  };
  const invoke = (...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  const meta = {
    inputs: { 'workers/index.ts': {}, 'node_modules/direct/esm/index.js': {} },
    outputs: {
      '.worker/index.mjs': {
        inputs: {
          'workers/index.ts': { bytesInOutput: 10 },
          'node_modules/direct/esm/index.js': { bytesInOutput: 10 },
        },
      },
    },
  };
  write('.worker/metafile.json', JSON.stringify(meta));
  write('artifacts/ui-metafiles.json', JSON.stringify([meta]));
  write(
    'node_modules/direct/package.json',
    JSON.stringify({ name: 'public-fixture', version: '1.0.0', license: 'MIT' }),
  );
  write('node_modules/direct/esm/package.json', '{"type":"module"}');
  write('node_modules/direct/esm/index.js', 'export const publicFixture = 1;');
  write('node_modules/direct/LICENSE', 'PUBLIC FIXTURE LICENSE\r\n');
  write('third_party_licenses/.fixture', 'public fixture');
  fs.mkdirSync(path.join(cwd, 'docs'));
  try {
    run({ cwd, write, invoke, meta });
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}
test('inventory counts direct aliases at the installation boundary and preserves original text bytes', () =>
  fixture(({ cwd, invoke }) => {
    const result = invoke('--write');
    assert.equal(result.status, 0, result.stderr);
    const evidence = JSON.parse(fs.readFileSync(path.join(cwd, 'docs/distribution-dependency-evidence.json')));
    assert.equal(evidence.worker.packages.length, 1);
    assert.equal(evidence.worker.packages[0].package, 'public-fixture');
    assert.equal(evidence.worker.packages[0].evidence[0].sha256, sha256('PUBLIC FIXTURE LICENSE\r\n'));
    assert(
      fs
        .readFileSync(path.join(cwd, 'third_party_licenses/worker-bundle-licenses.txt'))
        .includes(Buffer.from('PUBLIC FIXTURE LICENSE\r\n')),
    );
  }));
test('audit rejects stale input bytes and a test-only metafile', () =>
  fixture(({ write, invoke, meta }) => {
    assert.equal(invoke('--write').status, 0);
    write('node_modules/direct/esm/index.js', 'export const publicFixture = 2;');
    let result = invoke();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /stale/);
    meta.inputs['tests/workers/entry.ts'] = {};
    write('.worker/metafile.json', JSON.stringify(meta));
    result = invoke('--write');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Test metafile/);
  }));
test('audit rejects changed delivered notices and an altered ARC manifest asset', () =>
  fixture(({ cwd, write, invoke }) => {
    assert.equal(invoke('--write').status, 0);
    for (const file of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) write(file, 'PUBLIC FIXTURE\n');
    const notices = [
      'LICENSE',
      'NOTICE',
      'THIRD_PARTY_NOTICES.md',
      ...fs.readdirSync(path.join(cwd, 'third_party_licenses')).map((name) => `third_party_licenses/${name}`),
    ];
    for (const directory of ['.worker/legal', 'dist', 'blocklet/dist'])
      for (const file of notices) write(`${directory}/${file}`, fs.readFileSync(path.join(cwd, file)));
    write('blocklet/dist/public.js', 'PUBLIC ORIGINAL');
    write(
      'blocklet/dist/.afs/manifest.json',
      JSON.stringify({
        files: [...notices, 'public.js'].map((file) => ({
          path: file,
          sha256: sha256(fs.readFileSync(path.join(cwd, 'blocklet/dist', file))),
        })),
      }),
    );
    assert.equal(invoke().status, 0);
    write('dist/NOTICE', 'PUBLIC CHANGED');
    let result = invoke();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing or changed/);
    write('dist/NOTICE', 'PUBLIC FIXTURE\n');
    write('blocklet/dist/public.js', 'PUBLIC MODIFIED');
    result = invoke();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ARC manifest hash mismatch/);
    write('blocklet/dist/public.js', 'PUBLIC ORIGINAL');
    write('blocklet/dist/unlisted.js', 'PUBLIC UNLISTED');
    result = invoke();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unlisted ARC output/);
  }));
