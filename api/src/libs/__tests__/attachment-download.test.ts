import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fromRandom } from '@ocap/wallet';

jest.mock('../env', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const fsSync = require('fs');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const os = require('os');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const pathSync = require('path');
  const tmpDir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'didmail-attachment-download-'));
  return {
    __esModule: true,
    default: {
      dataDir: tmpDir,
      chainHost: 'https://beta.abtnetwork.io/api/',
    },
  };
});

// eslint-disable-next-line import/first
import sequelize, { Mail, Attachment } from '../sqlite';
// eslint-disable-next-line import/first
import {
  getAttachmentForMail,
  getAttachmentMetadataForMail,
  verifyAttachmentDownloadAuth,
} from '../attachment-download';

const createMail = () =>
  Mail.create({
    subject: 'subject',
    content: 'content',
    sender: 'zSender',
    receiver: 'zReceiver',
    envelope: 'zEnvelope',
    hash: 'mail-hash',
    size: 100,
  });

describe('verifyAttachmentDownloadAuth', () => {
  const wallet = fromRandom();
  const account = { pk: wallet.publicKey };

  test('missing sign → not ok 400', async () => {
    const result = await verifyAttachmentDownloadAuth(account, '1', 'att-1', '', String(Date.now()));
    expect(result).toEqual({ ok: false, status: 400, error: 'Sign or timeStamp is required' });
  });

  test('missing timeStamp → not ok 400', async () => {
    const result = await verifyAttachmentDownloadAuth(account, '1', 'att-1', '0xabc', '');
    expect(result).toEqual({ ok: false, status: 400, error: 'Sign or timeStamp is required' });
  });

  test('expired timestamp → 401 Time expired', async () => {
    const expired = String(Date.now() - 1000 * 60 * 60 - 1000);
    const result = await verifyAttachmentDownloadAuth(account, '1', 'att-1', '0xabc', expired);
    expect(result).toEqual({ ok: false, status: 401, error: 'Time expired' });
  });

  test('valid signature → ok', async () => {
    const timeStamp = String(Date.now());
    const id = '42';
    const attachmentId = 'att-uuid';
    const sign = wallet.sign(`${id}-${attachmentId}-${timeStamp}`);
    const result = await verifyAttachmentDownloadAuth(account, id, attachmentId, sign, timeStamp);
    expect(result).toEqual({ ok: true });
  });

  test('invalid signature → 401 Unauthorized', async () => {
    const timeStamp = String(Date.now());
    const other = fromRandom();
    const sign = other.sign(`1-att-1-${timeStamp}`);
    const result = await verifyAttachmentDownloadAuth(account, '1', 'att-1', sign, timeStamp);
    expect(result).toEqual({ ok: false, status: 401, error: 'Unauthorized' });
  });
});

describe('getAttachmentForMail', () => {
  beforeAll(async () => {
    await Mail.sync({ force: true });
    await Attachment.sync({ force: true });
  });

  beforeEach(async () => {
    await Attachment.destroy({ where: {}, truncate: true });
    await Mail.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    const { storage } = (sequelize as any).options as { storage: string };
    await sequelize.close();
    fs.rmSync(path.dirname(storage), { recursive: true, force: true });
  });

  test('returns row when attachment belongs to mail', async () => {
    const mail = await createMail();
    const mailId = mail.get('id') as number;
    const blob = Buffer.from([9, 8, 7]);
    await Attachment.create({
      id: 'att-found',
      mailId,
      encryptedName: 'enc-name',
      encryptedMime: 'enc-mime',
      size: 3,
      hash: 'att-hash',
      content: blob,
    });

    const found = await getAttachmentForMail(mailId, 'att-found');
    expect(found).not.toBeNull();
    expect(found!.get('id')).toBe('att-found');
    expect(Buffer.from(found!.get('content') as Buffer)).toEqual(blob);
  });

  test('returns null when attachment missing or wrong mail', async () => {
    const mail = await createMail();
    const other = await createMail();
    const mailId = mail.get('id') as number;
    await Attachment.create({
      id: 'att-other-mail',
      mailId: other.get('id') as number,
      encryptedName: 'enc-name',
      encryptedMime: 'enc-mime',
      size: 1,
      hash: 'att-hash',
      content: Buffer.from([1]),
    });

    expect(await getAttachmentForMail(mailId, 'att-other-mail')).toBeNull();
    expect(await getAttachmentForMail(mailId, 'missing')).toBeNull();
  });

  test('getAttachmentMetadataForMail returns metadata without BLOB content', async () => {
    const mail = await createMail();
    const mailId = mail.get('id') as number;
    await Attachment.create({
      id: 'att-meta',
      mailId,
      encryptedName: 'enc-name',
      encryptedMime: 'enc-mime',
      size: 5,
      hash: 'att-hash',
      content: Buffer.from('hello'),
    });

    const rows = await getAttachmentMetadataForMail(mailId);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toBeDefined();
    expect(row!.get('id')).toBe('att-meta');
    expect(row!.get('encryptedName')).toBe('enc-name');
    expect(row!.get('size')).toBe(5);
    expect(row!.dataValues).not.toHaveProperty('content');
  });
});
