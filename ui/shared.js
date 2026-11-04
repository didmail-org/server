// Shared browser helpers; no framework, wallet or secret material belongs here.
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function units(value = '0', decimal = 18) {
  const raw = String(value);
  if (!/^\d+$/.test(raw) || !Number.isInteger(Number(decimal)) || decimal < 0 || decimal > 36) return '—';
  const digits = raw.padStart(Number(decimal) + 1, '0');
  if (!Number(decimal)) return BigInt(raw).toString();
  return `${BigInt(digits.slice(0, -decimal))}${digits.slice(-decimal).replace(/0+$/, '') ? '.' + digits.slice(-decimal).replace(/0+$/, '') : ''}`;
}
export function toUnits(value, decimal = 18) {
  const text = String(value);
  const precision = Number(decimal);
  if (!/^\d+(\.\d+)?$/.test(text) || !Number.isInteger(precision) || precision < 0 || precision > 36)
    throw new Error('Enter a valid token amount.');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > precision) throw new Error(`Use at most ${precision} decimal places.`);
  return BigInt(whole + fraction.padEnd(precision, '0'));
}
// Display rounding is separate from exact transaction units and form values.
export function amountText(value) {
  const text = String(value ?? '');
  const match = text.match(/^(\d+(?:\.\d+)?)(\s+[A-Za-z][A-Za-z0-9]*)?$/);
  if (!match) return text;
  const [whole, fraction = ''] = match[1].split('.');
  const scaled = BigInt(whole + fraction.slice(0, 4).padEnd(4, '0')) + (Number(fraction[4] || 0) >= 5 ? 1n : 0n);
  const digits = scaled.toString().padStart(5, '0');
  const tail = digits.slice(-4).replace(/0+$/, '');
  return BigInt(digits.slice(0, -4)).toString() + (tail ? '.' + tail : '') + (match[2] || '');
}
export function shortDid(value) {
  const address = String(value).replace(/^did:abt:/, '');
  return address.length > 10 ? address.slice(0, 6) + '...' + address.slice(-4).toUpperCase() : address;
}
export function didMarkup(value, t = (key) => key, { full = false } = {}) {
  const raw = String(value ?? '—');
  if (!/^(did:abt:[A-Za-z0-9-]+|z[1-9A-HJ-NP-Za-km-z]{20,64})$/.test(raw)) return escapeHtml(raw);
  const icon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${path}</svg>`;
  const display = full ? raw : shortDid(raw);
  return `<span class="dm-did${full ? ' dm-did-full' : ''}" dir="ltr"><button type="button" class="dm-did-value" data-did-show="${escapeHtml(raw)}" aria-label="${escapeHtml(t('DID details'))}: ${escapeHtml(display)}">${escapeHtml(display)}</button><button type="button" class="dm-did-icon" data-did-copy="${escapeHtml(raw)}" aria-label="${escapeHtml(t('Copy DID'))}">${icon('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>')}</button><button type="button" class="dm-did-icon" data-did-show="${escapeHtml(raw)}" aria-label="${escapeHtml(t('DID QR code'))}">${icon('<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3M15 21v-3M21 15v-3M12 3v3M12 12h3M3 12h3"/>')}</button></span>`;
}
export function tokenText(token, empty = 'NO BALANCE') {
  return token?.value != null ? `${amountText(units(token.value, token.decimal ?? 18))} ${token.symbol || ''}` : empty;
}
// Account/header display only. Transaction amounts and token selection are unchanged.
export function accountBalanceText(token, { unavailable = false, knownEmpty = false, empty = '—' } = {}) {
  const unknown = { summary: '—', exact: null };
  if (unavailable) return unknown;
  if (token == null) return knownEmpty ? { summary: empty, exact: empty } : unknown;
  const raw = token.value;
  if (
    !['string', 'bigint', 'number'].includes(typeof raw) ||
    (typeof raw === 'number' && (!Number.isSafeInteger(raw) || raw < 0)) ||
    !/^\d+$/.test(String(raw))
  ) return unknown;
  const scale = token.decimal;
  if (
    !((typeof scale === 'number' && Number.isInteger(scale)) ||
      (typeof scale === 'string' && /^(0|[1-9]\d?)$/.test(scale))) ||
    Number(scale) < 0 || Number(scale) > 36
  ) return unknown;
  const amount = units(String(raw), scale);
  if (amount === '—') return unknown;
  const suffix = token.symbol ? ` ${token.symbol}` : '';
  return { summary: amountText(amount) + suffix, exact: amount + suffix };
}
export function canAfford(tokens, cost) {
  if (!cost || !/^\d+$/.test(String(cost.value))) return false;
  const balance = tokens?.find(
    (token) =>
      (cost.address && token.address ? token.address === cost.address : token.symbol === cost.symbol) &&
      Number(token.decimal ?? 18) === Number(cost.decimal ?? 18),
  );
  return Boolean(balance && /^\d+$/.test(String(balance.value)) && BigInt(balance.value) >= BigInt(cost.value));
}
const pendingReads = new Map();
const mutationListeners = new Set();
export function onMutation(listener) {
  mutationListeners.add(listener);
  return () => mutationListeners.delete(listener);
}
async function notifyMutation(phase, path) {
  await Promise.all([...mutationListeners].map((listener) => listener(phase, path)));
}
export function request(path, options = {}) {
  if ((options.method || 'GET') !== 'GET') {
    return (async () => {
      pendingReads.clear();
      await notifyMutation('start', path);
      try {
        return await performRequest(path, options);
      } finally {
        pendingReads.clear();
        await notifyMutation('settled', path);
      }
    })();
  }
  const key = `${path}:${Boolean(options.optional404)}`;
  if (pendingReads.has(key)) return pendingReads.get(key);
  const pending = performRequest(path, options).finally(() => {
    if (pendingReads.get(key) === pending) pendingReads.delete(key);
  });
  pendingReads.set(key, pending);
  return pending;
}
async function performRequest(path, { method = 'GET', body, optional404 = false, signal } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(method === 'GET' ? 20_000 : 120_000)])
      : AbortSignal.timeout(method === 'GET' ? 20_000 : 120_000),
    headers:
      body instanceof FormData || body == null
        ? { accept: 'application/json' }
        : { accept: 'application/json', 'content-type': 'application/json' },
    body: body == null ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  if (optional404 && response.status === 404) return null;
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid API response (${response.status}).`);
  }
  if (!response.ok) {
    const message = [data?.message, data?.error, data?.detail].find((value) => typeof value === 'string' && value.trim());
    throw Object.assign(new Error(message || `Request failed (${response.status}).`), {
      status: response.status,
    });
  }
  return data;
}
export function svgSource(svg) {
  if (!svg) return '';
  if (/^data:image\/svg\+xml[;,]/i.test(svg)) return svg;
  if (/^\s*<(?:\?xml\b|svg\b)/i.test(svg)) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return '';
}
export function assetData(asset) {
  try {
    return typeof asset?.data?.value === 'string' ? JSON.parse(asset.data.value) : asset?.data?.value || {};
  } catch {
    return {};
  }
}

export function loadingMarkup(label, rows = 3) {
  return `<div class="dm-loading-panel" role="status" aria-label="${escapeHtml(label)}"><div class="dm-loading-caption"><span class="dm-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span></div><div class="dm-skeleton" aria-hidden="true">${Array.from({ length: rows }, (_, index) => `<span class="dm-skeleton-line" style="width:${index === 0 ? 48 : index % 2 ? 84 : 64}%"></span>`).join('')}</div></div>`;
}
