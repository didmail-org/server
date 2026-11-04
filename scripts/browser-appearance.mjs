// Readonly native-artifact appearance acceptance; all business writes are blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { appearanceFixture } from './ui-appearance-fixture.mjs';
import { messages } from '../ui/locales.js';
const output = path.resolve(process.env.DIDMAIL_APPEARANCE_ARTIFACTS || '../artifacts/ui-brand/server');
await fs.mkdir(path.join(output, 'lifecycle'), { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
const brandResults = [];
const brandNameResults = [];
const canvas = { light: 'rgb(242, 242, 242)', dark: 'rgb(17, 17, 17)' };
async function scenario(name, options, run) {
  if (process.env.DIDMAIL_APPEARANCE_SCENARIO && !name.includes(process.env.DIDMAIL_APPEARANCE_SCENARIO)) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', ...options });
  if (name.startsWith('compact native brand:') || name.includes('long labels')) await context.addInitScript(mode => localStorage.setItem('web-mode', mode), options.colorScheme);
  const { origin, state } = await appearanceFixture(context);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await context.addInitScript(() => {
    window.__appearanceFrames = [];
    const record = () => {
      if (window.didmailTheme && document.body) window.__appearanceFrames.push({ mode: document.documentElement.dataset.mode, background: getComputedStyle(document.body).backgroundColor });
      if (window.__appearanceFrames.length < 12) requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  try {
    await run({ context, page, origin, state });
    assert.deepEqual(errors, [], name + ': runtime errors');
    assert.deepEqual(state.writes, [], name + ': no mutation permitted');
    assert.deepEqual(state.failures, [], name + ': unknown requests');
    results.push({ name, result: 'passed' }); console.log('PASS appearance: ' + name);
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'lifecycle-failure.png'), fullPage: false });
    await fs.writeFile(path.join(output, 'lifecycle-failure.json'), JSON.stringify({ name, url: page.url(), errors, state, layout: await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, items: [...document.querySelectorAll('body *')].filter(el => !el.closest('.dm-tabs-inner, .dm-wallet-tabs, .dm-table-wrap')).map(el => ({ tag: el.tagName, class: String(el.className), right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width })).filter(el => el.right > 321 && el.width > 0).slice(0, 30) })) }, null, 2));
    throw error;
  } finally { await context.close(); }
}
async function open(page, origin, route = '/') {
  await page.goto(origin + route, { waitUntil: 'networkidle' });
  await page.locator('[data-appearance-ready]').waitFor();
}
async function mode(page, expected) {
  await page.waitForFunction(value => document.documentElement.dataset.mode === value, expected);
  assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), canvas[expected]);
}
async function brandName(page, label) {
  const header = page.locator('.aup-app-header');
  const title = (await header.locator('.aup-app-header-title').textContent()).trim();
  assert.equal(title, 'DIDMail Server', `${label}: full product title`);
  const explicit = await header.locator('.aup-app-header-brand-link').getAttribute('aria-label');
  const name = explicit || title;
  if (explicit) assert.equal(name, messages(await page.locator('html').getAttribute('lang')).brandHome, `${label}: localized full product name`);
  assert.ok(name.includes('DIDMail'), `${label}: product identity in accessible label`);
  assert.equal(await header.getByRole('link', { name, exact: true }).count(), 1, `${label}: compact brand link accessible name`);
  brandNameResults.push({ label, accessibleName: name });
  return name;
}
async function brandFits(page, label) {
  const accessibleName = await brandName(page, label);
  const geometry = await page.locator('.aup-app-header').evaluate(header => {
    const rect = selector => {
      const { x, y, width, height } = header.querySelector(selector).getBoundingClientRect();
      return { x, y, width, height };
    };
    return { logo: rect('.aup-app-header-logo'), brand: rect('.aup-app-header-brand'), link: rect('.aup-app-header-brand-link') };
  });
  assert.ok(geometry.logo.width >= 27, `${label}: original logo remains full size`);
  for (const key of ['brand', 'link']) {
    const wrapper = geometry[key], logo = geometry.logo;
    assert.ok(wrapper.width + 1 >= logo.width && wrapper.height + 1 >= logo.height &&
      wrapper.x <= logo.x + 1 && wrapper.x + wrapper.width + 1 >= logo.x + logo.width,
    `${label}: ${key} clips original logo ${JSON.stringify(geometry)}`);
  }
  brandResults.push({ label, accessibleName, geometry });
}
async function choose(page, label) {
  const target = label.toLowerCase();
  const current = await page.evaluate(() => window.didmailTheme.preference());
  if (current !== target) await page.locator('[data-appearance-ready]').click();
  assert.equal(await page.locator('[data-appearance-ready]').getAttribute('aria-label'), target === 'dark' ? 'Switch to light' : 'Switch to dark');
}
try {
  for (const saved of ['light', 'dark']) await scenario(`local-only ${saved}: opposite OS, first paint, reload and navigation`, { colorScheme: saved === 'dark' ? 'light' : 'dark' }, async ({ context, page, origin }) => {
    await context.addInitScript(value => localStorage.setItem('web-mode', value), saved);
    await open(page, origin); await mode(page, saved);
    assert.equal(await page.evaluate(() => localStorage.getItem('web-mode')), saved);
    assert.ok((await context.cookies()).every(cookie => cookie.name !== 'arc_mode'));
    const frames = await page.evaluate(() => window.__appearanceFrames);
    assert.ok(frames.length > 0); assert.ok(frames.every(frame => frame.mode === saved && frame.background === canvas[saved]), JSON.stringify(frames));
    await page.reload({ waitUntil: 'networkidle' }); await mode(page, saved);
    await open(page, origin, '/help'); await mode(page, saved);
    await page.emulateMedia({ colorScheme: saved === 'dark' ? 'light' : 'dark' }); await mode(page, saved);
    await fs.writeFile(path.join(output, 'lifecycle', `first-paint-${saved}.json`), JSON.stringify({ saved, frames, note: 'First animation-frame samples after the native head bootstrap, before any deferred UI theme control.' }, null, 2));
    await page.screenshot({ path: path.join(output, 'lifecycle', `first-paint-${saved}.png`) });
  });
  for (const effective of ['light', 'dark']) await scenario(`legacy System migration: ${effective}`, { colorScheme: effective }, async ({ context, page, origin }) => {
    await context.addInitScript(() => { if (!sessionStorage.getItem('legacy-seeded')) { localStorage.setItem('web-mode', 'system'); sessionStorage.setItem('legacy-seeded', 'true'); } });
    await open(page, origin, '/admin/attachment'); await mode(page, effective);
    assert.equal(await page.evaluate(() => localStorage.getItem('web-mode')), effective);
    await page.emulateMedia({ colorScheme: effective === 'light' ? 'dark' : 'light' }); await mode(page, effective);
    await page.reload({ waitUntil: 'networkidle' }); await mode(page, effective);
  });
  await scenario('dark default, direct toggle, persistence, keyboard and unsaved form state', { colorScheme: 'light' }, async ({ context, page, origin }) => {
    await open(page, origin, '/admin/attachment'); await page.locator('[name="maxCount"]').fill('12'); await mode(page, 'dark');
    await choose(page, 'Light'); await mode(page, 'light');
    assert.equal(await page.locator('[name="maxCount"]').inputValue(), '12');
    assert.equal(await page.evaluate(() => localStorage.getItem('web-mode')), 'light');
    assert.ok((await context.cookies()).some(cookie => cookie.name === 'arc_mode' && cookie.value === 'light'));
    await page.emulateMedia({ colorScheme: 'dark' }); await mode(page, 'light');
    const trigger = page.locator('[data-appearance-ready]');
    await trigger.focus(); await page.keyboard.press('Enter'); await mode(page, 'dark');
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('[name="maxCount"]').inputValue(), '12');
    assert.equal(await trigger.getAttribute('onclick'), null);
    assert.equal(await page.locator('.dm-appearance-menu').count(), 0);
    await page.reload({ waitUntil: 'networkidle' }); await mode(page, 'dark');
  });
  await scenario('cookie fallback and blocked localStorage', { colorScheme: 'light' }, async ({ context, page, origin }) => {
    await context.addCookies([{ name: 'arc_mode', value: 'dark', url: origin }]);
    await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { const error = new Error('Blocked test storage'); error.name = 'SecurityError'; throw error; } }); });
    await open(page, origin, '/help'); await mode(page, 'dark');
    await choose(page, 'Light'); await mode(page, 'light'); await page.reload({ waitUntil: 'networkidle' }); await mode(page, 'light');
    await page.emulateMedia({ colorScheme: 'dark' }); await mode(page, 'light');
  });
  await scenario('native appearance synchronizes across tabs', { colorScheme: 'light' }, async ({ context, page, origin }) => {
    await open(page, origin); const second = await context.newPage(); await open(second, origin, '/help');
    await choose(page, 'Dark'); await mode(second, 'dark'); await choose(second, 'Light'); await mode(page, 'light');
    await page.emulateMedia({ colorScheme: 'dark' }); await second.emulateMedia({ colorScheme: 'dark' });
    await mode(page, 'light'); await mode(second, 'light');
  });
  for (const colorScheme of ['light', 'dark']) await scenario(`compact native brand: ${colorScheme}, all callers at 320px and 390px`, { isMobile: true, hasTouch: true, colorScheme }, async ({ page, origin }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/', '/help', '/admin', '/admin/account', '/admin/server', '/admin/envelope', '/admin/namecard', '/admin/storage', '/admin/members', '/admin/attachment']) {
        await open(page, origin, route);
        if (route.startsWith('/admin')) await page.locator('[data-workspace]:not([hidden])').waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${route}: compact overflow`);
        await brandFits(page, `${colorScheme}/${width}${route}`);
        for (const button of await page.locator('.dm-app .dm-did button').all()) {
          if (!(await button.isVisible())) continue;
          const target = await button.boundingBox();
          assert.ok(target.width >= 44 && target.height >= 44, `${route}: identity touch target ${JSON.stringify(target)}`);
        }
        for (const button of await page.locator('.aup-app-header button, .aup-app-header a.aup-app-header-action, .aup-app-header-brand-link').all()) {
          if (!(await button.isVisible())) continue;
          const target = await button.boundingBox();
          assert.ok(target.width >= 44 && target.height >= 44, `${route}: header touch target ${JSON.stringify(target)}`);
        }
        if (width === 390) await page.screenshot({ path: path.join(output, 'lifecycle', `compact-${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}-${colorScheme}-390.png`), fullPage: true });
        if (width === 390) {
          await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
          await brandName(page, `${colorScheme}/390/text200${route}`);
        }
      }
    }
  });
  for (const locale of ['en', 'zh', 'ja', 'ru', 'ar']) await scenario(`${locale}: 320px, long labels, dialogs and 200% text`, { viewport: { width: 320, height: 900 }, isMobile: true, hasTouch: true, colorScheme: 'dark' }, async ({ context, page, origin }) => {
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setEmulatedOSTextScale', { scale: 2 });
    for (const route of ['/', '/help', '/admin/account', '/admin/server', '/admin/envelope', '/admin/namecard', '/admin/storage', '/admin/members', '/admin/attachment']) {
      await open(page, origin, '/' + locale + (route === '/' ? '/' : route));
      if (route.startsWith('/admin')) await page.locator('[data-workspace]:not([hidden])').waitFor();
      // Rem-based text scaling supplements CDP OS text scaling. Neither claims physical-device QA.
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 321), true, `${locale}${route}: overflow`);
      await brandFits(page, `${locale}/320/text200${route}`);
      if (route === '/admin/storage') {
        for (const row of await page.locator('[data-storage-row]').all()) {
          const date = await row.locator('.dm-storage-date').boundingBox();
          const action = await row.locator('.dm-storage-action button').boundingBox();
          assert.ok(date.y + date.height <= action.y || action.y + action.height <= date.y || date.x + date.width <= action.x || action.x + action.width <= date.x, `${locale}: storage date/action overlap`);
        }
      }
      const trigger = page.locator('[data-appearance-ready]');
      const initial = await page.evaluate(() => window.didmailTheme.preference());
      await trigger.click(); assert.notEqual(await page.evaluate(() => window.didmailTheme.preference()), initial); await trigger.click();
      if (locale === 'en' && route === '/admin/storage') {
        await page.locator('[data-action="storage-details"]').first().click();
        await page.locator('[data-action="delete-mail"]:not([disabled])').first().click();
        const dialog = page.locator('dialog[open]'); await dialog.waitFor(); const bounds = await dialog.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 321); await page.keyboard.press('Escape');
      }
      await page.screenshot({ path: path.join(output, 'lifecycle', `${locale}-${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}-320-text200-dark.png`), fullPage: true });
    }
  });
  for (const colorScheme of ['light', 'dark']) await scenario(`no JavaScript: ${colorScheme} fixed dark fallback`, { javaScriptEnabled: false, colorScheme, viewport: { width: 320, height: 900 } }, async ({ page, origin }) => {
    await page.goto(origin + '/help');
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), canvas.dark);
    assert.equal(await page.locator('article section').count(), 13);
    await brandName(page, `${colorScheme}/320/no-JavaScript`);
    await page.setViewportSize({ width: 390, height: 900 });
    await brandName(page, `${colorScheme}/390/no-JavaScript`);
  });
  await fs.writeFile(path.join(output, 'lifecycle-results.json'), JSON.stringify(results, null, 2) + '\n');
  await fs.writeFile(path.join(output, 'header-brand-results.json'), JSON.stringify(brandResults, null, 2) + '\n');
  await fs.writeFile(path.join(output, 'header-name-results.json'), JSON.stringify(brandNameResults, null, 2) + '\n');
  console.log(`Appearance scenarios: ${results.length} passed. No external messages, writes or chain requests.`);
} finally { await browser.close(); }
