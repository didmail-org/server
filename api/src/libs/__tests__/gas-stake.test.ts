/* eslint-disable no-await-in-loop */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { toStakeAddress } from '@arcblock/did-util';
import { fromRandom } from '@ocap/wallet';

const wallet = fromRandom();
const owner = { role: 'owner' };
const token = { address: 'z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG', symbol: 'TBA', decimal: 18 };
const policy = { gasMinStake: 1, gasStakeLockPeriod: 31536000 };
const client = {
  getConfig: jest.fn<() => Promise<any>>(),
  getAccountState: jest.fn<() => Promise<any>>(),
  getTokenState: jest.fn<() => Promise<any>>(),
  getStakeState: jest.fn<() => Promise<any>>(),
  listTransactions: jest.fn<() => Promise<any>>(),
  sendRevokeStakeTx: jest.fn<(input: any) => Promise<string>>(),
  sendClaimStakeTx: jest.fn<(input: any) => Promise<string>>(),
  multiSignStakeTx: jest.fn<(input: any) => Promise<any>>(),
  signStakeTx: jest.fn<() => Promise<any>>(),
  sendStakeTx: jest.fn<() => Promise<string>>(),
};
jest.doMock('@ocap/client', () => jest.fn(() => client));
jest.doMock('../../runtime/wallet', () => ({ __esModule: true, default: () => wallet }));
jest.doMock('../env', () => ({
  __esModule: true,
  default: { chainId: 'beta', chainHost: 'https://chain.invalid', tokenId: token.address },
}));
// eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
const { gasStakeQuote, stakeForGas, revokeGasStake, claimGasStake } = require('../gas-stake');

