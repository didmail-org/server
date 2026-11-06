import { beforeEach, expect, jest, test } from '@jest/globals';

const mockRead = jest.fn<() => Promise<any>>();
jest.mock('@ocap/client', () => jest.fn().mockImplementation(() => ({ getForgeState: mockRead })));
jest.mock('../support/node/libs/env', () => ({
  __esModule: true,
  default: { chainHost: 'https://public-fixture.invalid/api/' },
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/logger', () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));

// eslint-disable-next-line import/first
import { getForgeState, getPublicForgeState } from '../../blocklet/providers/didmail-http/source/api/src/libs/forge';

beforeEach(() => {
  mockRead.mockReset();
});

test('public native terms preserve the exact valid zero-balance state', async () => {
  const state = { nonce: 0, balance: '0', tokens: [], assets: [], token: { symbol: 'TBA', decimal: 18 } };
  mockRead.mockResolvedValue({ state });
  expect(await getPublicForgeState()).toBe(state);
  expect(mockRead).toHaveBeenCalledWith({});
});

test.each([0, 18, 2147483647])(
  'native token precision %i is retained rather than treated as missing',
  async (decimal) => {
    const state = { balance: '0', token: { symbol: 'TBA', decimal } };
    mockRead.mockResolvedValue({ state });
    expect(await getPublicForgeState()).toBe(state);
  },
);

test.each([
  undefined,
  null,
  {},
  [],
  { token: null },
  { token: { symbol: 'TBA', decimal: '18' } },
  { token: { symbol: 'TBA', decimal: -1 } },
  { token: { symbol: 'TBA', decimal: 2147483648 } },
  { token: { symbol: 'TBA', decimal: 1.5 } },
  { token: { symbol: ' ', decimal: 18 } },
])('absent or malformed public native state is unavailable: %j', async (state) => {
  mockRead.mockResolvedValue({ state });
  expect(await getPublicForgeState()).toBeNull();
});

test('transport failure is nullable, then a normal retry reads the genuine recovered state', async () => {
  const state = { balance: '9876543210', token: { symbol: 'TBA', decimal: 18 } };
  mockRead.mockRejectedValueOnce(new Error('public-fixture-upstream-failure')).mockResolvedValueOnce({ state });
  expect(await getPublicForgeState()).toBeNull();
  expect(await getPublicForgeState()).toBe(state);
});

test('the existing internal accessor keeps its legacy failure and signing-call contract', async () => {
  const state = { token: { address: 'public-fixture-token' } };
  mockRead.mockResolvedValueOnce({ state }).mockRejectedValueOnce(new Error('public-fixture-upstream-failure'));
  expect(await getForgeState()).toBe(state);
  expect(await getForgeState()).toMatchObject({ balance: '0', tokens: [], assets: [] });
});
