import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { arcResponseHeaders } from './arc-response-headers.mjs';

// Node fetch does not reliably honor an overridden Host. ARC chooses the
// credential's instance using that host, so use an explicit, fixed HTTP hop.
export function arcHttpTransport(origin, publicOrigin) {
  const source = new URL(origin),
    site = new URL(publicOrigin);
  if (
    site.username ||
    site.password ||
    site.pathname !== '/' ||
    site.search ||
    site.hash ||
    !['https:', 'http:'].includes(site.protocol)
  )
    throw Error('Invalid ARC public origin');
  return async (input, options) => {
    const target = new URL(input);
    if (target.origin !== source.origin) throw Error('Invalid ARC destination');
    return new Promise((resolve, reject) => {
      const transport = target.protocol === 'https:' ? https : http;
      const request = transport.request(
        target,
        {
          method: options.method,
          signal: options.signal,
          headers: {
            ...options.headers,
            host: site.host,
            'x-forwarded-host': site.host,
            'x-forwarded-proto': site.protocol.slice(0, -1),
            'accept-encoding': 'identity',
          },
        },
        (response) => {
          resolve(
            new Response([204, 205, 304].includes(response.statusCode) ? null : Readable.toWeb(response), {
              status: response.statusCode,
              headers: arcResponseHeaders(response.headers),
            }),
          );
        },
      );
      request.on('error', reject);
      request.end(options.body);
    });
  };
}
