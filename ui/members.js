import { escapeHtml as e, request, didMarkup } from './shared.js';
const icon = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const searchIcon = icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>');
const refreshIcon = icon('<path d="M20 7v5h-5M20 12a8 8 0 1 1-2.3-5.7L20 9"/>');
const arrow = (next) => icon(next ? '<path d="m9 6 6 6-6 6"/>' : '<path d="m15 6-6 6 6 6"/>');
function avatar(member) {
  const hash = [...member.did].reduce((v, c) => (v * 31 + c.charCodeAt(0)) >>> 0, 0);
  const initial = [...(member.name.trim() || 'Z')][0].toLocaleUpperCase();
  return `<span class="dm-member-avatar dm-avatar-${hash % 5}" aria-hidden="true">${e(initial)}</span>`;
}
function badge(label, kind, dot = false) {
  return `<span class="dm-member-badge dm-badge-${kind}">${dot ? '<span aria-hidden="true" class="dm-member-dot"></span>' : ''}${e(label)}</span>`;
}
export function renderMembers(result, t, filtered = false) {
  return `<div class="dm-table-wrap dm-members-table" tabindex="0" role="region" aria-label="${e(t('Members'))}"><table><thead><tr><th>${e(t('Member'))}</th><th>${e(t('Role'))}</th><th>${e(t('Status'))}</th><th>${e(t('Linked mailbox'))}</th></tr></thead><tbody>${
    result.members
      .map(
        (m) => `<tr>
      <td><div class="dm-member-identity">${avatar(m)}<div class="dm-member-profile"><strong title="${e(m.name || t('Unnamed member'))}">${e(m.name || t('Unnamed member'))}</strong>${didMarkup(m.did, t)}</div></div></td>
      <td>${badge(t(m.role), m.role)}</td>
      <td>${badge(t(m.active ? 'Active' : 'Inactive'), m.active ? 'active' : 'inactive', true)}</td>
      <td><div class="dm-member-mailbox">${m.binding ? didMarkup(m.binding.mailboxId, t) : ''}${badge(t(!m.binding ? 'Not linked' : m.binding.revoked ? 'Revoked' : 'Linked'), !m.binding ? 'neutral' : m.binding.revoked ? 'revoked' : 'linked')}</div></td>
    </tr>`,
      )
      .join('') ||
    `<tr><td colspan="4"><div class="dm-members-empty">${searchIcon}<strong>${e(t('No matching members.'))}</strong><span>${e(t('Try another name, DID, or filter.'))}</span>${filtered ? `<button type="button" class="dm-secondary" data-members-clear>${e(t('Clear search'))}</button>` : ''}</div></td></tr>`
  }</tbody></table></div>
    <div class="dm-members-pagination"><span>${e(t('Page {page} · {total} members', { page: result.page, total: result.total }))}</span><div class="dm-actions"><button type="button" class="dm-secondary" data-members-page="previous" aria-label="${e(t('Previous'))}" ${result.page > 1 ? '' : 'disabled'}>${arrow(false)}</button><button type="button" class="dm-secondary" data-members-page="next" aria-label="${e(t('Next'))}" ${result.page * result.pageSize < result.total ? '' : 'disabled'}>${arrow(true)}</button></div></div>`;
}
export async function mountMembers(parent, t) {
  const panel = document.createElement('section');
  panel.className = 'dm-members-directory';
  panel.dataset.membersPanel = '';
  const select = (name, label, items) =>
    `<label class="dm-member-filter"><span class="dm-visually-hidden">${e(t(label))}</span><select name="${name}">${items.map(([value, text]) => `<option value="${value}">${e(t(text))}</option>`).join('')}</select></label>`;
  panel.innerHTML = `<div class="dm-members-toolbar"><form data-members-search class="dm-members-search" role="search"><label class="dm-members-query"><span class="dm-visually-hidden">${e(t('Search members'))}</span>${searchIcon}<input name="search" type="search" maxlength="100" placeholder="${e(t('Search members…'))}"></label>${select(
    'role',
    'Role',
    [
      ['', 'All roles'],
      ['owner', 'owner'],
      ['admin', 'admin'],
      ['member', 'member'],
      ['guest', 'guest'],
    ],
  )}${select('active', 'Status', [
    ['', 'All statuses'],
    ['active', 'Active'],
    ['inactive', 'Inactive'],
  ])}<button type="submit" class="dm-secondary dm-member-search-submit">${e(t('Search'))}</button></form><div class="dm-members-tools"><button type="button" data-members-refresh class="dm-secondary dm-members-icon" aria-label="${e(t('Refresh'))}" title="${e(t('Refresh'))}">${refreshIcon}</button><a class="dm-button dm-secondary" href="/.well-known/service/admin#members">${e(t('Manage and invite'))}</a><details class="dm-members-help"><summary aria-label="${e(t('Link a mailbox'))}" title="${e(t('Link a mailbox'))}">?</summary><div><strong>${e(t('Link a mailbox'))}</strong><p>${e(t('In DIDMail, sign in to the mailbox, open Servers, connect this private server, then choose Link mailbox. Confirm with the matching ARC member. The association appears here after refreshing.'))}</p><p>${e(t('Only active non-guest members qualify for member benefits.'))}</p></div></details></div></div><div data-members-result aria-live="polite" aria-label="${e(t('Members'))}"></div>`;
  parent.prepend(panel);
  const box = panel.querySelector('[data-members-result]'),
    form = panel.querySelector('[data-members-search]');
  let page = 1,
    busy = false,
    queued = false,
    lastResult;
  function placeholders() {
    return `<div class="dm-members-loading" role="status">${e(t('Loading…'))}</div>`;
  }
  async function load() {
    if (busy) {
      queued = true;
      return;
    }
    busy = true;
    queued = false;
    box.setAttribute('aria-busy', 'true');
    panel.querySelector('[data-members-refresh]').disabled = true;
    if (!lastResult) box.innerHTML = placeholders();
    const query = new URLSearchParams({ page: String(page), ...Object.fromEntries(new FormData(form)) });
    try {
      const result = await request('/api/admin/members?' + query);
      if (panel.isConnected && !queued) {
        lastResult = result;
        box.innerHTML = renderMembers(result, t, [...new FormData(form).values()].some(Boolean));
      }
    } catch {
      if (panel.isConnected && !queued) {
        lastResult = undefined;
        box.innerHTML = `<div class="dm-members-empty" role="alert"><strong>${e(t('ARC member service is unavailable. Refresh to retry.'))}</strong><button type="button" class="dm-secondary" data-members-refresh>${e(t('Retry'))}</button></div>`;
      }
    } finally {
      busy = false;
      box.setAttribute('aria-busy', 'false');
      panel.querySelector('[data-members-refresh]').disabled = false;
      if (queued && panel.isConnected) void load();
    }
  }
  panel.addEventListener('submit', (event) => {
    if (event.target !== form) return;
    event.preventDefault();
    event.stopPropagation();
    page = 1;
    void load();
  });
  panel.addEventListener('change', (event) => {
    if (!event.target.matches('select')) return;
    page = 1;
    void load();
  });
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-members-refresh], [data-members-page], [data-members-clear]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.hasAttribute('data-members-clear')) {
      form.reset();
      page = 1;
      form.elements.namedItem('search').focus();
    }
    if (button.dataset.membersPage) {
      if (busy) return;
      page += button.dataset.membersPage === 'next' ? 1 : -1;
    }
    void load();
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') panel.querySelector('.dm-members-help').open = false;
  });
  await load();
}
