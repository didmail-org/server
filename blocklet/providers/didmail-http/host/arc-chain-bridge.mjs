// Local-only adapter for a trusted Service Binding, never a public HTTP route.
export default function createChainForward(origin, fetcher = fetch) {
  return async (request) => {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/afs')
      return new Response('Read-only chain RPC required', { status: 403 });
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid RPC', { status: 400 });
    }
    const path = body?.params?.path;
    if (
      !['read', 'list'].includes(body?.method) ||
      typeof path !== 'string' ||
      !/^\/dev\/chain\/[a-z][a-z0-9-]*(?:\/|$)/.test(path) ||
      /[%\\?#\u0000]/.test(path) ||
      path.includes('//') ||
      path.split('/').some((part) => part === '.' || part === '..')
    )
      return new Response('Read-only chain RPC required', { status: 403 });
    return fetcher(new URL('/afs', origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
      redirect: 'manual',
    });
  };
}
