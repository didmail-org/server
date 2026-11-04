// End-to-end UI regression on real ARC HTML. Every business/chain API is intercepted;
// no real purchase, stake, publish or deletion can leave the isolated browser context.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserDiagnostics } from './browser-diagnostics.mjs';
import { isolateBrowserResources } from './browser-isolation.mjs';
import { languages, messages, localeDirection, localizedPath } from '../ui/locales.js';
import { adminTranslator } from '../ui/admin-i18n.js';
const theme = process.env.DIDMAIL_BROWSER_THEME || 'light';
const origin = process.env.DIDMAIL_BROWSER_URL || 'http://didmail-server.localhost:8788';
async function openMailDetails(page) {
  const toggle=page.locator('[data-action="storage-details"]').first();
  await toggle.waitFor();
  if(await toggle.getAttribute('aria-expanded')==='false') await toggle.click();
}
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const token = { symbol: 'TBA', decimal: 18, value: '1000000000000000000' };
const asset = { address: 'test-node-nft', data: { value: JSON.stringify({ endpoint: origin, location: 'AS-CN-SH' }) } };
const factory = {
  name: 'Test Factory',
  address: 'test-factory',
  description: 'Factory fixture',
  token,
  price: '1 TBA',
  limit: '∞',
  minted: 1,
  owner: 'test-owner',
};
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><text>{{mail.subject}} {{mail.sender}} {{namecard.name}}</text></svg>';
let count = 0;
async function scenario(name, run, { role = 'owner' } = {}) {
  if (process.env.DIDMAIL_BROWSER_SCENARIO && !name.includes(process.env.DIDMAIL_BROWSER_SCENARIO)) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((mode) => {
    if (!localStorage.getItem('web-mode')) localStorage.setItem('web-mode', mode);
  }, theme);
  await isolateBrowserResources(context);
  const page = await context.newPage();
  const diagnostics = browserDiagnostics(page);
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(12000);
  const errors = [],
    mutations = [],
    reads = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const releases = [];
  const state = {
    gates: {},
    stake: { staked: false, ownerAssets: [], assets: [], tokens: [], revokedTokens: [], revokedAssets: [] },
    items: [],
    failPublish: false,
    failDelete: false,
    mails: [
      {
        id: 7,
        storageKey: 'legacy:7',
        sender: 'sender-did',
        receiver: 'receiver-did',
        envelope: 'envelope-did',
        asset: 'mail-nft',
        hash: 'content-hash',
        payment: '1234567890123456789',
        createdAt: '2026-10-24T00:00:00Z',
        size: 1024,
      },
    ],
    policy: { maxFileSizeBytes: 10485760, maxFileCount: 5, pricePerBytePerDay: '9007199254740993' },
  };
  const delay = (path) => {
    let release;
    state.gates[path] = new Promise((resolve) => {
      release = resolve;
    });
    const unblock = () => {
      delete state.gates[path];
      release();
    };
    releases.push(unblock);
    return unblock;
  };
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const json = (data, status = 200) => route.fulfill({ status, json: data });
    if (path === '/api/runtime/session' || path === '/.well-known/service/api/did/session') {
      if (state.gates[path]) await state.gates[path];
      state.sessionCalls = (state.sessionCalls || 0) + 1;
      return json({
        authenticated: (state.role || role) !== 'anonymous',
        user:
          (state.role || role) === 'anonymous'
            ? null
            : { did: state.userDid || 'ui-test-user', role: state.role || role, fullName: 'UI Test Owner' },
        node: {
          address: state.nodeDid || 'test-node-did',
          chainId: state.chainId || 'beta',
          tokenId: 'test-token',
          cacheKey: 'fixture-' + (state.chainId || 'beta'),
        },
      });
    }
    if (req.method() !== 'GET') {
      let body;
      try {
        body = req.postDataJSON();
      } catch {
        body = req.postData();
      }
      mutations.push({ path, method: req.method(), body });
      if (state.gates[path]) await state.gates[path];
      if (path === '/api/account/gas-stake/revoke') {
        state.gasEligible = false;
        state.gasWithdrawals = [
          { evidence: 'A'.repeat(64), amount: token.value, availableAt: '2099-01-01T00:00:00Z', claimable: false },
        ];
        return json({ hash: 'test-gas-revoke-hash', address: 'test-self-stake-address' });
      }
      if (path === '/api/account/gas-stake/claim') {
        if (state.gasClaimFailure) return json({ message: 'The gas stake waiting period has not ended.' }, 409);
        state.gasWithdrawals = [];
        return json({ hash: 'test-gas-claim-hash', address: 'test-self-stake-address' });
      }
      if (path === '/api/account/gas-stake') {
        if (state.gasRuleChanged)
          return json({ message: 'Gas staking rules changed. Review the latest terms before submitting.' }, 409);
        state.gasEligible = true;
        return json({ hash: 'test-gas-stake-hash', address: 'test-self-stake-address' });
      }
      if (path === '/api/account/transfer') {
        if (state.transferFailure) return json({ message: 'Insufficient available balance.' }, 402);
        return json({ hash: 'test-transfer-hash', recipient: 'test-owner-did', amount: body.amount, token: 'TBA' });
      }
      if (path === '/api/servers/acquire') {
        state.stake.ownerAssets = [asset];
        return json({ hash: 'test-acquire' });
      }
      if (path === '/api/stake/asset') {
        state.stake = { ...state.stake, staked: true, assets: [asset.address], tokens: [token] };
        return json({ message: 'staked' });
      }
      if (path === '/api/stake/add') return json({ hash: 'test-add' });
      if (path === '/api/stake/revoke') {
        state.stake = {
          ...state.stake,
          staked: false,
          assets: [],
          tokens: [],
          revokedAssets: [asset.address],
          revokedTokens: [token],
        };
        return json({ hash: 'test-revoke' });
      }
      if (path === '/api/stake/claim') {
        state.stake = { ...state.stake, revokedAssets: [], revokedTokens: [] };
        return json({ hash: 'test-claim' });
      }
      if (path === '/api/stake/update-endpoint') {
        state.stake.ownerAssets = [asset];
        return json({ hash: 'test-endpoint' });
      }
      if (path === '/api/admin/attachment-config') {
        state.policy = body;
        return json(body);
      }
      if (/\/api\/(envelope|namecard)\/acquire$/.test(path)) {
        if (state.failAcquire) return json({ message: 'Factory temporarily unavailable' }, 503);
        state.items = [
          {
            name: 'UI Test Template',
            address: 'template-nft',
            price: /name="category"\r?\n\r?\nmembers/.test(String(body))?'0':'0.001',
            category: /name="category"\r?\n\r?\nmembers/.test(String(body))?'members':'public',
            token,
            display: svg,
            description: 'Test description',
            retentionPeriod: '7',
            enabled: false,
          },
        ];
        return json({ asset: 'template-nft' });
      }
      if (path.endsWith('/db/update')) {
        if (state.failPublish) return json({ message: 'Publish denied' }, 500);
        if(body.enabled!==undefined && req.method()!=='PATCH')state.items[0].enabled = body.enabled;
        if(body.category)state.items[0].category=body.category;
        return json({ message: 'Updated successfully' });
      }
      if (path.endsWith('/clean')) return json({ message: 'Cleaned successfully' });
      if (path === '/api/storage/mails/delete/7') {
        if (state.failDelete) return json({ message: 'Delete denied' }, 500);
        state.mails = [];
        return json({ message: 'deleted' });
      }
      return json({ message: 'Unexpected mutation was blocked' }, 400);
    }
    reads.push(url);
    if (state.gates[path]) await state.gates[path];
    if (path === '/api/account/gas-stake') {
      if (state.gasReadFailure) return json({ message: 'Gas staking rules could not be verified.' }, 503);
      return json({
        address: 'test-self-stake-address',
        node: 'test-node-did',
        chainId: 'beta',
        policyId: 'reviewed-gas-policy',
        exitPolicyId: 'reviewed-exit-policy',
        waitingPeriod: 31536000,
        withdrawalWaitingPeriod: 31536000,
        canRevoke: Boolean(state.gasEligible),
        withdrawals: state.gasWithdrawals || [],
        token: { ...token, address: 'test-token' },
        balance: state.gasEmptyBalance ? '0' : '10000000000000000000',
        staked: state.gasEligible ? token.value : '0',
        revoked: state.gasWithdrawals?.length ? token.value : '0',
        eligible: Boolean(state.gasEligible || state.gasWithdrawals?.length),
      });
    }
    if (path === '/api/account/transfer') {
      if (state.quoteFailure) return json({ message: 'Node balance could not be verified.' }, 503);
      return json({
        recipient: state.ownerDid || 'test-owner-did',
        node: 'test-node-did',
        chainId: 'beta',
        token: { ...token, address: 'test-token', value: '10000000000000000000' },
      });
    }
    if (path === '/api/account/state' && state.accountDenied) return json({ message: 'Unauthorized' }, 403);
    if (path === '/api/account/state')
      return json({
        address: state.nodeDid || 'test-node-did',
        moniker: 'DIDMail Server',
        chainId: state.chainId || 'beta',
        chainStatus: state.accountUnavailable ? 'unavailable' : 'ready',
        ...(state.chainError ? { chainError: state.chainError } : {}),
        tokens: Object.hasOwn(state, 'accountTokens') ? state.accountTokens : state.emptyBalance ? [] : [{ ...token, value: state.balance || '100000000000000000000' }],
      });
    if (path === '/api/stake/state' && state.failStake)
      return json({ message: 'ARC OCAP provider is unavailable' }, 503);
    if (path === '/api/stake/state') return json(state.stake);
    if (path === '/api/forge/state')
      return json({ token: { ...token, symbol: state.chainId === 'main' ? 'ABT' : 'TBA' } });
    if (path === '/api/envelope/factory' && state.failEnvelopeFactory)
      return json({ error: 'Factory temporarily unavailable' }, 503);
    if (path === '/api/servers/factory' && url.searchParams.get('refresh') === '1') {
      if (state.failServerFactory) return json({ error: 'Factory temporarily unavailable' }, 503);
      return json({
        ...factory,
        minted: 7,
        updated_at: '2026-10-25T00:00:00Z',
        display:
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 374 130"><rect width="374" height="130" fill="#222"/><text x="12" y="60" fill="white">Server Node {{ctx.id}}</text></svg>',
      });
    }
    if (path.endsWith('/factory')) return json(factory);
    if (path === '/api/admin/attachment-config') return json(state.policy);
    if (path === '/api/storage/size') return json({ size: '1 KB' });
    if (path === '/api/storage/mails')
      return json({ mails: state.mails, total: state.mails.length, totalPages: state.mails.length ? 2 : 0 });
    if (/\/api\/(envelope|namecard)\/list$/.test(path)) {
      const kind = path.split('/')[2];
      return json({
        [kind === 'envelope' ? 'envelopes' : 'namecards']: state.items,
        cache: {
          source: url.searchParams.get('refresh') === '1' ? 'chain' : 'cache',
          syncedAt: '2026-10-24T00:00:00Z',
          syncError: Boolean(state.listSyncError),
        },
        paging: {
          cursor: url.searchParams.get('cursor') || '0',
          next: url.searchParams.get('cursor') !== '1',
          total: 20,
        },
      });
    }
    if (path === '/api/display') return route.fulfill({ contentType: 'image/svg+xml', body: svg });
    return json({ message: 'Unexpected API read was blocked' }, 404);
  });
  try {
    await run({ page, state, mutations, reads, delay });
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('#app').count(), 0, 'React root must be absent');
    assert.equal(await page.locator('header').count(), 1);
    count++;
    console.log(`PASS native UI: ${name}`);
  } catch (error) {
    await fs.writeFile(
      '.data/browser-ui-failure.json',
      JSON.stringify({ scenario: name, ...(await diagnostics()) }, null, 2),
    );
    throw error;
  } finally {
    releases.forEach((release) => release());
    await context.close();
  }
}
async function accept(page, name) {
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('button', { name, exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.locator('[data-busy]').waitFor({ state: 'hidden' });
}
try {
  await fs.mkdir('.data/screenshots', { recursive: true });
  await scenario('empty mail search clears the filter and destructive dialogs start on Cancel', async ({ page, state, mutations }) => {
    const stored = state.mails;
    await page.goto(`${origin}/admin/storage`);
    await page.getByRole('heading', { name: 'Mails', exact: true }).waitFor();
    state.mails = [];
    await page.locator('[data-search] input').fill('missing-fixture');
    await page.locator('[data-search]').getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByText('No matching mail.', { exact: true }).waitFor();
    state.mails = stored;
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.locator('[data-storage-row]').waitFor();
    assert.equal(await page.locator('[data-search] input').inputValue(), '');
    assert.equal(await page.locator('[data-search] input').evaluate(el => el === document.activeElement), true);
    await openMailDetails(page);
    await page.getByRole('button', { name: 'Delete mail 7', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Cancel', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await page.locator('[data-busy]').waitFor({ state: 'hidden' });
    assert.equal(mutations.length, 0);
    assert.equal(await page.locator('[data-storage-row]').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Delete mail 7', exact: true }).evaluate(el => el === document.activeElement), true);
    // A confirmed operation must not make Escape confirm the next dialog.
    await page.getByRole('button', { name: 'Delete mail 7', exact: true }).click();
    await accept(page, 'Delete');
    assert.equal(mutations.length, 1);
    state.mails = stored;
    await page.locator('[data-action="storage-refresh"]').click();
    await page.locator('[data-storage-row]').waitFor();
    await openMailDetails(page);
    await page.getByRole('button', { name: 'Delete mail 7', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await page.locator('[data-busy]').waitFor({ state: 'hidden' });
    assert.equal(mutations.length, 1);
    assert.equal(await page.locator('[data-storage-row]').count(), 1);
  });
  await scenario('recharge displays an already qualified DID without duplicating the prefix', async ({ page, state, mutations }) => {
    state.nodeDid = 'did:abt:z1YofskF1rtZ6AHn1iwHZugN2HmSVLpH6cL';
    await page.goto(`${origin}/admin/account`);
    const recharge = page.locator('[data-wallet-recharge]');
    await recharge.locator('[data-did-copy]').waitFor();
    assert.equal(await recharge.locator('[data-did-copy]').getAttribute('data-did-copy'), state.nodeDid);
    await recharge.locator('[data-did-show]').first().click();
    await page.locator('.dm-identity-dialog[open]').getByText(state.nodeDid, { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(mutations.length, 0);
  });
  await scenario('amount precision and DID details preserve original clipboard bytes', async ({page,state,mutations}) => {
    const address = 'z1YofskF1rtZ6AHn1iwHZugN2HmSVLpH6cL';
    state.nodeDid = address;
    state.balance = '3995750800000000000';
    await page.addInitScript(() => {
      window.__copied = [];
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => window.__copied.push(value) } });
    });
    await page.goto(`${origin}/zh/admin/account`);
    await page.locator('[data-node-balance] strong').getByText('3.9958 TBA', {exact:true}).waitFor();
    const identity = page.locator('[data-account] .dm-did');
    await identity.getByText(address, {exact:true}).waitFor();
    await identity.locator('[data-did-copy]').click();
    assert.deepEqual(await page.evaluate(() => window.__copied), [address]);
    await identity.locator('[data-did-show]').first().click();
    const details = page.locator('.dm-identity-dialog[open]');
    await details.getByText(address, {exact:true}).waitFor();
    assert.equal(await details.locator('.dm-identity-qr svg').count(), 1);
    assert.equal(await details.locator('.dm-identity-qr svg path').evaluate(el => getComputedStyle(el).fill), 'rgb(0, 0, 0)');
    await details.getByRole('button', {name:'复制 DID',exact:true}).click();
    assert.deepEqual(await page.evaluate(() => window.__copied), [address,address]);
    await page.keyboard.press('Escape');
    await details.waitFor({state:'hidden'});
    await page.setViewportSize({width:390,height:844});
    await identity.getByRole('button', {name:'DID 二维码',exact:true}).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:`.data/screenshots/did-details-mobile-${theme}.png`,fullPage:false});
    assert.equal(mutations.length,0);
  });
  await scenario(
    'progressive account and factory display before slow stake and forge; reduced motion',
    async ({ page, reads, delay }) => {
      const releaseStake = delay('/api/stake/state');
      const releaseForge = delay('/api/forge/state');
      await page.goto(`${origin}/admin/server`);
      assert.equal(await page.locator('[data-account]').count(), 0);
      await page.getByRole('heading', { name: 'DIDMail Server Node NFT Factory', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
      await page.getByRole('status', { name: 'Loading node NFTs…', exact: true }).waitFor();
      assert.equal(await page.getByText('NO STAKED', { exact: true }).count(), 0);
      assert.equal(reads.filter((url) => url.pathname === '/api/account/state').length, 1);
      assert.equal(reads.filter((url) => url.pathname === '/api/stake/state').length, 1);
      const skeleton = page.locator('.dm-loading-panel .dm-skeleton-line').first();
      assert.equal(await skeleton.evaluate((el) => getComputedStyle(el, '::after').animationName), 'dm-shimmer');
      await page.screenshot({ path: `.data/screenshots/loading-progressive-${theme}.png`, fullPage: true });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await skeleton.evaluate((el) => getComputedStyle(el, '::after').animationName), 'none');
      releaseStake();
      await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
      await page.getByText('No staked node NFTs yet', { exact: true }).waitFor();
      releaseForge();
    },
  );
  await scenario('owned node NFTs render before slow factory metadata', async ({ page, state, delay }) => {
    state.stake.ownerAssets = [asset];
    const releaseFactory = delay('/api/servers/factory');
    await page.goto(`${origin}/admin/server`);
    await page.locator('[data-node-asset]').waitFor();
    await page.getByRole('status', { name: 'Loading node factory…', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Stake', exact: true }).waitFor();
    releaseFactory();
    await page.getByRole('heading', { name: 'DIDMail Server Node NFT Factory', exact: true }).waitFor();
  });
  await scenario('header balance shows zero and links to the standalone node account page', async ({ page, state }) => {
    state.emptyBalance = true;
    await page.goto(`${origin}/zh/admin/namecard`);
    await page.locator('[data-node-balance] strong').getByText('0', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-account]').count(), 0);
    await page.locator('header [data-node-recharge]').click();
    await page.locator('[data-wallet-recharge] .dm-account-recharge > svg').waitFor();
    assert.equal(new URL(page.url()).pathname, '/zh/admin/account');
    assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.locator('[data-did-show="did:abt:test-node-did"]').first().waitFor();
    await page.goto(`${origin}/en/admin/attachment`);
    await page.locator('[data-node-balance] strong').getByText('0', { exact: true }).waitFor();
    await page.locator('header [data-node-recharge]').click();
    await page.locator('[data-wallet-recharge] .dm-account-recharge > svg').waitFor();
    assert.equal(new URL(page.url()).pathname, '/admin/account');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `.data/screenshots/account-recharge-${theme}.png`, fullPage: true });
    state.accountUnavailable = true;
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`${origin}/en/admin/account#recharge`);
    await page.locator('[data-node-balance] strong').getByText('Balance unavailable', { exact: true }).waitFor();
    await page.locator('[data-did-show="did:abt:test-node-did"]').first().waitFor();
    await page.goto(`${origin}/en/`);
    assert.equal(await page.locator('[data-node-recharge]').count(), 0);
  });
  await scenario('compact node card preserves unavailable states and responsive layout', async ({ page, state }) => {
    state.nodeDid = 'zNKtj7SV8Z3zkTZQzpu5dC8HBQKUxUNUGFRM';
    state.emptyBalance = true;
    await page.goto(`${origin}/en/admin/account`);
    const card = page.locator('[data-account]');
    await page.waitForFunction(() => document.querySelector('[data-account]')?.getAttribute('aria-busy') === 'false');
    await card.locator('.dm-metrics strong').first().getByText('0 TBA', { exact: true }).waitFor();
    await card.screenshot({ path: `.data/screenshots/node-summary-${theme}.png` });
    state.accountUnavailable = true;
    await card.getByRole('button', { name: 'Refresh node account', exact: true }).click();
    await card.getByText('Some node data is unavailable', { exact: true }).waitFor();
    assert.equal(await card.locator('details').getAttribute('open'), null);
    assert.equal(await card.locator('.dm-metrics strong').first().textContent(), '—');
    await card.getByText('Details', { exact: true }).click();
    await card
      .getByText('Chain data is unavailable. Balances and stake could not be verified.', { exact: true })
      .waitFor();
    await card.getByText('Details', { exact: true }).click();
    await card.screenshot({ path: `.data/screenshots/node-summary-unavailable-${theme}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await card.screenshot({ path: `.data/screenshots/node-summary-mobile-${theme}.png` });
  });
  // Supporting synthetic-role fixture only, NOT genuine ARC auth/E2E acceptance.
  await scenario('account precision details preserve exact integers and native controls', async ({ page, state, reads, mutations, delay }) => {
    const deadline = Date.now() + 170_000;
    const remaining = () => { const ms = deadline - Date.now(); assert.ok(ms > 0, 'focused precision scenario deadline'); return Math.min(ms, 6000); };
    const originalDID = 'zNKtj7SV8Z3zkTZQzpu5dC8HBQKUxUNUGFRM';
    const nativeTokenId = 'test-token'; // Declared session.node.tokenId in THIS public fixture.
    const fractionRaw = '3049210800000000080';
    const fraction = { summary: '3.0492 TBA', exact: '3.04921080000000008 TBA' };
    const whole70 = '1234567890123456789012345678901234567890123456789012345678901234567890';
    const hugeRaw = whole70 + '123456789012345678';
    const huge = { summary: whole70 + '.1235 TBA', exact: whole70 + '.123456789012345678 TBA' };
    const labels = {
      en: { details: 'Details', available: 'Available balance', refresh: 'Refresh node account', refreshBalance: 'Refresh balance' },
      zh: { details: '详情', available: '可用余额', refresh: '刷新节点账户', refreshBalance: '刷新余额' },
      ar: { details: 'التفاصيل', available: 'الرصيد المتاح', refresh: 'تحديث حساب العقدة', refreshBalance: 'تحديث الرصيد' },
    };
    let tabPresses = 0, refreshes = 0, layoutCases = 0;
    state.nodeDid = originalDID;
    const setNative = (value) => {
      // Native is deliberately NOT the first row. Neither old global token nor
      // old scenario shapes are changed; new-only override has address binding.
      state.accountTokens = [
        { ...token, address: 'public-other-token', symbol: 'OTHER', value: '999999999999999999999999' },
        { ...token, address: nativeTokenId, value },
      ];
      assert.equal(state.accountTokens[1].address, nativeTokenId);
      assert.equal(state.accountTokens[1].value, value);
    };
    setNative(fractionRaw);
    const card = page.locator('[data-account]');
    const detail = card.locator('[data-balance-exact]');
    const summary = detail.locator(':scope > summary');
    const full = detail.locator('[data-balance-exact-value]');
    const header = page.locator('[data-node-balance]');
    const apiCounts = () => ({ reads: reads.length, sessions: state.sessionCalls || 0, writes: mutations.length });
    const frameTail = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const settled = async () => {
      remaining();
      await page.waitForFunction(() => document.querySelector('[data-account]')?.getAttribute('aria-busy') === 'false', undefined, { timeout: remaining() });
      await frameTail();
      assert.deepEqual(mutations, []);
    };
    const normalValue = async (expected, language) => {
      await settled();
      await card.locator('.dm-metrics strong').getByText(expected.summary, { exact: true }).waitFor({ timeout: remaining() });
      assert.equal(await card.locator('.dm-node-account-address .dm-did-value').textContent(), originalDID);
      await header.locator('strong').getByText(expected.summary, { exact: true }).waitFor({ timeout: remaining() });
      assert.ok((await header.getAttribute('title')).includes(originalDID));
      assert.ok((await header.getAttribute('title')).includes(expected.exact));
      assert.equal(await header.getAttribute('aria-label'), `${labels[language].refreshBalance}: ${expected.exact}`);
      assert.equal(await header.locator('strong').textContent(), expected.summary);
      assert.equal(await detail.count(), 1);
    };
    const assertFull = async (expected) => {
      await full.waitFor({ state: 'visible', timeout: remaining() });
      assert.equal(await full.textContent(), expected.exact);
      assert.equal(await full.evaluate((el) => getComputedStyle(el).direction), 'ltr');
      assert.equal(await full.locator('script,img,iframe,svg').count(), 0);
    };
    const noDisclosureIO = async (action) => {
      const before = apiCounts();
      await action(); await frameTail();
      assert.deepEqual(apiCounts(), before, 'native Details must not cause API reads/session checks/writes');
    };
    const refresh = async (language) => {
      const before = apiCounts(), oldAccountReads = reads.filter((url) => url.pathname === '/api/account/state').length;
      const release = delay('/api/account/state');
      try {
        await card.getByRole('button', { name: labels[language].refresh, exact: true }).click({ timeout: remaining() });
        await page.waitForFunction(() => document.querySelector('[data-account] [data-action="refresh-account"]')?.disabled === true, undefined, { timeout: remaining() });
        const readDeadline = Date.now() + remaining();
        while (reads.filter((url) => url.pathname === '/api/account/state').length === oldAccountReads) {
          assert.ok(Date.now() < readDeadline, 'normal refresh request must enter the real fixture route');
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(reads.filter((url) => url.pathname === '/api/account/state').length, oldAccountReads + 1);
      } finally { release(); }
      await settled(); refreshes++;
      assert.equal(reads.filter((url) => url.pathname === '/api/account/state').length, oldAccountReads + 1);
      assert.equal(reads.length, before.reads + 1, 'one normal account Refresh must coalesce with header');
      assert.equal(state.sessionCalls || 0, before.sessions);
      assert.deepEqual(mutations, []);
    };
    await page.goto(`${origin}/admin/account#recharge`, { timeout: remaining() });
    await normalValue(fraction, 'en');
    await page.waitForLoadState('networkidle', { timeout: remaining() });
    assert.equal(await detail.getAttribute('open'), null);
    assert.equal(await summary.evaluate((el) => el.tagName), 'SUMMARY');
    await noDisclosureIO(async () => { await summary.click({ timeout: remaining() }); await assertFull(fraction); });
    // One real bounded Tab walk (TOTAL <=40), never .focus or locator.press.
    for (; tabPresses < 40;) {
      remaining(); await page.keyboard.press('Tab'); tabPresses++;
      if (await summary.evaluate((el) => el === document.activeElement)) break;
    }
    const focus = await summary.evaluate((el) => ({ active: el === document.activeElement, visible: el.matches(':focus-visible'),
      outline: getComputedStyle(el).outlineStyle, width: parseFloat(getComputedStyle(el).outlineWidth) }));
    assert.equal(focus.active, true); assert.equal(focus.visible, true); assert.notEqual(focus.outline, 'none'); assert.ok(focus.width >= 2);
    await noDisclosureIO(async () => { await page.keyboard.press('Space'); await page.waitForFunction(() => document.querySelector('[data-balance-exact]')?.open === false, undefined, { timeout: remaining() }); });
    await noDisclosureIO(async () => { await page.keyboard.press('Enter'); await assertFull(fraction); });
    assert.equal(await detail.getAttribute('open'), '');
    // Original same token/raw value; one actual normal Refresh preserves open bit.
    await refresh('en'); await normalValue(fraction, 'en'); assert.equal(await detail.getAttribute('open'), ''); await assertFull(fraction);

    setNative('1'); await refresh('en');
    await normalValue({ summary: '0 TBA', exact: '0.000000000000000001 TBA' }, 'en');
    await assertFull({ exact: '0.000000000000000001 TBA' });
    setNative('0'); await refresh('en'); await normalValue({ summary: '0 TBA', exact: '0 TBA' }, 'en'); await assertFull({ exact: '0 TBA' });
    state.accountTokens = []; // Successful ready[] with NO top-level balance is known native0.
    await refresh('en');
    assert.equal(await card.locator('.dm-metrics strong').textContent(), '0 TBA');
    assert.equal(await header.locator('strong').textContent(), '0');
    await assertFull({ exact: '0 TBA' });
    setNative(hugeRaw); await refresh('en'); await normalValue(huge, 'en'); await assertFull(huge);
    state.accountUnavailable = true; state.accountTokens = []; // Valid array + explicit unavailable; no malformed-selector claim.
    await refresh('en');
    assert.equal(await card.locator('.dm-metrics strong').textContent(), '—'); assert.equal(await detail.count(), 0);
    state.accountUnavailable = false; setNative(fractionRaw);
    await refresh('en'); await normalValue(fraction, 'en');
    assert.equal(await detail.getAttribute('open'), null);

    // All layout stress uses the 70-digit value, not merely the short fraction.
    setNative(hugeRaw); await refresh('en'); await normalValue(huge, 'en');
    for (const language of ['en', 'zh', 'ar']) {
      await page.goto(`${origin}${localizedPath('/admin/account', language)}#recharge`, { timeout: remaining() });
      await normalValue(huge, language); await page.waitForLoadState('networkidle', { timeout: remaining() });
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      assert.equal(await page.locator('html').getAttribute('dir'), localeDirection(language));
      const baseRootFont = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      for (const appearance of ['light', 'dark']) {
        if ((await page.locator('html').getAttribute('data-mode')) !== appearance) {
          await page.getByRole('button', { name: messages(language)[appearance === 'dark' ? 'switchToDark' : 'switchToLight'], exact: true }).click({ timeout: remaining() });
        }
        assert.equal(await page.locator('html').getAttribute('data-mode'), appearance);
        for (const width of [1280, 390, 320]) {
          await page.setViewportSize({ width, height: 600 });
          for (const textScale of [1, 2]) {
            remaining();
            // Declared browser fixture stress, not an OS-font preference claim.
            await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}px`; }, baseRootFont * textScale);
            await frameTail();
            assert.equal(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)), baseRootFont * textScale);
            if ((await detail.getAttribute('open')) === null) await noDisclosureIO(async () => { await summary.click({ timeout: remaining() }); });
            await assertFull(huge);
            const expectedName = `${labels[language].details}: ${labels[language].available}`;
            assert.equal(await summary.getAttribute('aria-label'), expectedName);
            const geometry = await full.evaluate((el) => {
              const rect = el.getBoundingClientRect(), card = el.closest('[data-account]').getBoundingClientRect();
              const metric = el.closest('.dm-metrics').getBoundingClientRect();
              const target = el.parentElement.querySelector('summary').getBoundingClientRect();
              return { viewportFits: document.documentElement.scrollWidth <= innerWidth,
                fullInside: rect.left >= card.left - 1 && rect.right <= card.right + 1 && rect.bottom <= card.bottom + 1,
                metricFits: metric.left >= 0 && metric.right <= innerWidth + 1,
                targetWidth: target.width, targetHeight: target.height, coarse: matchMedia('(pointer: coarse)').matches };
            });
            assert.equal(geometry.viewportFits, true); assert.equal(geometry.fullInside, true); assert.equal(geometry.metricFits, true);
            assert.ok(geometry.targetWidth >= (geometry.coarse ? 44 : 32)); assert.ok(geometry.targetHeight >= (geometry.coarse ? 44 : 32));
            const refreshButton = card.getByRole('button', { name: labels[language].refresh, exact: true });
            await refreshButton.scrollIntoViewIfNeeded({ timeout: remaining() });
            assert.equal(await refreshButton.evaluate((el) => {
              const r = el.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && Boolean(top && (top === el || el.contains(top)));
            }), true, 'normal Refresh stays reachable after wrapping/scaling');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.deepEqual(mutations, []); layoutCases++;
          }
        }
      }
      await page.evaluate(() => { document.documentElement.style.removeProperty('font-size'); });
    }
    assert.equal(layoutCases, 36); assert.ok(tabPresses > 0 && tabPresses <= 40);
    assert.equal(refreshes, 8);
    assert.ok(reads.every((url) => ['/api/account/state', '/api/forge/state'].includes(url.pathname)));
    assert.deepEqual(mutations, []);
    console.log(`PUBLIC isolated precision details: ${layoutCases} layouts, ${tabPresses} real Tab presses, ${refreshes} coalesced normal Refresh actions; synthetic role only.`);
  });
  await scenario(
    'node factory details are on demand; node state refresh is manual',
    async ({ page, reads, state, delay }) => {
      await page.clock.install();
      await page.goto(`${origin}/admin/server`);
      await page.getByText('Test Factory', { exact: true }).waitFor();
      await page.waitForFunction(
        () => document.querySelector('[data-action="refresh-account"]')?.getAttribute('aria-busy') === 'false',
      );
      assert.equal(await page.locator('.dm-note').count(), 0);
      const card = page.locator('[data-server-factory]');
      await card.getByText('To successfully become a DIDMail public service node,', { exact: false }).waitFor();
      assert.equal(reads.filter((url) => url.searchParams.get('refresh') === '1').length, 0);
      const initial = reads.filter((url) => ['/api/account/state', '/api/stake/state'].includes(url.pathname)).length;
      await page.clock.fastForward(60_000);
      assert.equal(
        reads.filter((url) => ['/api/account/state', '/api/stake/state'].includes(url.pathname)).length,
        initial,
      );
      await page.getByRole('button', { name: 'Server Node Factory information', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByText('Minted', { exact: true }).waitFor();
      await dialog.getByText('7', { exact: true }).waitFor();
      await dialog
        .getByRole('img', { name: 'Server node NFT SVG template', exact: true })
        .evaluate((img) => img.decode());
      assert.equal(
        reads.filter((url) => url.pathname === '/api/servers/factory' && url.searchParams.get('refresh') === '1')
          .length,
        1,
      );
      await page.screenshot({ path: `.data/screenshots/node-factory-details-${theme}.png`, fullPage: true });
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      const accountCard = page.locator('[data-server-factory]');
      const height = (await accountCard.boundingBox()).height;
      const releaseAccount = delay('/api/account/state');
      const releaseStake = delay('/api/stake/state');
      const refresh = page.getByRole('button', { name: 'Refresh node NFTs', exact: true });
      await refresh.click();
      await page.waitForFunction(
        () => document.querySelector('[data-action="refresh-account"]')?.getAttribute('aria-busy') === 'true',
      );
      assert.equal(await accountCard.getByText('Updating node data…', { exact: true }).count(), 0);
      assert.equal(await refresh.isDisabled(), true);
      assert.equal(await refresh.locator('svg').evaluate((el) => getComputedStyle(el).animationName), 'dm-spin');
      assert.ok(
        Math.abs((await accountCard.boundingBox()).height - height) < 0.5,
        'refresh keeps the node card height stable',
      );
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await refresh.locator('svg').evaluate((el) => getComputedStyle(el).animationName), 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      releaseAccount();
      releaseStake();
      await page.waitForFunction(
        () => document.querySelector('[data-action="refresh-account"]')?.getAttribute('aria-busy') === 'false',
      );
      assert.equal(
        reads.filter((url) => ['/api/account/state', '/api/stake/state'].includes(url.pathname)).length,
        initial + 2,
      );
      assert.equal(await refresh.locator('svg').evaluate((el) => getComputedStyle(el).animationName), 'none');
      assert.ok(
        Math.abs((await accountCard.boundingBox()).height - height) < 0.5,
        'completed refresh keeps the node card height stable',
      );
      state.failServerFactory = true;
      await page.getByRole('button', { name: 'Server Node Factory information', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      state.failServerFactory = false;
      await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
      await dialog
        .getByRole('img', { name: 'Server node NFT SVG template', exact: true })
        .evaluate((img) => img.decode());
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    },
  );
  await scenario(
    'envelope factory details load only on demand; background node refresh retains form edits',
    async ({ page, state, reads, delay }) => {
      const releaseFactory = delay('/api/envelope/factory');
      await page.goto(`${origin}/admin/envelope`);
      await page.getByText('No envelope NFTs yet', { exact: true }).waitFor();
      assert.equal(reads.filter((url) => url.pathname === '/api/envelope/factory').length, 0);
      assert.equal(await page.getByRole('heading', { name: 'Envelope Factory', exact: true }).count(), 0);
      assert.equal(reads.filter((url) => url.pathname === '/api/envelope/list').length, 1);
      await page.getByLabel('Name', { exact: true }).fill('Unsaved template');
      await page.getByRole('button', { name: 'Envelope Factory information', exact: true }).click();
      await page.getByRole('dialog').getByRole('status', { name: 'Loading Envelope factory…', exact: true }).waitFor();
      releaseFactory();
      await page.getByRole('dialog').getByText('Test Factory', { exact: true }).waitFor();
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Unsaved template');
      await page.waitForFunction(
        () => document.querySelector('[data-node-balance]')?.getAttribute('aria-busy') === 'false',
      );
      const releaseAccount = delay('/api/account/state');
      await page.getByRole('button', { name: /^Refresh balance:/ }).click();
      assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Unsaved template');
      assert.equal(await page.getByRole('button', { name: 'Create Factory', exact: true }).isDisabled(), true);
      assert.equal(await page.getByLabel('Description', { exact: true }).isEditable(), true);
      await page.getByLabel('Description', { exact: true }).fill('Editing during refresh');
      assert.equal(await page.locator('[data-account]').count(), 0);
      assert.equal(reads.filter((url) => url.pathname === '/api/stake/state').length, 0);
      releaseAccount();
      await page.waitForFunction(
        () => document.querySelector('[data-node-balance]')?.getAttribute('aria-busy') === 'false',
      );
      assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Unsaved template');
      assert.equal(await page.getByLabel('Description', { exact: true }).inputValue(), 'Editing during refresh');
      assert.equal(reads.filter((url) => url.pathname === '/api/forge/state').length, 1);
      state.failPublish = false;
    },
  );
  await scenario(
    'mail rows load without size query; search and pagination do not refetch size',
    async ({ page, reads, delay }) => {
      const releaseSize = delay('/api/storage/size');
      await page.goto(`${origin}/admin/storage`);
      await openMailDetails(page);
      await page.getByRole('button', { name: 'Delete mail 7' }).waitFor();
      await page.getByRole('searchbox').fill('sender-did');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.locator('[data-busy]').waitFor({ state: 'hidden' });
      assert.equal(reads.filter((url) => url.pathname === '/api/storage/size').length, 1);
      releaseSize();
      await page.getByText('Database Used Size:', { exact: false }).waitFor();
      const releaseRows = delay('/api/storage/mails');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Updating in background' }).waitFor();
      assert.equal(await page.locator('[data-storage-row]').count(), 1);
      assert.equal(await page.locator('.dm-storage-id code').textContent(), '7');
      assert.equal(reads.filter((url) => url.pathname === '/api/storage/size').length, 1);
      releaseRows();
      await page.locator('[data-busy]').waitFor({ state: 'hidden' });
    },
  );
  await scenario(
    'envelope info handles failure, retry and closing a slow dialog without losing edits',
    async ({ page, state, delay }) => {
      await page.goto(`${origin}/admin/envelope`);
      await page.getByLabel('Name', { exact: true }).fill('Keep this draft');
      state.failEnvelopeFactory = true;
      await page.getByRole('button', { name: 'Envelope Factory information', exact: true }).click();
      await page.getByRole('dialog').getByRole('alert').waitFor();
      state.failEnvelopeFactory = false;
      await page.getByRole('dialog').getByRole('button', { name: 'Retry', exact: true }).click();
      await page.getByRole('dialog').getByText('Test Factory', { exact: true }).waitFor();
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
      const release = delay('/api/envelope/factory');
      await page.getByRole('button', { name: 'Envelope Factory information', exact: true }).click();
      await page.getByRole('dialog').getByRole('status').waitFor();
      await page.keyboard.press('Escape');
      release();
      await page.waitForFunction(() => !document.querySelector('[data-dialog]').open);
      assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Keep this draft');
    },
  );
  await scenario(
    'namecard creation and info are available without an initial factory read',
    async ({ page, reads, delay }) => {
      const release = delay('/api/namecard/factory');
      await page.goto(`${origin}/admin/namecard`);
      await page.getByRole('heading', { name: 'Create Namecard NFT Factory', exact: true }).waitFor();
      assert.equal(reads.filter((url) => url.pathname === '/api/namecard/factory').length, 0);
      assert.equal(await page.locator('[name="retentionPeriod"]').count(), 0);
      await page.getByLabel('Name', { exact: true }).fill('Namecard draft');
      await page.getByRole('button', { name: 'Namecard Factory information', exact: true }).click();
      await page.getByRole('dialog').getByRole('status', { name: 'Loading Namecard factory…', exact: true }).waitFor();
      release();
      await page.getByRole('dialog').getByText('Test Factory', { exact: true }).waitFor();
      await page.getByRole('dialog').screenshot({ path: `.data/screenshots/namecard-info-${theme}.png` });
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Namecard draft');
    },
  );
  await scenario(
    'envelope and namecard template help document real variables without fetching factory data or changing drafts',
    async ({ page, reads }) => {
      for (const kind of ['envelope', 'namecard'])
        for (const locale of ['en', 'zh']) {
          await page.goto(`${origin}/${locale}/admin/${kind}`);
          await page.getByLabel(locale === 'zh' ? '名称' : 'Name', { exact: true }).fill('Keep help draft');
          const trigger = page.getByRole('button', {
            name:
              locale === 'zh'
                ? kind === 'envelope'
                  ? '关于 SVG 信封模板'
                  : '关于 SVG 名片模板'
                : kind === 'envelope'
                  ? 'About SVG Envelope templates'
                  : 'About SVG Namecard templates',
            exact: true,
          });
          const factoryReads = () => reads.filter((url) => url.pathname === `/api/${kind}/factory`).length;
          const before = factoryReads();
          await trigger.click();
          const dialog = page.getByRole('dialog');
          await dialog
            .getByRole('heading', { name: locale === 'zh' ? '支持的变量' : 'Supported variables', exact: true })
            .waitFor();
          const variables =
            kind === 'envelope'
              ? ['subject', 'sender', 'createdAt', 'expiredAt', 'envelope']
              : ['name', 'company', 'position', 'phone', 'email', 'website', 'location', 'background'];
          const namespace = kind === 'envelope' ? 'mail' : 'contact';
          assert.equal(await dialog.locator('.dm-template-variables dt').count(), variables.length);
          for (const variable of variables)
            await dialog.locator('dt code').getByText(`{{${namespace}.${variable}}}`, { exact: true }).waitFor();
          assert.equal(
            await dialog.locator('pre code').textContent(),
            kind === 'envelope'
              ? '<text x="24" y="48">{{mail.subject}}</text>'
              : '<text x="24" y="48">{{contact.name}}</text>',
          );
          assert.equal(await dialog.locator('.dm-template-help text').count(), 0);
          assert.equal(factoryReads(), before);
          await page.setViewportSize({ width: 390, height: 844 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          await dialog.screenshot({ path: `.data/screenshots/${kind}-template-help-${locale}-${theme}.png` });
          await page.keyboard.press('Escape');
          assert.equal(
            await page.getByLabel(locale === 'zh' ? '名称' : 'Name', { exact: true }).inputValue(),
            'Keep help draft',
          );
          assert.equal(await trigger.evaluate((el) => document.activeElement === el), true);
          await page.setViewportSize({ width: 1440, height: 1000 });
        }
    },
  );
  await scenario(
    'template pages use saved lists; explicit refresh and successful creation request chain synchronization',
    async ({ page, state, reads }) => {
      for (const kind of ['envelope', 'namecard']) {
        await page.goto(`${origin}/admin/${kind}`);
        await page.locator('[data-template-sync]').waitFor();
        const calls = () => reads.filter((url) => url.pathname === `/api/${kind}/list`);
        assert.equal(calls().at(-1).searchParams.has('refresh'), false);
        await page.getByLabel('Name', { exact: true }).fill('Retain draft');
        state.listSyncError = true;
        await page.locator('[data-action="list-refresh"]').click();
        await page.getByRole('alert').filter({ hasText: 'Chain sync failed. Showing saved data' }).waitFor();
        assert.equal(calls().at(-1).searchParams.get('refresh'), '1');
        assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Retain draft');
        state.listSyncError = false;
      }
    },
  );
  await scenario('storage overview is compact, localized and responsive with safe payment/deletion details', async ({page,state})=>{
    const base={sender:'did:abt:z'+'1'.repeat(30),receiver:'did:abt:z'+'2'.repeat(30),envelope:'z'+'3'.repeat(30),hash:'a'.repeat(64),payment:'10000000000000000',credit:'8900000000000000',dividend:'1000000000000000',size:127,createdAt:'2026-10-30T08:20:00Z'};
    state.mails=['awaiting_signature','delivered','payment_pending'].map((sendStatus,index)=>{const id='00000000-0000-4000-8000-00000000000'+index;return{...base,id,storageKey:'dmp:'+id,sendStatus,...(index?{paymentTx:'b'.repeat(64)}:{})};});
    await page.goto(`${origin}/zh/admin/storage`);
    await page.getByText('待签名',{exact:true}).waitFor();
    const rows=page.locator('[data-storage-row]');assert.equal(await rows.count(),3);
    assert.ok((await rows.first().boundingBox()).height<100);
    assert.equal(await rows.first().locator('.dm-did-icon[data-did-show]:visible').count(),0);
    const copyButton=await rows.first().locator('[data-did-copy]').first().boundingBox();assert.ok(copyButton.width>=24&&copyButton.height>=24);
    assert.equal(await page.locator('[data-action="delete-mail"]:visible').count(),0);
    await rows.first().locator('[data-action="storage-details"]').click();
    const detail=page.locator('#storage-mail-0');await detail.getByText('报价明细',{exact:true}).waitFor();
    assert.ok((await detail.innerText()).includes(base.hash));assert.ok(!(await detail.innerText()).includes('净收益'));
    await rows.nth(2).locator('[data-action="storage-details"]').click();
    assert.equal(await page.locator('#storage-mail-2 [data-action="delete-mail"]').isDisabled(),true);
    await rows.first().locator('[data-action="storage-details"]').click();await rows.nth(2).locator('[data-action="storage-details"]').click();
    await page.screenshot({path:`.data/screenshots/storage-redesign-zh-desktop-${theme}.png`,fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await rows.first().locator('[data-action="storage-details"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`.data/screenshots/storage-redesign-zh-mobile-${theme}.png`,fullPage:true});
    await page.goto(`${origin}/ar/admin/storage`);
    await page.locator('[data-storage-row]').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('[data-storage-row] [data-action="storage-details"]').first().click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`.data/screenshots/storage-redesign-ar-mobile-${theme}.png`,fullPage:true});

  });
  await scenario(
    'early mail rows wait for network identity before showing the currency symbol',
    async ({ page, state, delay }) => {
      state.chainId = 'main';
      const releaseAccount = delay('/api/account/state');
      const releaseForge = delay('/api/forge/state');
      await page.goto(`${origin}/admin/storage`);
      const amount = page.locator('[data-mail-payment]');
      await amount.waitFor();
      assert.ok(!(await amount.innerText()).includes('TBA'));
      releaseAccount();
      await amount.getByText('1.2346 ABT', { exact: true }).waitFor();
      releaseForge();
    },
  );
  await scenario(
    'native language/theme controls, Chinese SSR, preference and localized admin navigation',
    async ({ page }) => {
      await page.goto(`${origin}/?entry=home#features`);
      assert.equal(await page.locator('header .aup-app-header-nav a').count(), 0);
      const adminIcon = page.locator('header .dm-header-admin');
      await adminIcon.waitFor();
      assert.equal(await adminIcon.locator('svg').count(), 1);
      assert.equal(await adminIcon.innerText(), '');
      assert.equal(
        await adminIcon.evaluate((el) => {
          const user = document.querySelector('header [data-action-kind="user-menu"]');
          return Boolean(user && el.compareDocumentPosition(user) & Node.DOCUMENT_POSITION_FOLLOWING);
        }),
        true,
      );

      const picker = page.locator('[data-role="locale-switcher"]');
      const trigger = picker.locator('button').first();
      await trigger.press('ArrowDown');
      await page.getByRole('menuitem', { name: 'English', exact: true }).waitFor();
      await page.getByRole('menuitem', { name: 'English', exact: true }).press('Escape');
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      assert.equal(await trigger.evaluate((el) => document.activeElement === el), true);
      await trigger.click();
      await Promise.all([
        page.waitForURL('**/zh/?entry=home#features'),
        page.getByRole('menuitem', { name: '简体中文', exact: true }).click(),
      ]);
      await page.getByRole('heading', { name: '端到端加密', exact: true }).waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'), 'zh');
      assert.equal(await page.locator('[data-node-balance]').count(), 0);

      await page.getByRole('link', { name: '获取浏览器扩展 ↗', exact: true }).waitFor();
      const other = theme === 'dark' ? 'light' : 'dark';
      const toggle = page.getByRole('button', { name: messages('zh')[other === 'dark' ? 'switchToDark' : 'switchToLight'], exact: true });
      await toggle.click();
      assert.equal(await page.locator('html').getAttribute('data-mode'), other);
      const card = page.locator('.dm-home-features article').first();
      assert.equal(
        await card.evaluate((el) => getComputedStyle(el).backgroundColor),
        other === 'dark' ? 'rgb(28, 28, 28)' : 'rgb(250, 250, 250)',
      );
      assert.equal(await page.evaluate(() => localStorage.getItem('web-mode')), other);
      await page.goto(origin);
      assert.equal(new URL(page.url()).pathname, '/zh/');
      assert.equal(await page.locator('html').getAttribute('data-mode'), other);
      await page.getByRole('heading', { name: '端到端加密', exact: true }).waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.getByRole('button', { name: '选择语言', exact: true }).click();
      await page.getByRole('menuitem', { name: '简体中文', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.keyboard.press('Escape');
      await page.screenshot({ path: `.data/screenshots/native-home-zh-${theme}.png`, fullPage: true });
      await page.locator('header').getByRole('link', { name: '管理', exact: true }).click();
      assert.match(new URL(page.url()).pathname, /^\/zh\/admin\/?$/);
      await page.locator('[data-workspace]:not([hidden])').waitFor();
      await page.locator('.dm-tabs a[href="/zh/admin/storage"]').click();
      assert.equal(new URL(page.url()).pathname, '/zh/admin/storage');
      await page.locator('[data-content] table').waitFor();
      await page.getByRole('button', { name: '选择语言', exact: true }).click();
      await page.getByRole('menuitem', { name: 'English', exact: true }).click();
      await page.waitForURL('**/en/admin/storage');
      await page.locator('[data-content] table').waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    },
  );
  await scenario(
    'Chinese node balances, recharge, acquisition and staking use the original API payloads',
    async ({ page, mutations }) => {
      await page.goto(`${origin}/zh/admin/server`);
      await page.getByRole('heading', { name: 'DIDMail 服务节点 NFT 工厂', exact: true }).waitFor();
      await page.getByRole('button', { name: '获取', exact: true }).waitFor({ state: 'visible' });
      const acquire = page.getByRole('button', { name: '获取', exact: true });
      await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
      const tabs = await page.locator('.dm-tabs-inner').boundingBox();
      const firstTab = await page.locator('.dm-tabs a').first().boundingBox();
      assert.equal(tabs.x, 0);
      assert.equal(tabs.width, 1440);
      assert.ok(firstTab.x <= 24, 'business navigation starts at the left edge');
      await page.getByText('Test Factory', { exact: true }).waitFor();
      await page.locator('[data-node-balance]').getByText('100 TBA', { exact: true }).waitFor();
      assert.equal(await page.locator('[data-account]').count(), 0);
      await page.locator('header [data-node-recharge]').click();
      await page.getByRole('heading', { name: '节点账户', exact: true }).first().waitFor();
      await page.locator('[data-did-show="did:abt:test-node-did"]').first().waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await page.goto(`${origin}/zh/admin/server`);
      await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
      await acquire.click();
      await page.getByRole('heading', { name: '获取服务节点 NFT', exact: true }).waitFor();
      await accept(page, '取消');
      assert.equal(mutations.length, 0);
      await acquire.click();
      await accept(page, '获取');
      await page.getByRole('status').filter({ hasText: '请求已受理' }).waitFor();
      assert.equal(mutations[0].path, '/api/servers/acquire');
      await page.getByRole('button', { name: '质押', exact: true }).click();
      await page.getByRole('heading', { name: '质押节点 NFT', exact: true }).waitFor();
      await accept(page, '质押节点 NFT');
      await page.getByRole('button', { name: '撤销质押', exact: true }).waitFor();
      assert.deepEqual(mutations.at(-1).body, { assetAddress: asset.address });
      await page.screenshot({ path: `.data/screenshots/native-server-zh-${theme}.png`, fullPage: true });
    },
  );
  for (const kind of ['envelope', 'namecard'])
    await scenario(`Chinese ${kind} validation, multipart creation and publish`, async ({ page, mutations, state }) => {
      await page.goto(`${origin}/zh/admin/${kind}`);
      await page.getByRole('heading', { name: '预览', exact: true }).waitFor();
      await page.locator('input[type=file]').setInputFiles({
        name: 'invalid.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      });
      await page.getByRole('alert').filter({ hasText: 'SVG 文件必须包含' }).waitFor();
      await page.getByRole('button', { name: '使用默认模板', exact: true }).click();
      await page.getByLabel('名称', { exact: true }).fill('中文模板名称测试');
      await page.getByLabel('价格', { exact: false }).fill('0.001');
      await page.getByLabel('描述', { exact: true }).fill('保留中文用户输入');
      await page.getByLabel(kind==='envelope'?'信封分类':'名片分类',{exact:true}).selectOption('members');
      if (kind === 'envelope') {
        await page.getByLabel('保留期限', { exact: false }).fill('7');
        await page.getByLabel('信封分类', {exact:true}).selectOption('members');
        await page.getByLabel('价格', {exact:false}).fill('0');
        assert.equal(await page.locator('[data-member-envelope]').count(),0);
      }
      await page.getByRole('button', { name: '创建工厂', exact: true }).click();
      await page.getByRole('dialog').getByText('节点钱包将支付工厂获取费用：1 TBA。', { exact: true }).waitFor();
      await accept(page, '创建');
      assert.equal(mutations[0].path, `/api/${kind}/acquire`);
      assert.match(mutations[0].body, /name="file"/);
      assert.match(mutations[0].body, /中文模板名称测试/);
      assert.match(mutations[0].body, /保留中文用户输入/);
      if (kind === 'envelope') assert.match(mutations[0].body, /name="retentionPeriod"/);
      assert.match(mutations[0].body,/name="category"\r?\n\r?\nmembers/);
      assert.equal(await page.locator('select[data-namecard-category]').count(),0);
      if(kind==='namecard')assert.equal(await page.locator('[data-namecard-category]').textContent(),'成员专用名片');
      const toggle = page.getByRole('checkbox', { name: '启用UI Test Template', exact: true });
      await toggle.check();
      await page.getByRole('status').filter({ hasText: '发布设置已保存' }).waitFor();
      assert.equal(mutations.at(-1).body.name, 'UI Test Template');
      assert.equal(mutations.at(-1).body.address, 'template-nft');
      assert.equal(mutations.at(-1).body.enabled, true);
      if(kind==='envelope'){
        assert.match(mutations[0].body,/name="category"\r?\n\r?\nmembers/);
        assert.equal(state.items[0].category,'members');
        assert.equal(await page.locator('select[data-envelope-category]').count(),0);
        assert.equal(await page.locator('[data-envelope-category]').textContent(),'成员专用信封');
        assert.equal(state.items[0].enabled,true);
      }
    });
  await scenario(
    'Chinese storage and attachment forms retain exact amounts and mutation paths',
    async ({ page, mutations }) => {
      await page.goto(`${origin}/zh/admin/storage`);
      await page.getByRole('columnheader', { name: '邮件费用', exact: true }).waitFor();
      await page.getByText('1.2346 TBA', { exact: true }).waitFor();
      await openMailDetails(page);
      await page.getByRole('button', { name: '删除邮件 7', exact: true }).click();
      await page.getByRole('heading', { name: '删除邮件', exact: true }).waitFor();
      await accept(page, '取消');
      assert.equal(mutations.length, 0);
      await openMailDetails(page);
      await page.getByRole('button', { name: '删除邮件 7', exact: true }).click();
      await accept(page, '删除');
      await page.getByRole('status').filter({ hasText: '邮件已删除' }).waitFor();
      assert.equal(mutations[0].path, '/api/storage/mails/delete/7');
      assert.equal(mutations[0].method, 'DELETE');
      await page.goto(`${origin}/zh/admin/attachment`);
      await page.locator('.dm-legacy-settings > summary').click();
      await page.getByRole('heading', { name: '附件策略', exact: true }).waitFor();
      await page.getByLabel('单个文件大小上限', { exact: false }).fill('2.5');
      await page.getByLabel('附件数量上限', { exact: false }).fill('3');
      await page.getByLabel('每字节每天价格', { exact: false }).fill('900719925474099312345');
      await page.getByRole('button', { name: '保存策略', exact: true }).click();
      await page.getByRole('status').filter({ hasText: '附件策略已保存' }).waitFor();
      assert.deepEqual(mutations.at(-1), {
        path: '/api/admin/attachment-config',
        method: 'PUT',
        body: { maxFileSizeBytes: 2621440, maxFileCount: 3, pricePerBytePerDay: '900719925474099312345' },
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `.data/screenshots/native-attachment-zh-mobile-${theme}.png`, fullPage: true });
    },
  );
  await scenario(
    'Chinese anonymous admin shows the sign-in gate without business data',
    async ({ page, reads }) => {
      await page.goto(`${origin}/zh/admin`);
      await page.getByRole('heading', { name: 'DIDMail 管理', exact: true }).waitFor();
      await page.getByRole('link', { name: '使用 ARC 登录', exact: true }).waitFor();
      assert.equal(reads.length, 0);
    },
    { role: 'anonymous' },
  );
  await scenario(
    'Chinese member permissions do not load business data',
    async ({ page, reads }) => {
      await page.goto(`${origin}/zh/admin`);
      await page
        .getByRole('alert')
        .filter({ hasText: '无权访问：仅所有者或管理员可以访问此页面，当前角色为 成员' })
        .waitFor();
      assert.equal(reads.length, 0);
    },
    { role: 'member' },
  );
  await scenario(
    'node query cache survives navigation, revalidates stale snapshots and keeps non-server pages lean',
    async ({ page, state, reads, delay }) => {
      const calls = (path) => reads.filter((url) => url.pathname === path).length;
      await page.goto(`${origin}/admin/server`);
      await page.locator('[data-node-balance] strong').getByText('100 TBA', { exact: true }).waitFor();
      await page.getByText('No staked node NFTs yet', { exact: true }).waitFor();
      await page.waitForFunction(
        () => document.querySelector('[data-node-balance]').getAttribute('aria-busy') === 'false',
      );
      for (const section of ['envelope', 'namecard', 'storage', 'attachment']) {
        await page.locator(`.dm-tabs a[href="/admin/${section}"]`).click();
        await page.locator('[data-content] .dm-card').first().waitFor();
        await page.locator('[data-node-balance] strong').getByText('100 TBA', { exact: true }).waitFor();
        assert.equal(await page.locator('[data-account]').count(), 0);
        assert.equal(calls('/api/account/state'), 1, 'fresh balance is reused across full-page navigation');
        assert.equal(calls('/api/stake/state'), 1, 'only Server requests stake');
        assert.equal(calls('/api/forge/state'), 1, 'configuration is reused');
      }
      assert.ok(state.sessionCalls >= 5, 'permissions are reverified on every page');
      await page.evaluate(() => {
        const key = 'didmail:node-state:v1';
        const snapshot = JSON.parse(sessionStorage.getItem(key));
        snapshot.resources.account.updatedAt = Date.now() - 20_000;
        sessionStorage.setItem(key, JSON.stringify(snapshot));
      });
      state.balance = '200000000000000000000';
      const release = delay('/api/account/state');
      await page.goto(`${origin}/admin/storage`);
      await page.locator('[data-content] table').waitFor();
      await page.locator('[data-node-balance] strong').getByText('100 TBA', { exact: true }).waitFor();
      assert.equal(await page.locator('[data-node-balance]').getAttribute('aria-busy'), 'true');
      assert.equal(await page.locator('[data-account]').count(), 0);
      release();
      await page.locator('[data-node-balance] strong').getByText('200 TBA', { exact: true }).waitFor();
      state.balance = '300000000000000000000';
      const before = calls('/api/account/state');
      await page.getByRole('button', { name: /^Refresh balance:/ }).click();
      await page.locator('[data-node-balance] strong').getByText('300 TBA', { exact: true }).waitFor();
      assert.equal(calls('/api/account/state'), before + 1, 'explicit refresh bypasses fresh cache');
      assert.equal(calls('/api/stake/state'), 1);
      const beforeHome = reads.length;
      await page.goto(`${origin}/`);
      await page.locator('.dm-home').waitFor();
      await page.locator('.dm-header-admin').waitFor();
      assert.equal(await page.locator('[data-node-balance]').count(), 0);
      assert.equal(reads.length, beforeHome, 'home does not request node business data');
      await page.locator('.dm-header-admin').click();
      await page.locator('[data-node-balance] strong').getByText('300 TBA', { exact: true }).waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.setViewportSize({ width: 320, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `.data/screenshots/native-cache-header-${theme}.png`, fullPage: true });
    },
  );
  await scenario(
    'cached balance stays hidden until session verification and is cleared on logout or user change',
    async ({ page, state, reads, delay }) => {
      await page.goto(`${origin}/admin/server`);
      await page.locator('[data-node-balance] strong').getByText('100 TBA', { exact: true }).waitFor();
      state.role = 'anonymous';
      const releaseSession = delay('/api/runtime/session');
      const before = reads.length;
      await page.goto(`${origin}/admin/storage`);
      assert.equal(await page.locator('[data-node-balance]:not([hidden])').count(), 0);
      assert.equal(reads.length, before, 'no business reads before identity is verified');
      releaseSession();
      await page.getByRole('link', { name: 'Sign in with ARC', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => sessionStorage.getItem('didmail:node-state:v1')), null);
      state.role = 'owner';
      state.userDid = 'different-owner';
      const releaseAccount = delay('/api/account/state');
      await page.goto(`${origin}/admin/storage`);
      await page.locator('[data-content] table').waitFor();
      assert.equal(await page.locator('[data-node-balance] strong').textContent(), 'Loading…');
      assert.equal(await page.locator('[data-account]').count(), 0);
      releaseAccount();
      await page.locator('[data-node-balance] strong').getByText('100 TBA', { exact: true }).waitFor();
    },
  );
  await scenario('revoked API access clears cached balance and closes the workspace', async ({ page, state }) => {
    await page.goto(`${origin}/admin/server`);
    await page.locator('[data-node-balance] strong').getByText('100 TBA', { exact: true }).waitFor();
    state.accountDenied = true;
    await page.getByRole('button', { name: /^Refresh balance:/ }).click();
    await page
      .locator('[data-session]')
      .getByText('Session expired. Refresh the page to sign in again.', { exact: true })
      .waitFor();
    assert.equal(await page.locator('[data-workspace]').isVisible(), false);
    assert.equal(await page.locator('[data-node-balance]').isVisible(), false);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('didmail:node-state:v1')), null);
  });
  await scenario(
    'Acquire shows an animated pending state and actionable chain diagnostics before retry',
    async ({ page, state, delay, mutations }) => {
      await page.goto(`${origin}/zh/admin/server`);
      await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
      const release = delay('/api/account/state');
      state.accountUnavailable = true;
      state.chainError = {
        code: 'AFS_CHAIN_UNAVAILABLE',
        stage: 'transport',
        reason: 'TIMEOUT_10S',
        path: '/dev/chain/beta/accounts/test-node-did',
      };
      const acquire = page.getByRole('button', { name: '获取', exact: true });
      await acquire.click();
      await page.waitForFunction(
        () => document.querySelector('[data-action="acquire"]')?.getAttribute('aria-busy') === 'true',
      );
      await acquire.getByText('正在获取…', { exact: true }).waitFor();
      assert.equal(await acquire.isDisabled(), true);
      assert.equal(
        await acquire.locator('.dm-spinner').evaluate((el) => getComputedStyle(el).animationName),
        'dm-spin',
      );
      release();
      await page.locator('[data-notice]').getByRole('alert').filter({ hasText: 'TIMEOUT_10S' }).waitFor();
      await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
      assert.equal(await acquire.getAttribute('aria-busy'), 'false');
      assert.equal(await acquire.locator('.dm-spinner').count(), 0);
      assert.equal(mutations.length, 0);
      state.accountUnavailable = false;
      await acquire.click();
      await page.getByRole('dialog').getByRole('heading', { name: '获取服务节点 NFT', exact: true }).waitFor();
      await accept(page, '取消');
      await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
    },
  );
  await scenario(
    'Acquire remains retryable after failed chain verification and rechecks before purchasing',
    async ({ page, state, reads, mutations }) => {
      state.accountUnavailable = true;
      await page.goto(`${origin}/zh/admin/server`);
      const acquire = page.getByRole('button', { name: '获取', exact: true });
      await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
      for (let attempt = 0; attempt < 2; attempt++) {
        const previousReads = reads.filter((url) => url.pathname === '/api/account/state').length;
        await acquire.click();
        await page.locator('[data-notice]').getByRole('alert').filter({ hasText: '链上数据暂不可用' }).waitFor();
        await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
        assert.ok(reads.filter((url) => url.pathname === '/api/account/state').length > previousReads);
        assert.equal(await page.getByRole('dialog').count(), 0);
        assert.equal(mutations.length, 0);
      }
      state.accountUnavailable = false;
      await acquire.click();
      await page.getByRole('dialog').getByRole('heading', { name: '获取服务节点 NFT', exact: true }).waitFor();
      assert.equal(await page.locator('[data-notice]').textContent(), '');
      await accept(page, '获取');
      await page.getByRole('status').filter({ hasText: '请求已受理' }).waitFor();
      assert.equal(mutations.filter((item) => item.path === '/api/servers/acquire').length, 1);
    },
  );
  await scenario(
    'deposit clears only the balance warning and restores purchase despite unavailable stake data',
    async ({ page, state, mutations }) => {
      state.balance = '0';
      state.failStake = true;
      await page.goto(`${origin}/zh/admin/server`);
      const acquire = page.getByRole('button', { name: '获取', exact: true });
      await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
      await acquire.click();
      await page
        .locator('[data-notice]')
        .getByRole('alert')
        .filter({ hasText: '余额不足，请先为节点充值。' })
        .waitFor();
      await page.locator('[data-purchase-balance]').getByRole('button', { name: '充值', exact: true }).click();
      state.balance = '10000000000000000000';
      await page.locator('[data-account]').getByRole('button', { name: '刷新节点账户', exact: true }).click();
      await page.locator('[data-account] .dm-metrics strong').getByText('10 TBA', { exact: true }).waitFor();
      await page.goto(`${origin}/zh/admin/server`);
      await page.waitForFunction(() => document.querySelector('[data-action="acquire"]')?.disabled === false);
      await page.waitForFunction(() => !document.querySelector('[data-notice]').textContent.trim());
      assert.equal(await page.locator('[data-purchase-balance]').count(), 0);
      assert.equal(await acquire.isEnabled(), true);
      assert.equal(await page.locator('[data-account]').count(), 0);
      await acquire.click();
      await page.getByRole('dialog').getByRole('heading', { name: '获取服务节点 NFT', exact: true }).waitFor();
      await accept(page, '获取');
      await page.getByRole('status').filter({ hasText: '请求已受理' }).waitFor();
      assert.equal(mutations.filter((item) => item.path === '/api/servers/acquire').length, 1);
    },
  );
  await scenario('insufficient node balance blocks Acquire before confirmation', async ({ page, state, mutations }) => {
    state.balance = '999999999999999999'; // One base unit below the 1 TBA price.
    await page.goto(`${origin}/en/admin/server`);
    await page
      .locator('[data-purchase-balance]')
      .getByText('Insufficient balance. Recharge the node first.', { exact: false })
      .waitFor();
    await page.getByRole('button', { name: 'Acquire', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Insufficient balance. Recharge the node first.' }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(mutations.length, 0);
    await page.locator('[data-purchase-balance]').getByRole('button', { name: 'Node recharge', exact: true }).click();
    await page.locator('[data-wallet-recharge]').locator('[data-did-show="did:abt:test-node-did"]').first().waitFor();
    assert.equal(await page.locator('dialog[open]').count(), 0);
  });
  await scenario(
    'cached funds cannot authorize a purchase when fresh balance is insufficient',
    async ({ page, state, reads, mutations }) => {
      await page.goto(`${origin}/admin/server`);
      await page.waitForFunction(
        () =>
          document.querySelector('[data-action="acquire"]') &&
          document.querySelector('[data-action="acquire"]')?.disabled === false,
      );
      await page.getByRole('button', { name: 'Acquire', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      state.balance = '0';
      await accept(page, 'Acquire');
      await page.getByRole('alert').filter({ hasText: 'Insufficient balance. Recharge the node first.' }).waitFor();
      assert.equal(mutations.length, 0);
      assert.ok(reads.filter((url) => url.pathname === '/api/account/state').length >= 2);
      await page.locator('[data-node-balance] strong').getByText('0 TBA', { exact: true }).waitFor();
      // A deposit after that reading must also be checked from the network, not rejected by the cached zero.
      state.balance = '100000000000000000000';
      await page.getByRole('button', { name: 'Acquire', exact: true }).click();
      await accept(page, 'Acquire');
      await page.getByRole('status').filter({ hasText: 'Request accepted' }).waitFor();
      assert.equal(mutations.length, 1);
      assert.equal(mutations[0].path, '/api/servers/acquire');
    },
  );
  await scenario('public home and all native deep links', async ({ page }) => {
    await page.goto(origin);
    await page.getByRole('heading', { name: 'DIDMail', exact: true }).waitFor();
    assert.equal(await page.locator('.dm-home-hero img').evaluate((img) => img.complete && img.naturalWidth > 0), true);
    for (const section of ['account', 'server', 'envelope', 'namecard', 'storage', 'attachment']) {
      const response = await page.goto(`${origin}/admin/${section}`);
      assert.equal(response.status(), 200);
      await page.locator('[data-workspace]:not([hidden])').waitFor();
      assert.equal(await page.locator('[data-didmail-admin]').getAttribute('data-section'), section);
      await page.locator('[data-content] .dm-card').first().waitFor();
      assert.equal(await page.locator('html').getAttribute('data-mode'), theme);
      const palette = await page
        .locator('[data-content] .dm-card')
        .first()
        .evaluate((el) => ({
          card: getComputedStyle(el).backgroundColor,
          text: getComputedStyle(el).color,
          page: getComputedStyle(document.body).backgroundColor,
        }));
      assert.equal(palette.card, theme === 'dark' ? 'rgb(28, 28, 28)' : 'rgb(250, 250, 250)');
      assert.equal(palette.page, theme === 'dark' ? 'rgb(17, 17, 17)' : 'rgb(242, 242, 242)');
      assert.notEqual(palette.card, palette.text);
      if (theme === 'light') {
        await page.locator('html').evaluate((el) => el.setAttribute('data-theme', 'dark'));
        assert.equal(
          await page
            .locator('[data-content] .dm-card')
            .first()
            .evaluate((el) => getComputedStyle(el).backgroundColor),
          'rgb(28, 28, 28)',
        );
        await page.locator('html').evaluate((el) => el.removeAttribute('data-theme'));
      }

      const tabs = page.getByRole('navigation', { name: 'DIDMail business navigation' });
      assert.equal(await tabs.locator('[aria-current="page"]').getAttribute('href'), `/admin/${section}`);
    }
  });
  await scenario(
    'owner transfer on the account page validates, confirms once, and renders progress inline',
    async ({ page, state, mutations, delay }) => {
      await page.goto(`${origin}/en/admin/account#transfer`);
      const panel = page.locator('[data-wallet-transfer]');
      const dialog = page.getByRole('dialog');
      const amount = panel.getByLabel('Transfer amount');
      await amount.fill('11');
      await panel.getByRole('button', { name: 'Review transfer', exact: true }).click();
      await panel.getByText('Insufficient available balance.', { exact: true }).waitFor();
      assert.equal(mutations.length, 0);
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await amount.fill('0.123456789012345678');
      await panel.getByRole('button', { name: 'Review transfer', exact: true }).click();
      await dialog.getByText('test-owner-did', { exact: true }).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 1);
      await accept(page, 'Cancel');
      assert.equal(mutations.length, 0);
      assert.equal(await amount.inputValue(), '0.123456789012345678');
      await panel.getByRole('button', { name: 'Review transfer', exact: true }).click();
      const release = delay('/api/account/transfer');
      await dialog.getByRole('button', { name: 'Transfer to owner', exact: true }).click();
      await panel.getByText('Submitting transfer…', { exact: true }).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await panel.locator('.dm-spinner').waitFor();
      release();
      await panel.getByText('test-transfer-hash', { exact: true }).waitFor();
      await page.locator('[data-busy]').waitFor({ state: 'hidden' });
      assert.equal(mutations.length, 1);
      assert.deepEqual(mutations[0].body, { amount: '0.123456789012345678' });
      await page.screenshot({ path: '.data/screenshots/account-transfer-result.png', fullPage: true });
      state.transferFailure = true;
      await panel.getByRole('button', { name: 'Back', exact: true }).click();
      await amount.fill('1');
      await panel.getByRole('button', { name: 'Review transfer', exact: true }).click();
      await accept(page, 'Transfer to owner');
      await panel.getByText('Insufficient available balance.', { exact: true }).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 0);
      assert.equal(mutations.length, 2);
    },
  );
  await scenario(
    'Chinese transfer page supports quote failure, retry and precise validation',
    async ({ page, state, mutations }) => {
      state.quoteFailure = true;
      state.ownerDid = 'z1UuQe5MJEppVYFkcVdMi7ofWtMgQXvZbcc';
      await page.goto(`${origin}/zh/admin/account#transfer`);
      const panel = page.locator('[data-wallet-transfer]');
      await panel.getByText('无法验证节点余额。', { exact: true }).waitFor();
      state.quoteFailure = false;
      await panel.getByRole('button', { name: '重试', exact: true }).click();
      await panel.getByLabel('转出金额').fill('0.0000000000000000001');
      await panel.getByRole('button', { name: '确认转出信息', exact: true }).click();
      await panel.getByText('最多支持 18 位小数。', { exact: true }).waitFor();
      assert.equal(mutations.length, 0);
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: '.data/screenshots/account-transfer-zh-mobile.png', fullPage: true });
    },
  );
  await scenario(
    'admins can recharge but cannot transfer owner funds',
    async ({ page, reads, mutations }) => {
      await page.goto(`${origin}/en/admin/account#transfer`);
      await page.getByText('Only the node owner can transfer funds.', { exact: true }).waitFor();
      assert.equal(reads.filter((url) => url.pathname === '/api/account/transfer').length, 0);
      assert.equal(mutations.length, 0);
    },
    { role: 'admin' },
  );
  await scenario(
    'gas stake page uses one confirmation and inline progress with no nested dialogs',
    async ({ page, mutations, delay }) => {
      await page.goto(`${origin}/en/admin/account#stake`);
      const panel = page.locator('[data-wallet-gas]');
      const dialog = page.getByRole('dialog');
      await panel.getByText('test-self-stake-address', { exact: true }).waitFor();
      await panel.getByText('365 days', { exact: true }).waitFor();
      assert.equal(mutations.length, 0);
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await page.screenshot({ path: '.data/screenshots/account-gas-stake.png', fullPage: true });
      await panel.locator('[data-action="gas-stake"]').click();
      await dialog.getByRole('heading', { name: 'Confirm gas stake', exact: true }).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 1);
      await accept(page, 'Cancel');
      assert.equal(mutations.length, 0);
      await panel.locator('[data-action="gas-stake"]').click();
      const release = delay('/api/account/gas-stake');
      await dialog.getByRole('button', { name: 'Stake for gas', exact: true }).click();
      await panel.getByText('Submitting gas stake…', { exact: true }).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await panel.locator('.dm-spinner').waitFor();
      release();
      await panel.getByText('test-gas-stake-hash', { exact: true }).waitFor();
      await page.locator('[data-busy]').waitFor({ state: 'hidden' });
      assert.deepEqual(
        mutations.map((item) => ({ path: item.path, body: item.body })),
        [{ path: '/api/account/gas-stake', body: { policyId: 'reviewed-gas-policy' } }],
      );
      await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
      assert.equal(
        await panel.getByRole('button', { name: 'Gas stake already sufficient', exact: true }).isDisabled(),
        true,
      );
    },
  );
  await scenario(
    'Chinese gas stake page handles unavailable rules and insufficient balance without signing',
    async ({ page, state, mutations }) => {
      state.gasReadFailure = true;
      await page.goto(`${origin}/zh/admin/account#stake`);
      const panel = page.locator('[data-wallet-gas]');
      await page.getByRole('heading', { name: '节点账户', exact: true }).first().waitFor();
      await panel.getByText('无法验证链上免手续费质押规则。', { exact: true }).waitFor();
      state.gasReadFailure = false;
      state.gasEmptyBalance = true;
      await panel.getByRole('button', { name: '重试', exact: true }).click();
      await panel.getByText('365 天', { exact: true }).waitFor();
      assert.equal(await panel.locator('[data-action="gas-stake"]').isDisabled(), true);
      assert.equal(mutations.length, 0);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: '.data/screenshots/account-gas-zh-mobile.png', fullPage: true });
    },
  );
  await scenario(
    'admins cannot initiate gas staking',
    async ({ page, reads, mutations }) => {
      await page.goto(`${origin}/en/admin/account#stake`);
      await page.getByText('Only the node owner can stake for gas.', { exact: true }).waitFor();
      assert.equal(reads.filter((url) => url.pathname === '/api/account/gas-stake').length, 0);
      assert.equal(mutations.length, 0);
    },
    { role: 'admin' },
  );
  await scenario(
    'gas stake revocation and claim verify waiting state and keep confirmations separate',
    async ({ page, state, mutations, delay }) => {
      state.gasEligible = true;
      await page.goto(`${origin}/zh/admin/account#stake`);
      const panel = page.locator('[data-wallet-gas]');
      await panel.getByRole('button', { name: '解除质押', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog
        .getByText('申请解除质押后，需等待 365 天才能领取资金。滥用网络可能导致质押被罚没。', { exact: true })
        .waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 1);
      await accept(page, '取消');
      assert.equal(mutations.length, 0);
      await panel.getByRole('button', { name: '解除质押', exact: true }).click();
      const release = delay('/api/account/gas-stake/revoke');
      await dialog.getByRole('button', { name: '解除质押', exact: true }).click();
      await panel.getByText('正在解除质押…', { exact: true }).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 0);
      release();
      await panel.getByText('test-gas-revoke-hash', { exact: true }).waitFor();
      await page.locator('[data-busy]').waitFor({ state: 'hidden' });
      assert.deepEqual(mutations[0].body, { policyId: 'reviewed-exit-policy' });
      await panel.getByRole('button', { name: '刷新', exact: true }).click();
      await panel.getByRole('heading', { name: '待取回资金', exact: true }).waitFor();
      assert.equal(await panel.getByRole('button', { name: '取回', exact: true }).isDisabled(), true);
      assert.equal(mutations.length, 1);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `.data/screenshots/account-gas-waiting-${theme}.png`, fullPage: true });
      state.gasWithdrawals[0] = { ...state.gasWithdrawals[0], claimable: true, availableAt: '2020-01-01T00:00:00Z' };
      await panel.getByRole('button', { name: '刷新', exact: true }).click();
      await panel.getByText('可取回', { exact: true }).waitFor();
      await panel.getByRole('button', { name: '取回', exact: true }).click();
      await dialog.getByText('资金将返回节点账户，取回后可能不再满足免手续费要求。', { exact: true }).waitFor();
      await accept(page, '取回');
      await panel.getByText('test-gas-claim-hash', { exact: true }).waitFor();
      await page.locator('[data-busy]').waitFor({ state: 'hidden' });
      assert.deepEqual(mutations[1].body, { policyId: 'reviewed-exit-policy', evidence: 'A'.repeat(64) });
      await panel.getByRole('button', { name: '刷新', exact: true }).click();
      await panel.getByRole('button', { name: '免手续费质押', exact: true }).waitFor();
      assert.equal(await panel.locator('[data-action="gas-claim"]').count(), 0);
    },
  );
  await scenario('node settings stay read-only and waiting periods follow the chain', async ({ page, state }) => {
    state.stake.ownerAssets = [asset];
    state.stake.address = 'test-stake-address';
    state.stake.tokens = [{ ...token, value: '0' }];
    state.stake.revokedTokens = [{ ...token, value: '0' }];
    await page.goto(`${origin}/en/admin/server`);
    const card = page.locator('[data-node-asset]');
    await card.getByText('120 seconds', { exact: true }).waitFor();
    await card.getByText('test-stake-address', { exact: true }).waitFor();
    const stakeAmount = card
      .locator('.dm-fields > div')
      .filter({ has: page.locator('dt', { hasText: 'Amount to stake' }) });
    assert.equal(await stakeAmount.locator('dd').textContent(), '1 TBA');
    assert.equal(
      await card
        .locator('dt')
        .filter({ hasText: /^(Staked|Revoked)$/ })
        .count(),
      0,
    );
    const actions = card.locator('.dm-node-asset-actions');
    const footerBox = await actions.boundingBox();
    const stakeBox = await actions.getByRole('button', { name: 'Stake', exact: true }).boundingBox();
    assert.ok(Math.abs(footerBox.x + footerBox.width - stakeBox.x - stakeBox.width) < 2);
    assert.equal(await card.locator('[data-node-name], [data-node-stake]').count(), 0);
    state.chainId = 'main';
    await page.goto(`${origin}/en/admin/server`);
    await card.getByText('604800 seconds', { exact: true }).waitFor();
    assert.equal(await card.locator('[data-node-name], [data-node-stake]').count(), 0);
  });
  await scenario(
    'staking controls animate during submission and fit desktop and mobile',
    async ({ page, state, delay, mutations }) => {
      state.stake.ownerAssets = [asset];
      await page.goto(`${origin}/en/admin/server`);
      const card = page.locator('[data-node-asset]');
      await card.getByRole('button', { name: 'Stake', exact: true }).click();
      const releaseStake = delay('/api/stake/asset');
      await page.getByRole('dialog').getByRole('button', { name: 'Stake Node NFT', exact: true }).click();
      await card.locator('[data-action="stake"][aria-busy="true"] .dm-spinner').waitFor();
      assert.equal(await card.getByRole('button', { name: 'Stake', exact: true }).isDisabled(), true);
      releaseStake();
      await page.locator('[data-busy]').waitFor({ state: 'hidden' });
      const form = card.locator('[data-add-stake]');
      await form.getByLabel('Additional stake').fill('2');
      await form.getByRole('button', { name: 'Add Stake', exact: true }).click();
      const releaseAdd = delay('/api/stake/add');
      await page.getByRole('dialog').getByRole('button', { name: 'Add Stake', exact: true }).click();
      await form.locator('button[aria-busy="true"] .dm-spinner').waitFor();
      assert.equal(await form.getByRole('button', { name: 'Add Stake', exact: true }).isDisabled(), true);
      assert.equal(await form.locator('input').inputValue(), '2');
      assert.equal(await form.locator('input').getAttribute('readonly'), '');
      releaseAdd();
      await page.locator('[data-busy]').waitFor({ state: 'hidden' });
      assert.equal(await form.locator('button .dm-spinner').count(), 0);
      assert.equal(await form.getByRole('button', { name: 'Add Stake', exact: true }).isEnabled(), true);
      assert.deepEqual(
        mutations.map((item) => item.path),
        ['/api/stake/asset', '/api/stake/add'],
      );
      await page.screenshot({ path: '.data/screenshots/stake-controls-desktop.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const inputBox = await form.locator('input').boundingBox();
      const buttonBox = await form.locator('button').boundingBox();
      assert.ok(inputBox.x + inputBox.width <= buttonBox.x);
      await page.screenshot({ path: '.data/screenshots/stake-controls-mobile.png', fullPage: true });
    },
  );
  await scenario('node NFT acquire, stake, add, revoke cancellation and claim', async ({ page, state, mutations }) => {
    await page.goto(`${origin}/admin/server`);
    await page.getByText('No staked node NFTs yet', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Acquire', exact: true }).click();
    await accept(page, 'Acquire');
    assert.equal(mutations[0].path, '/api/servers/acquire');
    await page.getByRole('button', { name: 'Stake', exact: true }).click();
    await accept(page, 'Stake Node NFT');
    assert.deepEqual(mutations.at(-1).body, { assetAddress: asset.address });
    await page.getByLabel('Additional stake').fill('2');
    await page.getByRole('button', { name: 'Add Stake', exact: true }).click();
    await accept(page, 'Add Stake');
    assert.deepEqual(mutations.at(-1).body, { amount: 2 });
    await page.getByRole('button', { name: 'Revoke', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    assert.equal(mutations.length, 3);
    await page.getByRole('button', { name: 'Revoke', exact: true }).click();
    await accept(page, 'Revoke Stake');
    await page.getByRole('button', { name: 'Claim', exact: true }).click();
    await accept(page, 'Claim Stake');
    assert.equal(mutations.at(-1).path, '/api/stake/claim');
    state.stake.ownerAssets = [
      { ...asset, data: { value: JSON.stringify({ endpoint: 'https://old.test', location: 'AS-CN-SH' }) } },
    ];
    await page.getByRole('button', { name: 'Refresh node NFTs' }).click();
    await page.locator('[data-busy]').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Update Endpoint', exact: true }).click();
    await accept(page, 'Update Endpoint');
    assert.equal(mutations.at(-1).path, '/api/stake/update-endpoint');
    assert.deepEqual(mutations.at(-1).body, { asset: asset.address });
    await page.screenshot({ path: `.data/screenshots/native-server-${theme}.png`, fullPage: true });
    await page.locator('header [data-node-recharge]').click();
    await page.locator('[data-wallet-recharge] .dm-account-recharge > svg').waitFor();
    const dialog = page.locator('.dm-account-operations');
    assert.equal(
      await dialog.evaluate((el) => getComputedStyle(el).backgroundColor),
      theme === 'dark' ? 'rgb(28, 28, 28)' : 'rgb(250, 250, 250)',
    );
    assert.equal(
      await dialog
        .locator('[data-wallet-recharge] .dm-account-recharge > svg')
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(255, 255, 255)',
    );
    await page.screenshot({ path: `.data/screenshots/native-recharge-${theme}.png`, fullPage: true });
    assert.equal(await page.locator('dialog[open]').count(), 0);
  });
  for (const kind of ['envelope', 'namecard'])
    await scenario(
      `${kind} SVG validation, creation, publish rollback, pagination and clean`,
      async ({ page, state, mutations, reads, delay }) => {
        await page.goto(`${origin}/admin/${kind}`);
        await page.getByRole('heading', { name: 'Preview', exact: true }).waitFor();
        {
          const preview = page.locator('.dm-upload-zone');
          const fields = page.locator('.dm-template-fields');
          assert.ok((await preview.boundingBox()).x < (await fields.boundingBox()).x);
          const samples = page.locator('.dm-template-samples');
          assert.equal(await samples.locator('figure').count(), 5);
          assert.equal(await samples.locator('a[download]').count(), 5);
          assert.equal(await samples.getByRole('button').first().innerText(), '');
          if (kind === 'namecard') {
            for (const name of ['executiveCard', 'techCard', 'creativeCard', 'consultantCard']) {
              await samples.locator(`[data-template-name="${name}"]`).click();
              await page.waitForFunction(
                (fileName) => document.querySelector('[data-preview-status]').textContent === fileName,
                `${name}.svg`,
              );
              await page.locator('[data-preview]').evaluate((img) => img.decode());
              assert.equal(
                await samples.locator(`[data-template-name="${name}"]`).getAttribute('aria-pressed'),
                'true',
              );
              assert.equal(await page.locator('[data-preview]').evaluate((img) => img.naturalWidth > 0), true);
            }
            await page
              .locator('.dm-template-create')
              .screenshot({ path: `.data/screenshots/namecard-new-samples-${theme}.png` });
            const chooserEvent = page.waitForEvent('filechooser');
            await page.locator('.dm-upload-zone').click();
            await (await chooserEvent).setFiles([]);
          }

          await page
            .locator('.dm-template-create')
            .screenshot({ path: `.data/screenshots/${kind}-create-empty-${theme}.png` });
        }
        await page.locator('input[type=file]').setInputFiles({
          name: 'invalid.svg',
          mimeType: 'image/svg+xml',
          buffer: Buffer.from(
            kind === 'namecard'
              ? '<svg xmlns="http://www.w3.org/2000/svg"><text>{{namecard.name}}</text></svg>'
              : '<svg xmlns="http://www.w3.org/2000/svg"/>',
          ),
        });
        await page.getByRole('alert').filter({ hasText: 'must contain' }).waitFor();
        assert.equal(mutations.length, 0);
        await page.getByRole('button', { name: 'Use default', exact: true }).click();
        await page.locator('[data-preview]:not([hidden])').waitFor();
        {
          assert.equal(await page.locator('.dm-template-select[aria-pressed="true"]').count(), 1);
          const downloadEvent = page.waitForEvent('download');
          await page.locator('.dm-template-samples a[download]').last().click();
          assert.equal(
            (await downloadEvent).suggestedFilename(),
            kind === 'envelope' ? 'festivalCard.svg' : 'consultantCard.svg',
          );
          assert.equal(
            await page.locator('.dm-template-select[aria-pressed="true"]').getAttribute('data-template-name'),
            'default',
          );
          if (kind === 'envelope') {
            await page.locator('.dm-template-select[data-template-name="festivalCard"]').press('Enter');
            await page.waitForFunction(
              () => document.querySelector('[data-preview-status]').textContent === 'festivalCard.svg',
            );
          }
          const chooserEvent = page.waitForEvent('filechooser');
          await page.locator('.dm-upload-zone').click();
          const chooser = await chooserEvent;
          await chooser.setFiles({
            name: 'custom.svg',
            mimeType: 'image/svg+xml',
            buffer: Buffer.from(
              kind === 'envelope'
                ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"><text>{{mail.subject}}</text><text y="30">{{mail.sender}}</text></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 200"><text>{{contact.name}}</text></svg>',
            ),
          });
          await page.waitForFunction(
            () => document.querySelector('[data-preview-status]').textContent === 'custom.svg',
          );
          assert.equal(await page.locator('.dm-template-select[aria-pressed="true"]').count(), 0);
          await page.getByRole('button', { name: 'Use default', exact: true }).click();
          await page.waitForFunction(
            () => document.querySelector('[data-preview-status]').textContent === 'default.svg',
          );
          await page
            .locator('.dm-template-create')
            .screenshot({ path: `.data/screenshots/${kind}-create-selected-${theme}.png` });
          await page.setViewportSize({ width: 390, height: 844 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          assert.ok(
            (await page.locator('.dm-upload-zone').boundingBox()).y <
              (await page.locator('.dm-template-fields').boundingBox()).y,
          );
          await page
            .locator('.dm-template-create')
            .screenshot({ path: `.data/screenshots/${kind}-create-mobile-${theme}.png` });
          await page.setViewportSize({ width: 1440, height: 1000 });
        }
        assert.equal(
          await page.locator('[data-preview]').evaluate((img) => img.complete && img.naturalWidth > 0),
          true,
        );
        await page.getByLabel('Name', { exact: true }).fill('UI Test Template');
        await page.getByLabel('Price', { exact: false }).fill('0.001');
        await page.getByLabel('Description', { exact: true }).fill('Test description');
        if (kind === 'envelope') await page.getByLabel('Retention Period', { exact: false }).fill('7');
        await page.getByRole('button', { name: 'Create Factory', exact: true }).click();
        const releaseCreate = delay(`/api/${kind}/acquire`);
        await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
        const submit = page.locator('[data-template] button[type="submit"]');
        await submit.getByText('Creating Factory…', { exact: true }).waitFor();
        assert.equal(await submit.isDisabled(), true);
        assert.equal(await submit.getAttribute('aria-busy'), 'true');
        await submit.locator('.dm-spinner').waitFor();
        releaseCreate();
        await page.locator('[data-busy]').waitFor({ state: 'hidden' });
        assert.equal(await submit.textContent(), 'Create Factory');
        assert.equal(await submit.getAttribute('aria-busy'), 'false');
        await page
          .locator('[data-list] img.dm-preview')
          .first()
          .evaluate((img) => img.decode());
        assert.equal(mutations[0].path, `/api/${kind}/acquire`);
        assert.ok(reads.some((url) => url.pathname === `/api/${kind}/list` && url.searchParams.get('refresh') === '1'));
        assert.match(mutations[0].body, /name="file"/);
        assert.match(mutations[0].body, /UI Test Template/);
        if (kind === 'envelope') assert.match(mutations[0].body, /name="retentionPeriod"/);
        const toggle = page.getByRole('checkbox', { name: 'Enable UI Test Template' });
        state.failPublish = true;
        await toggle.check();
        await page.getByRole('alert').filter({ hasText: 'Publish denied' }).waitFor();
        assert.equal(await toggle.isChecked(), false);
        state.failPublish = false;
        await toggle.check();
        await page.getByRole('status').filter({ hasText: 'Publish setting saved' }).waitFor();
        assert.equal(mutations.at(-1).body.enabled, true);
        assert.equal(mutations.at(-1).body.address, 'template-nft');
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.locator('[data-busy]').waitFor({ state: 'hidden' });
        assert.equal(reads.at(-1).searchParams.get('cursor'), '1');
        await page.getByRole('button', { name: 'Clean', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
        const n = mutations.length;
        await page.getByRole('button', { name: 'Clean', exact: true }).click();
        await accept(page, 'Clean');
        assert.equal(mutations.length, n + 1);
        assert.equal(mutations.at(-1).method, 'DELETE');
        assert.equal(reads.at(-1).searchParams.get('cursor'), '0');
        await page.screenshot({ path: `.data/screenshots/native-${kind}-${theme}.png`, fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      },
    );
  for (const kind of ['envelope', 'namecard'])
    await scenario(
      `${kind} failed creation restores the button and preserves the selected preview`,
      async ({ page, state, mutations }) => {
        state.failAcquire = true;
        await page.goto(`${origin}/admin/${kind}`);
        await page.getByLabel('Name', { exact: true }).fill('Retry Template');
        await page.getByLabel('Price', { exact: false }).fill('0.001');
        await page.getByLabel('Description', { exact: true }).fill('Retry description');
        await page.locator('[data-action="use-template"]').first().click();
        await page.getByRole('button', { name: 'Create Factory', exact: true }).click();
        await accept(page, 'Create');
        await page.getByRole('alert').filter({ hasText: 'Factory temporarily unavailable' }).waitFor();
        const submit = page.getByRole('button', { name: 'Create Factory', exact: true });
        assert.equal(await submit.isEnabled(), true);
        assert.equal(await submit.getAttribute('aria-busy'), 'false');
        assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Retry Template');
        assert.equal(await page.locator('[data-preview]').isVisible(), true);
        state.failAcquire = false;
        await submit.click();
        await accept(page, 'Create');
        assert.equal(mutations.length, 2);
        await page
          .locator('[data-list] img.dm-preview')
          .first()
          .evaluate((img) => img.decode());
      },
    );
  await scenario(
    'storage search, pagination, safe deletion and API failure',
    async ({ page, state, mutations, reads }) => {
      await page.goto(`${origin}/admin/storage`);
      await openMailDetails(page);
      await page.getByRole('button', { name: 'Delete mail 7' }).waitFor();
      await page.getByRole('searchbox').fill('sender-did');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.locator('[data-busy]').waitFor({ state: 'hidden' });
      assert.equal(
        reads.findLast((url) => url.pathname === '/api/storage/mails').searchParams.get('search'),
        'sender-did',
      );
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.locator('[data-busy]').waitFor({ state: 'hidden' });
      assert.equal(reads.findLast((url) => url.pathname === '/api/storage/mails').searchParams.get('page'), '2');
      await openMailDetails(page);
      await page.getByRole('button', { name: 'Delete mail 7' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
      assert.equal(mutations.length, 0);
      state.failDelete = true;
      await openMailDetails(page);
      await page.getByRole('button', { name: 'Delete mail 7' }).click();
      await accept(page, 'Delete');
      await page.getByRole('alert').filter({ hasText: 'Delete denied' }).waitFor();
      assert.equal(state.mails.length, 1);
      state.failDelete = false;
      await openMailDetails(page);
      await page.getByRole('button', { name: 'Delete mail 7' }).click();
      await accept(page, 'Delete');
      await page.getByText('No matching mail.').waitFor();
      assert.equal(mutations.at(-1).path, '/api/storage/mails/delete/7');
    },
  );
  await scenario(
    'envelope creation remains the only configuration entry, with no whitelist controls',
    async ({ page, mutations }) => {
      await page.goto(`${origin}/admin/envelope`);
      await page.locator('[data-template]').waitFor();
      assert.equal(await page.locator('[data-mail-service], [data-default-envelope]').count(), 0);
      assert.equal(await page.getByText('Default envelope for direct connections').count(), 0);
      assert.equal(await page.locator('textarea[name="allowedDids"]').count(), 0);
      assert.equal(mutations.length, 0);
      await page.screenshot({ path: `.data/screenshots/default-envelope-mobile-${theme}.png`, fullPage: true });
    },
  );
  await scenario('attachment policy preserves integer wei and updates exact fields', async ({ page, mutations }) => {
    await page.goto(`${origin}/admin/attachment`);
    await page.locator('.dm-legacy-settings > summary').click();
    await page.getByRole('button', { name: 'Save Policy' }).waitFor();
    const price = page.getByLabel('Price Per Byte Per Day', { exact: false });
    assert.equal(await price.inputValue(), '9007199254740993');
    await page.getByLabel('Max File Size', { exact: false }).fill('2.5');
    await page.getByLabel('Max File Count', { exact: false }).fill('3');
    await price.fill('900719925474099312345');
    await page.getByRole('button', { name: 'Save Policy' }).click();
    await page.getByText('Attachment policy saved successfully.').waitFor();
    assert.deepEqual(mutations[0], {
      path: '/api/admin/attachment-config',
      method: 'PUT',
      body: { maxFileSizeBytes: 2621440, maxFileCount: 3, pricePerBytePerDay: '900719925474099312345' },
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const tab = document.querySelector('.dm-tabs [aria-current="page"]').getBoundingClientRect();
      return tab.left >= 0 && tab.right <= innerWidth;
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `.data/screenshots/native-attachment-mobile-${theme}.png`, fullPage: true });
  });
  await scenario(
    'member cannot load business data or actions',
    async ({ page, reads, mutations }) => {
      await page.goto(`${origin}/admin/server`);
      await page.getByRole('alert').filter({ hasText: 'Permission denied' }).waitFor();
      assert.equal(reads.length, 0);
      assert.equal(mutations.length, 0);
    },
    { role: 'member' },
  );
  for (const { code, label } of languages.filter(({ code }) => ['ar', 'ja', 'ru'].includes(code))) {
    await scenario(`${code} language switch, persistence, admin and mobile`, async ({ page, mutations }) => {
      const t = adminTranslator(code);
      await page.goto(`${origin}/?entry=locale#features`);
      const picker = page.locator('[data-role="locale-switcher"]');
      await picker.locator(':scope > button').click();
      await Promise.all([
        page.waitForURL(`**/${code}/?entry=locale#features`),
        picker.getByRole('menuitem', { name: label, exact: true }).click(),
      ]);
      assert.equal(await page.locator('html').getAttribute('lang'), code);
      await page.waitForFunction((direction) => document.documentElement.dir === direction, localeDirection(code));
      await page.getByRole('heading', { name: messages(code).encryptionTitle, exact: true }).waitFor();
      await page.goto(`${origin}/`);
      assert.equal(new URL(page.url()).pathname, `/${code}/`);
      await page.goto(`${origin}/admin/attachment`);
      assert.equal(new URL(page.url()).pathname, `/${code}/admin/attachment`);
      await page.locator('.dm-legacy-settings > summary').click();
      await page.getByRole('heading', { name: t('Attachment Policy'), exact: true }).waitFor();
      assert.equal(await page.getByLabel(t('Max File Count')).inputValue(), '5');
      await page.locator(`.dm-tabs a[href="${localizedPath('/admin/storage', code)}"]`).click();
      await page.getByRole('heading', { name: t('Mails'), exact: true }).waitFor();
      await openMailDetails(page);
      await page.getByRole('button', { name: t('Delete mail {id}', { id: 7 }), exact: true }).click();
      await page
        .getByRole('dialog')
        .getByRole('heading', { name: t('Delete Mail'), exact: true })
        .waitFor();
      await page.getByRole('button', { name: t('Cancel'), exact: true }).click();
      assert.equal(mutations.length, 0);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => {
        const tab = document.querySelector('.dm-tabs [aria-current="page"]').getBoundingClientRect();
        return tab.left >= 0 && tab.right <= innerWidth;
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `.data/screenshots/native-storage-${code}-mobile-${theme}.png`, fullPage: true });
    });
  }
  console.log(`Native UI scenarios: ${count} passed. No real chain transactions sent.`);
} finally {
  await browser.close();
}
