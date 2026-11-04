import http from 'node:http';
import { AddressInfo } from 'node:net';
import express from 'express';
import { fromRandom } from '@ocap/wallet';
import { toBase58 } from '@ocap/util';
import GraphQLClient from '@ocap/client';
import sequelize, { Alias, Contact, DomainBinding } from '../libs/sqlite';
import { addDomain, makeChallenge, verifyDomain } from '../libs/alias-domain';
import { buildRegisterTx } from '../libs/alias-service';
import contactRouter from './contact';
import didMiddleware from '../middleware/didmail-middleware';

jest.mock('cross-fetch', () => global.fetch);
jest.mock('../libs/forge', () => ({ getForgeState: () => Promise.resolve({ token: { address: 'test-token' } }) }));
jest.mock('@ocap/client', () => {
  const Actual = jest.requireActual('@ocap/client');
  return jest.fn(() => {
    const client = new Actual('https://example.invalid', false);
    client.getContext = () => Promise.resolve({ chainId: 'beta', chainInfo: { id: 'beta' } });
    client.getAssetState = jest.fn(() =>
      Promise.resolve({ state: { data: { value: JSON.stringify({ price: '0.001' }) } } }),
    );
    return client;
  });
});
const sender = fromRandom();
let server: http.Server;
let endpoint: string;
beforeAll(async () => {
  (sequelize as any).options.logging = false;
  await Promise.all([Alias.sync({ force: true }), Contact.sync({ force: true }), DomainBinding.sync({ force: true })]);
  await addDomain('nonce.test');
  await verifyDomain('nonce.test', () => Promise.resolve([`didmail-verify=${makeChallenge('nonce.test')}`]));
  const app = express();
  app.use(express.json());
  app.use(didMiddleware as any, contactRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/send`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await sequelize.close();
});
test('same-millisecond concurrent contact and alias preparations have unique signed payment bytes', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now());
  try {
    const contact = async () => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-didmail-did': sender.address,
          'x-didmail-pk': toBase58(sender.publicKey),
        },
        body: JSON.stringify({
          receiver: sender.address,
          contact: 'public-ciphertext-fixture',
          namecard: sender.address,
        }),
      });
      expect(response.status).toBe(200);
      return response.json() as Promise<{ origin: string }>;
    };
    const account = { did: sender.address, pk: toBase58(sender.publicKey) };
    const prepared = await Promise.all([
      contact(),
      contact(),
      buildRegisterTx(account, 'alice', 'nonce.test', 1),
      buildRegisterTx(account, 'bobby', 'nonce.test', 1),
    ]);
    const client = (GraphQLClient as unknown as jest.Mock).mock.results[0]!.value;
    const nonces = prepared.map((p) => client.decodeTx(p.origin).nonce);
    expect(new Set(nonces).size).toBe(4);
    expect(new Set(prepared.map((p) => p.origin)).size).toBe(4);
    const stored = await sequelize.query('SELECT last_nonce FROM legacy_payment_nonce');
    expect((stored[0][0] as { last_nonce: number }).last_nonce).toBe(Math.max(...nonces));
  } finally {
    clock.mockRestore();
  }
});
