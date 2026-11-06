import http from 'node:http';
import { Readable } from 'node:stream';
import { createLegacyApp } from '../source/http/app-factory.ts';
import { arcResponseHeaders } from './arc-response-headers.mjs';
let server, starting;
async function start() {
  if (!starting)
    starting = new Promise((resolve, reject) => {
      server = http.createServer(createLegacyApp());
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  await starting;
}
export async function closeApp() {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
export default {
  async fetch(request) {
    await start();
    const target = new URL(request.url);
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.from(await request.arrayBuffer());
    const headers = Object.fromEntries(request.headers);
    delete headers.connection;
    delete headers['transfer-encoding'];
    delete headers['content-length'];
    if (body) headers['content-length'] = String(body.length);
    return new Promise((resolve, reject) => {
      const upstream = http.request(
        {
          host: '127.0.0.1',
          port: server.address().port,
          path: target.pathname + target.search,
          method: request.method,
          headers,
        },
        (response) => {
          resolve(
            new Response(
              request.method === 'HEAD' || [204, 205, 304].includes(response.statusCode)
                ? null
                : Readable.toWeb(response),
              { status: response.statusCode, headers: arcResponseHeaders(response.headers) },
            ),
          );
        },
      );
      upstream.on('error', reject);
      upstream.end(body);
    });
  },
};
