// Real native-artifact playback; fixtures reject every business mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { appearanceFixture } from './ui-appearance-fixture.mjs';
const output = path.resolve(process.env.DIDMAIL_MOTION_ARTIFACTS || '../artifacts/brand-space-2026-11-01/server');
await fs.mkdir(path.join(output, 'videos'), { recursive: true });
const browser = await chromium.launch({ headless: process.env.DIDMAIL_MOTION_HEADFUL !== '1', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
async function run(name, options, callback) {
  if (process.env.DIDMAIL_MOTION_SCENARIO && !name.includes(process.env.DIDMAIL_MOTION_SCENARIO)) return;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...options });
  await context.addInitScript(value => { if (!sessionStorage.getItem('brand-seeded')) { localStorage.setItem('web-mode', value); sessionStorage.setItem('brand-seeded', 'true'); } }, options.colorScheme || 'dark');
  const fixture = await appearanceFixture(context), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await context.addInitScript(() => {
    window.__brandAnimations = []; window.__brandPaints = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.matches('.dm-home-emblem')) window.__brandAnimations.push(animation);
      return animation;
    };
    const frame = () => {
      const emblem = document.querySelector('.dm-home-emblem');
      if (emblem) window.__brandPaints.push({ opacity: Number(getComputedStyle(emblem).opacity), phase: emblem.dataset.brandMotion || document.documentElement.dataset.didmailBrandEntrance });
      if (window.__brandPaints.length < 100) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  try {
    await callback({ ...fixture, page, context });
    assert.deepEqual(errors, [], name + ': runtime errors');
    assert.deepEqual(fixture.state.writes, [], name + ': no mutations');
    assert.deepEqual(fixture.state.failures, [], name + ': no unknown requests');
    results.push({ name, result: 'passed' }); console.log('PASS motion: ' + name);
  } catch (error) {
    await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ name, error: error.stack || error.message, closed: page.isClosed(), url: page.url(), errors, state: fixture.state }, null, 2));
    if (!page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    const video = page.video(); await context.close();
    if (video) await fs.rename(await video.path(), path.join(output, 'videos', name.startsWith('desktop') ? 'home-1440-cycle.webm' : name.startsWith('light') ? 'home-390-light.webm' : 'home-390-dark.webm'));
  }
}
async function phase(page, expected) {
  await page.waitForFunction(value => document.querySelector('.dm-home-emblem')?.dataset.brandMotion === value, expected);
}
async function active(page) {
  return page.evaluate(() => {
    const animation = document.querySelector('.dm-home-emblem').getAnimations()[0];
    return animation && { id: animation.id, time: animation.currentTime, state: animation.playState, duration: animation.effect.getTiming().duration, count: window.__brandAnimations.length };
  });
}
async function assertPaused(page, why) {
  await page.waitForFunction(() => document.querySelector('.dm-home-emblem').getAnimations()[0]?.playState === 'paused', undefined, { polling: 50 });
  await page.locator('.dm-home-emblem').evaluate(async el => { await el.getAnimations()[0].ready; });
  const before = await active(page); await page.waitForTimeout(220); const after = await active(page);
  assert.ok(Math.abs(after.time - before.time) < 1, why + ': timeline preserved ' + JSON.stringify({ before, after }));
  assert.equal(after.count, before.count); return after;
}
try {
  for (const colorScheme of ['light', 'dark']) await run(`${colorScheme}: entry, full breath, viewport/document pause, theme and live reduce`, { colorScheme, recordVideo: { dir: path.join(output, 'videos'), size: { width: 390, height: 844 } } }, async ({ page, context, origin }) => {
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' }); await page.locator('[data-brand-motion-ready]').waitFor();
    await page.waitForFunction(() => window.__brandAnimations.length > 0);
    const first = await page.evaluate(() => {
      const animation = window.__brandAnimations[0];
      return { id: animation?.id, frames: animation?.effect.getKeyframes(), duration: animation?.effect.getTiming().duration, actions: [...document.querySelectorAll('.dm-home-actions a')].map(el => ({ opacity: getComputedStyle(el).opacity, href: el.href, pointer: getComputedStyle(el).pointerEvents })) };
    });
    assert.equal(first.id, 'didmail-brand-entrance'); assert.equal(first.duration, 1800);
    assert.equal(first.frames[0].transform, 'scale(0.76)'); assert.equal(first.frames[0].opacity, '0');
    assert.equal(first.frames.at(-1).transform, 'translateY(0px) scale(1)');
    assert.ok(first.actions.every(action => action.opacity === '1' && action.pointer !== 'none'));
    await phase(page, 'floating');
    await page.screenshot({ path: path.join(output, `home-390-${colorScheme}.png`), fullPage: true });
    const breath = await active(page);
    assert.equal(breath.id, 'didmail-brand-float'); assert.equal(breath.duration, 12000); assert.equal(breath.count, 2);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.dm-home-hero').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(8, 8, 8)');
    assert.equal(await page.locator('.aup-app-header').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(8, 8, 8)');
    const cycle = await page.evaluate(async () => {
      const emblem = document.querySelector('.dm-home-emblem'), title = document.querySelector('.dm-home-brand h1');
      const samples = [], start = performance.now();
      while (performance.now() - start < 12350) {
        samples.push({ elapsed: performance.now() - start, y: new DOMMatrixReadOnly(getComputedStyle(emblem).transform).f, scale: new DOMMatrixReadOnly(getComputedStyle(emblem).transform).a, opacity: Number(getComputedStyle(emblem).opacity), titleY: title.getBoundingClientRect().y });
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      return samples;
    });
    assert.ok(cycle.length > 20 && cycle.some(sample => sample.scale > 1.099), 'Actual playback reaches breathing peak');
    assert.ok(cycle.every(sample => sample.scale >= 0.9999 && sample.scale <= 1.1001 && sample.opacity === 1 && Math.abs(sample.titleY - cycle[0].titleY) < 0.01), 'Breath stays bounded and text stays still');
    await fs.writeFile(path.join(output, `cycle-${colorScheme}.json`), JSON.stringify(cycle, null, 2));
    const turnaround = await page.locator('.dm-home-emblem').evaluate(async element => {
      const animation = element.getAnimations()[0], originalTime = animation.currentTime;
      animation.pause(); await animation.ready;
      const values = [];
      for (const time of [5900, 6000, 6100]) {
        animation.currentTime = time;
        await new Promise(requestAnimationFrame);
        values.push(new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
      }
      animation.currentTime = originalTime; animation.play();
      return { values, frames: animation.effect.getKeyframes().map(frame => frame.easing), overall: animation.effect.getTiming().easing };
    });
    assert.equal(turnaround.overall, 'linear');
    assert.deepEqual(turnaround.frames.slice(0, 2), ['ease-in-out', 'ease-in-out']);
    assert.ok(turnaround.values[1] - turnaround.values[0] < 0.0003 && turnaround.values[1] - turnaround.values[2] < 0.0003, 'Breath decelerates to a stationary midpoint turnaround');
    await fs.writeFile(path.join(output, `turnaround-${colorScheme}.json`), JSON.stringify(turnaround, null, 2));
    const paints = await page.evaluate(() => window.__brandPaints);
    assert.ok(paints.length > 20 && paints[0].opacity < 0.95, 'First visible paint begins guarded, never visible then hidden');
    for (let index = 1; index < paints.length; index++) assert.ok(paints[index].opacity + 0.01 >= paints[index - 1].opacity, 'No visible→hidden logo flash');
    await fs.writeFile(path.join(output, `first-paint-${colorScheme}.json`), JSON.stringify(paints, null, 2));
    assert.equal(await page.locator('.dm-home-hero-copy').evaluate(el => el.getAnimations({ subtree: true }).length), 0, 'Text/actions stay stable');
    assert.equal(await page.locator('.aup-app-header-brand').evaluate(el => el.getAnimations({ subtree: true }).length), 0, 'Tiny header brand remains static');
    await page.locator('.dm-home-features').scrollIntoViewIfNeeded(); const viewportPause = await assertPaused(page, 'Out of viewport');
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForFunction(() => document.querySelector('.dm-home-emblem').getAnimations()[0]?.playState === 'running');
    await page.waitForTimeout(120); assert.ok((await active(page)).time > viewportPause.time + 50, 'Viewport resume advances the same timeline');
    await page.evaluate(() => {
      const dialog = document.createElement('dialog');
      dialog.id = 'brand-test-cover';
      dialog.textContent = 'Isolated modal coverage';
      document.body.append(dialog); dialog.showModal();
    });
    const coveredPause = await assertPaused(page, 'Real native modal coverage');
    await page.evaluate(() => document.querySelector('#brand-test-cover').remove());
    await page.waitForFunction(() => document.querySelector('.dm-home-emblem').getAnimations()[0]?.playState === 'running');
    await page.waitForTimeout(120);
    assert.ok((await active(page)).time > coveredPause.time + 50, 'Uncover resumes the same timeline');
    const count = await page.evaluate(() => window.__brandAnimations.length);
    // Hit-test the real download action without leaving the safe fixture.
    await page.locator('.dm-home-actions a').first().click({ trial: true });
    // This host keeps document.visible under native minimization. Exercise the
    // visibility-event handler explicitly; viewport suspension above is real.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hiddenPause = await assertPaused(page, 'Simulated document visibility event');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => !document.hidden); await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => document.querySelector('.dm-home-emblem').getAnimations()[0]?.playState === 'running');
    await page.waitForTimeout(120); assert.ok((await active(page)).time > hiddenPause.time + 50, 'Document resume advances the same timeline');
    await page.evaluate(mode => window.didmailTheme.choose(mode), colorScheme === 'light' ? 'dark' : 'light');
    await page.locator('.dm-home-actions a').first().focus();
    assert.equal(await page.evaluate(() => window.__brandAnimations.length), count, 'Theme/focus/visibility resume do not recreate entrance');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await phase(page, 'static');
    assert.equal(await page.locator('.dm-home-emblem').evaluate(el => el.getAnimations().length), 0);
    assert.equal(await page.locator('.dm-home-light').evaluate(el => el.getAnimations().length), 0);
    assert.equal(await page.locator('.dm-home-emblem').evaluate(el => getComputedStyle(el).opacity), '1');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await phase(page, 'floating');
    assert.equal((await active(page)).id, 'didmail-brand-float');
    assert.equal(await page.evaluate(() => window.__brandAnimations.filter(animation => animation.id === 'didmail-brand-entrance').length), 1);
    assert.equal(context.pages().length, 1, 'No external destination opened');
    await page.goto(origin + '/help', { waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => localStorage.getItem('web-mode')), colorScheme === 'light' ? 'dark' : 'light');
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), colorScheme === 'light' ? 'rgb(17, 17, 17)' : 'rgb(242, 242, 242)');
    assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.id.startsWith('didmail-brand')).length), 0, 'No welcome animation survives route removal');
  });
  await run('initial reduced motion re-enables breathing without entrance', { colorScheme: 'dark', reducedMotion: 'reduce' }, async ({ page, origin }) => {
    await page.goto(origin + '/', { waitUntil: 'networkidle' }); await phase(page, 'static');
    assert.equal(await page.evaluate(() => window.__brandAnimations.length), 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await phase(page, 'floating');
    assert.equal((await active(page)).id, 'didmail-brand-float');
    assert.equal(await page.evaluate(() => window.__brandAnimations.some(animation => animation.id === 'didmail-brand-entrance')), false);
  });
  await run('delayed module first paint and static fallback do not replay entrance', { colorScheme: 'light' }, async ({ page, context, origin }) => {
    await context.route('**/*.js', async route => { await new Promise(resolve => setTimeout(resolve, 1400)); await route.fallback(); });
    await page.goto(origin + '/', { waitUntil: 'networkidle' }); await phase(page, 'static');
    assert.equal(await page.evaluate(() => window.__brandAnimations.length), 0);
    const paints = await page.evaluate(() => window.__brandPaints);
    assert.equal(paints[0].opacity, 0); assert.ok(paints.some(frame => frame.opacity === 1));
    for (let index = 1; index < paints.length; index++) assert.ok(paints[index].opacity >= paints[index - 1].opacity);
    await fs.writeFile(path.join(output, 'delayed-module-first-paint.json'), JSON.stringify(paints, null, 2));
  });
  await run('slow original image consumes entrance without delaying actions', { colorScheme: 'light' }, async ({ page, context, origin }) => {
    const html = await fs.readFile('dist/en/index.html', 'utf8');
    const original = await fs.readFile('public/images/dove.svg');
    const prepared = html.replace(/(class="dm-home-emblem"><img src=")[^"]+/, '$1/motion-original-dove.svg');
    assert.notEqual(prepared, html);
    await context.route(origin + '/', route => route.fulfill({ contentType: 'text/html', body: prepared }));
    await context.route('**/motion-original-dove.svg', async route => { await new Promise(resolve => setTimeout(resolve, 1400)); await route.fulfill({ contentType: 'image/svg+xml', body: original }); });
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('.dm-home-actions a').first().evaluate(el => getComputedStyle(el).opacity), '1');
    await page.locator('.dm-home-emblem img').evaluate(image => image.decode()); await phase(page, 'static');
    assert.equal(await page.evaluate(() => window.__brandAnimations.length), 0, 'Late original image stays static, no half-breath entrance');
  });
  for (const colorScheme of ['light', 'dark']) await run(`layout, links and accessible brand: ${colorScheme}`, { colorScheme, reducedMotion: 'reduce' }, async ({ page, origin }) => {
    for (const [width, height] of [[320, 900], [390, 844], [1024, 768], [1440, 1000], [2560, 1280], [1440, 500], [390, 480]]) {
      await page.setViewportSize({ width, height }); await page.goto(origin + '/', { waitUntil: 'networkidle' });
      await page.screenshot({ path: path.join(output, `home-${width}x${height}-${colorScheme}.png`), fullPage: true });
      const box = await page.locator('.dm-home-emblem').boundingBox(), name = await page.getByRole('heading', { name: 'DIDMail', exact: true }).boundingBox();
      const ink = await page.locator('.dm-home-emblem img').evaluate(async image => {
        await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = 1026; canvas.height = 1026;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 1026, 1026);
        const pixels = ctx.getImageData(0, 0, 1026, 1026).data;
        let left = 1026, right = 0, top = 1026, bottom = 0;
        for (let y = 0; y < 1026; y++) for (let x = 0; x < 1026; x++) if (pixels[(y * 1026 + x) * 4 + 3] > 16) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        return { left, right, top, bottom, visibleWidth: (right - left + 1) / 1026 * image.getBoundingClientRect().width };
      });
      assert.ok(ink.visibleWidth >= (width > 760 ? 280 : 180), 'The visible dove itself is prominent');
      await fs.writeFile(path.join(output, `ink-${width}x${height}-${colorScheme}.json`), JSON.stringify(ink, null, 2));
      assert.ok(Math.abs(box.x + box.width / 2 - width * (width >= 1024 ? 0.25 : 0.5)) < 1, 'Artwork centered within its full-page half');
      const scene = await page.locator('.dm-home-hero').evaluate(el => ({ divider: getComputedStyle(el, '::after').content, width: getComputedStyle(el, '::after').width, gradient: getComputedStyle(el, '::after').backgroundImage }));
      if (width >= 1024) {
        const brand = await page.locator('.dm-home-brand').boundingBox(), copy = await page.locator('.dm-home-hero-copy').boundingBox();
        assert.ok(Math.abs(copy.x + copy.width / 2 - width * .75) < 1, 'Entry actions centered within right half');
        assert.ok(Math.abs(brand.y + brand.height / 2 - copy.y - copy.height / 2) < 1, 'Brand and actions vertically centered');
        assert.equal(scene.width, '1px'); assert.ok(scene.gradient.includes('linear-gradient'));
      } else assert.equal(scene.divider, 'none');
      assert.ok(name.y >= box.y + box.height, 'Product name below original artwork');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.equal(await page.locator('.aup-app-header').getByRole('link', { name: 'DIDMail Server home', exact: true }).count(), 1);
      assert.ok((await page.locator('.aup-app-header-brand').boundingBox()).width >= 28);
      const actions = page.locator('.dm-home-actions a');
      assert.match(await actions.nth(0).getAttribute('href'), /^https:\/\/chromewebstore\.google\.com\//);
      assert.equal(await actions.nth(1).getAttribute('href'), 'https://www.arcblock.io/en/docs/arc-cli/install/');
      await actions.first().focus(); assert.equal(await actions.first().evaluate(el => el === document.activeElement), true);
    }
    for (const locale of ['en', 'zh', 'ja', 'ru', 'ar']) {
      await page.setViewportSize({ width: 320, height: 900 }); await page.goto(`${origin}/${locale}/`, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, locale + ': enlarged overflow');
      await page.screenshot({ path: path.join(output, `home-${locale}-320-text200-${colorScheme}.png`), fullPage: true });
    }
  });
  await run('desktop full space cycle under 4x CPU throttle', { colorScheme: 'light', viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false, recordVideo: { dir: path.join(output, 'videos'), size: { width: 1440, height: 1000 } } }, async ({ page, context, origin }) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    // Slow enhancement may legitimately fall back to a visible static entrance.
    await page.waitForFunction(() => ['floating', 'static'].includes(document.querySelector('.dm-home-emblem')?.dataset.brandMotion));
    if (await page.locator('.dm-home-emblem').getAttribute('data-brand-motion') === 'static') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await phase(page, 'floating');
    }
    const samples = await page.evaluate(async () => {
      const mark = document.querySelector('.dm-home-emblem');
      const title = document.querySelector('.dm-home-hero-copy');
      const light = document.querySelector('.dm-home-light');
      const start = performance.now(), samples = [];
      while (performance.now() - start < 24700) {
        const pose = new DOMMatrixReadOnly(getComputedStyle(mark).transform);
        samples.push({ time: performance.now() - start, scale: pose.a, y: pose.f, titleY: title.getBoundingClientRect().y, lightTime: light.getAnimations()[0]?.currentTime });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return samples;
    });
    assert.ok(samples.at(-1).lightTime - samples[0].lightTime > 24000, 'Real playback includes a complete environment cycle');
    assert.ok(Math.max(...samples.map(sample => sample.scale)) > 1.099);
    assert.ok(Math.min(...samples.map(sample => sample.y)) < -23.8);
    assert.ok(samples.every(sample => Math.abs(sample.titleY - samples[0].titleY) < 0.1));
    const titleBox = await page.locator('.dm-home-brand h1').boundingBox();
    const markBox = await page.locator('.dm-home-emblem').boundingBox();
    assert.ok(markBox.y + markBox.height < titleBox.y, 'Movement envelope clears the stable title');
    const lightBox = await page.locator('.dm-home-light').boundingBox();
    assert.ok(lightBox.width > markBox.width * 3 && lightBox.height > markBox.height * 2, 'Ambient extent belongs to the page');
    await fs.writeFile(path.join(output, 'desktop-throttled-cycle.json'), JSON.stringify({ cpuThrottle: 4, samples, browser: browser.version() }, null, 2));
    await page.screenshot({ path: path.join(output, 'home-1440-playback.png') });
    await cdp.detach();
  });
  await run('no JavaScript retains static original artwork and usable entrances', { javaScriptEnabled: false, reducedMotion: 'no-preference' }, async ({ page, origin }) => {
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.dm-home-emblem').evaluate(el => getComputedStyle(el).opacity), '1');
    assert.equal(await page.locator('.dm-home-emblem').evaluate(el => getComputedStyle(el).transform), 'none');
    assert.equal(await page.locator('.dm-home-actions a').count(), 2);
    assert.equal(await page.locator('.aup-app-header').getByRole('link', { name: 'DIDMail Server', exact: true }).count(), 1);
  });
  await fs.writeFile(path.join(output, 'motion-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(`Motion scenarios: ${results.length} passed. Real Chromium playback; all business writes blocked.`);
} finally { await browser.close(); }
