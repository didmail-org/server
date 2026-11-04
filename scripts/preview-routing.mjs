import { isIP } from 'node:net';

function privateIPv4(host) {
  if (isIP(host) !== 4) return false;
  const [a, b] = host.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// Explicit local aliases only. Never trust arbitrary Host/X-Forwarded-* input
// when ARC constructs invitation links or DID Wallet callback origins.
export function previewRouting({ origin, aliases = '', listenHost = '127.0.0.1', arc }) {
  const primary = new URL(origin);
  const allowed = new Set([primary.origin]);
  for (const input of aliases
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    const alias = new URL(input);
    if (
      alias.protocol !== 'http:' ||
      !(privateIPv4(alias.hostname) || ['localhost', '127.0.0.1'].includes(alias.hostname)) ||
      alias.username ||
      alias.password ||
      alias.search ||
      alias.hash ||
      alias.pathname !== '/' ||
      alias.port !== primary.port
    ) {
      throw new Error('Preview aliases must be LAN or loopback HTTP origins on the preview port');
    }
    allowed.add(alias.origin);
  }
  if (!['127.0.0.1', '0.0.0.0'].includes(listenHost) && !privateIPv4(listenHost)) {
    throw new Error('Preview listen host must be loopback or a private LAN IPv4 address');
  }
  return {
    listenHost,
    resolve(requestUrl) {
      const incoming = new URL(requestUrl);
      if (!allowed.has(incoming.origin)) throw new Error('Unconfigured preview origin');
      const target = new URL(arc);
      target.pathname = incoming.pathname;
      target.search = incoming.search;
      // ARC supports explicit blocklet selection for hosts without a registered
      // site domain. The route remains scoped to this application's namespace.
      if (incoming.origin !== primary.origin) target.searchParams.set('blocklet', 'didmail-arc');
      return { target, publicOrigin: incoming.origin };
    },
  };
}
