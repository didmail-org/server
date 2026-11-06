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
  const tmpDir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'didmail-attachment-config-'));
  return {
    __esModule: true,
    default: {
      dataDir: tmpDir,
      chainHost: 'https://beta.abtnetwork.io/api/',
    },
  };
});

// eslint-disable-next-line import/first
import sequelize, { AttachmentConfig, getAttachmentConfig, setAttachmentConfig } from '../support/node/libs/sqlite';
// eslint-disable-next-line import/first
import adminRouter from '../../blocklet/providers/didmail-http/source/api/src/routes/admin';

// Invoke the real route handler against this suite's isolated SQLite database.
// No authorization middleware, ARC role claims, HTTP server or network is involved.
const callAttachmentRoute = async (body: unknown) => {
  const layer = (adminRouter as any).stack.find(
    (entry: any) => entry.route?.path === '/attachment-config' && entry.route.methods.put,
  );
  expect(layer).toBeTruthy();
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      this.body = value;
      return this;
    },
  };
  await layer.route.stack[0].handle({ body }, response);
  return response;
};

describe('AttachmentConfig', () => {
  beforeAll(async () => {
    await AttachmentConfig.sync({ force: true });
  });

  beforeEach(async () => {
    await AttachmentConfig.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    const { storage } = (sequelize as any).options as { storage: string };
    await sequelize.close();
    fs.rmSync(path.dirname(storage), { recursive: true, force: true });
  });

  test('findOrCreate returns default attachment config values', async () => {
    const config = await getAttachmentConfig();

    expect(config.get('id')).toBe(1);
    expect(config.get('maxFileSizeBytes')).toBe(10 * 1024 * 1024);
    expect(config.get('maxFileCount')).toBe(5);
    expect(config.get('pricePerBytePerDay')).toBe('0');
    expect(typeof config.get('pricePerBytePerDay')).toBe('string');
    expect(config.get('updatedAt')).toBeInstanceOf(Date);
  });

  test('setAttachmentConfig updates price as string and refreshes updatedAt', async () => {
    const created = await getAttachmentConfig();
    const previousUpdatedAt = new Date(created.get('updatedAt') as Date).getTime();

    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });

    const updated = await setAttachmentConfig({ pricePerBytePerDay: '1000000000' });

    expect(updated.get('pricePerBytePerDay')).toBe('1000000000');
    expect(typeof updated.get('pricePerBytePerDay')).toBe('string');
    expect(updated.get('maxFileSizeBytes')).toBe(10 * 1024 * 1024);
    expect(updated.get('maxFileCount')).toBe(5);

    const nextUpdatedAt = new Date(updated.get('updatedAt') as Date).getTime();
    expect(nextUpdatedAt).toBeGreaterThan(previousUpdatedAt);

    const reloaded = await AttachmentConfig.findByPk(1);
    expect(reloaded?.get('pricePerBytePerDay')).toBe('1000000000');
    expect(typeof reloaded?.get('pricePerBytePerDay')).toBe('string');
  });

  describe('real attachment-config PUT handler validation', () => {
    const fields = ['maxFileSizeBytes', 'maxFileCount'] as const;
    const invalidNumbers = [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 1e20, Infinity, NaN, '1', null];

    test.each(fields.flatMap((field) => invalidNumbers.map((value) => [field, value] as const)))(
      'rejects %s=%s without changing persisted configuration',
      async (field, value) => {
        const before = (await getAttachmentConfig()).get({ plain: true });
        const response = await callAttachmentRoute({ [field]: value });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({ message: `${field} must be a positive integer` });
        expect((await getAttachmentConfig()).get({ plain: true })).toEqual(before);
        expect(await AttachmentConfig.count()).toBe(1);
      },
    );

    test.each(fields)('rejects unsafe JSON-rounded %s before persistence', async (field) => {
      const body = JSON.parse(`{"${field}":9007199254740993}`);
      expect(body[field]).toBe(9007199254740992);
      expect(Number.isSafeInteger(body[field])).toBe(false);
      const before = (await getAttachmentConfig()).get({ plain: true });

      const response = await callAttachmentRoute(body);

      expect(response.statusCode).toBe(400);
      expect((await getAttachmentConfig()).get({ plain: true })).toEqual(before);
    });

    test.each(fields)('accepts the positive safe integer boundary for %s exactly', async (field) => {
      const response = await callAttachmentRoute({ [field]: Number.MAX_SAFE_INTEGER });

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ [field]: Number.MAX_SAFE_INTEGER });
      const reloaded = await AttachmentConfig.findByPk(1);
      expect(reloaded?.get(field)).toBe(Number.MAX_SAFE_INTEGER);
    });

    test('keeps exact digit-string pricing and ordinary valid limits unchanged', async () => {
      const values = { maxFileSizeBytes: 1310720, maxFileCount: 6, pricePerBytePerDay: '900719925474099312345' };
      const response = await callAttachmentRoute(values);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject(values);
      const reloaded = await AttachmentConfig.findByPk(1);
      expect(reloaded?.get('maxFileSizeBytes')).toBe(values.maxFileSizeBytes);
      expect(reloaded?.get('maxFileCount')).toBe(values.maxFileCount);
      expect(reloaded?.get('pricePerBytePerDay')).toBe(values.pricePerBytePerDay);
    });
  });

  test('findOrCreate is idempotent for id=1', async () => {
    const first = await getAttachmentConfig();
    await setAttachmentConfig({ maxFileCount: 3, pricePerBytePerDay: '42' });
    const second = await getAttachmentConfig();

    expect(first.get('id')).toBe(1);
    expect(second.get('id')).toBe(1);
    expect(second.get('maxFileCount')).toBe(3);
    expect(second.get('pricePerBytePerDay')).toBe('42');
    expect(await AttachmentConfig.count()).toBe(1);
  });
});
