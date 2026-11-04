import { expect, jest, test } from '@jest/globals';
import nodeStakeWaitingPeriod from '../node-stake-policy';

test('test and main chain waiting periods are fixed in seconds', () => {
  expect(nodeStakeWaitingPeriod('beta')).toBe(120);
  expect(nodeStakeWaitingPeriod('main')).toBe(604800);
});

test.each(['beta', 'main'])('stake requests cannot override the fixed policy on %s', async (chainId) => {
  jest.resetModules();
  const client = {
    getStakeState: jest.fn<() => Promise<any>>().mockResolvedValue({ state: null }),
    multiSignStakeTx: jest.fn<(input: any) => Promise<any>>().mockResolvedValue({ signed: true }),
    signStakeTx: jest.fn<() => Promise<any>>().mockResolvedValue({ signed: true }),
    sendStakeTx: jest.fn<() => Promise<string>>().mockResolvedValue('test-only-hash'),
  };
  jest.doMock('@ocap/client', () => jest.fn(() => client));
  jest.doMock('../../runtime/wallet', () => ({
    __esModule: true,
    default: () => ({ address: 'node', publicKey: 'pk' }),
  }));
  jest.doMock('../env', () => ({
    __esModule: true,
    default: {
      chainId,
      chainHost: 'https://chain.invalid/api',
      appId: 'node',
      appUrl: 'https://node.invalid',
      tokenId: 'token',
      factoryOwner: 'issuer',
      revokeWaitingPeriod: nodeStakeWaitingPeriod(chainId),
    },
  }));
  jest.doMock('@arcblock/did-util', () => ({ toStakeAddress: () => 'stake-address' }));
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const router = require('../../routes/stake').default;
  const handler = router.stack.find((item: any) => item.route?.path === '/asset').route.stack[0].handle;
  const res = { json: jest.fn() };
  await handler({ body: { assetAddress: 'nft', amount: '999', revokeWaitingPeriod: 1 } }, res);
  const [call] = client.multiSignStakeTx.mock.calls;
  if (!call) throw new Error('Expected a stake transaction');
  const tx = call[0].tx.itx;
  expect(tx.revokeWaitingPeriod).toBe(chainId === 'main' ? 604800 : 120);
  expect(tx.inputs[0].tokens).toEqual([{ address: 'token', value: '1000000000000000000' }]);
  expect(res.json).toHaveBeenCalledWith({ message: 'staked' });
  // An account with no stake yet must display the same destination used by staking.
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { getStaked } = require('../stake');
  const emptyState = await getStaked();
  expect(emptyState.address).toBe(tx.address);
  expect(emptyState.staked).toBe(false);
  expect(emptyState.revokeWaitingPeriod).toBe(nodeStakeWaitingPeriod(chainId));
});
