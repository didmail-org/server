import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadInputs, verifyNativePackage } from './native-package-audit.mjs';

test('a clean Blocklet source tree builds all native pages and browser assets with ARC alone', { timeout: 60000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-native-package-'));
  const source = path.join(root, 'blocklet');
  const ignored = new Set(['dist', '.web-cache', 'web'].map(name => path.resolve('blocklet', name)));
  try {
    await fs.cp('blocklet', source, {
      recursive: true,
      filter: (file) => !ignored.has(path.resolve(file)),
    });
    await fs.writeFile(path.join(root, '.dev.vars'), 'PRIVATE_BUILD_CANARY=not-a-real-secret\n');
    const inputs = loadInputs();
    const authored = await fs.readFile(path.join(source, 'pages/admin-account/layout.aup'));
    for (const args of [['dsl', 'validate', source], ['blocklet', 'check', source, '--profile', 'basic'], ['blocklet', 'build', source]]) {
      const result = spawnSync('arc', args, {
        cwd: root, encoding: 'utf8', timeout: 45000,
        env: { ...process.env, DIDMAIL_URL: 'http://unexpected.invalid', DIDMAIL_WORKER_URL: 'PRIVATE_BUILD_CANARY' },
      });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    assert.deepEqual(await fs.readFile(path.join(source, 'pages/admin-account/layout.aup')), authored);
    verifyNativePackage(path.join(source, 'dist'), inputs);
    const manifest = JSON.parse(await fs.readFile(path.join(source, 'dist/.afs/manifest.json'), 'utf8'));
    for(const file of ['providers/didmail-business/index.mjs','providers/didmail-business/store.mjs','providers/didmail-business/initialize.mjs','providers/didmail-business/migrations/0021_afs_admission_fences.sql'])assert(manifest.files.some(item=>item.path===file),file);
    assert.equal(manifest.files.some(item=>item.path.endsWith('/runtime.json')),false,'instance runtime credentials never ship');
    for (const file of manifest.files) {
      assert(!/(?:^|\/)(?:node_modules|\.data|\.arc|\.wrangler|\.dev\.vars)(?:\/|$)/.test(file.path), file.path);
      const bytes = await fs.readFile(path.join(source, 'dist', file.path));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
      assert(!bytes.includes('PRIVATE_BUILD_CANARY'), file.path);
    }
    for (const file of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', '.web/components/didmail-chrome/script.js', '.web/components/didmail-chrome/style.css', '.aup/locales/en.json']) {
      assert(manifest.files.some(item => item.path === file), file);
    }
    for (const locale of ['en', 'zh', 'ar', 'ja', 'ru']) {
      const translations = JSON.parse(await fs.readFile(path.join(source, '.aup/locales', locale + '.json'), 'utf8'));
      assert.equal(translations.didmailHelpMarkdown, await fs.readFile(path.join('docs/help', locale + '.md'), 'utf8'), `${locale}: help source matches the package`);
      for (const page of ['', 'help', 'admin', ...['account', 'server', 'envelope', 'namecard', 'storage', 'attachment', 'members'].map(name => 'admin-' + name)]) {
        const html = await fs.readFile(path.join(source, '.web-cache', locale, page, 'index.html'), 'utf8');
        assert.match(html, /<header class="aup-app-header"/);
        assert.doesNotMatch(html, /component not found|home\.encryptionTitle|didmailHelpMarkdown|didmail-appearance-bootstrap/);
        assert.match(html, page === 'help' ? /data-didmail-help/ : page ? /data-didmail-admin/ : /dm-home/);
        if (page === 'help') assert.equal((html.match(/<section id=/g) || []).length, 13);
      }
    }
    const flat = JSON.parse(await fs.readFile(path.join(source, 'dist/blocklet.dist.json'), 'utf8'));
    assert.equal(flat.instance.required, true);
    await fs.writeFile(path.join(source, 'unexpected.txt'), 'PRIVATE_BUILD_CANARY');
    const rebuild = spawnSync('arc', ['blocklet', 'build', source], { cwd: root, encoding: 'utf8', timeout: 45000 });
    assert.equal(rebuild.status, 0, rebuild.stdout + rebuild.stderr);
    assert.throws(() => verifyNativePackage(path.join(source, 'dist'), inputs), /Unexpected ARC manifest path/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
