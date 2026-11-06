import { describe, test, expect, beforeEach } from '@jest/globals';

jest.mock('../support/node/libs/env', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const fsSync = require('fs');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const os = require('os');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const pathSync = require('path');
  const tmpDir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'didmail-domains-route-'));
  return {
    __esModule: true,
    default: {
      dataDir: tmpDir,
      chainHost: 'https://beta.abtnetwork.io/api/',
      appId: 'zNKTestAppId',
    },
  };
});

jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/auth', () => ({
  wallet: { secretKey: '00'.repeat(32), address: 'z1TestNode' },
}));

// eslint-disable-next-line import/first
import { DomainBinding } from '../support/node/libs/sqlite';
// eslint-disable-next-line import/first
import domainsRouter from '../../blocklet/providers/didmail-http/source/api/src/routes/domains';
// eslint-disable-next-line import/first
import { makeChallenge } from '../../blocklet/providers/didmail-http/source/api/src/libs/alias-domain';

// 轻量 express 测试助手：找到路由层并直接调用 handler
const callRoute = async (method: string, path: string, req: any) => {
  const layer = (domainsRouter as any).stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods[method],
  );
  expect(layer).toBeTruthy();
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(b: any) {
      this.body = b;
      return this;
    },
  };
  await layer.route.stack[0].handle(req, res, (e: any) => {
    throw e;
  });
  return res;
};

describe('domains admin routes', () => {
  beforeEach(async () => {
    await DomainBinding.sync({ force: true });
  });

  test('POST / creates pending domain and returns DNS instructions', async () => {
    const res = await callRoute('post', '/', { body: { domain: 'DIDMail.IO' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.domain).toBe('didmail.io');
    expect(res.body.txtRecord).toBe('_didmail-challenge.didmail.io');
    expect(res.body.txtValue).toBe(`didmail-verify=${makeChallenge('didmail.io')}`);
  });

  test('PUT /:domain updates pricing', async () => {
    await callRoute('post', '/', { body: { domain: 'didmail.io' } });
    const res = await callRoute('put', '/:domain', {
      params: { domain: 'didmail.io' },
      body: { aliasPrice: '1000000000000000000', renewPricePerYear: '500000000000000000', minLength: 3 },
    });
    expect(res.body.aliasPrice).toBe('1000000000000000000');
    expect(res.body.minLength).toBe(3);
  });

  test('DELETE /:domain unbinds', async () => {
    await callRoute('post', '/', { body: { domain: 'didmail.io' } });
    const res = await callRoute('delete', '/:domain', { params: { domain: 'didmail.io' } });
    expect(res.body.status).toBe('unbound');
  });
});
