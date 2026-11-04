import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { themeBootstrap } from '../../ui/theme.js';

function appearance({ saved, cookie = '', dark = false, blockedStorage = false, blockedCookies = false, applied } = {}) {
  const values = new Map(saved ? [['web-mode', saved]] : []);
  const mutations = [];
  const attributes = new Map([['data-aup-mode', 'system'], ...(applied ? [['data-mode', applied]] : [])]);
  const events = new Map();
  let cookieValue = cookie;
  let systemChanged;
  const media = { matches: dark, addEventListener: (_type, listener) => { systemChanged = listener; } };
  const document = {
    documentElement: { getAttribute: key => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value), removeAttribute: (key) => attributes.delete(key) },
    get cookie() { if (blockedCookies) throw new Error('cookies unavailable'); return cookieValue; },
    set cookie(value) { if (blockedCookies) throw new Error('cookies unavailable'); cookieValue = value.includes('max-age=0') ? '' : value.split(';')[0]; },
  };
  const localStorage = {
    getItem(key) { if (blockedStorage) throw new Error('storage unavailable'); return values.get(key) || null; },
    setItem(key, value) { if (blockedStorage) throw new Error('storage unavailable'); mutations.push(['set', key, value]); values.set(key, value); },
    removeItem(key) { if (blockedStorage) throw new Error('storage unavailable'); mutations.push(['remove', key]); values.delete(key); },
  };
  const window = { matchMedia: () => media, addEventListener: (name, listener) => events.set(name, listener), dispatchEvent() {} };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  vm.runInNewContext(`(${themeBootstrap.toString()})()`, { window, document, localStorage, CustomEvent });
  return {
    controller: window.didmailTheme, values, mutations, attributes,
    get cookie() { return cookieValue; },
    system(dark) { media.matches = dark; systemChanged?.(); },
    storage(value) { if (value == null) values.delete('web-mode'); else values.set('web-mode', value); events.get('storage')({ key: 'web-mode' }); },
  };
}

for (const selected of ['light', 'dark']) {
  test(`first load preserves an explicit ${selected} local preference without an ARC cookie`, () => {
    const page = appearance({ saved: selected, dark: selected !== 'dark' });
    assert.equal(page.attributes.get('data-mode'), selected);
    assert.equal(page.controller.preference(), selected);
    assert.equal(page.values.get('web-mode'), selected);
    assert.deepEqual(page.mutations, []);
    page.system(selected !== 'dark');
    assert.equal(page.attributes.get('data-mode'), selected);
  });
}

for (const legacy of ['system', 'auto']) for (const dark of [false, true]) {
  test(`legacy ${legacy} migrates once to effective ${dark ? 'dark' : 'light'} and stays fixed`, () => {
    const page = appearance({ saved: legacy, dark });
    const expected = dark ? 'dark' : 'light';
    assert.equal(page.controller.preference(), expected);
    assert.equal(page.values.get('web-mode'), expected);
    assert.equal(page.cookie, 'arc_mode=' + expected);
    page.system(!dark);
    assert.equal(page.attributes.get('data-mode'), expected);
    assert.equal(page.controller.preference(), expected);
  });
}

test('migration preserves an already applied effective palette; a new installation defaults dark', () => {
  assert.equal(appearance({ saved: 'system', applied: 'light', dark: true }).controller.preference(), 'light');
  assert.equal(appearance({ saved: 'system', cookie: 'arc_mode=light', dark: true }).controller.preference(), 'dark');
  const page = appearance({ dark: false });
  assert.equal(page.controller.preference(), 'dark');
  page.system(false);
  assert.equal(page.attributes.get('data-mode'), 'dark');
  page.controller.choose('light');
  assert.equal(page.values.get('web-mode'), 'light');
  assert.equal(page.cookie, 'arc_mode=light');
  page.controller.choose('system');
  assert.equal(page.controller.preference(), 'light');
});

test('cookie fallback, unavailable browser storage and cross-tab updates retain usable appearance', () => {
  const cookie = appearance({ cookie: 'arc_mode=dark', blockedStorage: true });
  assert.equal(cookie.attributes.get('data-mode'), 'dark');
  cookie.controller.choose('light');
  cookie.system(true);
  assert.equal(cookie.attributes.get('data-mode'), 'light');
  const blocked = appearance({ blockedStorage: true, blockedCookies: true, dark: true });
  blocked.controller.choose('light');
  blocked.system(true);
  assert.equal(blocked.attributes.get('data-mode'), 'light');
  blocked.controller.choose('system');
  assert.equal(blocked.attributes.get('data-mode'), 'light');
  const tabs = appearance({ saved: 'light' });
  tabs.storage('dark');
  assert.equal(tabs.attributes.get('data-mode'), 'dark');
  tabs.controller.choose('unrecognized-mode');
  assert.equal(tabs.attributes.get('data-mode'), 'dark');
});
