import { escapeHtml as e, didMarkup, amountText, units } from './shared.js';
const states = {
  uploading: ['Preparing', 'neutral'], awaiting_signature: ['Awaiting signature', 'warning'],
  queued: ['Queued', 'warning'], payment_pending: ['Confirming payment', 'warning'],
  payment_confirmed: ['Creating mail NFT', 'warning'], index_pending: ['Creating mail NFT', 'warning'],
  delivered: ['Delivered', 'success'], rejected: ['Rejected', 'error'], expired: ['Expired', 'neutral'],
  reconciliation_required: ['Review required', 'error'],
};
const nft = (mail) => String(mail.storageKey || '').startsWith('dmp:');
const confirmed = (mail) => nft(mail) && ['payment_confirmed', 'index_pending', 'delivered'].includes(mail.sendStatus);
const shortId = (id) => String(id).length > 16 ? String(id).slice(0, 8) + '…' + String(id).slice(-4) : String(id);
export function storageStatus(mail, t) {
  const [label, kind] = states[mail.sendStatus] || [nft(mail) ? 'Unknown status' : 'Historical record', 'neutral'];
  return `<span class="dm-badge" data-kind="${kind}">${e(t(label))}</span>`;
}
function amount(mail, value, symbol, exact = false) {
  if (value == null || !/^\d+(?:\.\d+)?$/.test(String(value))) return '—';
  const decimal = nft(mail) || /^\d{10,}$/.test(String(value)) ? units(value, 18) : String(value);
  if (decimal === '—') return decimal;
  let text = exact ? decimal : amountText(decimal);
  if (!exact && text === '0' && /[1-9]/.test(decimal)) text = '< 0.0001';
  return text + (symbol ? ' ' + symbol : '');
}
export function storagePayment(mail, t, symbol) {
  const label = mail.fundingMode==='node-sponsored' ? 'Node funded' : !nft(mail) ? 'Recorded amount' : confirmed(mail) ? 'Payment confirmed' : !mail.paymentTx ? 'Quoted amount' : ['queued', 'payment_pending'].includes(mail.sendStatus) ? 'Confirmation pending' : 'Review required';
  return `<strong dir="ltr">${e(amount(mail, mail.payment, symbol))}</strong><span class="dm-small dm-muted">${e(t(label))}</span>`;
}
export function storageFeeDetails(mail, t, symbol) {
  const rows = [['Total fee', mail.payment], ['Node service fee', mail.credit], ['Developer share', mail.dividend]];
  if(mail.fundingMode==='node-sponsored')rows.push(['Node-paid NFT cost',mail.sponsorCost]);
  else if (nft(mail) && [mail.payment, mail.credit, mail.dividend].every(value => /^\d+$/.test(String(value)))) {
    const indexing = BigInt(mail.payment) - BigInt(mail.credit) - BigInt(mail.dividend);
    if (indexing >= 0n) rows.push(['Indexing fee', indexing.toString()]);
  }
  return `<h3>${e(t(confirmed(mail) || !nft(mail) ? 'Fee breakdown' : 'Quote breakdown'))}</h3><dl class="dm-storage-fees">${rows.map(([label, value]) => `<div><dt>${e(t(label))}</dt><dd dir="ltr">${e(amount(mail, value, symbol, true))}</dd></div>`).join('')}</dl>`;
}
function date(value, t) {
  if (!value) return '—';
  const raw = String(value), normalized = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(raw) ? raw.replace(' ', 'T') + 'Z' : raw;
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) return '—';
  return `<time datetime="${e(parsed.toISOString())}">${e(new Intl.DateTimeFormat(t.locale || 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed))}</time>`;
}
function size(value, t) {
  const bytes = Math.max(0, Number(value) || 0), power = bytes >= 1048576 ? 2 : bytes >= 1024 ? 1 : 0;
  return new Intl.NumberFormat(t.locale || 'en', { maximumFractionDigits: power ? 1 : 0 }).format(bytes / 1024 ** power) + ' ' + ['B', 'KB', 'MB'][power];
}
const field = (label, value, t) => `<div><dt>${e(t(label))}</dt><dd>${value || '—'}</dd></div>`;
export function renderStorageTable(mails, t, symbol, search = '') {
  const headings = ['Mail', 'Participants', 'Delivery state', 'Size', 'Mail fee', 'Created', 'Details'];
  return `<div class="dm-storage-table-wrap" tabindex="0" role="region" aria-label="${e(t('Mails'))}"><table role="table" class="dm-storage-table ${mails.length ? '' : 'dm-storage-empty-table'}"><thead><tr>${headings.map(label => `<th scope="col">${e(t(label))}</th>`).join('')}</tr></thead><tbody>${mails.map((mail, index) => {
    const panel = 'storage-mail-' + index, metadata = e(JSON.stringify({ storageKey: mail.storageKey, sendStatus: mail.sendStatus, paymentTx: mail.paymentTx, payment: mail.payment, credit: mail.credit, dividend: mail.dividend }));
    const canDelete = !nft(mail) || ['delivered', 'rejected', 'expired'].includes(mail.sendStatus) || (['uploading', 'awaiting_signature'].includes(mail.sendStatus) && !mail.paymentTx);
    return `<tr class="dm-storage-mail-row" data-storage-row>
      <td class="dm-storage-id" data-label="${e(t('Mail'))}"><code dir="ltr" title="${e(mail.id)}">${e(shortId(mail.id))}</code></td>
      <td class="dm-storage-participants" data-label="${e(t('Participants'))}"><div><span>${e(t('Sender'))}</span>${didMarkup(mail.sender, t)}</div><div><span>${e(t('Receiver'))}</span>${didMarkup(mail.receiver, t)}</div></td>
      <td class="dm-storage-state" data-label="${e(t('Delivery state'))}">${storageStatus(mail, t)}</td>
      <td class="dm-storage-bytes" data-label="${e(t('Size'))}"><bdi dir="ltr">${e(size(mail.size, t))}</bdi></td>
      <td class="dm-storage-payment" data-label="${e(t('Mail fee'))}" data-mail-payment="${metadata}">${storagePayment(mail, t, symbol)}</td>
      <td class="dm-storage-date" data-label="${e(t('Created'))}">${date(mail.createdAt, t)}</td>
      <td class="dm-storage-action"><button type="button" class="dm-secondary" data-action="storage-details" aria-expanded="false" aria-controls="${panel}" aria-label="${e(t('Mail details {id}', { id: shortId(mail.id) }))}">${e(t('Details'))}</button></td>
    </tr><tr class="dm-storage-detail-row" id="${panel}" hidden><td colspan="7"><section class="dm-storage-detail" aria-label="${e(t('Mail details {id}', { id: shortId(mail.id) }))}">
      <div class="dm-storage-detail-grid"><div><h3>${e(t('Message identifiers'))}</h3><dl>${field('ID', `<code dir="ltr">${e(mail.id)}</code>`, t)}${field('Envelope', mail.envelope ? didMarkup(mail.envelope, t) : '', t)}${field('Asset', mail.asset ? didMarkup(mail.asset, t) : '', t)}${field('Download', date(mail.downloadAt, t), t)}</dl></div>
      <div><h3>${e(t('Transaction records'))}</h3><dl>${field('Content', `<code dir="ltr">${e(mail.hash || '—')}</code>`, t)}${field('PaymentTx', `<code dir="ltr">${e(mail.paymentTx || '—')}</code>`, t)}${field('AssetTx', `<code dir="ltr">${e(mail.assetTx || '—')}</code>`, t)}</dl></div>
      <div data-mail-fee-details="${metadata}">${storageFeeDetails(mail, t, symbol)}</div></div>
      <footer class="dm-storage-detail-footer"><p class="dm-small dm-muted">${e(t(canDelete ? 'Deleting removes the encrypted copy on this node. Chain records and downloaded copies remain.' : 'Delivery is in progress. Deletion is unavailable until it finishes.'))}</p><button type="button" data-action="delete-mail" data-mail-id="${e(nft(mail) ? mail.storageKey : mail.id)}" data-mail-label="${e(mail.id)}" class="dm-danger" aria-label="${e(t('Delete mail {id}', { id: mail.id }))}" ${canDelete ? '' : 'disabled'}>${e(t('Delete'))}</button></footer>
    </section></td></tr>`;
  }).join('') || `<tr><td colspan="7" class="dm-empty"><div class="dm-storage-empty"><span>${e(t(search ? 'No matching mail.' : 'No mails stored yet.'))}</span>${search ? `<button type="button" class="dm-secondary" data-action="clear-mail-search">${e(t('Clear search'))}</button>` : ''}</div></td></tr>`}</tbody></table></div>`;
}
