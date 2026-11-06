import { randomBytes } from 'crypto';

import GraphQLClient from '@ocap/client';
import { toBase58 } from '@ocap/util';
import { fromAddress } from '@ocap/wallet';
import { Op } from 'sequelize';
import nextPaymentNonce from '../runtime/payment-nonce';

import { assertAliasWritable, AliasGateError } from './alias-domain';
import {
  aliasHash,
  buildBindingMessage,
  decryptDomainKey,
  encryptAlias,
  normalizeAlias,
  normalizeDomain,
  verifyBindingProof,
} from './alias-crypto';
import { wallet } from './auth';
import env from './env';
import { getForgeState } from './forge';
import logger from './logger';
import { verifyLegacyContactPayment } from './legacy-contact-payment';
import { Alias, DomainBinding } from './sqlite';

export const RESERVED_ALIASES = [
  'admin',
  'administrator',
  'support',
  'postmaster',
  'root',
  'noreply',
  'no-reply',
  'mail',
  'abuse',
];
const EXPIRED_GRACE_SECONDS = 30 * 86400;
// pending 占位行 TTL：超时未 finalize 的占位不再视为占用，防免费注册接口的 namespace DoS
export const PENDING_TTL_MS = 15 * 60 * 1000;

const isStalePending = (row: InstanceType<typeof Alias>): boolean =>
  row.get('status') === 'pending' &&
  Date.now() - new Date(row.get('createdAt') as string | number | Date).getTime() > PENDING_TTL_MS;

export const calculatePrice = (aliasPriceWei: string, renewWeiPerYear: string, years: number): string =>
  (BigInt(aliasPriceWei) + BigInt(renewWeiPerYear) * BigInt(Math.max(0, years - 1))).toString();

export type AvailabilityResult = {
  available: boolean;
  reason?: 'INVALID' | 'RESERVED' | 'TAKEN' | 'DOMAIN_NOT_VERIFIED';
  price?: string;
  aliasHash?: string;
};

export const checkAvailability = async (alias: string, domain: string): Promise<AvailabilityResult> => {
  const a = normalizeAlias(alias);
  const d = normalizeDomain(domain);
  const binding = await DomainBinding.findOne({ where: { domain: d } });
  if (!binding || binding.get('status') !== 'verified') {
    return { available: false, reason: 'DOMAIN_NOT_VERIFIED' };
  }
  if (RESERVED_ALIASES.includes(a)) {
    return { available: false, reason: 'RESERVED' };
  }
  const existing = await Alias.findOne({
    where: { alias: a, domain: d, status: ['active', 'grace', 'pending', 'submitting', 'reconciliation_required'] },
  });
  if (existing && !isStalePending(existing)) return { available: false, reason: 'TAKEN' };
  const min = binding.get('minLength') as number;
  const max = binding.get('maxLength') as number;
  if (a.length < min || a.length > max || !/^[a-z0-9_-]+$/.test(a)) {
    return { available: false, reason: 'INVALID' };
  }
  const domainKey = decryptDomainKey(binding.get('domainKeyEnc') as string);
  return {
    available: true,
    price: calculatePrice(binding.get('aliasPrice') as string, binding.get('renewPricePerYear') as string, 1),
    aliasHash: aliasHash(domainKey, a, d),
  };
};

export type ResolvedAliasAddress = {
  alias: string;
  did: string;
  pk: string;
  serverEndpoint: string;
  assetAddress: string;
  expiresAt: number;
  bindingProof: string;
  timeStamp: number;
};

export const resolveAliasAddress = async (address: string): Promise<ResolvedAliasAddress> => {
  const parts = address.trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new AliasGateError(400, 'INVALID_ADDRESS', 'Invalid alias address');
  }
  const [aliasPart, domainPart] = parts;
  const domain = normalizeDomain(domainPart);
  const alias = normalizeAlias(aliasPart);
  const binding = await DomainBinding.findOne({ where: { domain } });
  if (binding && binding.get('status') === 'unbound') {
    throw new AliasGateError(451, 'DOMAIN_UNBOUND', 'This domain is no longer served');
  }
  const row = await Alias.findOne({ where: { alias, domain } });
  const now = Math.floor(Date.now() / 1000);
  if (!row) throw new AliasGateError(404, 'ALIAS_NOT_FOUND', 'Alias not found');
  const status = row.get('status') as string;
  const expiresAt = row.get('expiresAt') as number;
  if (!['active', 'grace', 'burned', 'released'].includes(status)) {
    throw new AliasGateError(404, 'ALIAS_NOT_FOUND', 'Alias not found');
  }
  if (status === 'burned') {
    throw new AliasGateError(410, 'ALIAS_BURNED', 'Alias has been deactivated');
  }
  if (status === 'released' || expiresAt + EXPIRED_GRACE_SECONDS < now) {
    throw new AliasGateError(410, 'ALIAS_EXPIRED', 'Alias has expired');
  }
  return {
    alias: `${alias}@${domain}`,
    did: row.get('owner') as string,
    pk: row.get('ownerPk') as string,
    serverEndpoint: env.appUrl,
    assetAddress: row.get('assetAddress') as string,
    expiresAt,
    bindingProof: row.get('bindingProof') as string,
    timeStamp: Date.now(),
  };
};

