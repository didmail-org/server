// Native Web Device renderer source. ARC reads this file directly.
const languages = ['en', 'zh', 'ar', 'ja', 'ru'];
function resolveLocale(value) {
 const code = String(value || 'en').toLowerCase().split('-')[0];
 return languages.includes(code) ? code : 'en';
}
function localeDirection(locale) { return resolveLocale(locale) === 'ar' ? 'rtl' : 'ltr'; }
function localizedPath(path, locale) {
 const code=resolveLocale(locale);
 return code === 'en' ? path : '/' + code + (path === '/' ? '/' : path);
}
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const escapeHtml = e;

function loadingMarkup(label, rows = 3) {
  return `<div class="dm-loading-panel" role="status" aria-label="${escapeHtml(label)}"><div class="dm-loading-caption"><span class="dm-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span></div><div class="dm-skeleton" aria-hidden="true">${Array.from({ length: rows }, (_, index) => `<span class="dm-skeleton-line" style="width:${index === 0 ? 48 : index % 2 ? 84 : 64}%"></span>`).join('')}</div></div>`;
}
export function render({ props = {}, escapeHtml, t }) {
  const section = ['account', 'server', 'envelope', 'namecard', 'storage', 'attachment', 'members'].includes(props.section)
    ? props.section
    : 'server';
  const items = [
    ['storage', t('Storage')],
    ['members', t('Members')],
    ['server', t('Server'), true],
    ['envelope', t('Envelope')],
    ['namecard', t('Namecard')],
    ['account', t('Node account'), true],
    ['attachment', t('Settings')],
  ];
  const pages = {
    account: [t('Node account'), t('Manage node funds, transfers, and gas staking.')],
    server: [t('Server'), t('Manage your service node NFT and its stake.')],
    envelope: [t('Envelopes'), t('Create and publish envelope templates for your node.')],
    namecard: [t('Namecards'), t('Create and publish namecard templates for your node.')],
    storage: [t('Storage'), t('Search and manage encrypted mail stored on your node.')],
    members: [t('Members'), t('View ARC members and linked mailboxes.')],
    attachment: [t('Settings'), t('Configure mail service and attachment limits.')],
  };
  const [title, description] = pages[section];
  return {
    html: `<section class="dm-app" dir="${localeDirection(props.locale)}" data-didmail-admin data-section="${escapeHtml(section)}">
    <nav class="dm-tabs" aria-label="${escapeHtml(t('DIDMail business navigation'))}"><div class="dm-tabs-inner">${items.map(([id, label, groupStart]) => `<a${groupStart ? ' class="dm-nav-group-start"' : ''} href="${localizedPath(`/admin/${id}`, props.locale)}"${section === id ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`).join('')}</div></nav>
    <div class="dm-main">
      <div data-session>${loadingMarkup(t('Checking ARC session…'), 2)}</div>
      <div data-workspace hidden>
        <div class="dm-page-heading"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><a class="dm-page-help" href="${localizedPath('/help',props.locale)}#${({account:'node-account',server:'server-node',envelope:'envelopes',namecard:'namecards',storage:'storage',members:'members',attachment:'settings'})[section]}">${escapeHtml(t('Help and usage'))} →</a></div>
        ${section === 'account' ? `<section class="dm-card" data-account aria-label="${escapeHtml(t('Node account'))}" aria-busy="true">${loadingMarkup(t('Loading node account…'))}</section>` : ''}
        <div class="dm-content"><div data-notice aria-live="polite"></div><div data-content>${loadingMarkup(t('Loading page data…'), 5)}</div></div>
      </div>
    </div>
    <dialog class="dm-dialog" data-dialog aria-labelledby="dm-dialog-title"><div data-dialog-body></div></dialog>
  </section><footer class="dm-footer" dir="${localeDirection(props.locale)}">${escapeHtml(t('DIDMail · Powered by ARC'))}</footer>`,
  };
}
