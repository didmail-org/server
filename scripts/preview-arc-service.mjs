import http from 'node:http';
import { Readable } from 'node:stream';
import { arcResponseHeaders } from './arc-response-headers.mjs';

// Miniflare's Node-function service-binding transport can stall a subsequent
// HTML navigation after Chromium closes a context. A loopback external service
// uses ordinary HTTP framing and keeps that transport out of the ARC UI path.
export async function previewArcService(forward) {
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      // Workerd PROXY style preserves the complete original public URL. Never
      // construct it from an untrusted Host or expose a generic forward proxy.
      const url = new URL(incoming.url);
      const request = new Request(url, {
        method: incoming.method,
        headers: incoming.headers,
        ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}),
      });
      const response = await forward(request);
      const headers = arcResponseHeaders(Object.fromEntries(response.headers));
      const cookies = response.headers.getSetCookie();
      headers.delete('set-cookie');
      const body = Buffer.from(await response.arrayBuffer());
      outgoing.writeHead(response.status, {
        ...Object.fromEntries(headers),
        ...(cookies.length ? { 'set-cookie': cookies } : {}),
        ...(![204, 205, 304].includes(response.status) ? { 'content-length': body.length } : {}),
      });
      outgoing.end(incoming.method === 'HEAD' ? undefined : body);
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(502, { 'cache-control': 'no-store' });
      outgoing.end('ARC preview service unavailable');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    binding: { external: { address: `127.0.0.1:${server.address().port}`, http: { style: 1 } } },
    async close() {
      const closed = new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      server.closeAllConnections();
      await closed;
    },
  };
}
