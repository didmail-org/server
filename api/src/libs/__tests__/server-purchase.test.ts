import { beforeEach, expect, jest, test } from '@jest/globals';

jest.mock('@ocap/client', () =>
  jest.fn(() => ({
    getAccountState: jest.fn(),
    preMintAsset: jest.fn(),
    acquireAsset: jest.fn(),
  })),
);
jest.mock('../../runtime/wallet', () => ({ __esModule: true, default: () => ({ address: 'node' }) }));
jest.mock('../env', () => ({
  __esModule: true,
  default: {
    chainHost: 'https://chain.invalid/api',
    serverNodeFactory: 'factory',
    factoryOwner: 'issuer',
  },
}));
jest.mock('@ocap/wallet', () => ({ fromAddress: () => ({ address: 'issuer' }) }));
jest.mock('../server-factory', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const Client = require('@ocap/client');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const axios = require('axios');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const readFactory = require('../server-factory').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const router = require('../../routes/servers').default;

const client = Client.mock.results[0].value;
const handler = router.stack.find((layer: any) => layer.route?.path === '/acquire').route.stack[0].handle;
const cost = { symbol: 'TBA', decimal: 18, value: '1000000000000000000' };
const response = () => {
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};
beforeEach(() => {
  jest.clearAllMocks();
  readFactory.mockResolvedValue({ token: cost });
  client.getAccountState.mockResolvedValue({ state: { tokens: [{ ...cost, value: '999999999999999999' }] } });
});
test('direct purchase with insufficient funds returns 402 before preparation or broadcast', async () => {
  const res = response();
  await handler({}, res);
  expect(res.status).toHaveBeenCalledWith(402);
  expect(res.json).toHaveBeenCalledWith({ message: 'Insufficient balance. Recharge the node first.' });
  expect(readFactory).toHaveBeenCalledWith(client, 'https://chain.invalid/api', 'factory', true);
  expect(client.getAccountState).toHaveBeenCalledWith({ address: 'node' });
  expect(axios.get).not.toHaveBeenCalled();
  expect(client.preMintAsset).not.toHaveBeenCalled();
  expect(client.acquireAsset).not.toHaveBeenCalled();
});
test('failed live account reads reject purchase rather than using cached funds', async () => {
  client.getAccountState.mockRejectedValue(new Error('Chain unavailable'));
  const res = response();
  await handler({}, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(client.acquireAsset).not.toHaveBeenCalled();
});
test('verified funds at the exact price allow the existing mint flow', async () => {
  client.getAccountState.mockResolvedValue({ state: { tokens: [cost] } });
  axios.get.mockResolvedValue({ data: { continent_code: 'AS', country_code: 'CN', region_code: 'SH' } });
  client.preMintAsset.mockResolvedValue({ factory: 'factory' });
  client.acquireAsset.mockResolvedValue('mock-only-hash');
  const res = response();
  await handler({}, res);
  expect(client.acquireAsset).toHaveBeenCalledWith({ itx: { factory: 'factory' }, wallet: { address: 'node' } });
  expect(res.json).toHaveBeenCalledWith({ hash: 'mock-only-hash' });
});
