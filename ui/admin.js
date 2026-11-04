import { renderStorageTable, storagePayment, storageFeeDetails } from './storage-list.js';
import { installIdentityUI } from './identity.js';
import { mountMembers } from './members.js';
import { mountMailPolicy } from './mail-policy.js';
import { nodeStore } from './node-state.js';
import { readPageSession } from './node-header.js';
import './chrome.js';
import { resolveLocale, localizedPath } from './locales.js';
import { adminTranslator, adminError } from './admin-i18n.js';
import qrcode from 'qrcode-generator';
import { templates as templateFiles } from './templates.js';
import {
  escapeHtml as e,
  didMarkup,
  amountText,
  toUnits,
  tokenText,
  accountBalanceText,
  request,
  svgSource,
  assetData,
  canAfford,
  loadingMarkup,
} from './shared.js';

const locale = resolveLocale(document.documentElement.lang);
const t = adminTranslator(locale);
const tokenLabel = (token, empty = t('NO BALANCE')) => tokenText(token, t(empty));
const dateLabel = (value) => new Date(value).toLocaleString(locale);
const errorMessage = (error) => adminError(locale, error);
const app = document.querySelector('[data-didmail-admin]');
if (app && !app.dataset.initialized) {
  app.dataset.initialized = 'true';
  boot(app).catch((error) => {
    app.querySelector('[data-session]').textContent = errorMessage(error);
  });
}
async function boot(root) {
  const $ = (selector) => root.querySelector(selector);
  const section = root.dataset.section;
  installIdentityUI(root, t);
  const content = $('[data-content]');
  const accountBox = $('[data-account]');
  let account, stake, forge, stakeError, accountError, factory, factoryError;
  let accountPending = true,
    stakePending = section === 'server',
    accountFlight,
    store;
  let watching = false;
  let page = 1,
    pageSize = 10,
    search = '',
    cursor = '0';
  let file, previewUrl;
  let purchaseBalanceWarning = false;
  let acquirePending = false;
  let stakeAction = '';
  let ownerSession = false;
  let transferQuote;
  let gasQuote;
  let actionPending = false,
    listVersion = 0;
  const dialog = $('[data-dialog]');
  const tabs = $('.dm-tabs-inner');
  const activeTab = tabs.querySelector('[aria-current="page"]');
  const tabObserver = new ResizeObserver(() => {
    const viewport = tabs.getBoundingClientRect();
    const selected = activeTab.getBoundingClientRect();
    if (selected.left < viewport.left || selected.right > viewport.right) {
      tabs.scrollLeft += selected.left - viewport.left - (viewport.width - selected.width) / 2;
    }
  });
  tabObserver.observe(tabs);
  window.addEventListener('pagehide', () => tabObserver.disconnect(), { once: true });
  const buttonIcons = {
    'refresh-account':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 1-2.3-5.7L20 9"/></svg>',
    recharge:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h3v3h3M15 21v-3M21 15v-3M12 3v3M12 12h3M3 12h3"/></svg>',
  };

  const button = (label, action, attrs = '') =>
    `<button type="button" data-action="${action}" ${stakeAction === action ? 'aria-busy="true"' : ''} ${attrs}>${stakeAction === action ? '<span class="dm-spinner" aria-hidden="true"></span>' : ''}${buttonIcons[action] || e(label)}</button>`;
  const notice = (message = '', kind = 'error') => {
    purchaseBalanceWarning = kind === 'error' && t(message) === t('Insufficient balance. Recharge the node first.');
    $('[data-notice]').innerHTML = message
      ? `<div class="dm-alert" data-kind="${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${e(t(message))}</div>`
      : '';
  };
  const localError = (box, error, retry) => {
    box.innerHTML = `<div class="dm-alert" role="alert">${e(errorMessage(error))} ${retry ? button(t('Retry'), retry, 'class="dm-secondary dm-retry"') : ''}</div>`;
  };
  const fields = (pairs, { full = false } = {}) =>
    `<dl class="dm-fields">${pairs.map(([name, value]) => `<div><dt>${e(name)}</dt><dd>${didMarkup(value, t, { full })}</dd></div>`).join('')}</dl>`;
  function showDialog(title, html, confirmLabel, { wallet = false } = {}) {
    if (dialog.open) dialog.close();
    dialog.classList.toggle('dm-wallet-dialog', wallet);
    $('[data-dialog-body]').innerHTML =
      `<h2 id="dm-dialog-title">${e(title)}</h2>${html}${wallet && !confirmLabel ? `<button type="button" data-dialog-close class="dm-dialog-close" aria-label="${e(t('Close'))}" title="${e(t('Close'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>` : `<div class="dm-actions"><button type="button" data-dialog-close class="dm-secondary">${confirmLabel ? t('Cancel') : t('Close')}</button>${confirmLabel ? `<button type="button" data-dialog-confirm>${e(confirmLabel)}</button>` : ''}</div>`}`;
    const result = new Promise((resolve) => {
      const close = () => dialog.close('cancel');
      $('[data-dialog-close]').onclick = close;
      if (confirmLabel) $('[data-dialog-confirm]').onclick = () => dialog.close('confirm');
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    });
    // Native dialogs retain returnValue between openings. Escape must never
    // reuse a previous confirmation.
    dialog.returnValue = 'cancel';
    dialog.showModal();
    // A confirmation starts on its safe action, after the terms remain available
    // to screen readers and keyboard users in the dialog's reading order.
    if (confirmLabel) $('[data-dialog-close]').focus();
    return result;
  }
  const loginHref = () =>
    `/.well-known/service/login?return_to=${encodeURIComponent(location.pathname + location.search)}`;
  async function loadSession() {
    $('[data-session]').innerHTML = loadingMarkup(t('Checking ARC session…'), 2);
    try {
      const session = await readPageSession();
      if (!session.authenticated || !session.user) {
        $('[data-session]').innerHTML =
          `<div class="dm-empty"><h1>${e(t('DIDMail Admin'))}</h1><p>${e(t('Sign in to manage your server node.'))}</p><p><a class="dm-button" href="${loginHref()}">${e(t('Sign in with ARC'))}</a></p></div>`;
        return;
      }
      if (!['owner', 'admin'].includes(session.user.role)) {
        $('[data-session]').innerHTML =
          `<p class="dm-empty" role="alert">${e(t('Permission denied: Only owner or admin can access this page, current role is {role}', { role: t(session.user.role) }))}</p>`;
        return;
      }
      $('[data-session]').innerHTML = '';
      $('[data-workspace]').hidden = false;
      ownerSession = session.user.role === 'owner';
      store = nodeStore(session);
      if (!['attachment','members'].includes(section)) watchNodeState();
      await Promise.all([['attachment','members'].includes(section) ? undefined : loadAccount({ force: false }), loadSection()]);
    } catch (error) {
      localError($('[data-session]'), error, 'session-retry');
    }
  }
  function watchNodeState() {
    if (watching) return;
    watching = true;
    const update = () => {
      if (purchaseBalanceWarning && !accountPending && !accountError && account
        && account.chainStatus !== 'unavailable' && canAfford(account.tokens, factory?.token)) notice();
      renderAccount();
      syncTransactionControls();
      if (section === 'server') renderServer();
      if (section === 'storage') updateMailCurrency();
      if (['envelope', 'namecard'].includes(section)) updateTemplateCost();
      accountBox?.setAttribute('aria-busy', String(accountPending || stakePending));
    };
    store.watch('account', (state) => {
      account =
        state.data ||
        (state.error && store.node ? { ...store.node, chainStatus: 'unavailable', tokens: [] } : undefined);
      accountError = state.error;
      accountPending = state.fetching || (!state.data && !state.error);
      update();
    });
    if (section === 'server')
      store.watch(
        'stake',
        (state) => {
          stake = state.data;
          stakeError = state.error;
          stakePending = state.fetching || (!state.data && !state.error);
          update();
        },
      );
    store.watch('forge', (state) => {
      forge = state.data;
      update();
    });
  }
  function loadAccount({ force = true } = {}) {
    if (accountFlight) return accountFlight;
    accountFlight = Promise.allSettled([
      store.read('account', { force }),
      ...(section === 'server' ? [store.read('stake', { force })] : []),
    ]).finally(() => {
      accountFlight = null;
    });
    return accountFlight;
  }
  function nodeToken() {
    return account?.tokens?.find((t) => t.symbol === forge?.token?.symbol) || account?.tokens?.[0];
  }
  function renderAccount() {
    if (!accountBox) return;
    if (!account && accountPending) {
      accountBox.innerHTML = loadingMarkup(t('Loading node account…'));
      return;
    }
    const unknown = !account || Boolean(accountError) || account.chainStatus === 'unavailable';
    const refreshing = accountPending || stakePending;
    const symbol = forge?.token?.symbol;
    const issue = unknown || Boolean(stakeError);
    const diagnostics = [accountError, stakeError].filter(Boolean).map(errorMessage);
    const empty = symbol ? `0 ${symbol}` : '0';
    const unavailable = `<span aria-label="${e(t('Unavailable'))}" title="${e(t('Unavailable'))}">—</span>`;
    const balance = accountBalanceText(nodeToken(), {
      unavailable: unknown,
      knownEmpty: !unknown && ['ready', 'unregistered'].includes(account?.chainStatus) && Array.isArray(account.tokens) && account.tokens.length === 0,
      empty,
    });
    const detailsOpen = accountBox.querySelector('[data-balance-exact]')?.open === true;
    const metric = balance.exact === null ? unavailable : e(balance.summary);
    const exactDetails = balance.exact === null ? '' : `<details class="dm-account-balance-details" data-balance-exact${detailsOpen ? ' open' : ''}><summary aria-label="${e(t('Details'))}: ${e(t('Available balance'))}">${e(t('Details'))}</summary><span class="dm-account-balance-exact" data-balance-exact-value dir="ltr">${e(balance.exact)}</span></details>`;
    accountBox.innerHTML = `<div class="dm-node-body"><div class="dm-node-identity"><span class="dm-node-moniker">${e(t('Node address'))}</span><span class="dm-node-account-address">${didMarkup(account?.address || store.node?.address, t, { full: true })}</span><span class="dm-node-endpoint">${e(t('Network:'))} ${e(account?.chainId || store.node?.chainId)}</span></div><div class="dm-metrics"><div><span>${e(t('Available balance'))}</span><strong>${metric}</strong>${exactDetails}</div></div>${button('↻', 'refresh-account', `class="dm-secondary" aria-label="${e(t('Refresh node account'))}" aria-busy="${refreshing}" ${refreshing ? 'disabled' : ''}`)}</div>
      ${issue ? `<details class="dm-node-notice"><summary><span role="status">${e(t('Some node data is unavailable'))}</span><span class="dm-node-details-label">${e(t('Details'))}</span></summary><div>${e(diagnostics.join(' · ') || t('Node balance could not be verified.'))}</div></details>` : account?.chainStatus === 'unregistered' ? `<p class="dm-node-notice">${e(t('Recharge on {network} to activate this node.', { network: account.chainId }))}</p>` : ''}`;
    syncTransactionControls();
  }
  async function loadSection() {
    content.innerHTML = loadingMarkup(t('Loading page data…'), 5);
    try {
      if (section === 'account') {
        renderWalletPage();
      } else if (section === 'server') {
        await loadServerFactory();
      } else if (section === 'members') {
        content.innerHTML = '';
        await mountMailPolicy(content, t, 'members');
        await mountMembers(content, t);
      } else if (section === 'attachment') await loadAttachment();
      else if (section === 'storage') {
        content.innerHTML = `<section class="dm-card dm-storage-summary"><div><span class="dm-small dm-muted">${e(t('Database Used Size:'))}</span><strong data-size>${e(t('Loading…'))}</strong></div>${button(t('Refresh'), 'storage-refresh', 'class="dm-secondary"')}</section><section class="dm-card dm-storage-mails"><div class="dm-storage-toolbar"><h2>${e(t('Mails'))}</h2><form data-search class="dm-storage-search" role="search"><label><span class="dm-visually-hidden">${e(t('Search'))}</span><input type="search" name="search" placeholder="${e(t('Search By ID/Address/Envelope/Hash'))}"></label><button>${e(t('Search'))}</button></form></div><div data-list></div></section>`;
        await Promise.all([loadMails(), loadStorageSize()]);
      } else {
        const title = section === 'envelope' ? t('Envelope') : t('Namecard');
        content.innerHTML = `<div data-template-factory>${loadingMarkup(t('Loading {type} factory…', { type: title }), 5)}</div><section class="dm-template-list"><div class="dm-row dm-template-list-heading"><h2>${e(t('{type} List', { type: title }))}</h2><div class="dm-actions">${button(t('Clean'), 'clean', 'class="dm-secondary"')}${button(t('Refresh'), 'list-refresh', 'class="dm-secondary"')}</div></div><div data-list></div></section>`;
        renderTemplateForm();
        await loadTemplates();
      }
    } catch (error) {
      localError(content, error, 'section-retry');
    }
  }
  async function loadServerFactory({ refresh = false } = {}) {
    factoryError = null;
    renderServer();
    try {
      factory = await request(`/api/servers/factory${refresh ? '?refresh=1' : ''}`);
    } catch (error) {
      factoryError = error;
    }
    renderServer();
  }
  async function showServerFactory() {
    void showDialog(
      t('DIDMail Server Node NFT Factory'),
      `<div data-server-factory-info>${loadingMarkup(t('Loading node factory…'), 5)}</div>`,
    );
    const box = $('[data-server-factory-info]');
    try {
      const result = await request('/api/servers/factory?refresh=1');
      factory = result;
      factoryError = null;
      renderServer();
      const source = svgSource(result.display);
      if (dialog.open && box.isConnected)
        box.innerHTML = `${factoryFields(result)}<h3>${e(t('NFT SVG template'))}</h3>${source ? `<img class="dm-factory-preview" src="${e(source)}" alt="${e(t('Server node NFT SVG template'))}">` : `<p class="dm-muted">${e(t('No SVG template available'))}</p>`}`;
    } catch (error) {
      if (dialog.open && box.isConnected) localError(box, error, 'server-factory-info');
    }
  }
  function syncTransactionControls() {
    const submit = $('[data-template] button[type=submit], [data-template] > button');
    if (submit && !actionPending)
      submit.disabled =
        accountPending ||
        stakePending ||
        Boolean(accountError || stakeError) ||
        !account ||
        account.chainStatus === 'unavailable';
  }
  function updateTemplateCost() {
    const cost = $('[data-template-cost]');
    if (cost) cost.textContent = factory?.token ? tokenLabel(factory.token) : t('Confirmed before creation');
    const currency = $('[data-template-currency]');
    if (currency) currency.textContent = forge?.token?.symbol || factory?.token?.symbol || '';
  }
  async function readTemplateFactory() {
    const result = await request(`/api/${section}/factory`);
    factory = result;
    updateTemplateCost();
    return result;
  }
  async function showTemplateFactory() {
    void showDialog(
      t('{type} Factory', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }),
      `<div data-factory-info>${loadingMarkup(t('Loading {type} factory…', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }), 5)}</div>`,
    );
    const box = $('[data-factory-info]');
    try {
      const result = await readTemplateFactory();
      if (dialog.open && box.isConnected) box.innerHTML = factoryFields(result);
    } catch (error) {
      if (dialog.open && box.isConnected) localError(box, error, 'template-info');
    }
  }
  function showTemplateHelp() {
    const envelope = section === 'envelope';
    const variables = envelope
      ? [
          ['{{mail.subject}}', 'Mail subject, filled by the client after decryption.', true],
          ['{{mail.sender}}', 'Sender DID address.', true],
          ['{{mail.createdAt}}', 'Mail creation time, formatted by the client.', false],
          ['{{mail.expiredAt}}', 'Mail expiration time, formatted by the client.', false],
          ['{{mail.envelope}}', 'Envelope NFT address. Some send previews do not provide this value.', false],
        ]
      : [
          ['{{contact.name}}', 'Contact name.', true],
          ['{{contact.company}}', 'Company or organization.', false],
          ['{{contact.position}}', 'Job title or position.', false],
          ['{{contact.phone}}', 'Phone number.', false],
          ['{{contact.email}}', 'Email address.', false],
          ['{{contact.website}}', 'Website URL.', false],
          ['{{contact.location}}', 'Location.', false],
          ['{{contact.background}}', 'Background or personal introduction.', false],
        ];
    const description = envelope
      ? 'An SVG Envelope template defines the visual cover of a mail NFT. Clients replace the placeholders with mail data when displaying it; the encrypted message content is unchanged.'
      : 'An SVG Namecard template defines the visual appearance of a contact card NFT. Clients replace its placeholders with profile or decrypted contact data when displaying it.';
    const instructions = envelope
      ? 'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; mail.subject and mail.sender are required. Download a sample to edit, then upload it here. The preview shows the template placeholders, not real mail data.'
      : 'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; contact.name is required. Download a sample to edit, then upload it here. Values come from the contact fields supplied by the client; missing values render blank. The preview shows placeholders, not real contact data.';

    void showDialog(
      t(envelope ? 'SVG Envelope template' : 'SVG Namecard template'),
      `<div class="dm-template-help"><p>${e(t(description))}</p>
      <h3>${e(t('Supported variables'))}</h3><dl class="dm-template-variables">${variables.map(([name, description, required]) => `<div><dt><code>${e(name)}</code>${required ? ` <span class="dm-small dm-muted">${e(t('Required'))}</span>` : ''}</dt><dd>${e(t(description))}</dd></div>`).join('')}</dl>
      <h3>${e(t('Example'))}</h3><pre><code>${e(envelope ? '<text x="24" y="48">{{mail.subject}}</text>' : '<text x="24" y="48">{{contact.name}}</text>')}</code></pre>
      <p class="dm-small dm-muted">${e(t(instructions))}</p></div>`,
    );
  }
  function factoryFields(f) {
    return fields([
      [t('Name'), f.name],
      [t('Address'), f.address],
      [t('Description'), f.description],
      [t('Limit'), f.limit],
      [t('Minted'), f.minted],
      [t('Created At'), f.created_at ? dateLabel(f.created_at) : '—'],
      [t('Updated At'), f.updated_at ? dateLabel(f.updated_at) : '—'],
      [t('Owned By'), f.owner],
      [t('Price'), amountText(f.price) || tokenLabel(f.token)],
    ]);
  }
  function renderServer() {
    const edits = [...content.querySelectorAll('[data-node-asset] [data-add-stake] input')].map((input) => ({
      asset: input.closest('[data-node-asset]').dataset.nodeAsset,
      value: input.value,
      focused: document.activeElement === input,
    }));
    const acquired = Boolean(stake?.ownerAssets?.length);
    const insufficient = !acquired && factory?.token && account && !accountError && !accountPending
      && account.chainStatus !== 'unavailable' && !canAfford(account.tokens, factory.token);
    content.innerHTML = `<section class="dm-card dm-server-endpoint" data-server-endpoint><h2>${e(t('Server endpoint'))}</h2><div class="dm-row"><code dir="ltr" data-endpoint-url>${e(location.origin)}</code>${button(t('Copy endpoint'), 'copy-endpoint', 'class="dm-secondary"')}</div><p class="dm-small dm-muted">${e(t('Use this endpoint in DIDMail clients. Direct connections do not require a Node NFT.'))}</p><p class="dm-small" data-endpoint-copy role="status" aria-live="polite"></p></section><section class="dm-card" data-server-factory><div class="dm-row"><h2>${e(t('DIDMail Server Node NFT Factory'))}</h2><div class="dm-actions">${button('↻', 'refresh-account', `class="dm-secondary" aria-label="${e(t('Refresh node NFTs'))}" aria-busy="${stakePending}" ${stakePending ? 'disabled' : ''}`)}<button type="button" data-action="server-factory-info" class="dm-secondary dm-factory-info" aria-label="${e(t('Server Node Factory information'))}" title="${e(t('Server Node Factory information'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></button></div></div>
      <p class="dm-muted">${e(t('To successfully become a DIDMail public service node, you need to purchase and stake a node NFT in order to be discovered by the client and appear in the service node list.'))}</p>
      ${factoryError ? `<div class="dm-alert" role="alert">${e(errorMessage(factoryError))} ${button(t('Retry'), 'server-factory-retry', 'class="dm-secondary"')}</div>` : factory ? `${fields([[t('Name'), factory.name], [t('Address'), factory.address], [t('Price'), amountText(factory.price) || tokenLabel(factory.token)]])}<div class="dm-divider dm-row"><span>${e(acquired ? t('Acquired DIDMail server node NFT for stake') : t('Acquire DIDMail server node NFT for stake'))}</span>${insufficient ? `<span class="dm-muted" data-purchase-balance>${e(t('Insufficient balance. Recharge the node first.'))} ${button(t('Node recharge'), 'recharge', `class="dm-secondary" aria-label="${e(t('Node recharge'))}" title="${e(t('Node recharge'))}"`)}</span>` : ''}<button type="button" data-action="acquire" aria-label="${e(acquired ? t('Acquired') : t('Acquire'))}" aria-busy="${acquirePending}" ${acquired || actionPending || accountPending ? 'disabled' : ''}>${acquirePending ? '<span class="dm-spinner" aria-hidden="true"></span>' : ''}${e(acquirePending ? t('Acquiring…') : acquired ? t('Acquired') : t('Acquire'))}</button></div>` : loadingMarkup(t('Loading node factory…'), 5)}</section>
      ${stakeError ? `<p role="alert">${e(t('Stake information could not be loaded. Refresh the node account to retry.'))}</p>` : !stake ? loadingMarkup(t('Loading node NFTs…')) : !acquired ? `<p class="dm-empty">${e(t('No staked node NFTs yet'))}</p>` : [...new Map(stake.ownerAssets.map((a) => [a.address, a])).values()].map(renderAsset).join('')}`;
    for (const edit of edits) {
      const input = [...content.querySelectorAll('[data-node-asset] [data-add-stake] input')].find(
        (el) => el.closest('[data-node-asset]').dataset.nodeAsset === edit.asset,
      );
      if (input) {
        input.value = edit.value;
        if (edit.focused) input.focus({ preventScroll: true });
      }
    }
  }
  function renderAsset(asset) {
    const data = assetData(asset);
    const staked = stake.assets?.includes(asset.address);
    const revoked = stake.revokedAssets?.includes(asset.address);
    const hasStaked = stake.tokens?.some((t) => BigInt(t.value || 0) > 0n);
    const hasRevoked = stake.revokedTokens?.some((t) => BigInt(t.value || 0) > 0n);
    const waiting = Number(stake.revokeWaitingPeriod ?? (store.node?.chainId === 'main' ? 604800 : 120));
    const dataAttr = `data-asset="${e(asset.address)}"`;
    const unavailable =
      actionPending ||
      accountPending ||
      stakePending ||
      accountError ||
      stakeError ||
      !account ||
      account.chainStatus === 'unavailable';
    return `<section class="dm-card" data-node-asset="${e(asset.address)}"><h2>${e(t('Server Node NFT'))} <span class="dm-badge" data-kind="${staked ? 'success' : revoked ? 'warning' : 'neutral'}">${staked ? t('Staked') : revoked ? t('Revoked') : t('No Stake')}</span></h2><div class="dm-grid"><img class="dm-preview" src="/api/display?assetId=${encodeURIComponent(asset.address)}" alt="${e(t('Server Node NFT'))}"><div>${fields(
      [
        ['NFT', asset.address],
        [t('Stake Address'), stake.address],
        [t('Location'), data.location],
        [t('Revoke Waiting Period'), t('{count} seconds', { count: waiting })],
        ...(!hasStaked && !hasRevoked
          ? [[t('Amount to stake'), `1 ${forge?.token?.symbol || nodeToken()?.symbol || ''}`.trim()]]
          : []),
        ...(hasStaked
          ? [
              [
                t('Staked'),
                stake.tokens
                  .filter((token) => BigInt(token.value || 0) > 0n)
                  .map((token) => tokenLabel(token))
                  .join(', '),
              ],
            ]
          : []),
        ...(hasRevoked
          ? [
              [
                t('Revoked'),
                stake.revokedTokens
                  .filter((token) => BigInt(token.value || 0) > 0n)
                  .map((token) => tokenLabel(token))
                  .join(', '),
              ],
            ]
          : []),
      ],
    )}
      <div class="dm-divider dm-stake-toolbar">
        ${hasStaked ? `<form data-add-stake class="dm-add-stake"><label><span class="dm-stake-input"><input aria-label="${e(t('Additional stake'))}" name="amount" type="number" min="1" step="1" value="1" required ${actionPending ? 'readonly' : ''}><span aria-hidden="true">${e(nodeToken()?.symbol || forge?.token?.symbol || '')}</span></span></label><button type="submit" aria-busy="${stakeAction === 'add'}" ${unavailable ? 'disabled' : ''}>${stakeAction === 'add' ? '<span class="dm-spinner" aria-hidden="true"></span>' : ''}${e(t('Add Stake'))}</button></form>` : ''}
        <div class="dm-actions dm-node-asset-actions">${!hasStaked && !hasRevoked ? button(t('Stake'), 'stake', `${dataAttr} ${staked || unavailable ? 'disabled' : ''}`) : ''}${hasStaked ? button(t('Revoke'), 'revoke', `class="dm-danger" ${unavailable ? 'disabled' : ''}`) : ''}${hasRevoked ? button(t('Claim'), 'claim', unavailable ? 'disabled' : '') : ''}</div>
      </div></div></div>
      ${
        data.endpoint?.replaceAll('&#x2F;', '/') !== location.origin
          ? `<div class="dm-divider"><p class="dm-muted">${e(t('The NFT endpoint differs from the app URL. Revoke and claim your stake before updating.'))}</p>${fields(
              [
                [t('App URL'), location.origin],
                [t('Endpoint URL'), data.endpoint],
              ],
            )}${button(t('Update Endpoint'), 'update-endpoint', `${dataAttr} ${staked || revoked || unavailable ? 'disabled' : ''}`)}</div>`
          : ''
      }</section>`;
  }
  async function loadAttachment() {
    const config = await request('/api/admin/attachment-config');
    content.innerHTML = `<details class="dm-card dm-legacy-settings"><summary>${e(t('Historical attachment settings'))}</summary><div class="dm-row"><h2>${e(t('Attachment Policy'))}</h2>${button(t('Refresh'), 'section-retry', 'class="dm-secondary"')}</div><p class="dm-muted">${e(t('Historical attachment settings. New mail uses the mail service settings above.'))}</p><form data-attachment><div class="dm-form-grid dm-form-grid-three">
      <label>${e(t('Max File Size'))} <small>${e(t('MB · Limit for a single encrypted attachment on the wire.'))}</small><input name="maxFileSizeMb" type="number" min="0.000001" step="any" required value="${e(Number(config.maxFileSizeBytes) / 1048576)}"></label>
      <label>${e(t('Max File Count'))} <small>${e(t('Maximum attachments allowed per mail.'))}</small><input name="maxFileCount" type="number" min="1" step="1" required value="${e(config.maxFileCount)}"></label>
      <label>${e(t('Price Per Byte Per Day'))} <small>${e(t('Storage unit price in wei (digits only).'))}</small><input name="pricePerBytePerDay" inputmode="numeric" pattern="[0-9]+" required value="${e(config.pricePerBytePerDay ?? '0')}"></label>
      </div><p class="dm-muted">${e(t('Last updated:'))} ${e(config.updatedAt ? dateLabel(config.updatedAt) : '—')}</p><div class="dm-divider"><button>${e(t('Save Policy'))}</button></div></form></details>`;
    void mountMailPolicy(content, t);
  }
  function templateCreateForm() {
    const symbol = forge?.token?.symbol || factory?.token?.symbol || '';
    const names = {
      default: section === 'envelope' ? 'Default Envelope' : 'Default Namecard',
      loveCard: 'Love Card',
      pigCard: 'Pig Card',
      businessCard: 'Business Card',
      festivalCard: 'Festival Card',
      executiveCard: 'Executive',
      techCard: 'Tech',
      creativeCard: 'Creative',
      consultantCard: 'Consultant',
    };
    const field = (name, description, control) => {
      const hint = `${section}-${name.toLowerCase().replaceAll(' ', '-')}-hint`;
      return `<label><span class="dm-field-heading"><span>${e(t(name))}</span><small id="${hint}">${e(t(description))}</small></span>${control.replace(/<(input|textarea) /, `<$1 aria-describedby="${hint}" `)}</label>`;
    };
    return `<section class="dm-card dm-template-create"><div class="dm-row"><h2>${e(t('Create {type} NFT Factory', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }))}</h2><button type="button" data-action="template-info" class="dm-secondary dm-factory-info" aria-label="${e(t('{type} Factory information', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }))}" title="${e(t('{type} Factory information', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></button></div><form data-template>
      <div class="dm-divider dm-template-layout"><div class="dm-template-upload"><h3 class="dm-visually-hidden">${e(t('Preview'))}</h3>
        <label class="dm-upload-zone"><input class="dm-upload-input" name="file" type="file" accept=".svg,image/svg+xml" aria-label="${e(t('Upload SVG {type} template file', { type: t(section) }))}" aria-describedby="${section}-upload-status">
          <span class="dm-upload-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></svg><span>${e(t('Upload SVG {type} template file', { type: t(section) }))}</span></span>
          <img data-preview class="dm-preview" alt="${e(t('SVG template preview'))}" hidden>
          <span data-preview-status id="${section}-upload-status" class="dm-upload-status">${e(t('Click or drop an SVG file · up to 5 MB'))}</span>
        </label><p class="dm-small dm-muted">${e(t('Click the preview to replace the SVG template.'))}</p></div>
      <div class="dm-template-fields">
        ${field(section==='envelope'?'Envelope category':'Namecard category',section==='envelope'?'Member envelopes require a bound active member.':'Member namecards require a bound active member.',`<select name="category" aria-label="${e(t(section==='envelope'?'Envelope category':'Namecard category'))}"><option value="public">${e(t(section==='envelope'?'Public envelope':'Public namecard'))}</option><option value="members">${e(t(section==='envelope'?'Member-only envelope':'Member-only namecard'))}</option></select>`)}
        ${field('Name', '5–80 characters.', `<input name="name" aria-label="${e(t('Name'))}" minlength="5" maxlength="80" placeholder="${e(t('Enter name'))}" required>`)}
        ${field('Price', section === 'envelope' ? 'The sender of the mail will cover the costs.' : 'The sender of the namecard will cover the costs.', `<span class="dm-input-unit"><input name="price" aria-label="${e(t('Price'))}" type="number" min="${section==='envelope'?'0':'0.001'}" step="any" placeholder="0.001" required><span data-template-currency>${e(symbol)}</span></span>`)}
        ${section === 'envelope' ? field('Retention Period', 'Mail retention on this server, in days; 0 means unlimited.', `<span class="dm-input-unit"><input name="retentionPeriod" aria-label="${e(t('Retention Period'))}" type="number" min="0" step="1" required value="0"><span>${e(t('Day'))}</span></span>`) : ''}
        ${field('Description', '1–50 characters.', `<textarea name="description" aria-label="${e(t('Description'))}" maxlength="50" placeholder="${e(t('Enter description'))}" required></textarea>`)}
      </div></div>
      <div class="dm-row dm-template-samples-heading"><h3>${e(t('SVG {type} template samples', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }))}</h3><button type="button" data-action="template-help" class="dm-secondary dm-factory-info" aria-label="${e(t(section === 'envelope' ? 'About SVG Envelope templates' : 'About SVG Namecard templates'))}" title="${e(t(section === 'envelope' ? 'About SVG Envelope templates' : 'About SVG Namecard templates'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></button></div><div class="dm-templates dm-template-samples">${Object.entries(
        templateFiles[section],
      )
        .map(
          ([name, svg]) =>
            `<figure><button type="button" data-action="use-template" data-template-name="${name}" class="dm-template-select" aria-label="${e(t('Use {name}', { name: name === 'default' ? t(name) : t(names[name]) }))}" aria-pressed="false" title="${e(t('Use {name}', { name: name === 'default' ? t(name) : t(names[name]) }))}"><img src="${e(svgSource(svg))}" alt="${e(t(names[name]))}"></button><a class="dm-template-download" href="${e(svgSource(svg))}" download="${name}.svg" aria-label="${e(t('Download SVG'))}: ${e(t(names[name]))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/></svg> ${e(t(names[name]))}</a></figure>`,
        )
        .join('')}</div>
      <div class="dm-divider dm-template-submit"><p class="dm-muted">${e(t('Factory acquisition cost:'))} <strong data-template-cost>${e(factory?.token ? tokenLabel(factory.token) : t('Confirmed before creation'))}</strong></p><button type="submit">${e(t('Create Factory'))}</button></div>
    </form></section>`;
  }
  function renderTemplateForm() {
    $('[data-template-factory]').innerHTML = templateCreateForm();
    syncTransactionControls();
  }
  function showReadProgress(list, label) {
    list.setAttribute('aria-busy', 'true');
    if (!list.dataset.loaded) list.innerHTML = loadingMarkup(label);
    else {
      list.querySelector('[data-read-progress]')?.remove();
      list.insertAdjacentHTML(
        'afterbegin',
        `<p data-read-progress class="dm-refresh-status" role="status"><span class="dm-spinner" aria-hidden="true"></span>${e(t('Updating in background…'))}</p>`,
      );
    }
  }
  function showReadError(list, error, retry) {
    list.setAttribute('aria-busy', 'false');
    if (list.dataset.loaded) {
      list.querySelector('[data-read-progress]')?.remove();
      notice(errorMessage(error));
    } else localError(list, error, retry);
  }
  async function loadTemplates({ refresh = false } = {}) {
    const version = ++listVersion;
    const list = $('[data-list]');
    showReadProgress(list, t('Loading {type} list…', { type: t(section) }));
    try {
      const data = await request(
        `/api/${section}/list?cursor=${encodeURIComponent(cursor)}${refresh ? '&refresh=1' : ''}`,
      );
      if (version !== listVersion) return;
      const items = data[section === 'envelope' ? 'envelopes' : 'namecards'] || [];
      const paging = data.paging || { cursor: '0', next: false, total: 0 };
      list.innerHTML = items.length
        ? items
            .map((item, index) => {
              const svg = svgSource(item.display);
              return `<article class="dm-card dm-template-item"><div class="dm-grid">${svg ? `<img class="dm-preview" src="${e(svg)}" alt="${e(item.name)}">` : `<p class="dm-template-no-preview">${e(t('Preview not available'))}</p>`}<div class="dm-template-meta"><div class="dm-row"><h3>${e(item.name)}</h3>${svg ? `<label class="dm-toggle dm-publish-toggle" title="${e(t('Enable And Publish'))}"><span>${e(t('Enable And Publish'))}</span><input type="checkbox" data-publish="${index}" aria-label="${e(t('Enable {name}', { name: item.name }))}" ${item.enabled ? 'checked' : ''}><span class="dm-switch" aria-hidden="true"></span></label>` : ''}</div>${item.description && item.description !== item.name ? `<p class="dm-template-description">${e(item.description)}</p>` : ''}<div class="dm-template-category"><span>${e(t(section==='envelope'?'Envelope category':'Namecard category'))}</span><span class="dm-badge" data-template-category ${section==='envelope'?'data-envelope-category':'data-namecard-category'}>${e(t(section==='envelope'?(item.category==='members'?'Member-only envelope':'Public envelope'):(item.category==='members'?'Member-only namecard':'Public namecard')))}</span></div><div class="dm-template-address"><span>${e(t('Address'))}</span><span>${didMarkup(item.address, t)}</span></div><dl class="dm-template-facts"><div><dt>${e(t('Price'))}</dt><dd>${e(amountText(item.price))} ${e(item.token?.symbol || '')}</dd></div>${section === 'envelope' ? `<div><dt>${e(t('Retention Period'))}</dt><dd>${e(Number(item.retentionPeriod || 0) === 0 ? t('Unlimited') : t('{count} Day', { count: item.retentionPeriod }))}</dd></div>` : ''}</dl></div></div></article>`;
            })
            .join('')
        : `<p class="dm-empty">${e(t('No {type} NFTs yet', { type: t(section) }))}</p>`;
      list.insertAdjacentHTML(
        'beforeend',
        `<div class="dm-pagination"><span>${e(t('Total:'))} ${e(paging.total)}</span><div class="dm-actions">${button(t('Previous'), 'cursor-prev', `class="dm-secondary" ${Number(cursor) <= 0 ? 'disabled' : ''}`)}${button(t('Next'), 'cursor-next', `class="dm-secondary" ${!paging.next ? 'disabled' : ''}`)}</div></div>`,
      );
      if (data.cache?.syncedAt)
        list.insertAdjacentHTML(
          'afterbegin',
          `<p class="dm-small dm-muted" data-template-sync>${e(t('Last chain sync:'))} ${e(dateLabel(data.cache.syncedAt))}</p>`,
        );
      if (data.cache?.syncError)
        list.insertAdjacentHTML(
          'afterbegin',
          `<div class="dm-alert" role="alert">${e(t('Chain sync failed. Showing saved data; try Refresh again.'))}</div>`,
        );
      list.dataset.loaded = 'true';
      list.setAttribute('aria-busy', 'false');
      for (const toggle of list.querySelectorAll('[data-publish]'))
        toggle.onchange = async () => {
          const item = items[Number(toggle.dataset.publish)];
          const enabled = toggle.checked;
          toggle.disabled = true;
          try {
            await request(`/api/${section}/db/update`, {
              method: 'POST',
              body: {
                address: item.address,
                name: item.name,
                price: `${item.price} ${item.token?.symbol || ''}`,
                token: item.token,
                retentionPeriod: item.retentionPeriod,
                description: item.description,
                svg: svgSource(item.display),
                enabled,
              },
            });
            notice(t('Publish setting saved.'), 'success');
          } catch (error) {
            toggle.checked = !enabled;
            notice(errorMessage(error));
          } finally {
            toggle.disabled = false;
          }
        };
    } catch (error) {
      if (version === listVersion) showReadError(list, error, 'list-refresh');
    }
  }
  async function loadMails() {
    const version = ++listVersion;
    const list = $('[data-list]');
    showReadProgress(list, t('Loading stored mail…'));
    try {
      const data = await request(
        `/api/storage/mails?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), search })}`,
      );
      if (version !== listVersion) return;
      const lastPage = Math.max(1, Number(data.totalPages) || 1);
      if (page > lastPage) { page = lastPage; return loadMails(); }
      list.innerHTML = renderStorageTable(data.mails || [], t, mailCurrency(), search) + `
        <div class="dm-pagination"><span class="dm-storage-total">${e(t('Total:'))} ${e(data.total || 0)}</span><div class="dm-pagination-controls"><label>${e(t('Page size'))}<input type="number" min="1" max="100" value="${pageSize}" data-page-size></label><div class="dm-page-position"><label>${e(t('Page'))}<input type="number" min="1" max="${Math.max(1, Number(data.totalPages) || 1)}" value="${page}" data-page></label><span>${e(t('of {count}', { count: Math.max(1, Number(data.totalPages) || 1) }))}</span></div><div class="dm-actions">${button(t('Previous'), 'page-prev', `class="dm-secondary" ${page <= 1 ? 'disabled' : ''}`)}${button(t('Next'), 'page-next', `class="dm-secondary" ${page >= Number(data.totalPages || 0) ? 'disabled' : ''}`)}</div></div></div>`;
      list.dataset.loaded = 'true';
      list.setAttribute('aria-busy', 'false');
    } catch (error) {
      if (version === listVersion) showReadError(list, error, 'storage-refresh');
    }
  }
  function mailCurrency() {
    return forge?.token?.symbol || (account?.chainId ? (account.chainId === 'main' ? 'ABT' : 'TBA') : '');
  }
  function updateMailCurrency() {
    for (const cell of content.querySelectorAll('[data-mail-payment]'))
      cell.innerHTML = storagePayment(JSON.parse(cell.dataset.mailPayment), t, mailCurrency());
    for (const detail of content.querySelectorAll('[data-mail-fee-details]'))
      detail.innerHTML = storageFeeDetails(JSON.parse(detail.dataset.mailFeeDetails), t, mailCurrency());
  }
  async function loadStorageSize() {
    const label = $('[data-size]');
    try {
      label.textContent = (await request('/api/storage/size')).size;
    } catch (error) {
      label.textContent = t('Unavailable');
      label.title = errorMessage(error);
    }
  }
  async function setTemplate(candidate) {
    if (!candidate || !candidate.name.toLowerCase().endsWith('.svg')) throw new Error(t('Choose an SVG file.'));
    if (candidate.size > 5 * 1024 * 1024) throw new Error(t('SVG template must be at most 5 MB.'));
    const text = await candidate.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
      throw new Error(t('Invalid SVG document.'));
    const required = section === 'envelope' ? ['{{mail.subject}}', '{{mail.sender}}'] : ['{{contact.name}}'];
    const valid =
      section === 'envelope'
        ? required.every((value) => text.includes(value))
        : required.some((value) => text.includes(value));
    if (!valid)
      throw new Error(
        t('The SVG file must contain {fields}', { fields: required.join(section === 'envelope' ? ', ' : t(' or ')) }),
      );
    file = candidate;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(candidate);
    $('[data-preview]').src = previewUrl;
    $('[data-preview]').hidden = false;
    $('[data-preview-status]').textContent = candidate.name;
    for (const button of root.querySelectorAll('.dm-template-select'))
      button.setAttribute('aria-pressed', String(templateFiles[section][button.dataset.templateName] === text));
  }
  async function mutate(path, body, method = 'POST', verifyMessage = true) {
    if (method === 'POST' && (path.startsWith('/api/stake/') || path.endsWith('/acquire'))) {
      const purchase = path.endsWith('/acquire');
      if (purchase) await store.read('account', { force: true });
      else await loadAccount();
      if (!store.active || accountError || (!purchase && stakeError) || !account || account.chainStatus === 'unavailable')
        throw new Error(t('Node state could not be verified. Refresh the node data before submitting a transaction.'));
      if (path.endsWith('/acquire') && !canAfford(account.tokens, factory?.token))
        throw new Error(t('Insufficient balance. Recharge the node first.'));
      if (
        path === '/api/stake/add' &&
        toUnits(body.amount, nodeToken()?.decimal ?? 18) > BigInt(nodeToken()?.value || 0)
      )
        throw new Error(t('Enter an integer stake amount within the node balance.'));
    }
    const result = await request(path, { method, body });
    if (
      verifyMessage &&
      result.message &&
      !['staked', 'Updated successfully', 'Cleaned successfully'].includes(result.message)
    )
      throw new Error(result.message);
    return result;
  }
  async function runAction(task) {
    if (actionPending) return;
    actionPending = true;
    const previousFocus = document.activeElement;
    root.dataset.busy = 'true';
    const controls = [...root.querySelectorAll('button,input[type=checkbox]')].filter((el) => !el.disabled);
    controls.forEach((el) => {
      el.disabled = true;
    });
    notice();
    try {
      await task();
    } catch (error) {
      notice(errorMessage(error) || t('Operation failed.'));
    } finally {
      actionPending = false;
      acquirePending = false;
      stakeAction = '';
      const templateSubmit = $('[data-template] button[type=submit]');
      if (templateSubmit) {
        templateSubmit.setAttribute('aria-busy', 'false');
        templateSubmit.textContent = t('Create Factory');
      }
      delete root.dataset.busy;
      controls.forEach((el) => {
        if (el.isConnected) el.disabled = false;
      });
      syncTransactionControls();
      if (section === 'server') renderServer();
      if (previousFocus?.isConnected && !previousFocus.disabled &&
          (document.activeElement === document.body || (!dialog.open && dialog.contains(document.activeElement)))) {
        previousFocus.focus({ preventScroll: true });
      }
    }
  }
  function showRecharge() {
    if (!store?.active || actionPending) return;
    if (section !== 'account') {
      location.assign(`${localizedPath('/admin/account', locale)}#recharge`);
      return;
    }
    location.hash = 'recharge';
    selectWalletPanel('wallet-recharge');
  }
  function renderWalletPage() {
    const address = store.node?.address || account?.address;
    if (!address) return;
    const code = qrcode(0, 'M');
    const did = address.startsWith('did:abt:') ? address : `did:abt:${address}`;
    code.addData(did);
    code.make();
    content.innerHTML = `<section class="dm-card dm-account-operations"><div class="dm-wallet-tabs" role="group" aria-label="${e(t('Account operations'))}"><button type="button" data-action="wallet-recharge">${e(t('Recharge'))}</button><button type="button" data-action="wallet-transfer">${e(t('Transfer out'))}</button><button type="button" data-action="wallet-gas">${e(t('Gas stake'))}</button></div><div data-wallet-recharge><div class="dm-account-recharge">${code.createSvgTag({ cellSize: 5, margin: 4, scalable: true })}<div><h2>${e(t('Recharge'))}</h2><p class="dm-muted dm-recharge-description">${e(t('Send funds to this node address.'))}</p>${fields([[t('Node address'), did], [t('Network:'), store.node?.chainId || account?.chainId || 'beta']], { full: true })}<p class="dm-muted">${e(t('Use the matching network in your wallet.'))}</p></div></div></div><div data-wallet-transfer hidden></div><div data-wallet-gas hidden></div></section>`;
    selectWalletPanel({ '#transfer': 'wallet-transfer', '#stake': 'wallet-gas' }[location.hash] || 'wallet-recharge');
  }
  function selectWalletPanel(action) {
    if (section !== 'account' || actionPending || !$('[data-wallet-recharge]')) return;
    const mapping = { 'wallet-recharge': 'recharge', 'wallet-transfer': 'transfer', 'wallet-gas': 'stake' };
    for (const [key, panel] of Object.entries({ 'wallet-recharge': 'recharge', 'wallet-transfer': 'transfer', 'wallet-gas': 'gas' }))
      $(`[data-wallet-${panel}]`).hidden = key !== action;
    root.querySelectorAll('.dm-wallet-tabs button').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.action === action)));
    history.replaceState(null, '', `#${mapping[action]}`);
    if (action === 'wallet-transfer') void showTransfer();
    if (action === 'wallet-gas') void showGasStake();
  }
  async function showTransfer() {
    const panel = $('[data-wallet-transfer]');
    if (!panel) return;
    panel.innerHTML = ownerSession ? loadingMarkup(t('Loading available balance…')) : `<p class="dm-muted">${e(t('Only the node owner can transfer funds.'))}</p>`;
    if (!ownerSession) return;
    try {
      const quote = await request('/api/account/transfer');
      if (!panel.isConnected) return;
      transferQuote = quote;
      panel.innerHTML = `<p class="dm-muted">${e(t('Transfer available funds to the node owner. Staked funds cannot be transferred.'))}</p>${fields([[t('Recipient address'), quote.recipient], [t('Network:'), quote.chainId], [t('Available balance'), tokenLabel(quote.token)]])}<form data-node-transfer><label>${e(t('Transfer amount'))}<span class="dm-stake-input"><input name="amount" type="text" inputmode="decimal" autocomplete="off" required placeholder="0"><span aria-hidden="true">${e(quote.token.symbol)}</span></span></label><p class="dm-small dm-muted">${e(t('Keep enough funds in the node wallet for transaction fees.'))}</p><div data-transfer-error role="alert"></div><div class="dm-actions"><button type="submit">${e(t('Review transfer'))}</button></div></form>`;
    } catch (error) {
      if (panel.isConnected) panel.innerHTML = `<p role="alert">${e(errorMessage(error))}</p>${button(t('Retry'), 'wallet-transfer')}`;
    }
  }
  async function showGasStake() {
    const panel = $('[data-wallet-gas]');
    if (!panel) return;
    gasQuote = undefined;
    panel.innerHTML = ownerSession ? loadingMarkup(t('Loading gas staking rules…')) : `<p class="dm-muted">${e(t('Only the node owner can stake for gas.'))}</p>`;
    if (!ownerSession) return;
    try {
      const quote = await request('/api/account/gas-stake');
      if (!panel.isConnected) return;
      gasQuote = quote;
      const days = (quote.withdrawalWaitingPeriod ?? quote.waitingPeriod) / 86400;
      panel.innerHTML = `<p class="dm-muted">${e(t('Stake the network token to qualify for gas-free transactions. This is separate from the service node NFT stake.'))}</p>${fields([[t('Network:'), quote.chainId], [t('Stake Address'), quote.address], [t('Amount to stake'), tokenLabel(quote.token)], [t('Available balance'), tokenLabel({ ...quote.token, value: quote.balance })], [t('Staked'), tokenLabel({ ...quote.token, value: quote.staked })], [t('Revoke Waiting Period'), t('{count} days', { count: days })]])}<p class="dm-small dm-muted">${e(t('After revoking, wait {count} days before claiming the funds. Network abuse may result in slashing.', { count: days }))}</p>${BigInt(quote.revoked) > 0n ? `<p class="dm-muted">${e(t('Revoked'))}: ${e(tokenLabel({ ...quote.token, value: quote.revoked }))}</p>` : ''}<div class="dm-actions">${button(t('Refresh'), 'wallet-gas', 'class="dm-secondary"')}${quote.canRevoke ? button(t('Revoke gas stake'), 'gas-revoke', 'class="dm-secondary"') : ''}<button type="button" data-action="gas-stake" ${quote.eligible || BigInt(quote.balance) < BigInt(quote.token.value) ? 'disabled' : ''}>${e(t(quote.eligible ? 'Gas stake already sufficient' : 'Stake for gas'))}</button></div>${!quote.eligible && BigInt(quote.balance) < BigInt(quote.token.value) ? `<p role="alert">${e(t('Insufficient available balance.'))}</p>` : ''}`;
      if (quote.withdrawals?.length) {
        const list = document.createElement('section');
        list.className = 'dm-gas-withdrawals';
        list.innerHTML = `<h3>${e(t('Pending withdrawals'))}</h3>${quote.withdrawals.map((item) => `<div class="dm-gas-withdrawal"><div><strong>${e(tokenLabel({ ...quote.token, value: item.amount }))}</strong><p class="dm-muted dm-small">${e(t(item.claimable ? 'Ready to claim' : 'Available to claim at'))}${item.claimable ? '' : ` ${e(dateLabel(item.availableAt))}`}</p></div><button type="button" data-action="gas-claim" data-evidence="${e(item.evidence)}" ${item.claimable ? '' : 'disabled'}>${e(t('Claim gas stake'))}</button></div>`).join('')}`;
        panel.append(list);
      }

    } catch (error) {
      if (panel.isConnected) panel.innerHTML = `<p role="alert">${e(errorMessage(error))}</p>${button(t('Retry'), 'wallet-gas')}`;
    }
  }
  document.addEventListener('didmail-node-recharge', showRecharge);
  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'clear-mail-search') {
      search = '';
      page = 1;
      const input = $('[data-search] input');
      input.value = '';
      input.focus();
      void runAction(loadMails);
      return;
    }
    if (action === 'storage-details') {
      const panel = document.getElementById(target.getAttribute('aria-controls'));
      if (panel) { panel.hidden = !panel.hidden; target.setAttribute('aria-expanded', String(!panel.hidden)); }
      return;
    }
    if (action === 'copy-endpoint') {
      const feedback = $('[data-endpoint-copy]');
      void (async () => {
        try {
          await navigator.clipboard.writeText(location.origin);
          if (feedback?.isConnected) {
            feedback.setAttribute('role', 'status');
            feedback.textContent = t('Endpoint copied.');
          }
        } catch {
          if (feedback?.isConnected) {
            feedback.setAttribute('role', 'alert');
            feedback.textContent = t('Copy failed. Select the endpoint above and copy it manually.');
          }
        }
      })();
      return;
    }

    if (action === 'template-help') {
      showTemplateHelp();
      return;
    }
    if (action === 'template-info') {
      void showTemplateFactory();
      return;
    }
    if (['wallet-recharge', 'wallet-transfer', 'wallet-gas'].includes(action)) {
      selectWalletPanel(action);
      return;
    }
    if (['gas-revoke', 'gas-claim'].includes(action)) {
      if (!gasQuote || actionPending) return;
      const quote = gasQuote;
      const revoking = action === 'gas-revoke';
      const item = quote.withdrawals?.find((entry) => entry.evidence === target.dataset.evidence);
      if (revoking ? !quote.canRevoke : !item?.claimable) return;
      const title = t(revoking ? 'Revoke gas stake' : 'Claim gas stake');
      void runAction(async () => {
        const amount = tokenLabel({ ...quote.token, value: revoking ? quote.staked : item.amount });
        const explanation = revoking
          ? t('After revoking, wait {count} days before claiming the funds. Network abuse may result in slashing.', { count: quote.withdrawalWaitingPeriod / 86400 })
          : t('Funds return to the node account. Claiming may end gas-free eligibility.');
        if (!(await showDialog(title, `${fields([[t('Stake Address'), quote.address], [t('Amount'), amount], [t('Network:'), quote.chainId]])}<p class="dm-muted">${e(explanation)}</p>`, title, { wallet: true }))) return;
        const panel = $('[data-wallet-gas]');
        panel.innerHTML = loadingMarkup(t(revoking ? 'Revoking gas stake…' : 'Claiming gas stake…'));
        try {
          const result = await request(`/api/account/gas-stake/${revoking ? 'revoke' : 'claim'}`, {
            method: 'POST', body: { policyId: quote.exitPolicyId, ...(!revoking ? { evidence: item.evidence } : {}) },
          });
          notice(t('Request accepted. Refresh to verify on-chain state.'), 'success');
          panel.innerHTML = `<h2>${e(t(revoking ? 'Gas stake revocation submitted' : 'Gas stake claim submitted'))}</h2>${fields([[t('Transaction hash'), result.hash], [t('Stake Address'), result.address]])}<p class="dm-muted">${e(explanation)}</p><div class="dm-actions">${button(t('Refresh'), 'wallet-gas', 'class="dm-secondary"')}</div>`;
        } catch (error) {
          notice(errorMessage(error));
          panel.innerHTML = `<p role="alert">${e(errorMessage(error))}</p>${button(t('Retry'), 'wallet-gas', 'class="dm-secondary"')}`;
        } finally { await loadAccount(); }
      });
      return;
    }
    if (action === 'gas-stake') {
      if (!gasQuote || actionPending) return;
      const quote = gasQuote;
      void runAction(async () => {
        if (!(await showDialog(t('Confirm gas stake'), `${fields([[t('Amount to stake'), tokenLabel(quote.token)], [t('Stake Address'), quote.address], [t('Network:'), quote.chainId]])}<p>${e(t('After revoking, wait {count} days before claiming the funds. Network abuse may result in slashing.', { count: quote.waitingPeriod / 86400 }))}</p>`, t('Stake for gas'), { wallet: true }))) return;
        const panel = $('[data-wallet-gas]');
        panel.innerHTML = loadingMarkup(t('Submitting gas stake…'));
        try {
          const result = await request('/api/account/gas-stake', { method: 'POST', body: { policyId: quote.policyId } });
          notice(t('Request accepted. Refresh to verify on-chain state.'), 'success');
          panel.innerHTML = `<h2>${e(t('Gas stake submitted'))}</h2>${fields([[t('Transaction hash'), result.hash], [t('Stake Address'), result.address]])}<div class="dm-actions">${button(t('Refresh'), 'wallet-gas', 'class="dm-secondary"')}</div>`;
        } catch (error) {
          notice(errorMessage(error));
          panel.innerHTML = `<p role="alert">${e(errorMessage(error))}</p>${button(t('Retry'), 'wallet-gas', 'class="dm-secondary"')}`;
        } finally { await loadAccount(); }
      });
      return;
    }
    if (action === 'recharge') {
      showRecharge();
      return;
    }
    if (action === 'refresh-account') {
      void loadAccount();
      return;
    }
    if (action === 'session-retry') {
      void loadSession();
      return;
    }
    if (action === 'acquire' && !actionPending) {
      acquirePending = true;
      renderServer();
    }
    void runAction(async () => {
      if (action === 'server-factory-info') await showServerFactory();
      else if (action === 'server-factory-retry') await loadServerFactory();
      else if (action === 'section-retry') await loadSection();
      else if (action === 'acquire') {
        const [freshFactory] = await Promise.all([
          request('/api/servers/factory?refresh=1'),
          store.read('account', { force: true }),
        ]);
        factory = freshFactory;
        if (!store.active || accountError || !account || account.chainStatus === 'unavailable')
          throw new Error(t('Node state could not be verified. Refresh the node data before submitting a transaction.'));
        if (!canAfford(account.tokens, factory.token))
          throw new Error(t('Insufficient balance. Recharge the node first.'));
        // The backend owns node-wallet signing; the ARC login wallet is never substituted.
        if (
          !(await showDialog(
            t('Acquire Server Node NFT'),
            `<p>${e(t('The node wallet will pay {cost} and own this NFT.', { cost: tokenLabel(factory.token) }))}</p>`,
            t('Acquire'),
          ))
        )
          return;
        await mutate('/api/servers/acquire');
        await loadAccount();
        notice(t('Request accepted. Refresh to verify on-chain state.'), 'success');
      } else if (['stake', 'revoke', 'claim', 'update-endpoint'].includes(action)) {
        const names = {
          stake: t('Stake Node NFT'),
          revoke: t('Revoke Stake'),
          claim: t('Claim Stake'),
          'update-endpoint': t('Update Endpoint'),
        };
        if (
          !(await showDialog(
            names[action],
            `<p>${action === 'revoke' ? t('Revoke the staked tokens? A waiting period applies before claiming.') : t('Submit this operation using the node wallet?')}</p>`,
            names[action],
          ))
        )
          return;
        const paths = { stake: 'asset', revoke: 'revoke', claim: 'claim', 'update-endpoint': 'update-endpoint' };
        const body =
          action === 'stake'
            ? { assetAddress: target.dataset.asset }
            : action === 'update-endpoint'
              ? { asset: target.dataset.asset }
              : undefined;
        stakeAction = action;
        renderServer();
        await mutate(`/api/stake/${paths[action]}`, body);
        await loadAccount();
        notice(t('Request accepted. Refresh to verify on-chain state.'), 'success');
      } else if (action === 'use-template') {
        const text = templateFiles[section][target.dataset.templateName];
        if (!text) throw new Error(t('Template could not be loaded.'));
        await setTemplate(new File([text], `${target.dataset.templateName}.svg`, { type: 'image/svg+xml' }));
      } else if (action === 'list-refresh') {
        cursor = '0';
        await loadTemplates({ refresh: true });
      } else if (action === 'clean') {
        if (
          !(await showDialog(
            t('Clean {type} cache', { type: t(section) }),
            `<p>${e(t('Remove cached publish settings for this list? On-chain NFTs remain.'))}</p>`,
            t('Clean'),
          ))
        )
          return;
        await mutate(`/api/${section}/clean`, undefined, 'DELETE');
        cursor = '0';
        await loadTemplates();
        notice(t('Cache cleaned.'), 'success');
      } else if (action === 'cursor-prev' || action === 'cursor-next') {
        cursor = String(Math.max(0, Number(cursor) + (action === 'cursor-next' ? 1 : -1)));
        await loadTemplates();
      } else if (action === 'storage-refresh') await Promise.all([loadMails(), loadStorageSize()]);
      else if (action === 'page-prev' || action === 'page-next') {
        page = Math.max(1, page + (action === 'page-next' ? 1 : -1));
        await loadMails();
      } else if (action === 'delete-mail') {
        if (
          !(await showDialog(
            t('Delete Mail'),
            `<p>${e(t('Delete mail {id} and its encrypted content? This action cannot be undone.', { id: target.dataset.mailLabel || target.dataset.mailId }))}</p>`,
            t('Delete'),
          ))
        )
          return;
        await mutate(
          `/api/storage/mails/delete/${encodeURIComponent(target.dataset.mailId)}`,
          undefined,
          'DELETE',
          false,
        );
        await Promise.all([loadMails(), loadStorageSize()]);
        notice(t('Mail deleted.'), 'success');
      }
    });
  });
  root.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('input[type=file]')) {
      file = null;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      $('[data-preview]').hidden = true;
      for (const button of root.querySelectorAll('.dm-template-select')) button.setAttribute('aria-pressed', 'false');
      void setTemplate(target.files?.[0]).catch((error) => {
        notice(errorMessage(error));
        $('[data-preview-status]').textContent = t('Select a valid SVG template.');
      });
    }
    if (target.matches('[data-page],[data-page-size]')) {
      const value = Number(target.value);
      const max = target.matches('[data-page]') ? Number(target.max) : 100;
      if (!Number.isInteger(value) || value < 1 || value > max) {
        notice(t('Enter a valid page or page size.'));
        return;
      }
      if (target.matches('[data-page]')) page = value;
      else {
        pageSize = value;
        page = 1;
      }
      void runAction(loadMails);
    }
  });
  root.addEventListener('submit', (event) => {
    const form = event.target;
    event.preventDefault();
    if (form.matches('[data-search]')) {
      search = new FormData(form).get('search').trim();
      page = 1;
      void runAction(loadMails);
      return;
    }
    if (form.matches('[data-node-transfer]')) {
      const amount = String(new FormData(form).get('amount')).trim();
      try {
        if (!transferQuote) throw new Error(t('Node balance could not be verified.'));
        const value = toUnits(amount, transferQuote.token.decimal);
        if (value <= 0n) throw new Error(t('Transfer amount must be greater than zero.'));
        if (value > BigInt(transferQuote.token.value)) throw new Error(t('Insufficient available balance.'));
      } catch (error) {
        form.querySelector('[data-transfer-error]').textContent = errorMessage(error);
        return;
      }
      const quote = transferQuote;
      void runAction(async () => {
        if (!(await showDialog(t('Confirm transfer'), `${fields([[t('Transfer amount'), `${amountText(amount)} ${quote.token.symbol}`], [t('Recipient address'), quote.recipient], [t('Network:'), quote.chainId]])}<p class="dm-muted">${e(t('This transfer cannot be undone.'))}</p>`, t('Transfer to owner'), { wallet: true }))) return;
        const panel = $('[data-wallet-transfer]');
        panel.innerHTML = loadingMarkup(t('Submitting transfer…'));
        try {
          const result = await request('/api/account/transfer', { method: 'POST', body: { amount } });
          notice(t('Transfer submitted'), 'success');
          panel.innerHTML = `<h2>${e(t('Transfer submitted'))}</h2>${fields([[t('Transaction hash'), result.hash], [t('Recipient address'), result.recipient], [t('Transfer amount'), `${amountText(result.amount)} ${result.token}`]])}<p class="dm-muted">${e(t('Refresh the node balance to verify the result.'))}</p>${button(t('Back'), 'wallet-transfer', 'class="dm-secondary"')}`;
        } catch (error) {
          notice(errorMessage(error));
          panel.innerHTML = `<p role="alert">${e(errorMessage(error))}</p>${button(t('Back'), 'wallet-transfer', 'class="dm-secondary"')}`;
        } finally {
          await loadAccount();
        }
      });
      return;
    }
    void runAction(async () => {
      const values = Object.fromEntries(new FormData(form));
      if (form.matches('[data-attachment]')) {
        const bytes = Math.round(Number(values.maxFileSizeMb) * 1048576),
          count = Number(values.maxFileCount);
        if (
          !Number.isSafeInteger(bytes) ||
          bytes <= 0 ||
          !Number.isSafeInteger(count) ||
          count <= 0 ||
          !/^\d+$/.test(values.pricePerBytePerDay)
        )
          throw new Error(t('Enter positive file limits and a price in whole wei.'));
        await request('/api/admin/attachment-config', {
          method: 'PUT',
          body: { maxFileSizeBytes: bytes, maxFileCount: count, pricePerBytePerDay: values.pricePerBytePerDay },
        });
        await loadAttachment();
        notice(t('Attachment policy saved successfully.'), 'success');
      } else if (form.matches('[data-add-stake]')) {
        const amount = Number(values.amount);
        if (!Number.isSafeInteger(amount) || amount < 1)
          throw new Error(t('Enter an integer stake amount within the node balance.'));
        if (
          !(await showDialog(
            t('Add Stake'),
            `<p>${e(t('Add {amount} tokens to the node stake?', { amount }))}</p>`,
            t('Add Stake'),
          ))
        )
          return;
        stakeAction = 'add';
        renderServer();
        await mutate('/api/stake/add', { amount });
        await loadAccount();
        notice(t('Request accepted. Refresh to verify on-chain state.'), 'success');
      } else if (form.matches('[data-template]')) {
        if (!file) throw new Error(t('Select a valid SVG template.'));
        const name = values.name.trim(),
          description = values.description.trim();
        if (name.length < 5 || name.length > 80 || !description || description.length > 50)
          throw new Error(t('Name must be 5–80 characters; description must be 1–50 characters.'));
        if (!/^\d+(\.\d+)?$/.test(values.price) || Number(values.price) < (section==='envelope'?0:0.001))
          throw new Error(t('Price must be at least 0.001.'));
        if (
          section === 'envelope' &&
          (!Number.isSafeInteger(Number(values.retentionPeriod)) || Number(values.retentionPeriod) < 0)
        )
          throw new Error(t('Retention must be a non-negative integer.'));
        await readTemplateFactory();
        if (
          !(await showDialog(
            t('Create {type} Factory', { type: t(section) }),
            `<p>${e(t('The node wallet will pay the factory acquisition cost: {cost}.', { cost: tokenLabel(factory.token) }))}</p>`,
            t('Create'),
          ))
        )
          return;
        const submit = form.querySelector('button[type=submit]');
        submit.setAttribute('aria-busy', 'true');
        submit.innerHTML = `<span class="dm-spinner" aria-hidden="true"></span>${e(t('Creating Factory…'))}`;
        const body = new FormData();
        body.append('file', file);
        body.append('name', name);
        body.append('price', values.price);
        body.append('description', description);
        body.append('category',values.category);
        if (section === 'envelope') body.append('retentionPeriod', values.retentionPeriod);
        await mutate(`/api/${section}/acquire`, body);
        form.reset();
        file = null;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        $('[data-preview]').hidden = true;
        $('[data-preview-status]').textContent = t('Select or upload an SVG template.');
        for (const button of root.querySelectorAll('.dm-template-select')) button.setAttribute('aria-pressed', 'false');
        cursor = '0';
        await Promise.all([loadAccount(), loadTemplates({ refresh: true })]);
        notice(t('Factory created successfully.'), 'success');
      }
    });
  });
  window.addEventListener(
    'pagehide',
    () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    { once: true },
  );
  document.addEventListener('didmail-session-ended', () => {
    if (dialog.open) dialog.close();
    $('[data-workspace]').hidden = true;
    $('[data-session]').textContent = t('Session expired. Refresh the page to sign in again.');
  });
  await loadSession();
}
