// Explicit local-development bridge for environments that require Node's
// NODE_USE_ENV_PROXY. Only the configured chain RPC may leave this bridge.
// Production Workers continue to use their native fetch implementation.
export function previewChainOutbound(endpoint, fetcher = fetch) {
  const allowed = new URL(endpoint);
  if (allowed.protocol !== 'https:' || allowed.username || allowed.password || allowed.search || allowed.hash)
    throw new Error('Invalid preview chain endpoint');
  return async (request) => {
    const url = new URL(request.url);
    if (url.origin !== allowed.origin || url.pathname !== allowed.pathname || url.search || request.method !== 'POST')
      return new Response('Preview outbound destination denied', { status: 403 });
    // workerd supplies transport framing for its own connection. The buffered
    // body starts a new Node fetch, which must generate its own framing headers.
    const headers = new Headers(request.headers);
    for (const name of ['content-length', 'transfer-encoding', 'connection', 'host']) headers.delete(name);
    return fetcher(url.href, {
      method: 'POST',
      headers,
      body: await request.arrayBuffer(),
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
  };
}