export type MyAlias = {
  alias: string;
  domain: string;
  expiresAt: number;
  status: string;
  assetAddress: string;
};

export const listMyAliases = async (did: string): Promise<MyAlias[]> => {
  const rows = await Alias.findAll({
    where: { owner: did, status: ['active', 'grace'] },
    order: [['createdAt', 'DESC']],
  });
  return rows.map((r) => ({
    alias: `${r.get('alias')}@${r.get('domain')}`,
    domain: r.get('domain') as string,
    expiresAt: r.get('expiresAt') as number,
    status: r.get('status') as string,
    assetAddress: r.get('assetAddress') as string,
  }));
};

// ---- 链交互：两步注册（buildRegisterTx / finalizeRegister）----
// Chain submissions are guarded by an exact preparation and an atomic claim.

const client = new GraphQLClient(env.chainHost, false);
const factoryWallet = fromAddress(env.factoryOwner);

export type RegisterAccount = { did: string; pk: string };

export type DecodedPaymentTx = {
  itx?: {
    outputs?: Array<{ owner?: string; tokens?: Array<{ address?: string; value?: string }> }>;
  };
};

// 纯函数：校验解码后的 TransferV3 含一笔 价格/收款人/token 完全匹配的输出，否则抛 400 PAYMENT_MISMATCH
export const validatePaymentOrigin = (
  decodedTx: DecodedPaymentTx,
  expectedPrice: string,
  expectedRecipient: string,
  expectedToken?: string,
): void => {
  const outputs = decodedTx?.itx?.outputs ?? [];
  const matched = outputs.some(
    (output) =>
      output.owner === expectedRecipient &&
      (output.tokens ?? []).some((t) => t.value === expectedPrice && (!expectedToken || t.address === expectedToken)),
  );
  if (!matched) {
    throw new AliasGateError(
      400,
      'PAYMENT_MISMATCH',
      'PAYMENT_MISMATCH: payment origin does not match expected price/recipient/token',
    );
  }
};

export const buildRegisterTx = async (account: RegisterAccount, alias: string, domain: string, years: number) => {
  const binding = await assertAliasWritable(domain); // 409 门控
  const a = normalizeAlias(alias);
  const d = normalizeDomain(domain);
  const avail = await checkAvailability(a, d);
  if (!avail.available) throw new AliasGateError(409, 'ALIAS_UNAVAILABLE', `Alias not available: ${avail.reason}`);
  if (!Number.isInteger(years) || years < 1 || years > 10) {
    throw new AliasGateError(400, 'INVALID_YEARS', 'years must be an integer between 1 and 10');
  }
  const price = calculatePrice(binding.get('aliasPrice') as string, binding.get('renewPricePerYear') as string, years);
  const expiresAt = Math.floor(Date.now() / 1000) + years * 365 * 86400;
  const nonce = randomBytes(16).toString('hex');
  const domainKey = decryptDomainKey(binding.get('domainKeyEnc') as string);
  const hash = aliasHash(domainKey, a, d);

  // pending 占位（alias+domain 唯一索引防并发抢注）；assetAddress/mintTx/bindingProof 在 finalize 后回填
  // 先清理同 (alias, domain) 的过期 pending 占位，保证唯一插入成功
  await Alias.destroy({
    where: { alias: a, domain: d, status: 'pending', createdAt: { [Op.lt]: new Date(Date.now() - PENDING_TTL_MS) } },
  });
  const row = await Alias.create({
    alias: a,
    aliasHash: hash,
    domain: d,
    owner: account.did,
    ownerPk: account.pk,
    expiresAt,
    nonce,
    price,
    status: 'pending',
  });

  const forgeState = await getForgeState();
  const tokenAddress = forgeState.token.address; // TBA
  const tx = {
    from: account.did,
    pk: account.pk,
    nonce: await nextPaymentNonce(),
    signatures: [],
    itx: {
      inputs: [{ owner: account.did, tokens: [{ address: tokenAddress, value: price }] }],
      outputs: [{ owner: wallet.address, tokens: [{ address: tokenAddress, value: price }] }],
    },
  };
  const encoded = await client.encodeTransferV3Tx({ tx, wallet });
  const origin = toBase58(encoded.buffer);
  await row.update({ preparedOrigin: origin });
  return { alias: `${a}@${d}`, price, token: tokenAddress, origin, expiresAt, nonce };
};

export type FinalizePayload = {
  alias: string;
  domain: string;
  nonce: string;
  origin: string;
  bindingProof: string;
};

