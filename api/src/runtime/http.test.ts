import http from 'http';
import { AddressInfo } from 'net';
import { fromRandom } from '@ocap/wallet';
import { toBase58 } from '@ocap/util';

import { createApp } from '../../../tests/support/legacy-http';
import { initializeDatabase } from './database';
import env from '../libs/env';
import runtimeEnv from './env';
import sequelize, { Mail, Attachment } from '../libs/sqlite';

jest.mock('@ocap/client', () => jest.fn());
jest.mock('../libs/forge', () => ({ getForgeState: jest.fn(() => Promise.resolve({})) }));

let server: http.Server;
let arc: http.Server;
let origin: string;
const wallet = fromRandom();
const headers = { 'X-DIDMail-did': wallet.address, 'X-DIDMail-pk': toBase58(wallet.publicKey) };
const mailBytes = Buffer.from([11, 22, 33, 44]);
const attachmentBytes = Buffer.from([45, 67, 89, 0, 255]);
let mailId: number;

beforeAll(async () => {
  await initializeDatabase();
  const mail = await Mail.create({
    subject: 'encrypted-subject',
    content: toBase58(mailBytes),
    sender: wallet.address,
    receiver: wallet.address,
    envelope: 'fixture-envelope',
    sendStatus: 'sent',
    hash: 'hash',
    size: 4,
    expiredAt: new Date(Date.now() + 86400000),
  });
  mailId = mail.get('id') as number;
  await Attachment.create({
    id: 'fixture-attachment',
    mailId,
    encryptedName: 'opaque-name',
    encryptedMime: 'opaque-mime',
    size: 5,
    hash: 'hash',
    content: attachmentBytes,
  });
  arc = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (req.url === '/.well-known/service/api/did/session')
        res.end(JSON.stringify({ authenticated: false, user: null }));
      else res.end(JSON.stringify({ path: req.url, host: req.headers.host, body }));
    });
  });
  await new Promise<void>((resolve) => {
    arc.listen(0, '127.0.0.1', resolve);
  });
  env.arcUrl = `http://127.0.0.1:${(arc.address() as AddressInfo).port}`;
  runtimeEnv.arcUrl = env.arcUrl;
  const created = createApp();
  server = http.createServer(created);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await Promise.all(
    [server, arc].map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve());
        }),
    ),
  );
  await sequelize.close();
});

test('public capability probes and unknown API remain JSON', async () => {
  const policy = await fetch(`${origin}/api/mail/attachment-config`);
  expect(policy.status).toBe(200);
  expect(await policy.json()).toMatchObject({ maxFileCount: 5, pricePerBytePerDay: '0' });
  expect((await fetch(`${origin}/api/servers/domains`)).status).toBe(200);
  const missing = await fetch(`${origin}/api/not-a-route`);
  expect(missing.status).toBe(404);
  expect(missing.headers.get('content-type')).toContain('application/json');
});
test('protected API denies anonymous access and spoofed owner role', async () => {
  expect((await fetch(`${origin}/api/mail/download/1`)).status).toBe(401);
  expect((await fetch(`${origin}/api/admin/attachment-config`, { headers: { 'x-arc-role': 'owner' } })).status).toBe(
    401,
  );
});
test('signed mail download preserves binary bytes and attachment metadata', async () => {
  const timeStamp = String(Date.now());
  const sign = wallet.sign(`${mailId}-${timeStamp}`);
  const res = await fetch(`${origin}/api/mail/download/${mailId}?${new URLSearchParams({ sign, timeStamp })}`, {
    headers,
  });
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('application/octet-stream');
  expect(res.headers.get('x-attachments-metadata')).toContain('fixture-attachment');
  expect(Buffer.from(await res.arrayBuffer())).toEqual(mailBytes);
});
test('signed attachment download preserves binary bytes and rejects invalid signatures', async () => {
  const timeStamp = String(Date.now());
  const sign = wallet.sign(`${mailId}-fixture-attachment-${timeStamp}`);
  const target = `${origin}/api/mail/download/${mailId}/attachment/fixture-attachment?`;
  const res = await fetch(target + new URLSearchParams({ sign, timeStamp }), { headers });
  expect(res.status).toBe(200);
  expect(Buffer.from(await res.arrayBuffer())).toEqual(attachmentBytes);
  const bad = await fetch(target + new URLSearchParams({ sign: fromRandom().sign('invalid'), timeStamp }), { headers });
  expect(bad.status).toBe(401);
});
test('multipart send reaches existing field and metadata validation unchanged', async () => {
  const data = new FormData();
  data.append('subject', new Blob([Buffer.from([1, 2])]), 'subject.bin');
  data.append('content', new Blob([Buffer.from([3, 4])]), 'content.bin');
  data.append('attachment', new Blob([attachmentBytes]), 'attachment.bin');
  data.append('attachmentMeta', '{not-json');
  const res = await fetch(`${origin}/api/mail/send`, { method: 'POST', headers, body: data });
  expect(res.status).toBe(400);
  const body = (await res.json()) as { error: string };
  expect(body.error).toMatch(/attachmentMeta/i);
});
test('ARC RPC proxy preserves request bytes and instance host', async () => {
  const body = JSON.stringify({ type: 'read', path: '/didmail/health.json' });
  const res = await fetch(`${origin}/api/afs/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  expect(await res.json()).toEqual({ path: '/api/afs/rpc', host: env.arcHost, body });
});
test('runtime configuration exposes only public fields', async () => {
  const res = await fetch(`${origin}/runtime-config.js`);
  const config = await res.text();
  expect(config).toContain('window.blocklet=');
  expect(config).not.toMatch(/secretKey|node-wallet|DIDMAIL_WALLET_FILE/);
});

test('corrects ARC custom static asset MIME types without changing bytes', async () => {
  const res = await fetch(`${origin}/assets/app.js`);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('application/javascript');
  expect(await res.json()).toMatchObject({ path: '/assets/app.js' });
  const css = await fetch(`${origin}/assets/app.css`);
  expect(css.headers.get('content-type')).toContain('text/css');
});
