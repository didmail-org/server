// Operator-only private configuration access; never a public HTTP binding.
import { protocolConfigPath, validateProtocolConfig } from '../blocklet/providers/didmail-http/config.mjs';
export function localProtocolConfig(origin) {
  const base = new URL(origin);
  if (
    base.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(base.hostname) ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  )
    throw Error('Fixed loopback ARC origin required');
  async function rpc(method, config, ifMatch) {
    const response = await fetch(new URL('/afs', base), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        method,
        params: {
          path: '/blocklets/didmail-server' + protocolConfigPath,
          ...(config
            ? { content: { content: JSON.stringify(validateProtocolConfig(config)) }, options: { ifMatch } }
            : {}),
        },
      }),
    });
    const body = await response.json();
    if (!response.ok || !body.success) throw Error('Private protocol configuration operation failed');
    return body.data;
  }
  return {
    read: () => rpc('read'),
    write: (config, ifMatch) => {
      if (typeof ifMatch !== 'string' || !ifMatch) throw Error('Explicit conditional version required');
      return rpc('write', config, ifMatch);
    },
  };
}
