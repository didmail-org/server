import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

jest.mock('../support/node/libs/env', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const fsSync = require('fs');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const os = require('os');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const pathSync = require('path');
  const tmpDir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'didmail-attachment-cleanup-'));
  return {
    __esModule: true,
    default: {
      dataDir: tmpDir,
      chainHost: 'https://beta.abtnetwork.io/api/',
    },
  };
});

// eslint-disable-next-line import/first
import sequelize, { Mail, Attachment, migrateMailsTable } from '../support/node/libs/sqlite';
// eslint-disable-next-line import/first
import { deleteExpiredMailsWithAttachments } from '../../blocklet/providers/didmail-http/source/api/src/libs/attachment-cleanup';

const createMail = (overrides: { expiredAt?: Date; totalAttachmentSize?: number } = {}) =>
  Mail.create({
    subject: 'subject',
    content: 'content',
    sender: 'zSender',
    receiver: 'zReceiver',
    envelope: 'zEnvelope',
    hash: 'mail-hash',
    size: 100,
    expiredAt: overrides.expiredAt?.toISOString() ?? null,
    totalAttachmentSize: overrides.totalAttachmentSize ?? 0,
  });

describe('deleteExpiredMailsWithAttachments', () => {
  beforeAll(async () => {
    await Mail.sync({ force: true });
    await migrateMailsTable();
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

  test('deletes only expired mails and their attachments', async () => {
    const expired = await createMail({
      expiredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      totalAttachmentSize: 42,
    });
    const expiredMailId = expired.get('id') as number;
    await Attachment.create({
      id: 'att-expired',
      mailId: expiredMailId,
      encryptedName: 'enc-name',
      encryptedMime: 'enc-mime',
      size: 42,
      hash: 'att-hash',
      content: Buffer.from('expired content'),
    });

    const fresh = await createMail({ expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000), totalAttachmentSize: 10 });
    const freshMailId = fresh.get('id') as number;
    await Attachment.create({
      id: 'att-fresh',
      mailId: freshMailId,
      encryptedName: 'enc-name',
      encryptedMime: 'enc-mime',
      size: 10,
      hash: 'att-hash-2',
      content: Buffer.from('fresh content'),
    });

    const result = await deleteExpiredMailsWithAttachments();

    expect(result.deletedMailCount).toBe(1);
    expect(result.deletedAttachmentCount).toBe(1);
    expect(result.freedBytes).toBe(42);

    expect(await Mail.findByPk(expiredMailId)).toBeNull();
    expect(await Attachment.findOne({ where: { id: 'att-expired' } })).toBeNull();
    expect(await Mail.findByPk(freshMailId)).not.toBeNull();
    expect(await Attachment.findOne({ where: { id: 'att-fresh' } })).not.toBeNull();
  });

  test('returns zero counts when nothing is expired', async () => {
    await createMail({ expiredAt: new Date(Date.now() + 60 * 1000), totalAttachmentSize: 5 });

    const result = await deleteExpiredMailsWithAttachments();

    expect(result.deletedMailCount).toBe(0);
    expect(result.deletedAttachmentCount).toBe(0);
    expect(result.freedBytes).toBe(0);
  });

  test('honors explicit before cutoff', async () => {
    const mail = await createMail({ expiredAt: new Date('2020-01-01T00:00:00Z'), totalAttachmentSize: 7 });
    const mailId = mail.get('id') as number;
    await Attachment.create({
      id: 'att-old',
      mailId,
      encryptedName: 'enc-name',
      encryptedMime: 'enc-mime',
      size: 7,
      hash: 'att-hash-old',
      content: Buffer.from('old content'),
    });

    const result = await deleteExpiredMailsWithAttachments(new Date('2019-01-01T00:00:00Z'));

    expect(result.deletedMailCount).toBe(0);
    expect(await Mail.findByPk(mailId)).not.toBeNull();
  });
});
