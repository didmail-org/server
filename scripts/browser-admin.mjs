// Real Chromium regression against the ARC-rendered page. API fixtures belong only to this isolated browser context.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserDiagnostics } from './browser-diagnostics.mjs';
import { isolateBrowserResources } from './browser-isolation.mjs';
const origin = process.env.DIDMAIL_BROWSER_URL || 'http://didmail-server.localhost:8788';
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath });
await fs.mkdir('.data/screenshots', { recursive: true });
try {
  for (const scenario of ['delayed-stake', 'new-node', 'chain-unavailable', 'anonymous']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await isolateBrowserResources(context);
    const page = await context.newPage();
    const diagnostics = browserDiagnostics(page);
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(15_000);
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/runtime/session' || pathname === '/.well-known/service/api/did/session') {
        await route.fulfill({
          json:
            scenario === 'anonymous'
              ? { authenticated: false, user: null }
              : {
                  authenticated: true,
                  user: { did: 'browser-fixture-owner', fullName: 'Browser Owner', role: 'owner' },
                  node: { address: 'browser-fixture-node', chainId: 'beta', cacheKey: 'fixture-scope' },
                },
        });
        return;
      }
      await pending;
      if (scenario === 'new-node' && pathname === '/api/stake/state') {
        await route.fulfill({ status: 404, json: { message: 'No stake record' } });
        return;
      }
      const data =
        pathname === '/api/account/state'
          ? {
              address: 'browser-fixture-node',
              moniker: 'DIDMail Server',
              tokens: [],
              balance: '0',
              chainId: 'beta',
              chainStatus:
                scenario === 'chain-unavailable' ? 'unavailable' : scenario === 'new-node' ? 'unregistered' : 'ready',
            }
          : pathname === '/api/stake/state'
            ? { staked: false, ownerAssets: [], tokens: [], revokedTokens: [] }
            : pathname === '/api/forge/state'
              ? { token: { symbol: 'TBA', unit: 18 } }
              : {};
      await route.fulfill({ json: data });
    });
    try {
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      const header = page.locator('header.aup-app-header');
      await header.waitFor();
      assert.equal(await page.locator('header').count(), 1);
      assert.equal(await page.locator('#app header').count(), 0);
      assert.equal(
        await header.locator('img.aup-app-header-logo').evaluate((img) => img.complete && img.naturalWidth > 0),
        true,
      );
      assert.equal(await header.getByRole('link', { name: 'Admin', exact: true }).getAttribute('href'), '/admin');
      if (scenario === 'anonymous') {
        await header.getByRole('button', { name: 'Login', exact: true }).waitFor();
      } else {
        await header.getByRole('button', { name: 'Browser Owner', exact: true }).click();
        await header.getByRole('menuitem', { name: 'Admin Console', exact: true }).waitFor();
        await header.getByRole('menuitem', { name: 'Sign Out', exact: true }).waitFor();
        await header.getByRole('button', { name: 'Browser Owner', exact: true }).click();
      }
      await header.getByRole('link', { name: 'Admin', exact: true }).click();
      assert.equal(await page.locator('header').count(), 1);
      assert.match(new URL(page.url()).pathname, /^\/admin\/?$/);
      if (scenario === 'anonymous') {
        const login = page.getByRole('link', { name: 'Sign in with ARC', exact: true });
        await login.waitFor();
        const returnTo = new URL(page.url()).pathname;
        for (const colorScheme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme });
          await page.evaluate((mode) => localStorage.setItem('web-mode', mode), colorScheme);
          await page.reload();
          await login.waitFor();
          assert.equal(await page.locator('html').getAttribute('data-mode'), colorScheme);
          await page.mouse.move(0, 0);
          await login.evaluate((el) => el.blur());
          for (const state of ['normal', 'hover', 'focus']) {
            if (state === 'hover') await login.hover();
            if (state === 'focus') {
              await page.mouse.move(0, 0);
              await login.focus();
            }
            const colors = await login.evaluate((el) => ({
              text: getComputedStyle(el).color,
              background: getComputedStyle(el).backgroundColor,
            }));
            assert.equal(colors.text, colorScheme === 'dark' ? 'rgb(32, 32, 32)' : 'rgb(255, 255, 255)', `${colorScheme}/${state}: login label must use the theme foreground`);
            const luminance = (rgb) =>
              rgb
                .match(/[\d.]+/g)
                .slice(0, 3)
                .map(Number)
                .map((value) => {
                  const channel = value / 255;
                  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
                })
                .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
            const foreground = luminance(colors.text), background = luminance(colors.background);
            const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
            assert.ok(contrast >= 4.5, `${colorScheme}/${state}: login text contrast ${contrast}`);
          }
          await page.screenshot({ path: `.data/screenshots/login-${colorScheme}.png`, fullPage: true });
        }
        await page.route('**/.well-known/service/login?**', (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<title>ARC login destination fixture</title>',
          }),
        );
        await login.click();
        assert.equal(new URL(page.url()).pathname, '/.well-known/service/login');
        assert.equal(new URL(page.url()).searchParams.get('return_to'), returnTo);
      } else {
        await page.getByRole('status', { name: 'Loading node NFTs…', exact: true }).waitFor();
        assert.equal(await page.getByText('出错了！', { exact: true }).count(), 0);
        if (scenario === 'delayed-stake')
          await page.screenshot({ path: '.data/screenshots/admin-pending.png', fullPage: true });
        release();
        await page.getByText('No staked node NFTs yet', { exact: true }).waitFor();
        assert.equal(await page.getByText('出错了！', { exact: true }).count(), 0);
        assert.equal(await page.locator('[data-account]').count(), 0);
        await page.locator('header [data-node-recharge]').click();
        await page.locator('[data-wallet-recharge] .dm-account-recharge > svg').waitFor();
        assert.match(new URL(page.url()).pathname, /^\/admin(?:\/|-)account\/?$/);
        const recharge = page.locator('[data-wallet-recharge]');
        assert.equal(await recharge.locator('[data-did-copy="did:abt:browser-fixture-node"]').count(), 1);
        await recharge.locator('[data-did-show="did:abt:browser-fixture-node"]').first().click();
        await page.locator('dialog[open]').getByText('did:abt:browser-fixture-node', { exact: true }).waitFor();
        await page.locator('[data-identity-close]').click();
        assert.equal(await page.locator('[data-wallet-recharge] .dm-account-recharge > svg').count(), 1);
        await page.locator('[data-wallet-recharge] dd').getByText('beta', { exact: true }).waitFor();
        assert.equal(await page.locator('dialog[open]').count(), 0);
        if (scenario === 'chain-unavailable') {
          assert.equal(await page.locator('[data-account] .dm-metrics [aria-label="Unavailable"]').count(), 1);
          assert.equal(await page.locator('[data-account]').getByText('NO BALANCE', { exact: true }).count(), 0);
        }
        if (scenario === 'new-node') {
          await page.screenshot({ path: '.data/screenshots/admin-loaded.png', fullPage: true });
          await page.setViewportSize({ width: 390, height: 844 });
          await header.getByRole('link', { name: 'Admin', exact: true }).waitFor();
          assert.equal(await header.evaluate((el) => el.scrollWidth <= window.innerWidth), true);
          await page.screenshot({ path: '.data/screenshots/admin-mobile.png', fullPage: true });
        }
      }
      assert.deepEqual(failures, []);
      console.log(`PASS Chromium ARC admin: ${scenario}`);
    } catch (error) {
      await fs.writeFile(
        '.data/browser-admin-failure.json',
        JSON.stringify({ scenario, ...(await diagnostics()) }, null, 2),
      );
      throw error;
    } finally {
      release();
      await context.close();
    }
  }
} finally {
  await browser.close();
}
