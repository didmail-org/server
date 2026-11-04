import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { prepareAppearanceHtml, prepareAppearanceArtifacts, prepareNativeAppearanceScript } from './prepare-ui-appearance.mjs';

const nativePrelude = `<script>(function(){var t=localStorage.getItem('web-tone'),m=localStorage.getItem('web-mode');if(!/arc_mode=(light|dark)/.test(document.cookie))localStorage.removeItem('web-mode')})()</script>`;
const original = `<html lang="en" data-mode="light" data-aup-mode="system"><head>${nativePrelude}<title>DIDMail</title></head><body><header>Native header</header><main data-didmail-admin>Protected UI</main><script>/* native identity runtime */</script></body></html>`;
const nativeScript = `/* layout and identity remain native */ (function(){var _tones=[],_pals=[];var _pals=[];var el=document.documentElement;
var curTone=localStorage.getItem("web-tone")||el.getAttribute("data-tone")||"editorial";
var curPalette=localStorage.getItem("web-palette")||el.getAttribute("data-palette")||"neutral";
var curMode=localStorage.getItem("web-mode")||el.getAttribute("data-mode")||"dark";
function apply(){el.setAttribute("data-mode",curMode);}
function toggle(){curMode=curMode==="dark"?"light":"dark";localStorage.setItem("web-mode",curMode);apply();}
})();`;

test('appearance adapter replaces only the known native theme prelude and is idempotent', () => {
  const html = prepareAppearanceHtml(original, ':root { --brand: teal; }');
  assert.match(html, /<html data-didmail-ui /);
  assert.doesNotMatch(html.split('<head>')[0], /data-mode=/);
  assert.match(html, /id="didmail-brand-theme"/);
  assert.match(html, /id="didmail-appearance-bootstrap"/);
  assert.ok(html.includes('<header>Native header</header>'));
  assert.ok(html.includes('<main data-didmail-admin>Protected UI</main>'));
  assert.ok(html.includes('<script>/* native identity runtime */</script>'));
  assert.equal(prepareAppearanceHtml(html, 'unused'), html);
  assert.equal(prepareAppearanceHtml('<html><main>ARC platform page</main></html>', ''), '<html><main>ARC platform page</main></html>');
  assert.throws(() => prepareAppearanceHtml(original.replace("localStorage.removeItem('web-mode')", 'upstreamChanged()'), ''), /prelude changed/);
  assert.throws(() => prepareAppearanceHtml(original.replace('data-aup-mode="system"', ''), ''), /system appearance/);
  assert.throws(() => prepareAppearanceHtml(original.replace(nativePrelude, nativePrelude + nativePrelude), ''), /prelude changed/);
});

test('native appearance delegates to the same controller and rejects upstream drift', () => {
  const prepared = prepareNativeAppearanceScript(nativeScript);
  assert.ok(prepared.startsWith('/* layout and identity remain native */'));
  assert.match(prepared, /window\.didmailTheme\.choose\(curMode\)/);
  assert.match(prepared, /window\.didmailTheme\.apply\(\)/);
  assert.match(prepared, /function appearanceValue/);
  assert.equal(prepareNativeAppearanceScript(prepared), prepared);
  assert.throws(() => prepareNativeAppearanceScript(nativeScript.replace('var curMode=', 'var upstreamMode=')), /initializer changed/);
});

test('only the public welcome shell prepares the motion first paint', () => {
  const home = original.replace('<main data-didmail-admin>Protected UI</main>', '<div class="dm-home">Original welcome artwork</div>');
  const html = prepareAppearanceHtml(home, ':root { --brand: teal; }');
  assert.ok(html.indexOf('id="didmail-brand-motion-bootstrap"') < html.indexOf('<body>'));
  assert.match(html, /data-didmail-brand-entrance="pending"/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /setTimeout/);
  assert.equal(prepareAppearanceHtml(html, 'unused'), html);
  assert.doesNotMatch(prepareAppearanceHtml(original, ''), /didmail-brand-motion-bootstrap/);
  assert.ok(html.includes('<script>/* native identity runtime */</script>'));
});

test('native published HTML and readonly-tree hashes stay consistent after the shell adapter', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-appearance-'));
  try {
    const root = path.join(temp, 'blocklet');
    for (const cache of ['.web-cache', 'dist/.web-cache']) {
      await fs.mkdir(path.join(root, cache, 'en'), { recursive: true });
      await fs.writeFile(path.join(root, cache, 'en/index.html'), original);
      await fs.mkdir(path.join(root, cache, '_arc/assets'), { recursive: true });
      await fs.writeFile(path.join(root, cache, '_arc/assets/native.js'), nativeScript);
      await fs.writeFile(path.join(root, cache, '.prerender-manifest.json'), JSON.stringify({ outputs: ['_arc/assets/native.js'] }));
    }
    await fs.mkdir(path.join(root, 'dist/.afs'), { recursive: true });
    await fs.writeFile(path.join(root, 'dist/.afs/manifest.json'), JSON.stringify({ afs: '1.0', type: 'readonly-tree', files: [{ path: '.web-cache/en/index.html', size: 0, sha256: 'old', contentType: 'text/html' }, { path: '.web-cache/_arc/assets/native.js', size: 0, sha256: 'old', contentType: 'text/javascript' }] }));
    const cssPath = path.join(temp, 'brand.css');
    await fs.writeFile(cssPath, ':root { color: teal; }');
    assert.equal(await prepareAppearanceArtifacts({ root, cssPath }), 2);
    const emitted = await fs.readFile(path.join(root, 'dist/.web-cache/en/index.html'));
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'dist/.afs/manifest.json')));
    assert.equal(manifest.files[0].size, emitted.length);
    assert.equal(manifest.files[0].sha256, createHash('sha256').update(emitted).digest('hex'));
    assert.deepEqual(emitted, await fs.readFile(path.join(root, '.web-cache/en/index.html')));
    const native = manifest.files[1];
    assert.notEqual(native.path, '.web-cache/_arc/assets/native.js');
    const script = await fs.readFile(path.join(root, 'dist', native.path));
    assert.equal(native.sha256, createHash('sha256').update(script).digest('hex'));
    assert.equal(path.basename(native.path), native.sha256 + '.js');
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
