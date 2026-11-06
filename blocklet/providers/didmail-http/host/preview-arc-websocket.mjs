import http from 'node:http';
import https from 'node:https';

// Fixed ARC destination + the same explicit public-origin allowlist as HTTP.
// This transports ARC's authenticated session; it grants no identity or role.
export function previewArcWebSocket(routing) {
  return (incoming, socket, head) => {
    let route;
    try {
      if (incoming.method !== 'GET' || incoming.headers.upgrade?.toLowerCase() !== 'websocket') throw Error();
      route = routing.resolve(incoming.url);
    } catch {
      socket.end('HTTP/1.1 421 Misdirected Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    const headers = {
      ...incoming.headers,
      host: new URL(route.publicOrigin).host,
      'x-forwarded-host': new URL(route.publicOrigin).host,
      'x-forwarded-proto': new URL(route.publicOrigin).protocol.slice(0, -1),
    };
    for (const name of Object.keys(headers)) if (/^x-(caller-|arc-role|arc-did)/i.test(name)) delete headers[name];
    const request = (route.target.protocol === 'https:' ? https : http).request(route.target, {
      method: 'GET',
      headers,
    });
    let upgraded = false;
    const fail = () => {
      if (upgraded) socket.destroy();
      else if (!socket.destroyed)
        socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    };
    request.setTimeout(10000, () => request.destroy());
    request.on('error', fail);
    socket.once('close', () => request.destroy());
    request.on('response', (response) => {
      response.resume();
      if (!socket.destroyed)
        socket.end(
          `HTTP/1.1 ${response.statusCode} ARC Upgrade Refused\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
        );
    });
    request.on('upgrade', (response, upstream, upstreamHead) => {
      upgraded = true;
      request.setTimeout(0);
      if (socket.destroyed) {
        upstream.destroy();
        return;
      }
      const lines = [];
      for (let i = 0; i < response.rawHeaders.length; i += 2)
        lines.push(`${response.rawHeaders[i]}: ${response.rawHeaders[i + 1]}`);
      socket.write(`HTTP/1.1 101 Switching Protocols\r\n${lines.join('\r\n')}\r\n\r\n`);
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) upstream.write(head);
      socket.on('error', () => upstream.destroy());
      upstream.on('error', () => socket.destroy());
      socket.once('close', () => upstream.destroy());
      upstream.once('close', () => socket.destroy());
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    request.end();
  };
}
