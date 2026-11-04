import { toStakeAddress } from '@arcblock/did-util';
import { addressOf } from '@didmail/protocol';
import chainReads from './chain-read';
import env from './env';
import wallet from './wallet';
import { admissionError } from './mail-admission';

const nativeTokens: Record<string, string> = {
  beta: 'z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG',
  main: 'z35nNRvYxBoHitx9yZ5ATS88psfShzPPBLxYD',
};
export interface GasEligibility {
  chainId: string;
  tokenId: string;
  minimumUnits: string;
  withdrawalWaitingSeconds: number;
  node: { did: string; stakeAddress: string; eligible: boolean; effectiveUnits: string };
  sender: { did: string; stakeAddress: string; eligible: boolean; effectiveUnits: string };
}
interface GasReads {
  getConfig(input: object): Promise<{ config: any }>;
  getTokenState(input: { address: string }): Promise<{ state: any }>;
  getStakeState(input: { address: string }): Promise<{ state: any }>;
}
const unavailable = (): never =>
  admissionError(503, 'GAS_STAKE_UNAVAILABLE', 'Native-token gas stake could not be verified', 'retry_later');
function units(value: unknown, decimal: number) {
  if (!['string', 'number'].includes(typeof value)) return unavailable();
  const text = String(value);
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text) || text.length > 80) return unavailable();
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimal) return unavailable();
  return BigInt(whole + fraction.padEnd(decimal, '0'));
}
function effective(state: any, address: string, stakeAddress: string, token: string): bigint {
  if (state === null) return 0n;
  if (
    !state ||
    state.address !== stakeAddress ||
    state.sender !== address ||
    state.receiver !== address ||
    (state.nonce || '') !== '' ||
    !Array.isArray(state.tokens) ||
    !Array.isArray(state.revokedTokens) ||
    !Array.isArray(state.assets) ||
    state.assets.length ||
    (state.revokedAssets !== undefined && (!Array.isArray(state.revokedAssets) || state.revokedAssets.length)) ||
    !Number.isSafeInteger(state.revokeWaitingPeriod) ||
    state.revokeWaitingPeriod < 1
  )
    return unavailable();
  const sum = (tokens: any[]) => {
    let amount = 0n;
    const seen = new Set<string>();
    for (const item of tokens) {
      if (
        !item ||
        item.address !== token ||
        seen.has(item.address) ||
        typeof item.value !== 'string' ||
        !/^(0|[1-9][0-9]{0,77})$/.test(item.value)
      )
        return unavailable();
      seen.add(item.address);
      amount += BigInt(item.value);
    }
    return amount;
  };
  return sum(state.tokens) + sum(state.revokedTokens);
}
export async function readSendingGasEligibility(senderDid: string, reads?: GasReads): Promise<GasEligibility> {
  try {
    const source = reads ?? chainReads({} as GasReads);
    const sender = addressOf(senderDid),
      node = wallet().address;
    if (nativeTokens[env.chainId] !== env.tokenId) return unavailable();
    const nodeStake = toStakeAddress(node, node),
      senderStake = toStakeAddress(sender, sender);
    const [configResult, tokenResult, nodeResult, senderResult] = await Promise.all([
      source.getConfig({}),
      source.getTokenState({ address: env.tokenId }),
      source.getStakeState({ address: nodeStake }),
      source.getStakeState({ address: senderStake }),
    ]);
    const config = typeof configResult.config === 'string' ? JSON.parse(configResult.config) : configResult.config;
    if (!config || tokenResult.state?.address !== env.tokenId || tokenResult.state.decimal !== 18) return unavailable();
    const chainMinimum = units(config.gasMinStake ?? config.transaction?.txGas?.minStake, 18);
    if (chainMinimum <= 0n) return unavailable();
    const minimum = chainMinimum > 10n ** 18n ? chainMinimum : 10n ** 18n;
    const waiting = config.gasStakeLockPeriod ?? config.transaction?.txGas?.stakeLockPeriod;
    if (!Number.isSafeInteger(waiting) || waiting < 1) return unavailable();
    const nodeUnits = effective(nodeResult.state, node, nodeStake, env.tokenId);
    const senderUnits = effective(senderResult.state, sender, senderStake, env.tokenId);
    return {
      chainId: env.chainId,
      tokenId: env.tokenId,
      minimumUnits: minimum.toString(),
      withdrawalWaitingSeconds: waiting,
      node: {
        did: 'did:abt:' + node,
        stakeAddress: nodeStake,
        eligible: nodeUnits >= minimum,
        effectiveUnits: nodeUnits.toString(),
      },
      sender: {
        did: senderDid,
        stakeAddress: senderStake,
        eligible: senderUnits >= minimum,
        effectiveUnits: senderUnits.toString(),
      },
    };
  } catch {
    return unavailable();
  }
}
export async function requireSendingGasEligibility(sender: string) {
  const result = await readSendingGasEligibility(sender);
  if (!result.node.eligible)
    admissionError(
      403,
      'NODE_GAS_STAKE_REQUIRED',
      'The service node requires native-token gas stake',
      'contact_operator',
    );
  if (!result.sender.eligible)
    admissionError(403, 'SENDER_GAS_STAKE_REQUIRED', 'The sender requires native-token gas stake', 'stake_for_gas');
}

// Internal mail has no gas transaction. Only the sender's one-token membership
// requirement is read; node gas configuration cannot block a stored delivery.
export async function requireMemberStake(senderDid: string, reads?: GasReads) {
  let amount: bigint;
  try {
    const source = reads ?? chainReads({} as GasReads), sender = addressOf(senderDid);
    if (nativeTokens[env.chainId] !== env.tokenId) return unavailable();
    const stake = toStakeAddress(sender, sender);
    const [token, result] = await Promise.all([source.getTokenState({ address: env.tokenId }), source.getStakeState({ address: stake })]);
    if (token.state?.address !== env.tokenId || token.state.decimal !== 18) return unavailable();
    // Pending withdrawals are no longer active membership collateral.
    const state = result.state;
    effective(state, sender, stake, env.tokenId);
    amount = state === null ? 0n : state.tokens.reduce((n: bigint, t: {value:string}) => n + BigInt(t.value), 0n);
  } catch { return unavailable(); }
  if (amount < 10n ** 18n) admissionError(403, 'SENDER_GAS_STAKE_REQUIRED', 'Internal mail requires at least one actively staked native token', 'stake_for_gas');
}
