import { escapeHtml as e, didMarkup } from './shared.js';

export function renderMemberAccess(snapshot, list, t) {
  const arc = snapshot.accessSource === 'arc',
    deny = arc || list.kind === 'deny';
  const date = (value) => {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat(t.locale || 'en', { year: 'numeric', month: 'short', day: 'numeric' }).format(parsed)
      : '—';
  };
  return `<div class="dm-access-overview"><p>${e(t(deny ? 'Blocked accounts cannot send through this server. Receiving and past mail downloads are unaffected.' : 'Allowlisted accounts can send through this server when access is restricted.'))}</p><button type="button" data-policy-action="refresh" class="dm-secondary dm-block-refresh" aria-label="${e(t('Refresh'))}" title="${e(t('Refresh'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 1-2.3-5.7L20 9"/></svg></button></div>
    <details class="dm-block-rules"><summary>${e(t('How access works'))}</summary><p>${e(t('A staked DIDMail service node NFT opens sending to everyone. Without one, only active local members with a linked mailbox can send. Blocked accounts are always excluded.'))}</p></details>
    <p data-policy-notice role="status"></p>
    <section class="dm-access-section" aria-label="${e(t(deny ? 'Blocked senders' : 'Allowed senders'))}">
      ${arc ? '' : `<label class="dm-access-kind"><span class="dm-visually-hidden">${e(t('List'))}</span><select data-policy-kind><option value="deny" ${deny ? 'selected' : ''}>${e(t('Denylist'))}</option><option value="allow" ${deny ? '' : 'selected'}>${e(t('Allowlist'))}</option></select></label>`}
      <details class="dm-block-editor" data-block-editor><summary class="dm-button dm-secondary">+ ${e(t(deny ? 'Block a sender' : 'Allow a sender'))}</summary>
        <form data-access-entry class="dm-block-form"><label>${e(t('Account DID'))}<input name="did" placeholder="did:abt:z… / z…" pattern="(did:abt:)?z[1-9A-HJ-NP-Za-km-z]{20,64}" maxlength="72" required autocomplete="off" dir="ltr"><small>${e(t('Paste a mailbox DID or ARC login DID.'))}</small></label><label>${e(t('Note (optional)'))}<input name="remark" maxlength="500" placeholder="${e(t('Why is this account listed?'))}"></label><div class="dm-block-form-actions"><button type="submit" data-entry-submit>${e(t(deny ? 'Confirm block' : 'Confirm allow'))}</button><button type="button" class="dm-secondary" data-policy-action="cancel-entry">${e(t('Cancel'))}</button></div></form>
      </details>
      ${list.entries.length ? `<div class="dm-table-wrap dm-block-table"><table><thead><tr><th>${e(t('Account DID'))}</th><th>${e(t('Remark'))}</th><th>${e(t('Added at'))}</th><th>${e(t('Action'))}</th></tr></thead><tbody>${list.entries.map((row) => `<tr><td>${didMarkup(row.did, t)}</td><td>${e(row.remark || '—')}</td><td><time datetime="${e(row.createdAt)}">${e(date(row.createdAt))}</time></td><td><div class="dm-block-row-actions"><button type="button" class="dm-secondary" data-policy-action="edit-entry" data-did="${e(row.did)}" data-remark="${e(row.remark)}">${e(t('Edit note'))}</button><button type="button" class="dm-secondary" data-policy-action="remove" data-did="${e(row.did)}">${e(t(deny ? 'Unblock' : 'Remove from allowlist'))}</button></div></td></tr>`).join('')}</tbody></table></div>` : `<div class="dm-block-empty"><strong>${e(t(deny ? 'No blocked senders' : 'No allowed senders yet'))}</strong></div>`}
      ${list.hasPrevious || list.nextCursor ? `<div class="dm-block-pagination"><button type="button" class="dm-secondary" data-policy-action="previous" ${list.hasPrevious ? '' : 'disabled'}>${e(t('Previous'))}</button><button type="button" class="dm-secondary" data-policy-action="next" ${list.nextCursor ? '' : 'disabled'}>${e(t('Next'))}</button></div>` : ''}

    </section>`;
}
