// Current native ARC artifacts only. The fixture rejects all business writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { appearanceFixture } from './ui-appearance-fixture.mjs';
const output = path.resolve(process.env.DIDMAIL_BRAND_ARTIFACTS || '../artifacts/brand-client-alignment/server');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(theme => { if (!sessionStorage.getItem('brand-seeded')) { localStorage.setItem('web-mode', theme); sessionStorage.setItem('brand-seeded', 'true'); } }, theme);
    const { origin, state } = await appearanceFixture(context);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const locale of ['en', 'zh', 'ar']) for (const [width, height] of [[1440, 1000], [1024, 768], [390, 844], [1440, 500]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/${locale}/`, { waitUntil: 'networkidle' });
      const layout = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        const headerTitle = document.querySelector('.aup-app-header-title');
        const divider = getComputedStyle(document.querySelector('.dm-home-hero'), '::after');
        return { artwork: rect('.dm-home-emblem'), brand: rect('.dm-home-brand'), copy: rect('.dm-home-hero-copy'), rtl: document.documentElement.dir === 'rtl', titleWidth: headerTitle.getBoundingClientRect().width, divider: { content: divider.content, width: divider.width, left: divider.left, gradient: divider.backgroundImage } };
      });
      assert.ok(Math.abs(layout.artwork.x + layout.artwork.width / 2 - width * (width >= 1024 ? (layout.rtl ? .75 : .25) : .5)) < 1);
      if (width >= 1024) {
        assert.ok(Math.abs(layout.copy.x + layout.copy.width / 2 - width * (layout.rtl ? .25 : .75)) < 1);
        assert.ok(Math.abs(layout.brand.y + layout.brand.height / 2 - layout.copy.y - layout.copy.height / 2) < 1);
        assert.equal(layout.divider.width, '1px');
        assert.ok(layout.divider.gradient.includes('linear-gradient'));
        assert.ok(Math.abs(parseFloat(layout.divider.left) - width / 2) < 1);
      } else assert.equal(layout.divider.content, 'none');
      assert.ok(layout.titleWidth <= 1, 'No redundant visible header wordmark');
      assert.equal(await page.getByRole('heading', { name: 'DIDMail', exact: true }).count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(output, `home-${locale}-${width}x${height}-${theme}.png`), fullPage: true });
      results.push({ theme, locale, width, height, layout });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin + '/admin/attachment', { waitUntil: 'networkidle' });
    await page.locator('[data-workspace]:not([hidden])').waitFor();
    const fields = page.locator('.dm-app input:not([type="checkbox"]):not([type="file"]):not(:disabled), .dm-app select:not(:disabled), .dm-app textarea:not(:disabled)');
    let count = 0;
    for (const field of await fields.all()) {
      if (!await field.isVisible()) continue;
      const measure = element => { const s = getComputedStyle(element), r = element.getBoundingClientRect(); return { border: s.borderTopWidth, color: s.borderTopColor, weight: s.fontWeight, outline: s.outlineStyle, shadow: s.boxShadow, width: r.width, height: r.height }; };
      await field.evaluate(element => element.blur());
      const before = await field.evaluate(measure);
      await field.focus();
      const after = await field.evaluate(measure);
      for (const property of ['border', 'weight', 'width', 'height']) assert.equal(after[property], before[property]);
      assert.equal(after.outline, 'none'); assert.equal(after.shadow, 'none');
      const rgb = after.color.match(/[\d.]+/g).slice(0, 3); assert.equal(rgb[0], rgb[1]); assert.equal(rgb[1], rgb[2]);
      results.push({ theme, focus: { before, after } }); count++;
    }
    assert.ok(count > 0);
    await page.screenshot({ path: path.join(output, `admin-focus-${theme}.png`), fullPage: true });
    assert.deepEqual(errors, []); assert.deepEqual(state.writes, []); assert.deepEqual(state.failures, []);
    await context.close();
  }
  await fs.writeFile(path.join(output, 'layout-focus-results.json'), JSON.stringify({ browser: browser.version(), results }, null, 2));
  console.log(`PASS ${results.length} native ARC layout/focus observations; no mutations or runtime errors.`);
} finally { await browser.close(); }
