import http from 'node:http';
import { AddressInfo } from 'node:net';
import express from 'express';
import { fromRandom } from '@ocap/wallet';
import { toBase58 } from '@ocap/util';
import GraphQLClient from '@ocap/client';
import sequelize, { Contact } from '../libs/sqlite';
import router from './contact';
import didMiddleware from '../middleware/didmail-middleware';

jest.mock('cross-fetch', () => global.fetch);
jest.mock('../libs/forge', () => ({ getForgeState: () => Promise.resolve({ token: { address: 'test-token' } }) }));
jest.mock('@ocap/client', () => {
  const Actual = jest.requireActual('@ocap/client');
  return jest.fn(() => {
    const instance = new Actual('https://example.invalid', false);
    instance.getContext = () => Promise.resolve({ chainId: 'beta', chainInfo: { id: 'beta' } });
    instance.getAssetState = jest.fn(() =>
      Promise.resolve({ state: { data: { value: JSON.stringify({ price: '0.001' }) } } }),
    );
    instance.sendTransferV3Tx = jest.fn(() => Promise.resolve('payment-hash'));
    instance.preMintAsset = jest.fn(() =>
      Promise.resolve({ factory: 'factory', address: 'contact-asset', variables: [], issuer: {} }),
    );
    instance.multiSignAcquireAssetV3Tx = jest.fn(({ tx }: any) => Promise.resolve(tx));
    instance.signAcquireAssetV3Tx = jest.fn(({ tx }: any) => Promise.resolve(tx));
    instance.sendAcquireAssetV3Tx = jest.fn(() => Promise.resolve('asset-hash'));
    instance.getTx = jest.fn(() => Promise.resolve({ info: { tx: { itxJson: { address: 'contact-asset' } } } }));
    return instance;
  });
});
const sender = fromRandom();
const receiver = fromRandom();
const outsider = fromRandom();
const contactClient = (GraphQLClient as unknown as jest.Mock).mock.results[0]!.value;
const client = () => contactClient;
let server: http.Server;
let endpoint: string;
const post = (path: string, body: unknown, who = sender) =>
  fetch(endpoint + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-didmail-did': who.address,
      'x-didmail-pk': toBase58(who.publicKey),
    },
    body: JSON.stringify(body),
  });
async function prepare() {
  const response = await post('/send', {
    receiver: receiver.address,
    contact: 'opaque-test-ciphertext',
    namecard: receiver.address,
  });
  expect(response.status).toBe(200);
  return response.json() as Promise<{ _id: number; origin: string; hash: string }>;
}
async function signed(preparation: { origin: string }, change?: (tx: any) => void) {
  let tx = client().decodeTx(preparation.origin);
  change?.(tx);
  tx.signaturesList.push({ signer: sender.address, pk: sender.publicKey });
  tx = { ...(await client().multiSignTransferV3Tx({ tx, wallet: sender })), itx: tx.itx };
  tx = { ...(await client().signTransferV3Tx({ tx, wallet: sender })), itx: tx.itx };
  return toBase58((await client().encodeTransferV3Tx({ tx, wallet: sender })).buffer);
}
beforeAll(async () => {
  (sequelize as any).options.logging = false;
  await Contact.sync({ force: true });
  const app = express();
  app.use(express.json());
  app.use(didMiddleware as any, router);
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await sequelize.close();
});
beforeEach(() => jest.clearAllMocks());
test('rejects modified payments and foreign sender without broadcasts or deleting original contact', async () => {
  const p = await prepare();
  expect((await post('/send/sign', { id: p._id, hash: p.hash, origin: await signed(p) }, outsider)).status).toBe(404);
  const altered = await signed(p, (tx) => {
    tx.itx = {
      inputs: [{ owner: sender.address, tokens: [{ address: 'test-token', value: '1' }] }],
      outputs: [{ owner: sender.address, tokens: [{ address: 'test-token', value: '1' }] }],
    };
  });
  expect((await post('/send/sign', { id: p._id, hash: p.hash, origin: altered })).status).toBe(400);
  expect((await post('/send/sign', { id: p._id, hash: 'wrong', origin: await signed(p) })).status).toBe(404);
  expect(client().sendTransferV3Tx).not.toHaveBeenCalled();
  expect((await Contact.findByPk(p._id))!.get('sendStatus')).toBe('prepared');
});
test('concurrent submissions and retries mint exactly once', async () => {
  const p = await prepare();
  const body = { id: p._id, hash: p.hash, origin: await signed(p) };
  const responses = await Promise.all([post('/send/sign', body), post('/send/sign', body)]);
  expect(responses.some((r) => r.status === 200)).toBe(true);
  expect(responses.every((r) => [200, 409].includes(r.status))).toBe(true);
  expect((await post('/send/sign', body)).status).toBe(200);
  expect(client().sendTransferV3Tx).toHaveBeenCalledTimes(1);
  expect(client().sendAcquireAssetV3Tx).toHaveBeenCalledTimes(1);
});
test('ambiguous payment broadcast retains evidence and prevents another payment or mint', async () => {
  const p = await prepare();
  const body = { id: p._id, hash: p.hash, origin: await signed(p) };
  client().sendTransferV3Tx.mockRejectedValueOnce(new Error('Timeout after broadcast'));
  expect((await post('/send/sign', body)).status).toBe(503);
  expect((await Contact.findByPk(p._id))!.get('sendStatus')).toBe('review');
  expect((await post('/send/sign', body)).status).toBe(409);
  expect(client().sendTransferV3Tx).toHaveBeenCalledTimes(1);
  expect(client().sendAcquireAssetV3Tx).not.toHaveBeenCalled();
});
