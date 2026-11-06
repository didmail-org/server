// Offline check of the real ARC-generated artifact; interactive acceptance is browser-ui.mjs.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { languages, messages, localeDirection } from '../ui/locales.js';
import { adminTranslator } from '../ui/admin-i18n.js';
const root = 'blocklet/.web-cache';
const manifest = JSON.parse(fs.readFileSync('blocklet/dist/.afs/manifest.json', 'utf8'));
assert.ok(manifest.files.some(file => file.path === '.web/components/didmail-chrome/script.js'));
assert.ok(manifest.files.some(file => file.path === '.web/components/didmail-admin/render.js'));
for (const route of [
  '',
  'help',
  'admin',
  'admin-account',
  'admin-server',
  'admin-envelope',
  'admin-namecard',
  'admin-storage',
  'admin-attachment',
  'admin-members',
]) {
  const html = fs.readFileSync(path.join(root, route ? `en/${route}` : '', 'index.html'), 'utf8');
  assert.match(html, /<header class="aup-app-header"/);
  assert.match(html, /data-action-kind="theme-toggle"/);
  assert.match(html, /data-role="locale-switcher"/);
  assert.doesNotMatch(html, /id="app"|react-dom|runtime-config\.js/);
  assert.equal((html.match(/<header\b/g) || []).length, 1);
  if (route === 'help') {
    assert.match(html, /data-didmail-help/);
    assert.doesNotMatch(html, /data-didmail-admin/);
  } else if (route) {
    assert.match(html, /data-didmail-admin/);
    if (route === 'admin-account') assert.match(html, /data-account/);
    else assert.doesNotMatch(html, /data-account/);
  } else assert.match(html, /Own your inbox/);
  for (const [, resource] of html.matchAll(/(?:src|href)="(\/_arc\/assets\/[^"?#]+)"/g)) {
    const file = path.join(root, resource);
    assert.ok(fs.existsSync(file), `Missing native resource: ${resource}`);
    if (file.endsWith('.js')) new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
  }
}
console.log(
  'PASS all 10 native page artifacts, original business sections, header resources and browser JavaScript syntax; no React runtime',
);

const chinese = fs.readFileSync(path.join(root, 'zh/index.html'), 'utf8');
assert.match(chinese, /<html\b[^>]*\blang="zh"/);
assert.match(chinese, /端到端加密/);
assert.match(chinese, /获取浏览器扩展/);
assert.doesNotMatch(chinese, /Own your inbox/);
for (const { code: locale } of languages) {
  for (const page of [
    '',
    'help',
    'admin',
    'admin-account',
    'admin-server',
    'admin-envelope',
    'admin-namecard',
    'admin-storage',
    'admin-attachment',
    'admin-members',
  ]) {
    assert.ok(
      fs.existsSync(path.join(root, locale, page, 'index.html')),
      `Missing localized page: ${locale}/${page}`,
    );
  }
}
for (const { code } of languages) {
  const home = fs.readFileSync(`${root}/${code}/index.html`, 'utf8');
  assert.ok(home.includes(messages(code).encryptionTitle));
  assert.ok(home.includes(`class="dm-home" dir="${localeDirection(code)}"`));
  const help = fs.readFileSync(`${root}/${code}/help/index.html`, 'utf8');
  assert.ok(help.includes(`class="dm-help" dir="${localeDirection(code)}"`));
  assert.equal((help.match(/<section id=/g) || []).length, 13);
  const admin = fs.readFileSync(`${root}/${code}/admin-storage/index.html`, 'utf8');
  assert.ok(admin.includes(`<h1>${adminTranslator(code)('Storage')}</h1>`));
  assert.ok(admin.includes(`class="dm-app" dir="${localeDirection(code)}"`));
  for (const { label } of languages) assert.ok(home.includes(label));
}
console.log('PASS five-language static pages, localized first paint, RTL and native language/theme controls');

for (const [page, title] of [
  ['account', '节点账户'],
  ['server', '服务节点'],
  ['envelope', '信封'],
  ['namecard', '名片'],
  ['storage', '存储'],
  ['attachment', '设置'],
  ['members', '成员'],
]) {
  const html = fs.readFileSync(`${root}/zh/admin-${page}/index.html`, 'utf8');
  assert.match(html, /DIDMail 业务导航/);
  assert.match(html, /正在验证 ARC 会话/);
  assert.match(html, new RegExp(`<h1>${title}</h1>`));
  assert.match(html, /href="\/zh\/admin\/storage"/);
}
console.log('PASS Chinese admin first paint, business navigation and localized links');
