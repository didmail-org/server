import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { getHasher, types } from '@ocap/mcrypto';

jest.mock('../support/node/libs/env', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const fsSync = require('fs');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const os = require('os');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const pathSync = require('path');
  const tmpDir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'didmail-attachment-validate-'));
  return {
    __esModule: true,
    default: {
      dataDir: tmpDir,
      chainHost: 'https://beta.abtnetwork.io/api/',
    },
  };
});

// eslint-disable-next-line import/first
import sequelize, {
  Attachment,
  AttachmentConfig,
  Mail,
  getAttachmentConfig,
  setAttachmentConfig,
} from '../support/node/libs/sqlite';
// eslint-disable-next-line import/first
import {
  AttachmentInput,
  computeMailHashWithAttachments,
  parseAttachmentInputs,
  validateAttachments,
} from '../../blocklet/providers/didmail-http/source/api/src/libs/attachment';

const hashFn = getHasher(types.HashType.SHA3);
const encoder = new TextEncoder();

const makeEncrypted = (plainSize: number, fill = 7): Buffer => Buffer.alloc(plainSize + 40, fill);

const makeValidInput = (
  overrides: Partial<AttachmentInput> & { id: string; size?: number } = { id: 'att-1' },
): AttachmentInput => {
  const size = overrides.size ?? 10;
  const buffer = overrides.buffer ?? makeEncrypted(size);
  const hash = overrides.hash ?? hashFn(buffer, 1).slice(-64).toUpperCase();
  return {
    id: overrides.id,
    encryptedName: overrides.encryptedName ?? 'enc-name',
    encryptedMime: overrides.encryptedMime ?? 'enc-mime',
    size,
    hash,
    buffer,
  };
};

describe('attachment validate and hash', () => {
  beforeAll(async () => {
    await Mail.sync({ force: true });
    await Attachment.sync({ force: true });
    await AttachmentConfig.sync({ force: true });
    await getAttachmentConfig();
  });

  beforeEach(async () => {
    await Attachment.destroy({ where: {}, truncate: true });
    await Mail.destroy({ where: {}, truncate: true });
    await setAttachmentConfig({
      maxFileSizeBytes: 10 * 1024 * 1024,
      maxFileCount: 5,
      pricePerBytePerDay: '0',
    });
  });

  afterAll(async () => {
    const { storage } = (sequelize as any).options as { storage: string };
    await sequelize.close();
    fs.rmSync(path.dirname(storage), { recursive: true, force: true });
  });

  test('missing fields → throw', () => {
    const buffer = makeEncrypted(5);
    const file = { buffer } as Express.Multer.File;

    expect(() => parseAttachmentInputs([file], [{ id: 'a1', encryptedName: 'n', size: 5, hash: 'h' }])).toThrow(
      /encryptedMime/,
    );

    expect(() =>
      parseAttachmentInputs([file], [{ encryptedName: 'n', encryptedMime: 'm', size: 5, hash: 'h' }]),
    ).toThrow(/id/);

    expect(() => parseAttachmentInputs([file], undefined)).toThrow(/both be provided/);
    expect(() => parseAttachmentInputs(undefined, JSON.stringify([{ id: 'a1' }]))).toThrow(/both be provided/);
  });

  test('id duplicate → throw', () => {
    const files = [{ buffer: makeEncrypted(5) }, { buffer: makeEncrypted(5, 8) }] as Express.Multer.File[];
    const meta = [
      { id: 'dup', encryptedName: 'n1', encryptedMime: 'm1', size: 5, hash: 'h1' },
      { id: 'dup', encryptedName: 'n2', encryptedMime: 'm2', size: 5, hash: 'h2' },
    ];

    expect(() => parseAttachmentInputs(files, meta)).toThrow(/duplicate attachment id/);
  });

  test('count over maxFileCount → throw', async () => {
    await setAttachmentConfig({ maxFileCount: 1 });
    const inputs = [makeValidInput({ id: 'a1' }), makeValidInput({ id: 'a2', size: 12 })];

    await expect(validateAttachments(inputs)).rejects.toThrow(/maxFileCount/);
  });

  test('size over max → throw', async () => {
    await setAttachmentConfig({ maxFileSizeBytes: 50 });
    const inputs = [makeValidInput({ id: 'big', size: 20 })]; // encrypted = 60

    await expect(validateAttachments(inputs)).rejects.toThrow(/maxFileSizeBytes/);
  });

  test('hash mismatch → throw', async () => {
    const inputs = [makeValidInput({ id: 'bad-hash', hash: '0'.repeat(64) })];

    await expect(validateAttachments(inputs)).rejects.toThrow(/hash mismatch/);
  });

  test('size !== buffer.length-40 → throw', async () => {
    const buffer = makeEncrypted(10);
    const inputs = [
      makeValidInput({
        id: 'bad-size',
        size: 9,
        buffer,
        hash: hashFn(buffer, 1).slice(-64).toUpperCase(),
      }),
    ];

    await expect(validateAttachments(inputs)).rejects.toThrow(/size must equal encrypted length - 40/);
  });

  test('valid multi-attachment passes', async () => {
    const inputs = [makeValidInput({ id: 'a1', size: 10 }), makeValidInput({ id: 'a2', size: 20 })];
    await expect(validateAttachments(inputs)).resolves.toBeUndefined();

    const files = inputs.map((input) => ({ buffer: input.buffer })) as Express.Multer.File[];
    const meta = inputs.map(({ id, encryptedName, encryptedMime, size, hash }) => ({
      id,
      encryptedName,
      encryptedMime,
      size,
      hash,
    }));
    expect(parseAttachmentInputs(files, JSON.stringify(meta))).toHaveLength(2);
    expect(parseAttachmentInputs(undefined, undefined)).toEqual([]);
    expect(parseAttachmentInputs([], '[]')).toEqual([]);
  });

  test('computeMailHashWithAttachments empty list matches hash without attachment bytes', () => {
    const did = 'zDid';
    const receiver = 'zReceiver';
    const subjectArray = new Uint8Array([1, 2, 3]);
    const contentArray = new Uint8Array([4, 5, 6]);
    const envelope = 'zEnvelope';

    const legacyHash = hashFn(
      new Uint8Array([
        ...encoder.encode(did),
        ...encoder.encode(receiver),
        ...subjectArray,
        ...contentArray,
        ...encoder.encode(envelope),
      ]),
      1,
    )
      .slice(-64)
      .toUpperCase();

    const emptyHash = computeMailHashWithAttachments({
      did,
      receiver,
      subjectArray,
      contentArray,
      envelope,
      attachments: [],
    });

    expect(emptyHash).toBe(legacyHash);

    const withAtt = computeMailHashWithAttachments({
      did,
      receiver,
      subjectArray,
      contentArray,
      envelope,
      attachments: [makeValidInput({ id: 'att-x', size: 3 })],
    });
    expect(withAtt).not.toBe(legacyHash);
  });
});