const hash = 'A'.repeat(64);
function revokeRecord(time = '2020-01-01T00:00:00Z') {
  return {
    hash,
    time,
    type: 'revoke_stake',
    sender: wallet.address,
    valid: true,
    code: 'OK',
    tx: {
      from: wallet.address,
      itxJson: {
        address: toStakeAddress(wallet.address, wallet.address),
        outputs: [
          { owner: wallet.address, assets: [], tokens: [{ address: token.address, value: '1000000000000000000' }] },
        ],
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  client.getConfig.mockResolvedValue({ config: JSON.stringify(policy) });
  client.getAccountState.mockResolvedValue({ state: { tokens: [{ ...token, value: '1000000000000000000' }] } });
  client.getTokenState.mockResolvedValue({ state: token });
  client.getStakeState.mockResolvedValue({ state: null });
  client.listTransactions.mockResolvedValue({ transactions: [] });
  client.sendRevokeStakeTx.mockResolvedValue('test-revoke');
  client.sendClaimStakeTx.mockResolvedValue('test-claim');
  client.multiSignStakeTx.mockResolvedValue({ signed: true });
  client.signStakeTx.mockResolvedValue({ signed: true });
  client.sendStakeTx.mockResolvedValue('test-only-gas-stake-hash');
});
test('SDK self-stake derivation matches the observed successful on-chain Stake for Gas transaction', () => {
  const node = 'zNKq7Uj9ExpioXbeLz7xmTBXUnYEeTpob79g';
  expect(toStakeAddress(node, node)).toBe('zrjyLiNeHnsFZSB7WprC4zz3fHFx49WhXYBa');
});
test('only an owner can query or submit a gas stake', async () => {
  for (const user of [undefined, { role: 'admin' }, { role: 'member' }]) {
    await expect(gasStakeQuote(user)).rejects.toMatchObject({ status: 403 });
    await expect(stakeForGas(user, 'forged')).rejects.toMatchObject({ status: 403 });
    await expect(revokeGasStake(user, 'forged')).rejects.toMatchObject({ status: 403 });
    await expect(claimGasStake(user, 'forged', 'forged')).rejects.toMatchObject({ status: 403 });
  }
  expect(client.getConfig).not.toHaveBeenCalled();
  expect(client.sendStakeTx).not.toHaveBeenCalled();
});
test('uses live rules and the node wallet, never the owner DID or NFT factory receiver', async () => {
  const quote = await gasStakeQuote(owner);
  expect(quote.address).toBe(toStakeAddress(wallet.address, wallet.address));
  expect(quote.waitingPeriod).toBe(31536000);
  expect(quote.token.value).toBe('1000000000000000000');
  await stakeForGas(owner, quote.policyId);
  const tx = client.multiSignStakeTx.mock.calls[0]?.[0];
  expect(tx.wallet).toBe(wallet);
  expect(tx.tx.itx).toMatchObject({
    receiver: wallet.address,
    address: quote.address,
    nonce: '',
    revokeWaitingPeriod: 31536000,
    slashers: [],
    inputs: [{ owner: wallet.address, assets: [], tokens: [{ address: token.address, value: '1000000000000000000' }] }],
  });
});
test('governance changes require another confirmation and insufficient balance never signs', async () => {
  const quote = await gasStakeQuote(owner);
  client.getConfig.mockResolvedValueOnce({ config: JSON.stringify({ ...policy, gasStakeLockPeriod: 63072000 }) });
  await expect(stakeForGas(owner, quote.policyId)).rejects.toMatchObject({ status: 409 });
  client.getAccountState.mockResolvedValue({ state: { tokens: [{ ...token, value: '999999999999999999' }] } });
  await expect(stakeForGas(owner, quote.policyId)).rejects.toMatchObject({ status: 402 });
  expect(client.sendStakeTx).not.toHaveBeenCalled();
});
test('existing and revoked self-stakes satisfy the minimum; no accidental duplicate staking', async () => {
  for (const revoked of [false, true]) {
    client.getStakeState.mockResolvedValue({
      state: {
        sender: wallet.address,
        receiver: wallet.address,
        nonce: '',
        assets: [],
        revokeWaitingPeriod: 31536000,
        tokens: revoked ? [] : [{ ...token, value: '1000000000000000000' }],
        revokedTokens: revoked ? [{ ...token, value: '1000000000000000000' }] : [],
      },
    });
    client.listTransactions.mockResolvedValue({ transactions: revoked ? [revokeRecord()] : [] });
    const quote = await gasStakeQuote(owner);
    expect(quote.eligible).toBe(true);
    await expect(stakeForGas(owner, quote.policyId)).rejects.toMatchObject({ status: 409 });
  }
  expect(client.sendStakeTx).not.toHaveBeenCalled();
});
test('missing rules, foreign stakes and failed chain reads fail closed; legacy config is also supported', async () => {
  client.getConfig.mockResolvedValueOnce({
    config: JSON.stringify({ transaction: { txGas: { minStake: 1, stakeLockPeriod: 31536000 } } }),
  });
  expect((await gasStakeQuote(owner)).token.value).toBe('1000000000000000000');
  client.getConfig.mockResolvedValueOnce({ config: '{}' });
  await expect(gasStakeQuote(owner)).rejects.toMatchObject({ status: 503 });
  client.getStakeState.mockResolvedValueOnce({
    state: { sender: wallet.address, receiver: 'NFT-factory', revokeWaitingPeriod: 120 },
  });
  await expect(gasStakeQuote(owner)).rejects.toMatchObject({ status: 503 });
  client.getConfig.mockRejectedValueOnce(new Error('AFS unavailable'));
  await expect(gasStakeQuote(owner)).rejects.toThrow('AFS unavailable');
  expect(client.sendStakeTx).not.toHaveBeenCalled();
});

function existingStake(revoked = false) {
  client.getStakeState.mockResolvedValue({
    state: {
      sender: wallet.address,
      receiver: wallet.address,
      nonce: '',
      revocable: true,
      revokeWaitingPeriod: 31536000,
      assets: [],
      tokens: revoked ? [] : [{ ...token, value: '1000000000000000000' }],
      revokedTokens: revoked ? [{ ...token, value: '1000000000000000000' }] : [],
    },
  });
}
test('revocation uses only the verified self-stake and exact base units, rejecting stale approvals', async () => {
  existingStake();
  const quote = await gasStakeQuote(owner);
  expect(quote.canRevoke).toBe(true);
  await expect(revokeGasStake(owner, 'forged')).rejects.toMatchObject({ status: 409 });
  expect(client.sendRevokeStakeTx).not.toHaveBeenCalled();
  await revokeGasStake(owner, quote.exitPolicyId);
  expect(client.sendRevokeStakeTx).toHaveBeenCalledWith({
    wallet,
    tx: {
      itx: {
        address: quote.address,
        outputs: [
          { owner: wallet.address, assets: [], tokens: [{ address: token.address, value: '1000000000000000000' }] },
        ],
      },
    },
  });
  client.getStakeState.mockResolvedValue({ state: null });
  await expect(revokeGasStake(owner, quote.exitPolicyId)).rejects.toMatchObject({ status: 409 });
});
test('withdrawals cannot be claimed before maturity or using fabricated evidence', async () => {
  existingStake(true);
  client.listTransactions.mockResolvedValue({ transactions: [revokeRecord(new Date().toISOString())] });
  const quote = await gasStakeQuote(owner);
  expect(quote.withdrawals[0].claimable).toBe(false);
  await expect(claimGasStake(owner, quote.exitPolicyId, hash)).rejects.toMatchObject({ status: 409 });
  await expect(claimGasStake(owner, quote.exitPolicyId, 'B'.repeat(64))).rejects.toMatchObject({ status: 409 });
  expect(client.sendClaimStakeTx).not.toHaveBeenCalled();
});
test('mature withdrawals are matched to unclaimed evidence and return to the node wallet', async () => {
  existingStake(true);
  client.listTransactions.mockResolvedValue({ transactions: [revokeRecord()] });
  const quote = await gasStakeQuote(owner);
  expect(quote.withdrawals[0]).toMatchObject({
    evidence: hash,
    claimable: true,
    availableAt: '2020-12-31T00:00:00.000Z',
  });
  await claimGasStake(owner, quote.exitPolicyId, hash);
  expect(client.sendClaimStakeTx).toHaveBeenCalledWith({
    wallet,
    tx: { itx: { address: quote.address, evidence: { hash } } },
  });
});
test('claimed, malformed, wrong owner and incomplete histories never authorize a claim', async () => {
  existingStake(true);
  for (const transactions of [
    [],
    [revokeRecord('bad-time')],
    [{ ...revokeRecord(), sender: 'foreign' }],
    [
      revokeRecord(),
      {
        ...revokeRecord(),
        hash: 'B'.repeat(64),
        type: 'claim_stake',
        tx: {
          from: wallet.address,
          itxJson: { address: toStakeAddress(wallet.address, wallet.address), evidence: { hash } },
        },
      },
    ],
  ]) {
    client.listTransactions.mockResolvedValue({ transactions });
    await expect(gasStakeQuote(owner)).rejects.toMatchObject({ status: 503 });
  }
  expect(client.sendClaimStakeTx).not.toHaveBeenCalled();
});

test('each pending evidence has its own maturity and claimed evidence is excluded', async () => {
  existingStake(true);
  const other = 'B'.repeat(64);
  const oldClaim = {
    ...revokeRecord(),
    hash: 'C'.repeat(64),
    type: 'claim_stake',
    tx: {
      from: wallet.address,
      itxJson: { address: toStakeAddress(wallet.address, wallet.address), evidence: { hash: other } },
    },
  };
  client.listTransactions.mockResolvedValue({
    transactions: [revokeRecord(), { ...revokeRecord(), hash: other }, oldClaim],
  });
  const quote = await gasStakeQuote(owner);
  expect(quote.withdrawals.map((item: any) => item.evidence)).toEqual([hash]);
  await expect(claimGasStake(owner, quote.exitPolicyId, other)).rejects.toMatchObject({ status: 409 });
  expect(client.sendClaimStakeTx).not.toHaveBeenCalled();
});
test('exiting an existing stake uses its recorded waiting period after a governance change', async () => {
  existingStake(true);
  client.getConfig.mockResolvedValue({ config: JSON.stringify({ ...policy, gasStakeLockPeriod: 63072000 }) });
  client.listTransactions.mockResolvedValue({ transactions: [revokeRecord()] });
  const quote = await gasStakeQuote(owner);
  expect(quote.waitingPeriod).toBe(63072000);
  expect(quote.withdrawalWaitingPeriod).toBe(31536000);
  expect(quote.withdrawals[0].availableAt).toBe('2020-12-31T00:00:00.000Z');
});