export const finalizeRegister = async (account: RegisterAccount, payload: FinalizePayload) => {
  const { alias, domain, nonce, origin, bindingProof } = payload;
  const a = normalizeAlias(alias);
  const d = normalizeDomain(domain);
  const row = await Alias.findOne({ where: { alias: a, domain: d, owner: account.did, status: 'pending' } });
  if (!row) throw new AliasGateError(404, 'PENDING_NOT_FOUND', 'No pending registration');
  if (isStalePending(row)) {
    throw new AliasGateError(410, 'REGISTRATION_EXPIRED', 'Registration session expired, please start over');
  }
  const expiresAt = row.get('expiresAt') as number;
  // nonce 校验（防重放）
  if (row.get('nonce') !== nonce) {
    throw new AliasGateError(409, 'NONCE_MISMATCH', 'Registration nonce mismatch');
  }
  const message = buildBindingMessage(`${a}@${d}`, account.did, expiresAt);
  if (!(await verifyBindingProof(account.pk, message, bindingProof))) {
    throw new AliasGateError(401, 'INVALID_BINDING_PROOF', 'Binding proof verification failed');
  }

  // 门控校验先于支付广播（M2）：build→finalize 之间 gate 翻转时在用户付款上链前拒绝
  const binding = await assertAliasWritable(d);
  const domainKey = decryptDomainKey(binding.get('domainKeyEnc') as string);

  // Compare the complete encoded preparation and both sender signatures before
  // broadcasting. The legacy codec keeps itx as an opaque Any payload.
  let decodedTx: any;
  try {
    decodedTx = await verifyLegacyContactPayment(client, row.get('preparedOrigin'), origin, account);
  } catch (_) {
    throw new AliasGateError(400, 'PAYMENT_MISMATCH', 'Payment does not match the original registration preparation');
  }
  // A concurrent request may have read the same pending row. Only one request
  // may broadcast or spend the node wallet on the resulting asset.
  const [claimed] = await Alias.update(
    { status: 'submitting' },
    { where: { id: row.get('id'), status: 'pending', nonce, preparedOrigin: row.get('preparedOrigin') } },
  );
  if (claimed !== 1) {
    throw new AliasGateError(409, 'REGISTRATION_ALREADY_SUBMITTED', 'Registration is already being processed');
  }

  let paymentTx = '';
  let assetTx = '';
  try {
    paymentTx = await client.sendTransferV3Tx({ tx: decodedTx, wallet });
    const inputs = {
      aliasHash: aliasHash(domainKey, a, d),
      encryptedAlias: encryptAlias(domainKey, a),
      domain: d,
      serverEndpoint: env.appUrl,
      expiresAt: `${expiresAt}`,
    };
    const itx = await (client as any).preMintAsset({
      factory: env.aliasFactory,
      inputs,
      owner: account.did,
      wallet: factoryWallet,
    });
    // 照抄 mail.ts /send/sign 的 acquireAsset 多签流程（receiver → account.did）
    // acquire 的 token 支付按 factory 链上 input 读取（链要求支付与 factory 声明一致；
    // alias factory 为 1 wei 粉尘，见 mock/nft-factory-alias.js 头部注释）
    const { state: aliasFactoryState } = await client.getFactoryState({ address: env.aliasFactory });
    const factoryToken = aliasFactoryState?.input?.tokens?.[0];
    if (!factoryToken?.address || !factoryToken?.value) {
      throw new AliasGateError(
        500,
        'FACTORY_NOT_CONFIGURED',
        `Alias factory ${env.aliasFactory} has no input token configured`,
      );
    }
    const token = { address: factoryToken.address, value: factoryToken.value };
    let acquireAssetTx = {
      from: wallet.address,
      pk: wallet.publicKey,
      signatures: [] as { signer: string; pk: string }[],
      itx: {
        factory: itx.factory,
        address: itx.address,
        inputs: [{ owner: wallet.address, tokens: [token] }],
        owner: account.did,
        variables: itx.variables,
        issuer: itx.issuer,
      },
    };
    acquireAssetTx.signatures.push({ signer: wallet.address, pk: wallet.publicKey });
    let signTx = await client.multiSignAcquireAssetV3Tx({ tx: acquireAssetTx, wallet });
    acquireAssetTx = { ...signTx, itx: acquireAssetTx.itx };
    signTx = await client.signAcquireAssetV3Tx({ tx: acquireAssetTx, wallet });
    acquireAssetTx = { ...signTx, itx: acquireAssetTx.itx };
    assetTx = await client.sendAcquireAssetV3Tx({ tx: acquireAssetTx, wallet });
    const {
      info: {
        tx: { itxJson },
      },
    } = await client.getTx({ hash: assetTx });
    const assetAddress = (itxJson as any)?.address ?? '';
    if (!assetAddress) throw new Error('Alias asset address is unavailable');
    await row.update({ status: 'active', assetAddress, mintTx: paymentTx, bindingProof });
    return { assetAddress, paymentTx, assetTx, alias: `${a}@${d}` };
  } catch (error) {
    // A timeout can follow a successful broadcast. Preserve the reservation
    // and known payment evidence so a retry cannot charge or mint again.
    await row.update({ status: 'reconciliation_required', mintTx: paymentTx, bindingProof });
    logger.error('Error finalizing alias registration');
    throw error;
  }
};
