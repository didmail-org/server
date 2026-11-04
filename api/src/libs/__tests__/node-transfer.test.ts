/* eslint-disable no-await-in-loop */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { fromRandom } from '@ocap/wallet';

const owner = { did: fromRandom().address, role: 'owner' };
const node = fromRandom();
const token = { address: 'token', symbol: 'TBA', decimal: 18, value: '9007199254740993123456789' };
const client = {
  getAccountState: jest.fn<() => Promise<any>>(),
  getTokenState: jest.fn<() => Promise<any>>(),
  sendTransferV2Tx: jest.fn<(input: any) => Promise<string>>(),
};
jest.doMock('@ocap/client', () => jest.fn(() => client));
jest.doMock('../../runtime/wallet', () => ({ __esModule: true, default: () => node }));
jest.doMock('../env', () => ({
  __esModule: true,
  default: { chainHost: 'https://chain.invalid', tokenId: 'token', chainId: 'beta' },
}));
// eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
const { nodeTransferQuote, transferToOwner } = require('../node-transfer');
// eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
const router = require('../../routes/account').default;

beforeEach(() => {
  jest.clearAllMocks();
  client.getAccountState.mockResolvedValue({ state: { tokens: [token] } });
  client.getTokenState.mockResolvedValue({ state: token });
  client.sendTransferV2Tx.mockResolvedValue('test-only-transfer-hash');
});
test('only a verified owner can view or transfer funds; invalid recipients never reach the chain', async () => {
  for (const user of [undefined, { ...owner, role: 'admin' }, { ...owner, role: 'member' }]) {
    await expect(nodeTransferQuote(user)).rejects.toMatchObject({ status: 403 });
    await expect(transferToOwner(user, '1')).rejects.toMatchObject({ status: 403 });
  }
  await expect(transferToOwner({ did: 'invalid', role: 'owner' }, '1')).rejects.toMatchObject({ status: 400 });
  await expect(transferToOwner({ did: node.address, role: 'owner' }, '1')).rejects.toMatchObject({ status: 400 });
  expect(client.getAccountState).not.toHaveBeenCalled();
  expect(client.sendTransferV2Tx).not.toHaveBeenCalled();
});
test('exact decimal amounts use the node signer and server-selected token and owner', async () => {
  const amount = '9007199.254740993123456789';
  await transferToOwner({ ...owner, did: `did:abt:${owner.did}` }, amount);
  expect(client.sendTransferV2Tx).toHaveBeenCalledWith({
    tx: { itx: { to: owner.did, value: '0', assets: [], tokens: [{ address: 'token', value: token.value }] } },
    wallet: node,
  });
});
test('invalid amounts, overprecision and insufficient fresh funds do not sign transactions', async () => {
  for (const amount of [1, '', '0', '-1', '1e2', 'Infinity', '0.0000000000000000001', '9007200', {}, '1'.repeat(101)])
    await expect(transferToOwner(owner, amount)).rejects.toBeDefined();
  await nodeTransferQuote(owner);
  client.getAccountState.mockResolvedValue({ state: { tokens: [{ ...token, value: '1' }] } });
  await expect(transferToOwner(owner, '1')).rejects.toMatchObject({ status: 402 });
  expect(client.sendTransferV2Tx).not.toHaveBeenCalled();
});
test('chain failures and malformed metadata fail closed', async () => {
  client.getAccountState.mockRejectedValueOnce(new Error('AFS unavailable'));
  await expect(transferToOwner(owner, '1')).rejects.toThrow('AFS unavailable');
  client.getTokenState.mockResolvedValueOnce({ state: { ...token, decimal: 1.5 } });
  await expect(transferToOwner(owner, '1')).rejects.toMatchObject({ status: 503 });
  client.getAccountState.mockResolvedValueOnce({ state: { tokens: [{ ...token, value: '1.5' }] } });
  await expect(transferToOwner(owner, '1')).rejects.toMatchObject({ status: 503 });
  expect(client.sendTransferV2Tx).not.toHaveBeenCalled();
});
test('route ignores forged destinations and does not expose upstream errors', async () => {
  const handler = router.stack.find((item: any) => item.route?.path === '/transfer' && item.route.methods.post).route
    .stack[0].handle;
  const res: any = { set: jest.fn(), json: jest.fn(), status: jest.fn() };
  res.status.mockReturnValue(res);
  await handler(
    { user: owner, body: { amount: '1', to: node.address, recipient: node.address, tokenId: 'other' } },
    res,
  );
  expect(client.sendTransferV2Tx.mock.calls[0]?.[0].tx.itx.to).toBe(owner.did);
  client.sendTransferV2Tx.mockRejectedValueOnce(Object.assign(new Error('secret upstream failure'), { status: 500 }));
  await handler({ user: owner, body: { amount: '1' } }, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret upstream failure');
});
