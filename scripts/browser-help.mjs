// Real ARC artifacts served in isolation. Only ARC's public core stylesheet is
// read from the running preview; all sessions and business APIs stay isolated.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { languages, localizedPath, localeDirection, messages } from '../ui/locales.js';
import { compileHelp } from '../ui/help-markdown.js';

const root = path.resolve('dist');
const preview = process.env.DIDMAIL_BROWSER_URL || 'http://didmail-server.localhost:8788';
const html = await fs.readFile(path.join(root, 'en/help/index.html'), 'utf8');
const corePath = html.match(/href="(\/aup-core\.[a-f0-9]+\.css)"/)?.[1];
assert.ok(corePath, 'ARC core stylesheet reference is missing');
// ARC serves this asset at runtime; blocklet build does not copy it into dist.
const coreCSS = process.env.DIDMAIL_BROWSER_CORE_CSS
  ? await fs.readFile(process.env.DIDMAIL_BROWSER_CORE_CSS, 'utf8')
  : await (async () => {
    const response = await fetch(new URL(corePath, preview), { redirect: 'error', signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, 'Start the ARC preview or supply its cached public core stylesheet');
    return response.text();
  })();
assert.ok(coreCSS.includes('.aup-app-header'), 'Expected the actual ARC stylesheet');
const contentTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === corePath) {
      res.writeHead(200, { 'content-type': 'text/css' }).end(coreCSS);
      return;
    }
    if (pathname === '/__blocklet__.js') {
      res
        .writeHead(200, { 'content-type': 'application/javascript' })
        .end('/* No platform bridge in isolated help test. */');
      return;
    }
    const match = /^\/(?:((?:en|zh|ja|ar|ru))\/)?(help|admin(?:\/[a-z]+)?)\/?$/.exec(pathname);
    if (match) pathname = `/${match[1] || 'en'}/${match[2].replaceAll('/', '-')}/index.html`;
    else if (/^\/(?:en|zh|ja|ar|ru)?\/?$/.test(pathname)) pathname = `${pathname.replace(/\/$/, '')}/index.html`;
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root + path.sep)) throw new Error('Outside artifact directory');
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': contentTypes[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
await fs.mkdir('artifacts/help', { recursive: true });
try {
  for (const { code: locale } of languages) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const errors = [],
      business = [];
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        return route.fulfill({ contentType: 'text/plain', body: '' });
      }
      if (url.pathname.startsWith('/api/')) {
        business.push(url.pathname);
        return route.fulfill({ status: 503, json: { message: 'Business API disabled in help test' } });
      }
      if (url.pathname.startsWith('/.well-known/'))
        return route.fulfill({ json: { authenticated: false, user: null } });
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const guide = compileHelp(await fs.readFile(`docs/help/${locale}.md`, 'utf8'), locale);
    try {
      await page.goto(origin + localizedPath('/help', locale));
      await page.locator('.dm-header-help').waitFor();
      assert.equal(await page.locator('h1').textContent(), guide.title);
      assert.equal(await page.locator('header').count(), 1);
      assert.ok((await page.locator('header').boundingBox()).height < 100, 'Native header styles must load');
      assert.equal(await page.locator('article section').count(), 13);
      assert.equal(
        await page.locator('.dm-help').evaluate((el) => getComputedStyle(el).direction),
        localeDirection(locale),
      );
      assert.equal(await page.locator('.dm-header-help').getAttribute('aria-label'), messages(locale).help);
      assert.equal(await page.locator('.dm-header-help').getAttribute('aria-current'), 'page');
      assert.equal(
        await page.locator('article a[href$="/admin/account"]').getAttribute('href'),
        localizedPath('/admin/account', locale),
      );
      await page.locator('.dm-help-skip').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#guide').evaluate((el) => el === document.activeElement), true);
      await page.locator('.dm-help-toc a[href="#delivery"]').click();
      assert.equal(new URL(page.url()).hash, '#delivery');
      assert.ok((await page.locator('#delivery').boundingBox()).y >= 0);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
          `${locale}/${width} overflow`,
        );
        assert.ok((await page.locator('header').boundingBox()).height < 100, `${locale}/${width} header height`);
        assert.equal(
          await page
            .locator('pre')
            .first()
            .evaluate((el) => getComputedStyle(el).direction),
          'ltr',
        );
      }
      await page.evaluate(() => {
        document.documentElement.dataset.mode = 'dark';
        document.documentElement.dataset.theme = 'dark';
      });
      assert.equal(
        await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor),
        'rgb(17, 17, 17)',
      );
      await page.evaluate(() => {
        document.documentElement.dataset.mode = 'light';
        document.documentElement.dataset.theme = 'light';
      });
      assert.equal(
        await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor),
        'rgb(242, 242, 242)',
      );
      await page.evaluate(() => scrollTo(0, 0));
      if (locale === 'en') await page.screenshot({ path: 'artifacts/help/english-desktop.png' });
      if (locale === 'ar') {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.dm-help-toc summary').click();
        assert.equal(await page.locator('#contents').getAttribute('open'), null);
        await page.screenshot({ path: 'artifacts/help/arabic-mobile.png' });
      }
      // The native locale picker must retain the current guide anchor and query.
      await page.goto(origin + localizedPath('/help', locale) + '?from=guide#delivery');
      const next = locale === 'ru' ? 'en' : 'ru';
      await page.locator('[data-role="locale-switcher"] > button').click();
      await Promise.all([
        page.waitForURL((url) => url.pathname === `/${next}/help`),
        page.locator(`[data-role="locale-switcher"] [role="menuitem"][lang="${next}"]`).click(),
      ]);
      assert.equal(new URL(page.url()).hash, '#delivery');
      assert.equal(new URL(page.url()).search, '?from=guide');
      assert.deepEqual(business, [], 'Public help must not load business data');
      assert.deepEqual(errors, []);
      console.log(
        `PASS help ${locale}: native page, sections, keyboard, locale links, anchor navigation, 320–1440px, themes and no business requests`,
      );
    } finally {
      await context.close();
    }
  }
  const noJS = await browser.newContext({ javaScriptEnabled: false });
  await noJS.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ body: '' }),
  );
  const page = await noJS.newPage();
  await page.goto(origin + '/zh/help');
  assert.equal(await page.locator('article section').count(), 13);
  assert.ok((await page.locator('#delivery').textContent()).includes('NFT'));
  await noJS.close();
  console.log('PASS help remains readable without JavaScript');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
