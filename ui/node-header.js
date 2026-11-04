import styles from './node-header.css';
import { messages, resolveLocale } from './locales.js';
import { request, accountBalanceText } from './shared.js';
import { nodeStore, closeNodeStore } from './node-state.js';
const locale = resolveLocale(document.documentElement.lang);
const t = messages(locale);
const style = document.createElement('style');
style.textContent = styles;
document.head.append(style);
let sessionFlight, headerStore, stopBalance;
let badge, recharge;
function hideBalance(forget = false) {
  if (badge) badge.hidden = true;
  if (recharge) recharge.hidden = true;
  stopBalance?.();
  stopBalance = undefined;
  headerStore = undefined;
  closeNodeStore({ forget });
}
function showBalance(session) {
  if (!document.querySelector('[data-didmail-admin]')) return;
  const store = nodeStore(session);
  if (!store) {
    hideBalance(true);
    return;
  }
  if (headerStore === store) return;
  stopBalance?.();
  const strip = document.querySelector('.aup-app-header-strip-right');
  if (!strip) return;
  if (!badge) {
    badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'dm-header-balance';
    badge.dataset.nodeBalance = '';
    const label = document.createElement('span');
    label.className = 'dm-header-balance-label';
    label.textContent = t.nodeBalance;
    const value = document.createElement('strong');
    value.className = 'dm-header-balance-value';
    const indicator = document.createElement('span');
    indicator.className = 'dm-header-balance-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    badge.append(label, value, indicator);
    badge.addEventListener('click', () => {
      void headerStore?.read('account', { force: true }).catch(() => {});
    });
    recharge = document.createElement('button');
    recharge.type = 'button';
    recharge.className = 'dm-header-recharge';
    recharge.dataset.nodeRecharge = '';
    recharge.setAttribute('aria-label', t.nodeRecharge);
    recharge.title = t.nodeRecharge;
    recharge.disabled = true;
    recharge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h3v3h3M15 21v-3M21 15v-3M12 3v3M12 12h3M3 12h3"/></svg>';
    recharge.addEventListener('click', () => {
      if (headerStore?.active) document.dispatchEvent(new Event('didmail-node-recharge'));
    });
    strip.prepend(badge, recharge);
  }
  badge.hidden = false;
  recharge.hidden = false;
  headerStore = store;
  stopBalance = store.watch(
    'account',
    (state) => {
      if ([401, 403].includes(state.error?.status)) {
        hideBalance(true);
        const workspace = document.querySelector('[data-workspace]');
        if (workspace) workspace.hidden = true;
        document.dispatchEvent(new Event('didmail-session-ended'));
        return;
      }
      const account = state.data;
      const token = account?.tokens?.find((token) => token.address === session.node?.tokenId) || account?.tokens?.[0];
      const balance = account ? accountBalanceText(token, {
        unavailable: account.chainStatus === 'unavailable',
        knownEmpty: !state.error && ['ready', 'unregistered'].includes(account.chainStatus) && Array.isArray(account.tokens) && account.tokens.length === 0,
        empty: t.noBalance,
      }) : null;
      const value = account ? balance.exact === null ? t.balanceUnavailable : balance.summary : state.error ? t.balanceUnavailable : t.balanceLoading;
      recharge.disabled = !(session.node?.address || account?.address);
      badge.querySelector('strong').textContent = value;
      badge.dataset.stale = String(state.stale || Boolean(state.error));
      badge.setAttribute('aria-busy', String(state.fetching));
      badge.setAttribute('aria-label', `${t.refreshNodeBalance}: ${balance?.exact ?? value}`);
      badge.title = [
        t.nodeBalance,
        balance?.exact,
        session.node?.address,
        session.node?.chainId,
        state.updatedAt ? `${t.balanceUpdatedAt} ${new Date(state.updatedAt).toLocaleTimeString(locale)}` : '',
        state.error ? t.balanceUnavailable : state.stale ? t.cachedNodeBalance : '',
        t.refreshNodeBalance,
      ]
        .filter(Boolean)
        .join(' · ');
    },
  );
}
export function readPageSession() {
  if (!sessionFlight)
    sessionFlight = request('/api/runtime/session')
      .then((session) => {
        showBalance(session);
        return session;
      })
      .catch((error) => {
        hideBalance(true);
        throw error;
      })
      .finally(() => {
        sessionFlight = undefined;
      });
  return sessionFlight;
}
// Native ARC logout owns the actual session. Clear display snapshots before the
// browser leaves, and always reverify identity on bfcache restoration.
document.addEventListener(
  'click',
  (event) => {
    const target = event.target.closest('a,button');
    if (
      target?.closest('header.aup-app-header') &&
      /logout|sign.?out/i.test(
        [target.getAttribute('href'), target.getAttribute('onclick'), target.dataset.action, target.textContent].join(
          ' ',
        ),
      )
    )
      hideBalance(true);
  },
  { capture: true },
);
window.addEventListener('pagehide', () => {
  hideBalance();
  const workspace = document.querySelector('[data-workspace]');
  if (workspace) workspace.hidden = true;
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});
