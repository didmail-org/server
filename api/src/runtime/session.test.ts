import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import { arcUser } from './session';
import env from './env';
import checkAuthAndRole from '../middleware/auth-middleware';

let upstream: http.Server;
let server: http.Server;
let origin: string;
let session: unknown;
let observedCookie: unknown;
let observedHost: unknown;
beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    observedCookie = req.headers.cookie;
    observedHost = req.headers.host;
    expect(req.url).toBe('/.well-known/service/api/did/session');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(session));
  });
  await new Promise<void>((r) => {
    upstream.listen(0, '127.0.0.1', r);
  });
  env.arcUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const app = express();
  app.all('/admin', arcUser, checkAuthAndRole, (req, res) => res.json({ did: req.user?.did }));
  server = http.createServer(app);
  await new Promise<void>((r) => {
    server.listen(0, '127.0.0.1', r);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await Promise.all(
    [server, upstream].map(
      (s) =>
        new Promise<void>((r) => {
          s.close(() => r());
        }),
    ),
  );
});
beforeEach(() => {
  session = { authenticated: false, user: null };
});

test('rejects anonymous requests and spoofed owner headers', async () => {
  const res = await fetch(`${origin}/admin`, { headers: { 'x-didmail-did': 'owner', 'x-arc-role': 'owner' } });
  expect(res.status).toBe(401);
});
test('rejects authenticated members without an admin role', async () => {
  session = { authenticated: true, user: { did: 'did:member', role: 'member' } };
  expect((await fetch(`${origin}/admin`)).status).toBe(401);
});
test('uses the role verified by ARC and forwards cookie only to the configured instance', async () => {
  session = { authenticated: true, user: { did: 'did:owner', role: 'owner' } };
  const res = await fetch(`${origin}/admin`, { headers: { cookie: 'arc_session=proof' } });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ did: 'did:owner' });
  expect(observedCookie).toBe('arc_session=proof');
  expect(observedHost).toBe(env.arcHost);
});
test('blocks cookie-authorized cross-origin mutations, including missing Origin', async () => {
  session = { authenticated: true, user: { did: 'did:owner', role: 'owner' } };
  for (const badOrigin of ['', 'https://attacker.test']) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(`${origin}/admin`, {
      method: 'POST',
      headers: { cookie: 'arc_session=proof', ...(badOrigin ? { origin: badOrigin } : {}) },
    });
    expect(res.status).toBe(403);
  }
  expect(
    (await fetch(`${origin}/admin`, { method: 'POST', headers: { cookie: 'arc_session=proof', origin: env.appUrl } }))
      .status,
  ).toBe(200);
});
test('fails closed when ARC returns an invalid identity response', async () => {
  session = { authenticated: true, user: { did: 'did:spoof' } };
  expect((await fetch(`${origin}/admin`)).status).toBe(503);
});
