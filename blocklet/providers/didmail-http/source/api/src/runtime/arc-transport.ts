/** ARC request transport independent of a particular runtime's binding API. */
export interface ArcTransportOptions {
  binding?: { fetch(request: Request): Promise<Response> };
  origin?: string;
  fetch?: typeof globalThis.fetch;
}

export function createArcTransport(options: ArcTransportOptions) {
  return {
    available: Boolean(options.binding || options.origin),
    async fetch(request: Request): Promise<Response> {
      if (options.binding) {
        // Derive Host from the actual destination, never from caller input.
        const headers = new Headers(request.headers);
        headers.set('host', new URL(request.url).host);
        const response = await options.binding.fetch(new Request(request, { headers }));
        return response;
      }
      if (!options.origin) throw new Error('ARC service binding or ARC_ORIGIN is required');
      const target = new URL(options.origin);
      if (target.protocol !== 'https:' || target.username || target.password || target.pathname !== '/')
        throw new Error('ARC_ORIGIN must be an HTTPS origin');
      const source = new URL(request.url);
      target.pathname = source.pathname;
      target.search = source.search;
      const response = await (options.fetch || globalThis.fetch)(new Request(target.toString(), request), {
        redirect: 'manual',
      });
      return response;
    },
  };
}
