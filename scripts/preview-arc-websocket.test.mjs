import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { previewRouting } from './preview-routing.mjs';
import { previewArcService } from '../tests/support/arc-service.mjs';
import { previewArcWebSocket } from './preview-arc-websocket.mjs';

test('preview transports ARC WebSockets through workerd without granting caller headers', async () => {
  const upstream = http.createServer();
  const wss = new WebSocketServer({ server: upstream });
  wss.on('connection', (socket, request) => {
    socket.on('message', bytes => socket.send(JSON.stringify({ bytes: [...bytes], cookie: request.headers.cookie, origin: request.headers.origin, host: request.headers.host, caller: request.headers['x-caller-role'] || null })));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const service = await previewArcService(async () => new Response('unused'), { upgrade: previewArcWebSocket(previewRouting({ origin: 'http://didmail-server.localhost:8788', arc: `http://127.0.0.1:${upstream.address().port}` })) });
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: `export default{fetch(r,env){return env.ARC.fetch(r)}}`, serviceBindings: { ARC: service.binding } }));
  let client;
  try {
    // dispatchFetch retains the public origin while the external bridge connects
    // to the isolated loopback fixture. No real ARC instance or cookie is used.
    const response = await mf.dispatchFetch('http://didmail-server.localhost:8788/?blocklet=didmail-server', { headers: { Upgrade: 'websocket', Cookie: 'fixture=owner', Origin: 'http://didmail-server.localhost:8788', 'x-caller-role': 'admin' } });
    assert.equal(response.status, 101);
    client = response.webSocket; assert.ok(client); client.accept();
    const received = new Promise(resolve => client.addEventListener('message', event => resolve(JSON.parse(event.data)), { once: true }));
    client.send(new Uint8Array([0, 255, 12]));
    assert.deepEqual(await received, { bytes: [0, 255, 12], cookie: 'fixture=owner', origin: 'http://didmail-server.localhost:8788', host: 'didmail-server.localhost:8788', caller: null });
    const denied = await mf.dispatchFetch('http://unconfigured.invalid/?blocklet=didmail-server', { headers: { Upgrade: 'websocket' } });
    assert.equal(denied.status, 421);
  } finally {
    client?.close(); await mf.dispose(); await service.close();
    for (const socket of wss.clients) socket.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => upstream.close(resolve));
  }
});
