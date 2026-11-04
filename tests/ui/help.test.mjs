import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileHelp } from '../../ui/help-markdown.js';
import { renderHelp } from '../../ui/help-view.js';
import { languages, localeDirection, localizedPath } from '../../ui/locales.js';
import { render as renderAdmin } from '../../ui/admin-render.js';
import { escapeHtml } from '../../ui/shared.js';

const read = (code) => fs.readFileSync(`docs/help/${code}.md`, 'utf8');
const english = compileHelp(read('en'));
const codeBlocks = (source) => [...source.matchAll(/```(?:text|sh)\n([\s\S]*?)\n```/g)].map((m) => m[1]);
const codeTokens = (source) => [...new Set([...source.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)].map((m) => m[1]))].sort();

test('all help translations follow the English sections and preserve operational identifiers', () => {
  assert.equal(english.sections.length, 13);
  for (const { code } of languages) {
    const source = read(code),
      doc = compileHelp(source, code);
    assert.deepEqual(
      doc.sections.map((s) => s.id),
      english.sections.map((s) => s.id),
      code,
    );
    assert.deepEqual(codeBlocks(source), codeBlocks(read('en')), `${code}: deployment values`);
    assert.deepEqual(codeTokens(source), codeTokens(read('en')), `${code}: code/error identifiers`);
    assert.ok(doc.sections.every((s) => s.html.length > 180));
    if (code !== 'en') assert.notEqual(doc.title, english.title);
  }
});

test('localized help is public static content, with working section links, correct direction and no business controls', () => {
  for (const { code } of languages) {
    const { html } = renderHelp(read(code), code);
    assert.match(html, new RegExp(`dir="${localeDirection(code)}"`));
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    assert.equal((html.match(/<section id=/g) || []).length, 13);
    assert.ok(html.includes(`href="${localizedPath('/admin/members', code)}"`));
    assert.ok(html.includes(`href="${localizedPath('/', code)}"`));
    for (const section of english.sections) {
      assert.ok(html.includes(`href="#${section.id}"`));
      assert.ok(html.includes(`id="${section.id}"`));
    }
    assert.doesNotMatch(html, /<script|<form|data-didmail-admin|data-session|data-action=/);
    assert.match(html, /<pre dir="ltr"><code>DMP_INTERNAL_RETENTION_DAYS=30/);
    assert.match(html, /\{\{contact.name\}\}/);
    const admin = renderAdmin({ props: { section: 'members', locale: code }, escapeHtml }).html;
    assert.ok(admin.includes(`href="${localizedPath('/help', code)}#members"`));
  }
});

test('help markup escapes HTML and refuses unsafe links, duplicate anchors or malformed guides', () => {
  const source =
    '# Guide <img src=x onerror=bad>\n\n<a id="start"></a>\n## Start\n\n<script>alert(1)</script> **Bold** `safe`\n';
  const html = renderHelp(source, 'en').html;
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<img|<script/);
  for (const url of [
    'javascript:alert',
    'data:text/html,bad',
    '//outside.test',
    '/api/account/transfer',
    'https://outside.test',
  ])
    assert.throws(() => compileHelp(`${source}\n[Bad](${url})`), /Unsupported help link/);
  assert.throws(() => compileHelp(`${source}\n<a id="start"></a>\n## Again`), /duplicate/);
  assert.throws(() => compileHelp('# Guide\n## Missing anchor'), /anchor/);
  assert.throws(() => compileHelp(`${source}\n\x60\x60\x60sh\nunfinished`), /Incomplete/);
});
