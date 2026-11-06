import { describe, test, expect, beforeEach } from '@jest/globals';

jest.mock('../support/node/libs/env', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const fsSync = require('fs');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const os = require('os');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const pathSync = require('path');
  const tmpDir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'didmail-alias-service-'));
  return {
    __esModule: true,
    default: {
      dataDir: tmpDir,
      chainHost: 'https://beta.abtnetwork.io/api/',
      appId: 'zNKTestAppId',
      appUrl: 'https://node-a.test',
      aliasFactory: 'z35TestFactory',
      factoryOwner: 'z1TestFactoryOwner',
      mailPrice: 0.0001,
      tokenId: 'z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG',
    },
  };
});

jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/auth', () => ({
  wallet: { secretKey: '00'.repeat(32), address: 'z1TestNode' },
}));

// @ocap/client 间接依赖 ESM 版 node-fetch，jest 无法加载；链交互不在单测中触达，mock 掉构造器即可
jest.mock('@ocap/client', () =>
  jest.fn(() => ({
    encodeTransferV3Tx: jest.fn(),
    sendTransferV3Tx: jest.fn(),
    preMintAsset: jest.fn(),
    getFactoryState: jest.fn(),
    multiSignAcquireAssetV3Tx: jest.fn(),
    signAcquireAssetV3Tx: jest.fn(),
    sendAcquireAssetV3Tx: jest.fn(),
    getTx: jest.fn(),
  })),
);
jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/forge', () => ({
  getForgeState: jest.fn(() => Promise.resolve({ token: { address: 'z35Token' } })),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/legacy-contact-payment', () => ({
  verifyLegacyContactPayment: jest.fn(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/alias-crypto', () => ({
  ...jest.requireActual('../../blocklet/providers/didmail-http/source/api/src/libs/alias-crypto'),
  verifyBindingProof: jest.fn(() => Promise.resolve(true)),
}));

// eslint-disable-next-line import/first
import GraphQLClient from '@ocap/client';
// eslint-disable-next-line import/first
import { verifyLegacyContactPayment } from '../../blocklet/providers/didmail-http/source/api/src/libs/legacy-contact-payment';

// eslint-disable-next-line import/first
import { Alias, DomainBinding } from '../support/node/libs/sqlite';
// eslint-disable-next-line import/first
import {
  addDomain,
  verifyDomain,
  makeChallenge,
} from '../../blocklet/providers/didmail-http/source/api/src/libs/alias-domain';
// eslint-disable-next-line import/first
import { aliasHash } from '../../blocklet/providers/didmail-http/source/api/src/libs/alias-crypto';
// eslint-disable-next-line import/first
import {
  PENDING_TTL_MS,
  buildRegisterTx,
  calculatePrice,
  checkAvailability,
  resolveAliasAddress,
  listMyAliases,
  validatePaymentOrigin,
  finalizeRegister,
} from '../../blocklet/providers/didmail-http/source/api/src/libs/alias-service';

const chain = (GraphQLClient as unknown as jest.Mock).mock.results[0]!.value;
const account = { did: 'z1user', pk: 'fixture-public-key' };
const payment = {
  itx: { typeUrl: 'fg:t:transfer_v3', value: 'public-encoded-transfer-fixture' },
};
const payload = {
  alias: 'alice',
  domain: 'didmail.io',
  nonce: 'public-fixture-nonce',
  origin: 'public-signed-payment',
  bindingProof: 'public-binding-proof',
};
const txtOk = () => Promise.resolve([`"didmail-verify=${makeChallenge('didmail.io')}"`]);

async function pendingRegistration() {
  await addDomain('didmail.io');
  const binding = await verifyDomain('didmail.io', txtOk);
  await binding.update({ aliasPrice: '1000' });
  return Alias.create({
    alias: 'alice',
    aliasHash: 'public-hash',
    domain: 'didmail.io',
    owner: account.did,
    ownerPk: account.pk,
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
    nonce: payload.nonce,
    price: '1000',
    status: 'pending',
    preparedOrigin: 'public-original-preparation',
  });
}

