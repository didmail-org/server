// Readonly native-artifact fixture. Every browser request is fulfilled locally;
// every mutation is rejected before it can reach a service or chain.
import fs from 'node:fs/promises';
import path from 'node:path';
export async function appearanceFixture(context, { origin = 'http://didmail-server.localhost:8788' } = {}) {
  const root = path.resolve('dist');
  const html = await fs.readFile(path.join(root, 'en/index.html'), 'utf8');
  const corePath = html.match(/href="(\/aup-core\.[a-f0-9]+\.css)"/)[1];
  let core;
  if (process.env.DIDMAIL_BROWSER_CORE_CSS) core = await fs.readFile(process.env.DIDMAIL_BROWSER_CORE_CSS, 'utf8');
  else {
    const response = await fetch(new URL(corePath, process.env.DIDMAIL_BROWSER_URL || origin), { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('The genuine public ARC stylesheet is unavailable. Supply DIDMAIL_BROWSER_CORE_CSS or a running approved preview.');
    core = await response.text();
  }
  if (!core.includes('.aup-app-header')) throw new Error('Expected the genuine public ARC core stylesheet.');
  const vector = JSON.parse(await fs.readFile('test/fixtures/protocol/fixtures/account-recovery-v1.json', 'utf8'));
  const did = vector.body.mailboxId;
  const token = { address: 'appearance-token', symbol: 'TBA', decimal: 18, value: '1000000000000000000' };
  const state = { writes: [], reads: [], role: 'owner', fail: '', failures: [] };
  const policy = { revision: 1, accessSource: 'arc', policy: { accessMode: 'public', ordinary: { enabled: false, baseFee: '0', retentionDays: 10, attachmentPricePerBytePerDay: '0' }, attachments: { enabled: true, maxCount: 20, maxFileBytes: 33554432, maxTotalBytes: 62914560 }, maxMessageCiphertextBytes: 67108864 } };
  await context.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname;
    const json = (data, status = 200) => route.fulfill({ status, json: data });
    if (url.origin !== origin) return route.fulfill({ contentType: 'text/plain', body: '' });
    if (req.method() !== 'GET') { state.writes.push(p); return json({ message: 'Mutation blocked by appearance fixture' }, 409); }
    if (p.includes('/api/')) {
      state.reads.push(p);
      if (p === state.fail) return json({ message: 'Synthetic service unavailable' }, 503);
      if (p === '/api/runtime/session' || p === '/.well-known/service/api/did/session') return json({ authenticated: state.role !== 'anonymous', user: state.role === 'anonymous' ? null : { did: 'appearance-owner', fullName: 'Taylor Reed', role: state.role }, node: { address: did, chainId: 'beta', cacheKey: 'appearance-fixture' } });
      if (p === '/api/account/state') return json({ address: did, moniker: 'DIDMail Server', tokens: [{ ...token, value: '100000000000000000000' }], chainId: 'beta', chainStatus: 'ready' });
      if (p === '/api/forge/state') return json({ token });
      if (p === '/api/stake/state') return json({ staked: false, ownerAssets: [], assets: [], tokens: [], revokedTokens: [], revokedAssets: [] });
      if (p === '/api/account/transfer') return json({ recipient: did, node: did, chainId: 'beta', token: { ...token, value: '100000000000000000000' } });
      if (p === '/api/account/gas-stake') return json({ address: did, node: did, chainId: 'beta', policyId: 'appearance-policy', exitPolicyId: 'appearance-exit', waitingPeriod: 31536000, withdrawalWaitingPeriod: 31536000, canRevoke: false, withdrawals: [], token, balance: '100000000000000000000', staked: '0', revoked: '0', eligible: false });
      if (p.endsWith('/factory')) return json({ name: 'DIDMail Template Factory', address: did, description: 'Synthetic factory', token, price: '1 TBA', limit: '∞', minted: 1, owner: did });
      if (p === '/api/admin/mail-policy') return json(policy);
      if (p === '/api/admin/mail-access-list') return json({ kind: 'deny', entries: [], revision: 1, nextCursor: null });
      if (p === '/api/admin/mail-health') return json({ queues: [], attention: [] });
      if (p === '/api/admin/attachment-config') return json({ maxFileSizeBytes: 10485760, maxFileCount: 5, pricePerBytePerDay: '0' });
      if (p === '/api/admin/members') return json({ page: 1, pageSize: 20, total: 2, members: [{ did, name: 'Taylor Reed', role: 'owner', active: true, binding: { mailboxId: did, revoked: false } }, { did, name: 'Morgan Chen — Infrastructure and community operations', role: 'member', active: true, binding: null }] });
      if (p === '/api/storage/size') return json({ size: '1 KB' });
      if (p === '/api/storage/mails') return json({ total: 3, totalPages: 1, mails: ['awaiting_signature', 'delivered', 'reconciliation_required'].map((sendStatus, i) => ({ id: String(i).padStart(32, '0'), storageKey: 'dmp:' + i, sender: did, receiver: did, envelope: did, asset: did, hash: 'a'.repeat(64), payment: '10000000000000000', credit: '9000000000000000', dividend: '0', createdAt: '2026-10-30T08:20:00Z', size: 127, sendStatus })) });
      if (p === '/api/envelope/list' || p === '/api/namecard/list') return json({ envelopes: [], namecards: [], cache: { source: 'cache', syncedAt: '2026-10-24T00:00:00Z' }, paging: { cursor: '0', next: false, total: 0 } });
      state.failures.push(p); return json({ message: 'Unknown appearance API fixture' }, 404);
    }
    if (p === corePath) return route.fulfill({ contentType: 'text/css', body: core });
    if (p === '/__blocklet__.js') return route.fulfill({ contentType: 'application/javascript', body: '/* Native platform bridge is excluded from the readonly appearance fixture. */' });
    if (p.startsWith('/.well-known/service/user/avatar/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="14" fill="#536277"/></svg>' });
    let pathname = decodeURIComponent(p);
    const match = /^\/(?:(en|zh|ja|ar|ru)\/)?(help|admin(?:\/[a-z]+)?)?\/?$/.exec(pathname);
    if (match) pathname = '/' + (match[1] || 'en') + '/' + (match[2] ? match[2].replaceAll('/', '-') + '/' : '') + 'index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) return route.fulfill({ status: 404, body: '' });
    try { return route.fulfill({ contentType: ({ '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream', body: await fs.readFile(file) }); }
    catch { state.failures.push(p); return route.fulfill({ status: 404, body: 'Missing appearance artifact' }); }
  });
  return { origin, state };
}
