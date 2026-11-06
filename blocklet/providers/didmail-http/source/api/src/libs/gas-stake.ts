import { createHash } from 'node:crypto';
import GraphQLClient from '@ocap/client';
import { toStakeAddress } from '@arcblock/did-util';
import chainReads from '../../../identity/chain-read';
import getWallet from '../../../identity/wallet';
import env from '../../../config/env';

const client = new GraphQLClient(env.chainHost, false);
const wallet = getWallet();
const failure = (message: string, status = 400) => Object.assign(new Error(message), { status, gasStakeError: true });
const requireOwner = (user?: { role: string }) => {
  if (user?.role !== 'owner') throw failure('Only the node owner can stake for gas.', 403);
};
function positiveUnits(value: unknown, decimal: number) {
  const text = String(value);
  if (!/^\d+(\.\d+)?$/.test(text) || text.length > 80) throw failure('Gas staking rules could not be verified.', 503);
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimal) throw failure('Gas staking rules could not be verified.', 503);
  return BigInt(whole + fraction.padEnd(decimal, '0'));
}
export async function gasStakeQuote(user?: { role: string }) {
  requireOwner(user);
  const nativeTokens: Record<string, string> = {
    beta: 'z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG',
    main: 'z35nNRvYxBoHitx9yZ5ATS88psfShzPPBLxYD',
  };
  if (nativeTokens[env.chainId] !== env.tokenId) throw failure('Gas staking rules could not be verified.', 503);
  const reads = chainReads(client);
  const address = toStakeAddress(wallet.address, wallet.address);
  const [configResult, accountResult, tokenResult, stakeResult] = await Promise.all([
    reads.getConfig({}),
    reads.getAccountState({ address: wallet.address }),
    reads.getTokenState({ address: env.tokenId }),
    reads.getStakeState({ address }),
  ]);
  const config = typeof configResult.config === 'string' ? JSON.parse(configResult.config) : configResult.config;
  const token = tokenResult.state;
  const wait = Number(config.gasStakeLockPeriod ?? config.transaction?.txGas?.stakeLockPeriod);
  if (
    !token?.symbol ||
    token.address !== env.tokenId ||
    token.decimal !== 18 ||
    !Number.isInteger(token.decimal) ||
    token.decimal < 0 ||
    token.decimal > 36 ||
    !Number.isSafeInteger(wait) ||
    wait < 1
  )
    throw failure('Gas staking rules could not be verified.', 503);
  const minimum = positiveUnits(config.gasMinStake ?? config.transaction?.txGas?.minStake, token.decimal);
  if (minimum <= 0n) throw failure('Gas staking rules could not be verified.', 503);
  const stake = stakeResult.state;
  if (
    stake &&
    (stake.sender !== wallet.address ||
      stake.receiver !== wallet.address ||
      (stake.nonce || '') !== '' ||
      !Number.isSafeInteger(stake.revokeWaitingPeriod) ||
      stake.revokeWaitingPeriod < 1 ||
      stake.assets?.length ||
      stake.revokedAssets?.length)
  )
    throw failure('Gas stake state could not be verified.', 503);
  const amount = (tokens: any[] = []) => {
    const balance = tokens.find((item) => item.address === env.tokenId)?.value || '0';
    if (!/^\d+$/.test(String(balance))) throw failure('Node balance could not be verified.', 503);
    return String(balance);
  };
  const staked = amount(stake?.tokens);
  const revoked = amount(stake?.revokedTokens);
  const balance = amount(accountResult.state?.tokens);
  const withdrawalWaitingPeriod = stake?.revokeWaitingPeriod ?? wait;
  const withdrawals: { evidence: string; amount: string; availableAt: string; claimable: boolean }[] = [];
  if (BigInt(revoked) > 0n) {
    const { transactions } = await reads.listTransactions({
      stakeFilter: { stakes: [address] },
      validityFilter: { validity: 'VALID' as any },
    });
    const claimed = new Set<string>();
    const revokes = new Map<string, { evidence: string; amount: string; availableAt: string; claimable: boolean }>();
    for (const tx of transactions.filter((entry) => ['revoke_stake', 'claim_stake'].includes(entry.type))) {
      const itx = tx.tx?.itxJson as any;
      if (
        tx.valid !== true ||
        !['0', 'OK'].includes(String(tx.code)) ||
        !/^[a-fA-F0-9]{64}$/.test(tx.hash || '') ||
        tx.sender !== wallet.address ||
        (tx.tx?.from !== undefined && tx.tx.from !== wallet.address) ||
        itx?.address !== address
      )
        throw failure('Gas stake withdrawal history could not be verified.', 503);
      if (tx.type === 'claim_stake') {
        if (!/^[a-fA-F0-9]{64}$/.test(itx.evidence?.hash || ''))
          throw failure('Gas stake withdrawal history could not be verified.', 503);
        claimed.add(itx.evidence.hash);
      } else {
        if (
          !Array.isArray(itx.outputs) ||
          itx.outputs.length !== 1 ||
          itx.outputs[0].owner !== wallet.address ||
          itx.outputs[0].assets?.length ||
          !Array.isArray(itx.outputs[0].tokens) ||
          itx.outputs[0].tokens.length !== 1 ||
          itx.outputs[0].tokens[0].address !== env.tokenId
        )
          throw failure('Gas stake withdrawal history could not be verified.', 503);
        const value = String(itx.outputs[0].tokens[0].value);
        const time = Date.parse(tx.time);
        if (!/^\d+$/.test(value) || BigInt(value) <= 0n || !Number.isFinite(time))
          throw failure('Gas stake withdrawal history could not be verified.', 503);
        const available = time + withdrawalWaitingPeriod * 1000;
        if (!Number.isSafeInteger(available) || available > 8640000000000000)
          throw failure('Gas stake withdrawal history could not be verified.', 503);
        if (revokes.has(tx.hash)) throw failure('Gas stake withdrawal history could not be verified.', 503);
        revokes.set(tx.hash, {
          evidence: tx.hash,
          amount: value,
          availableAt: new Date(available).toISOString(),
          claimable: available <= Date.now(),
        });
      }
    }
    for (const [hash, item] of revokes) if (!claimed.has(hash)) withdrawals.push(item);
    if (withdrawals.reduce((sum, item) => sum + BigInt(item.amount), 0n) !== BigInt(revoked))
      throw failure('Gas stake withdrawal history could not be verified.', 503);
    withdrawals.sort((a, b) => a.availableAt.localeCompare(b.availableAt) || a.evidence.localeCompare(b.evidence));
  }
  const exitPolicyId = createHash('sha256')
    .update(
      JSON.stringify([
        env.chainId,
        address,
        env.tokenId,
        withdrawalWaitingPeriod,
        staked,
        revoked,
        withdrawals.map(({ evidence, amount: value, availableAt }) => [evidence, value, availableAt]),
      ]),
    )
    .digest('hex');
  const policyId = createHash('sha256')
    .update(JSON.stringify([env.chainId, address, env.tokenId, minimum.toString(), wait]))
    .digest('hex');
  return {
    address,
    node: wallet.address,
    chainId: env.chainId,
    policyId,
    exitPolicyId,
    withdrawalWaitingPeriod,
    withdrawals,
    canRevoke: stake?.revocable === true && BigInt(staked) > 0n,
    waitingPeriod: wait,
    token: { address: env.tokenId, symbol: token.symbol, decimal: token.decimal, value: minimum.toString() },
    balance,
    staked,
    revoked,
    eligible: BigInt(staked) + BigInt(revoked) >= minimum,
  };
}
export async function stakeForGas(user: { role: string } | undefined, policyId: unknown) {
  const quote = await gasStakeQuote(user);
  if (policyId !== quote.policyId)
    throw failure('Gas staking rules changed. Review the latest terms before submitting.', 409);
  if (quote.eligible) throw failure('This node already has enough gas stake.', 409);
  if (BigInt(quote.balance) < BigInt(quote.token.value)) throw failure('Insufficient available balance.', 402);
  // Stake for Gas is a self-stake with the empty nonce. The chain applies its own slasher and lock rules.
  let tx: any = await client.multiSignStakeTx({
    tx: {
      itx: {
        address: quote.address,
        receiver: wallet.address,
        locked: false,
        message: 'stake-for-gas',
        nonce: '',
        revokeWaitingPeriod: quote.waitingPeriod,
        slashers: [],
        inputs: [{ owner: wallet.address, assets: [], tokens: [{ address: env.tokenId, value: quote.token.value }] }],
      },
      signatures: [{ signer: wallet.address, pk: wallet.publicKey }],
    },
    wallet,
  });
  tx = await client.signStakeTx({ tx, wallet });
  const hash = await client.sendStakeTx({ tx, wallet });
  if (typeof hash !== 'string' || !hash) throw new Error('Missing gas stake transaction hash');
  return { hash, address: quote.address };
}

