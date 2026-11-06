import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import GraphQLClient from '@ocap/client';
import router from '../../blocklet/providers/didmail-http/source/api/src/routes/account';
import getWallet from '../support/node/runtime/wallet';

jest.mock('@ocap/client', () => {
  const getAccountState = jest.fn();
  return jest.fn(() => ({ getAccountState }));
});
const client = (GraphQLClient as unknown as jest.Mock).mock.results[0]!.value;
let server: http.Server;
let origin: string;
beforeAll(async () => {
  const app = express();
  app.use('/api/account', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => {
    server.once('listening', resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

test('an unregistered node still exposes its own recharge address, never the caller DID', async () => {
  client.getAccountState.mockResolvedValue({ state: null });
  const response = await fetch(`${origin}/api/account/state`, { headers: { 'x-didmail-did': 'operator-did' } });
  const data = await response.json();
  expect(data).toMatchObject({ address: getWallet().address, chainStatus: 'unregistered', balance: '0', tokens: [] });
  expect(data.moniker).toBeTruthy();
  expect(client.getAccountState).toHaveBeenLastCalledWith({ address: getWallet().address });
  expect(JSON.stringify(data)).not.toContain(getWallet().secretKey);
});
test('a funded node retains its token balances and chain identity', async () => {
  const tokens = [{ symbol: 'TBA', value: '12345', decimal: 18 }];
  client.getAccountState.mockResolvedValue({
    state: { address: getWallet().address, moniker: 'existing-node', tokens, balance: '42' },
  });
  const response = await fetch(`${origin}/api/account/state`);
  expect(await response.json()).toMatchObject({
    address: getWallet().address,
    moniker: 'existing-node',
    tokens,
    balance: '42',
    chainStatus: 'ready',
  });
});
test.each(['ENOTFOUND', 'CERT_HAS_EXPIRED', 'OTHER_ERROR'])(
  'chain failure %s preserves the address and reports unavailable, not an empty account',
  async (code) => {
    client.getAccountState.mockRejectedValue(Object.assign(new Error('chain temporarily unavailable'), { code }));
    const response = await fetch(`${origin}/api/account/state`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ address: getWallet().address, chainStatus: 'unavailable' });
  },
);
