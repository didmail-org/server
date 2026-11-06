import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

jest.mock('../support/node/libs/env', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const fsSync = require('fs');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const os = require('os');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const pathSync = require('path');
  const tmpDir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'didmail-alias-model-'));
  return {
    __esModule: true,
    default: {
      dataDir: tmpDir,
      chainHost: 'https://beta.abtnetwork.io/api/',
    },
  };
});

// eslint-disable-next-line import/first
import sequelize, { Alias, DomainBinding } from '../support/node/libs/sqlite';

describe('Alias & DomainBinding models', () => {
  beforeAll(async () => {
    await Alias.sync({ force: true });
    await DomainBinding.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('creates an alias row with all fields', async () => {
    const row = await Alias.create({
      alias: 'alice',
      aliasHash: 'ab'.repeat(32),
      domain: 'didmail.io',
      owner: 'z1YSVJmTestDid',
      ownerPk: 'z4TcTestPk',
      assetAddress: 'z35AssetAddr',
      mintTx: 'txhash123',
      bindingProof: 'proof-base64',
      expiresAt: 1820000000,
    });
    expect(row.get('status')).toBe('active');
    expect(row.get('alias')).toBe('alice');
  });

  test('enforces unique (alias, domain)', async () => {
    await expect(
      Alias.create({
        alias: 'alice',
        aliasHash: 'cd'.repeat(32),
        domain: 'didmail.io',
        owner: 'z1Other',
        ownerPk: 'pk2',
        assetAddress: 'z35Other',
        mintTx: 'tx2',
        bindingProof: 'p2',
        expiresAt: 1820000000,
      }),
    ).rejects.toThrow();
  });

  test('same alias allowed on a different domain', async () => {
    const row = await Alias.create({
      alias: 'alice',
      aliasHash: 'ef'.repeat(32),
      domain: 'other.com',
      owner: 'z1Other',
      ownerPk: 'pk2',
      assetAddress: 'z35Other',
      mintTx: 'tx3',
      bindingProof: 'p3',
      expiresAt: 1820000000,
    });
    expect(row.get('domain')).toBe('other.com');
  });

  test('creates a domain binding with defaults', async () => {
    const row = await DomainBinding.create({ domain: 'didmail.io', challenge: 'c'.repeat(32) });
    expect(row.get('status')).toBe('pending');
    expect(row.get('aliasPrice')).toBe('0');
    expect(row.get('minLength')).toBe(4);
    expect(row.get('maxLength')).toBe(32);
  });
});
