import http from 'node:http';
import { Readable } from 'node:stream';
import { arcResponseHeaders } from './arc-response-headers.mjs';
import { previewArcWebSocket } from './preview-arc-websocket.mjs';

// Native HTTP/WebSocket transport only. Runtime identity, storage and scheduling
// are supplied by runtime.mjs after its startup gates complete.
export function createProtocolServer({ config, routing, fetch, isReady }) {
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      if (!isReady()) {
        outgoing.writeHead(503);
        outgoing.end('DIDMail starting');
        return;
      }
      if (!incoming.url.startsWith('/') || incoming.url.startsWith('//')) {
        outgoing.writeHead(421);
        outgoing.end();
        return;
      }
      const url = new URL(incoming.url, new URL(config.publicOrigin).protocol + '//' + incoming.headers.host);
      try {
        routing.resolve(url.toString());
      } catch {
        outgoing.writeHead(421);
        outgoing.end();
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 80 * 1024 * 1024) {
          outgoing.writeHead(413);
          outgoing.end();
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (let i = 0; i < incoming.rawHeaders.length; i += 2) {
        const key = incoming.rawHeaders[i];
        if (
          /^(x-(caller-|arc-role|arc-did|forwarded-)|forwarded$|cf-connecting-ip$|connection$|transfer-encoding$)/i.test(
            key,
          )
        )
          continue;
        headers.append(key, incoming.rawHeaders[i + 1]);
      }
      headers.set('cf-connecting-ip', incoming.socket.remoteAddress || '127.0.0.1');
      const request = new Request(url, {
        method: incoming.method,
        headers,
        ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Buffer.concat(chunks) } : {}),
      });
      const response = await fetch(request);
      const responseHeaders = arcResponseHeaders(Object.fromEntries(response.headers)),
        cookies = response.headers.getSetCookie();
      responseHeaders.delete('set-cookie');
      outgoing.writeHead(response.status, {
        ...Object.fromEntries(responseHeaders),
        ...(cookies.length ? { 'set-cookie': cookies } : {}),
      });
      if (incoming.method === 'HEAD' || !response.body) outgoing.end();
      else {
        const stream = Readable.fromWeb(response.body);
        outgoing.once('close', () => stream.destroy());
        stream.on('error', () => outgoing.destroy());
        stream.pipe(outgoing);
      }
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(503, { 'cache-control': 'no-store' });
      outgoing.end('DIDMail native protocol unavailable');
    }
  });
  const sockets = new Set();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  const upgrade = previewArcWebSocket(routing);
  server.on('upgrade', (request, socket, head) => {
    try {
      if (!isReady()) {
        socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
        return;
      }
      const url = new URL(request.url, new URL(config.publicOrigin).protocol + '//' + request.headers.host);
      if (request.headers.origin && request.headers.origin !== url.origin) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return;
      }
      request.url = url.toString();
      upgrade(request, socket, head);
    } catch {
      socket.end('HTTP/1.1 421 Misdirected Request\r\nConnection: close\r\n\r\n');
    }
  });
  async function close() {
    server.closeAllConnections();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
  return { server, close };
}
