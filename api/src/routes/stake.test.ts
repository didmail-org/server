import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import GraphQLClient from '@ocap/client';
import axios from 'axios';
import router from './stake';

jest.mock('@ocap/client', () =>
  jest.fn(() => ({
    getAssetState: jest.fn(() =>
      Promise.resolve({ state: { moniker: 'node', data: { value: '{"endpoint":"https://old.test"}' } } }),
    ),
    updateAsset: jest.fn(() => Promise.resolve('fixture-update-hash')),
  })),
);
jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { continent_code: 'AS', country_code: 'CN', region_code: 'SH' } })),
}));

let server: http.Server;
let origin: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

test('endpoint update completes its HTTP response with the transaction result', async () => {
  const response = await fetch(`${origin}/update-endpoint`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ asset: 'fixture-node' }),
    signal: AbortSignal.timeout(2000),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ hash: 'fixture-update-hash' });
  const clients = (GraphQLClient as unknown as jest.Mock).mock.results.map((result) => result.value);
  expect(
    clients.some((client) => client.updateAsset.mock.calls.some(([input]: any[]) => input.address === 'fixture-node')),
  ).toBe(true);
});
test('ordinary endpoint update failures return an error without hanging', async () => {
  (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Geo lookup unavailable'));
  const response = await fetch(`${origin}/update-endpoint`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ asset: 'fixture-node' }),
    signal: AbortSignal.timeout(2000),
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Geo lookup unavailable' });
});