export async function revokeGasStake(user: { role: string } | undefined, policyId: unknown) {
  const quote = await gasStakeQuote(user);
  if (policyId !== quote.exitPolicyId) throw failure('Gas stake changed. Refresh and review before submitting.', 409);
  if (!quote.canRevoke) throw failure('No revocable gas stake is available.', 409);
  const hash = await client.sendRevokeStakeTx({
    tx: {
      itx: {
        address: quote.address,
        outputs: [{ owner: wallet.address, assets: [], tokens: [{ address: env.tokenId, value: quote.staked }] }],
      },
    },
    wallet,
  });
  if (typeof hash !== 'string' || !hash) throw new Error('Missing gas stake revoke transaction hash');
  return { hash, address: quote.address };
}
export async function claimGasStake(user: { role: string } | undefined, policyId: unknown, evidence: unknown) {
  const quote = await gasStakeQuote(user);
  if (policyId !== quote.exitPolicyId) throw failure('Gas stake changed. Refresh and review before submitting.', 409);
  const item = quote.withdrawals.find((entry) => entry.evidence === evidence);
  if (!item) throw failure('No matching gas stake withdrawal is available.', 409);
  if (!item.claimable) throw failure('The gas stake waiting period has not ended.', 409);
  const hash = await client.sendClaimStakeTx({
    tx: { itx: { address: quote.address, evidence: { hash: item.evidence } } },
    wallet,
  });
  if (typeof hash !== 'string' || !hash) throw new Error('Missing gas stake claim transaction hash');
  return { hash, address: quote.address };
}