describe('alias-service', () => {
  beforeEach(async () => {
    await Alias.sync({ force: true });
    await DomainBinding.sync({ force: true });
    jest.clearAllMocks();
    (verifyLegacyContactPayment as jest.Mock).mockReset().mockResolvedValue(payment);
    chain.encodeTransferV3Tx.mockResolvedValue({ buffer: new Uint8Array([1, 2, 3]) });
    chain.sendTransferV3Tx.mockReset().mockResolvedValue('payment-hash');
    chain.preMintAsset.mockReset().mockResolvedValue({ factory: 'factory', address: 'asset' });
    chain.getFactoryState.mockResolvedValue({ state: { input: { tokens: [{ address: 'token', value: '1' }] } } });
    chain.multiSignAcquireAssetV3Tx.mockResolvedValue({});
    chain.signAcquireAssetV3Tx.mockResolvedValue({});
    chain.sendAcquireAssetV3Tx.mockResolvedValue('asset-hash');
    chain.getTx.mockReset().mockResolvedValue({ info: { tx: { itxJson: { address: 'minted-asset' } } } });
  });

  test('build persists the exact original payment preparation', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtOk);
    const result = await buildRegisterTx(account, 'alice', 'didmail.io', 1);
    const row = await Alias.findOne({ where: { alias: 'alice' } });
    expect(row!.get('preparedOrigin')).toBe(result.origin);
  });

  test('a substituted or unsigned payment cannot trigger any broadcast', async () => {
    const row = await pendingRegistration();
    (verifyLegacyContactPayment as jest.Mock).mockRejectedValueOnce(new Error('fixture mismatch'));
    await expect(finalizeRegister(account, payload)).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    expect(verifyLegacyContactPayment).toHaveBeenCalledWith(
      chain,
      'public-original-preparation',
      payload.origin,
      account,
    );
    expect(chain.sendTransferV3Tx).not.toHaveBeenCalled();
    expect(chain.preMintAsset).not.toHaveBeenCalled();
    expect((await Alias.findByPk(row.get('id') as number))!.get('status')).toBe('pending');
  });

  test('concurrent finalization claims a pending registration only once', async () => {
    await pendingRegistration();
    let release!: () => void;
    let arrived = 0;
    const both = new Promise<void>((resolve) => {
      release = resolve;
    });
    (verifyLegacyContactPayment as jest.Mock).mockImplementation(async () => {
      arrived += 1;
      if (arrived === 2) release();
      await both;
      return payment;
    });
    const results = await Promise.allSettled([finalizeRegister(account, payload), finalizeRegister(account, payload)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(chain.sendTransferV3Tx).toHaveBeenCalledTimes(1);
    expect(chain.sendAcquireAssetV3Tx).toHaveBeenCalledTimes(1);
  });

  test.each(['sendTransferV3Tx', 'preMintAsset', 'getTx'])(
    '%s uncertainty preserves reservation and prevents replay',
    async (step) => {
      const row = await pendingRegistration();
      chain[step].mockRejectedValueOnce(new Error('fixture transport failure'));
      await expect(finalizeRegister(account, payload)).rejects.toThrow('fixture transport failure');
      const saved = await Alias.findByPk(row.get('id') as number);
      expect(saved!.get('status')).toBe('reconciliation_required');
      expect(saved!.get('preparedOrigin')).toBe('public-original-preparation');
      expect(saved!.get('mintTx')).toBe(step === 'sendTransferV3Tx' ? '' : 'payment-hash');
      expect((await checkAvailability('alice', 'didmail.io')).available).toBe(false);
      await expect(resolveAliasAddress('alice@didmail.io')).rejects.toMatchObject({ code: 'ALIAS_NOT_FOUND' });
      await expect(finalizeRegister(account, payload)).rejects.toMatchObject({ code: 'PENDING_NOT_FOUND' });
      expect(chain.sendTransferV3Tx).toHaveBeenCalledTimes(1);
    },
  );

  test('calculatePrice = aliasPrice + renew * (years-1)', () => {
    expect(calculatePrice('1000', '500', 1)).toBe('1000');
    expect(calculatePrice('1000', '500', 3)).toBe('2000');
    expect(calculatePrice('0', '0', 5)).toBe('0');
  });

  test('checkAvailability: gate closed when domain not verified', async () => {
    const r = await checkAvailability('alice', 'didmail.io');
    expect(r.available).toBe(false);
    expect(r.reason).toBe('DOMAIN_NOT_VERIFIED');
  });

  test('checkAvailability: invalid / reserved / available / taken', async () => {
    await addDomain('didmail.io');
    const row = await verifyDomain('didmail.io', txtOk);
    await row.update({ aliasPrice: '1000', renewPricePerYear: '500' });

    expect((await checkAvailability('a!', 'didmail.io')).reason).toBe('INVALID');
    expect((await checkAvailability('admin', 'didmail.io')).reason).toBe('RESERVED');

    const ok = await checkAvailability('alice', 'didmail.io');
    expect(ok.available).toBe(true);
    expect(ok.price).toBe('1000');
    expect(ok.aliasHash).toMatch(/^[0-9a-f]{64}$/);

    await Alias.create({
      alias: 'bob',
      aliasHash: aliasHash('k', 'bob', 'didmail.io'),
      domain: 'didmail.io',
      owner: 'z1x',
      ownerPk: 'pkx',
      assetAddress: 'z35x',
      mintTx: 'tx',
      bindingProof: 'p',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    });
    expect((await checkAvailability('Bob', 'didmail.io')).reason).toBe('TAKEN'); // 大小写归一
  });

  test('resolveAliasAddress: 404 unknown / 410 expired / success', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtOk);

    await expect(resolveAliasAddress('nobody@didmail.io')).rejects.toMatchObject({ statusCode: 404 });

    const now = Math.floor(Date.now() / 1000);
    await Alias.create({
      alias: 'old',
      aliasHash: 'h1',
      domain: 'didmail.io',
      owner: 'z1old',
      ownerPk: 'pkold',
      assetAddress: 'z35old',
      mintTx: 'tx',
      bindingProof: 'p',
      expiresAt: now - 40 * 86400,
      status: 'released',
    });
    await expect(resolveAliasAddress('old@didmail.io')).rejects.toMatchObject({ statusCode: 410 });

    await Alias.create({
      alias: 'alice',
      aliasHash: 'h2',
      domain: 'didmail.io',
      owner: 'z1alice',
      ownerPk: 'pkalice',
      assetAddress: 'z35alice',
      mintTx: 'tx',
      bindingProof: 'proof-alice',
      expiresAt: now + 86400,
    });
    const r = await resolveAliasAddress('Alice@DIDMail.IO');
    expect(r.did).toBe('z1alice');
    expect(r.alias).toBe('alice@didmail.io');
    expect(r.bindingProof).toBe('proof-alice');
    expect(r.serverEndpoint).toBeTruthy();
  });

  test('resolveAliasAddress: 451 when domain unbound', async () => {
    await DomainBinding.create({ domain: 'gone.com', status: 'unbound' });
    await Alias.create({
      alias: 'alice',
      aliasHash: 'h3',
      domain: 'gone.com',
      owner: 'z1a',
      ownerPk: 'pka',
      assetAddress: 'z35a',
      mintTx: 'tx',
      bindingProof: 'p',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    });
    await expect(resolveAliasAddress('alice@gone.com')).rejects.toMatchObject({ statusCode: 451 });
  });

  test('resolveAliasAddress: 404 for pending row', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtOk);
    await Alias.create({
      alias: 'pend',
      aliasHash: 'h5',
      domain: 'didmail.io',
      owner: 'z1p',
      ownerPk: 'pkp',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
      status: 'pending',
    });
    await expect(resolveAliasAddress('pend@didmail.io')).rejects.toMatchObject({
      statusCode: 404,
      code: 'ALIAS_NOT_FOUND',
    });
  });

  test('validatePaymentOrigin: accepts exact match, rejects any mismatch', () => {
    const tx = {
      itx: {
        outputs: [
          { owner: 'z1SomeoneElse', tokens: [{ address: 'z35Token', value: '1' }] },
          { owner: 'z1Node', tokens: [{ address: 'z35Token', value: '1000' }] },
        ],
      },
    };
    expect(() => validatePaymentOrigin(tx, '1000', 'z1Node', 'z35Token')).not.toThrow();
    // expectedToken 省略时只校验金额+收款人
    expect(() => validatePaymentOrigin(tx, '1000', 'z1Node')).not.toThrow();

    expect(() => validatePaymentOrigin(tx, '999', 'z1Node', 'z35Token')).toThrow('PAYMENT_MISMATCH');
    expect(() => validatePaymentOrigin(tx, '1000', 'z1Other', 'z35Token')).toThrow('PAYMENT_MISMATCH');
    expect(() => validatePaymentOrigin(tx, '1000', 'z1Node', 'z35WrongToken')).toThrow('PAYMENT_MISMATCH');
    expect(() => validatePaymentOrigin({ itx: { outputs: [] } }, '1000', 'z1Node', 'z35Token')).toThrow(
      'PAYMENT_MISMATCH',
    );
    expect(() => validatePaymentOrigin({}, '1000', 'z1Node', 'z35Token')).toThrow('PAYMENT_MISMATCH');
  });

  test('checkAvailability: stale pending row does not count as taken', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtOk);

    const stale = await Alias.create({
      alias: 'stale',
      aliasHash: 'h-stale',
      domain: 'didmail.io',
      owner: 'z1squatter',
      ownerPk: 'pk',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
      status: 'pending',
    });
    // instance.update 不会写 createdAt（Sequelize 保护时间戳字段），用批量 update 覆盖
    await Alias.update({ createdAt: new Date(Date.now() - PENDING_TTL_MS - 1000) }, { where: { id: stale.get('id') } });
    expect((await checkAvailability('stale', 'didmail.io')).available).toBe(true);
  });

  test('checkAvailability: fresh pending row is TAKEN', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtOk);

    await Alias.create({
      alias: 'fresh',
      aliasHash: 'h-fresh',
      domain: 'didmail.io',
      owner: 'z1squatter',
      ownerPk: 'pk',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
      status: 'pending',
    });
    expect((await checkAvailability('fresh', 'didmail.io')).reason).toBe('TAKEN');
  });

  test('buildRegisterTx: rejects years 0 / 11 with INVALID_YEARS before chain interaction', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtOk);
    const invalidYearAccount = { did: 'z1user', pk: 'pkuser' };

    await expect(buildRegisterTx(invalidYearAccount, 'alice', 'didmail.io', 0)).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_YEARS',
    });
    await expect(buildRegisterTx(invalidYearAccount, 'alice', 'didmail.io', 11)).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_YEARS',
    });
    await expect(buildRegisterTx(invalidYearAccount, 'alice', 'didmail.io', 1.5)).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_YEARS',
    });
    // years 校验在 pending 占位之前，不应留下任何行
    expect(await Alias.count()).toBe(0);
  });

  test('listMyAliases returns only my rows', async () => {
    await Alias.create({
      alias: 'alice',
      aliasHash: 'h4',
      domain: 'didmail.io',
      owner: 'z1me',
      ownerPk: 'pk',
      assetAddress: 'z35',
      mintTx: 'tx',
      bindingProof: 'p',
      expiresAt: 1820000000,
    });
    const mine = await listMyAliases('z1me');
    expect(mine).toHaveLength(1);
    expect(mine[0]!.alias).toBe('alice@didmail.io');
    expect(await listMyAliases('z1other')).toHaveLength(0);
  });
});
