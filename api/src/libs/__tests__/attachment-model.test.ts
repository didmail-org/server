import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';

jest.mock('../env', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const fsSync = require('fs');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const os = require('os');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const pathSync = require('path');
  const tmpDir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'didmail-attachment-model-'));
  return {
    __esModule: true,
    default: {
      dataDir: tmpDir,
      chainHost: 'https://beta.abtnetwork.io/api/',
    },
  };
});

// eslint-disable-next-line import/first
import sequelize, { Mail, Attachment, migrateMailsTable } from '../sqlite';
// eslint-disable-next-line import/first
import { destroyMailWithAttachments } from '../mail-lifecycle';

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

describe('Attachment model and mail migration', () => {
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

  test('migrateMailsTable is idempotent and adds attachment columns', async () => {
    await expect(migrateMailsTable()).resolves.toBeUndefined();
    await expect(migrateMailsTable()).resolves.toBeUndefined();

    const columns = await sequelize.getQueryInterface().describeTable('mails');
    expect(columns).toHaveProperty('totalAttachmentSize');
    expect(columns).toHaveProperty('attachmentCount');
    expect(columns).toHaveProperty('attachmentStorageCost');
  });

  test('Attachment model can create with BLOB content', async () => {
    const mail = await createMail();
    const blob = Buffer.from([1, 2, 3, 4, 5]);

    const attachment = await Attachment.create({
      id: 'att-uuid-1',
      mailId: mail.get('id') as number,
      encryptedName: 'enc-name',
      encryptedMime: 'enc-mime',
      size: 5,
      hash: 'att-hash',
      content: blob,
    });

    expect(attachment.get('id')).toBe('att-uuid-1');
    expect(attachment.get('mailId')).toBe(mail.get('id'));
    expect(attachment.get('size')).toBe(5);
    expect(attachment.get('hash')).toBe('att-hash');

    const stored = attachment.get('content') as Buffer | Uint8Array;
    expect(Buffer.isBuffer(stored) || stored instanceof Uint8Array).toBe(true);
    expect(Buffer.from(stored).equals(blob)).toBe(true);
  });

  test('destroyMailWithAttachments removes mail and leaves no orphan attachments', async () => {
    const mail = await createMail();
    const mailId = mail.get('id') as number;

    await Attachment.create({
      id: 'att-uuid-2',
      mailId,
      encryptedName: 'enc-name',
      encryptedMime: 'enc-mime',
      size: 3,
      hash: 'att-hash-2',
      content: Buffer.from('abc'),
    });

    expect(await Attachment.count({ where: { mailId } })).toBe(1);

    await destroyMailWithAttachments(mailId);

    expect(await Mail.findByPk(mailId)).toBeNull();
    expect(await Attachment.count({ where: { mailId } })).toBe(0);

    const orphans = await sequelize.query('SELECT COUNT(*) as count FROM attachments', {
      type: QueryTypes.SELECT,
    });
    expect((orphans[0] as { count: number }).count).toBe(0);
  });
});
