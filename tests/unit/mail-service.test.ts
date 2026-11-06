import http from 'node:http';
import { AddressInfo } from 'node:net';
import express from 'express';
import { fromRandom } from '@ocap/wallet';
import { toBase58 } from '@ocap/util';
import GraphQLClient from '@ocap/client';
import sequelize, { Mail, Attachment, AttachmentConfig, Envelope } from '../support/node/libs/sqlite';
import {
  getDefaultEnvelope,
  publicMailPolicy,
} from '../../blocklet/providers/didmail-http/source/api/src/libs/mail-service-policy';
import env from '../support/node/libs/env';
import router from '../../blocklet/providers/didmail-http/source/api/src/routes/mail';
import didMiddleware from '../../blocklet/providers/didmail-http/source/api/src/middleware/didmail-middleware';

jest.mock('cross-fetch', () => global.fetch);
jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/forge', () => ({
  getForgeState: () => Promise.resolve({ token: { address: 'test-token' } }),
}));
jest.mock('@ocap/client', () => {
  const Actual = jest.requireActual('@ocap/client');
  return jest.fn(() => {
    const client = new Actual('https://example.invalid', false);
    client.getContext = () => Promise.resolve({ chainId: 'beta', chainInfo: { id: 'beta' } });
    client.getAssetState = jest.fn(({ address }: any) =>
      Promise.resolve({
        state: {
          address,
          parent: 'test-envelope-factory',
          data: { value: JSON.stringify({ price: '0.001', retentionPeriod: 14 }) },
        },
      }),
    );
    client.sendTransferV3Tx = jest.fn(() => Promise.resolve('payment-hash'));
    client.preMintAsset = jest.fn(() =>
      Promise.resolve({ factory: 'factory', address: 'mail-asset', variables: [], issuer: {} }),
    );
    client.multiSignAcquireAssetV3Tx = jest.fn(({ tx }: any) => Promise.resolve(tx));
    client.signAcquireAssetV3Tx = jest.fn(({ tx }: any) => Promise.resolve(tx));
    client.sendAcquireAssetV3Tx = jest.fn(() => Promise.resolve('asset-hash'));
    client.getTx = jest.fn(() => Promise.resolve({ info: { tx: { itxJson: { address: 'mail-asset' } } } }));
    return client;
  });
});
const sender = fromRandom();
const receiver = fromRandom();
const outsider = fromRandom();
let server: http.Server;
let endpoint: string;
const headers = (who = sender) => ({ 'X-DIDMail-did': who.address, 'X-DIDMail-pk': toBase58(who.publicKey) });
const defaultEnvelopeAddress = fromRandom().address;
const clients = () => (GraphQLClient as unknown as jest.Mock).mock.results.map((r) => r.value);
const post = (body: unknown, who = sender) =>
  fetch(`${endpoint}/send/sign`, {
    method: 'POST',
    headers: { ...headers(who), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
function prepare(extra: Record<string, string> = {}) {
  const body = new FormData();
  body.append('receiver', receiver.address);
  body.append('envelope', '');
  body.append('subject', new Blob([new Uint8Array([1, 2, 3])]));
  body.append('content', new Blob([new Uint8Array([4, 5, 6])]));
  for (const [key, value] of Object.entries(extra)) body.set(key, value);
  return fetch(`${endpoint}/send`, { method: 'POST', headers: headers(), body });
}
beforeAll(async () => {
  (env as any).tokenId = 'test-token';
  (env as any).envelopeFactory = 'test-envelope-factory';
  (sequelize as any).options.logging = false;
  await Promise.all([
    Mail.sync({ force: true }),
    Attachment.sync({ force: true }),
    AttachmentConfig.sync({ force: true }),
    Envelope.sync({ force: true }),
  ]);
  await Envelope.create({
    address: defaultEnvelopeAddress,
    name: 'Paid envelope NFT',
    price: '0.001 TBA',
    retentionPeriod: 14,
    token: '{}',
    enabled: true,
  });
  const app = express();
  app.use(express.json());
  app.use(didMiddleware);
  app.use(router);
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(async () => {
  await Envelope.update({ enabled: true }, { where: { address: defaultEnvelopeAddress } });
  for (const client of clients()) client.sendTransferV3Tx.mockClear();
});
afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await sequelize.close();
});
test('the first enabled paid NFT is the automatic default, without another settings form', async () => {
  expect((await getDefaultEnvelope()).address).toBe(defaultEnvelopeAddress);
  expect(await publicMailPolicy()).not.toHaveProperty('allowedDids');
  expect((await publicMailPolicy()).restricted).toBe(false);
  await Envelope.update({ enabled: false }, { where: { address: defaultEnvelopeAddress } });
  expect(await getDefaultEnvelope()).toBeNull();
});
test('unstaked server prepares exact mail using its paid default NFT, binds terms and keeps snapshot', async () => {
  const response = await prepare();
  expect(response.status).toBe(200);
  const result = (await response.json()) as any;
  expect(result.paymentWei).toBe('1000000000000000');
  const row = (await Mail.findByPk(result._id))!;
  expect(row.get('envelope')).toBe(defaultEnvelopeAddress);
  expect(row.get('dividend')).toBe('90000000000000');
  expect(new Date(result.expiredAt).getTime() - Date.now()).toBeGreaterThan(13.9 * 86400000);
  await Envelope.update({ enabled: false }, { where: { address: defaultEnvelopeAddress } });
  expect((await Mail.findByPk(result._id))!.get('payment')).toBe('1000000000000000');
  expect((await prepare()).status).toBe(409);
  await Envelope.update({ enabled: true }, { where: { address: defaultEnvelopeAddress } });
  expect((await prepare({ expectedEnvelopePrice: '0.002' })).status).toBe(409);
});
test('rejects foreign sender, hash mismatch and altered transaction without deleting upload', async () => {
  const data = (await (await prepare()).json()) as any;
  expect((await post(data, outsider)).status).toBe(404);
  expect((await post({ ...data, hash: 'tampered' })).status).toBe(404);
  const client = clients()[0];
  const decoded = client.decodeTx(data.origin);
  decoded.nonce++;
  const encoded = await client.encodeTransferV3Tx({ tx: decoded, wallet: sender });
  expect((await post({ ...data, origin: toBase58(encoded.buffer) })).status).toBe(400);
  expect(await Mail.findByPk(data._id)).not.toBeNull();
  expect(clients().every((c) => !c.sendTransferV3Tx.mock.calls.length)).toBe(true);
});
test('concurrent and repeated submissions broadcast payment once', async () => {
  const data = (await (await prepare()).json()) as any;
  const responses = await Promise.all([post(data), post(data)]);
  expect(responses.map((r) => r.status)).toContain(200);
  expect((await post(data)).status).toBe(200);
  expect(clients().reduce((n, c) => n + c.sendTransferV3Tx.mock.calls.length, 0)).toBe(1);
});
test('ambiguous broadcast preserves evidence and blocks repayment', async () => {
  const data = (await (await prepare()).json()) as any;
  for (const c of clients()) c.sendTransferV3Tx.mockRejectedValueOnce(new Error('Timeout after broadcast'));
  expect((await post(data)).status).toBe(500);
  expect((await Mail.findByPk(data._id))!.get('sendStatus')).toBe('review');
  expect((await post(data)).status).toBe(409);
});
test('download rejects outsiders and future timestamps, permits recipient signature', async () => {
  const data = (await (await prepare()).json()) as any;
  const pendingTime = String(Date.now());
  expect(
    (
      await fetch(
        `${endpoint}/download/${data._id}?timeStamp=${pendingTime}&sign=${receiver.sign(`${data._id}-${pendingTime}`)}`,
        { headers: headers(receiver) },
      )
    ).status,
  ).toBe(409);
  await post(data);
  const download = (who: typeof sender, ts = String(Date.now())) =>
    fetch(`${endpoint}/download/${data._id}?timeStamp=${ts}&sign=${who.sign(`${data._id}-${ts}`)}`, {
      headers: headers(who),
    });
  expect((await download(outsider)).status).toBe(403);
  expect((await download(receiver)).status).toBe(200);
  expect((await download(receiver, String(Date.now() + 7200000))).status).toBe(401);
});

test('SDK wallet signing preserves the exact prepared transaction and mail binding', async () => {
  const data = (await (await prepare()).json()) as any;
  const client = clients()[0];
  let tx = client.decodeTx(data.origin);
  tx.signaturesList.push({ signer: sender.address, pk: toBase58(sender.publicKey) });
  const multi = await client.multiSignTransferV3Tx({ tx, wallet: sender });
  tx = { ...multi, itx: tx.itx };
  const signed = await client.signTransferV3Tx({ tx, wallet: sender });
  const encoded = await client.encodeTransferV3Tx({ tx: { ...signed, itx: tx.itx }, wallet: sender });
  expect((await post({ ...data, origin: toBase58(encoded.buffer) })).status).toBe(200);
});
