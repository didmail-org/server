import path from 'path';
import { describe, test, expect } from '@jest/globals';
import env from '../support/node/libs/env';
import logger from '../../blocklet/providers/didmail-http/source/api/src/libs/logger';
import sequelize from '../support/node/libs/sqlite';

describe('Sequelize Instance', () => {
  test('should be defined', () => {
    expect(sequelize).toBeDefined();
  });

  test('should have the correct dialect', () => {
    expect(sequelize.getDialect()).toBe('sqlite');
  });

  test('should have the correct storage path', () => {
    const { storage } = (sequelize as any).options;
    expect(storage).toBe(path.join(env.dataDir, 'didmail.sqlite'));
  });

  test('should connect to the database successfully', async () => {
    try {
      await sequelize.authenticate();
      logger.log(env.dataDir);
      logger.log(sequelize.config.database);
      expect(true).toBe(true); // 如果没有抛出错误，测试通过
    } catch (error) {
      console.error('Unable to connect to the database:', error);
      expect(error).toBeUndefined(); // 如果发生错误，测试失败
    }
  });
});
