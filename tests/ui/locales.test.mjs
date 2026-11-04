import { adminTranslator, adminError } from '../../ui/admin-i18n.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { languages, messages, resolveLocale, localizedPath } from '../../ui/locales.js';
test('language registry normalizes regional preferences and falls back to English', () => {
  assert.equal(resolveLocale('zh-CN'), 'zh');
  assert.equal(resolveLocale('en-US'), 'en');
  assert.equal(resolveLocale('ZH'), 'zh');
  assert.equal(resolveLocale('fr'), 'en');
  assert.equal(messages('fr').intro, messages('en').intro);
  for (const { code, label } of languages) {
    assert.ok(label);
    assert.ok(messages(code).intro);
  }
  assert.equal(messages('zh').home, '首页');
  assert.equal(localizedPath('/admin/storage', 'zh'), '/zh/admin/storage');
  assert.equal(localizedPath('/', 'zh'), '/zh/');
  assert.equal(localizedPath('/admin', 'en'), '/admin');
});

test('admin copy supports Chinese, English fallback and non-recursive parameters', () => {
  const zh = adminTranslator('zh-CN');
  assert.equal(zh('Server'), '服务节点');
  assert.equal(zh('NO BALANCE'), '暂无余额');
  assert.equal(zh('Loading {type} factory…', { type: zh('Envelope') }), '正在加载信封工厂…');
  assert.equal(zh('Delete mail {id}', { id: '<mail>{id}' }), '删除邮件 <mail>{id}');
  assert.equal(
    zh('The SVG file must contain {fields}', { fields: '{{mail.subject}}' }),
    'SVG 文件必须包含 {{mail.subject}}',
  );
  assert.equal(zh('Backend diagnostic detail'), 'Backend diagnostic detail');
  assert.equal(zh('constructor'), 'constructor');
  assert.equal(adminTranslator('en')('Delete mail {id}', { id: 7 }), 'Delete mail 7');
  assert.equal(adminTranslator('fr')('Attachment Policy'), 'Attachment Policy');
});

test('admin errors translate known validation/network failures and preserve diagnostics', () => {
  assert.equal(adminTranslator('zh')('Single-file limit exceeds total attachment limit'), '单个附件上限不能超过附件总上限。');
  assert.equal(adminError('zh', new Error('Request failed (503).')), '请求失败（503）。');
  assert.equal(adminError('zh', new Error('Use at most 18 decimal places.')), '最多支持 18 位小数。');
  assert.equal(adminError('zh', { name: 'TimeoutError', message: 'timeout' }), '请求超时，请稍后重试。');
  assert.equal(adminError('zh', new Error('Chain diagnostic: node-123')), 'Chain diagnostic: node-123');
  assert.equal(adminError('en', new Error('Request failed (503).')), 'Request failed (503).');
});

test('server supports the same five languages as the Chrome extension', () => {
  assert.deepEqual(languages.map(({ code }) => code).sort(), ['ar', 'en', 'ja', 'ru', 'zh']);
  for (const preference of ['ar-SA', 'ja-JP', 'ru-RU']) {
    const code = preference.slice(0, 2);
    assert.equal(resolveLocale(preference), code);
    assert.equal(localizedPath('/admin/storage', preference), `/${code}/admin/storage`);
  }
});

test('every dictionary covers source keys and preserves interpolation variables', async () => {
  const { default: en } = await import('../../ui/locales/en.js');
  const { default: adminSource } = await import('../../ui/locales/admin-zh.js');
  const parameters = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const { code } of languages.filter(({ code }) => code !== 'en')) {
    const { default: home } = await import(`../../ui/locales/${code}.js`);
    const { default: admin } = await import(`../../ui/locales/admin-${code}.js`);
    assert.deepEqual(Object.keys(home).sort(), Object.keys(en).sort(), `${code}: home coverage`);
    assert.deepEqual(Object.keys(admin).sort(), Object.keys(adminSource).sort(), `${code}: admin coverage`);
    for (const [key, value] of Object.entries(admin)) {
      assert.ok(value.trim(), `${code}: ${key}`);
      assert.deepEqual(parameters(value), parameters(key), `${code}: ${key} parameters`);
    }
    const t = adminTranslator(code);
    assert.notEqual(t('Server'), 'Server');
    assert.ok(t('Delete mail {id}', { id: '<mail>{id}' }).includes('<mail>{id}'));
    assert.notEqual(adminError(code, new Error('Request failed (503).')), 'Request failed (503).');
    assert.equal(t('constructor'), 'constructor');
    assert.equal(t('Unknown backend diagnostic'), 'Unknown backend diagnostic');
  }
});

test('Arabic first paint uses RTL and other languages use LTR', async () => {
  const { localeDirection } = await import('../../ui/locales.js');
  const { render } = await import('../../ui/admin-render.js');
  const { escapeHtml } = await import('../../ui/shared.js');
  for (const { code } of languages) {
    assert.equal(localeDirection(code), code === 'ar' ? 'rtl' : 'ltr');
    const { html } = render({ props: { locale: code, section: 'storage' }, escapeHtml });
    assert.ok(html.includes(`dir="${localeDirection(code)}"`));
    assert.ok(html.includes(`<h1>${adminTranslator(code)('Storage')}</h1>`));
    assert.ok(html.includes(`href="${localizedPath('/admin/storage', code)}"`));
  }
  assert.equal(localeDirection('ar-SA'), 'rtl');
  assert.equal(localeDirection('fr'), 'ltr');
});
