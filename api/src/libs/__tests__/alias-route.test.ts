import { describe, test, expect, beforeEach } from '@jest/globals';
import { randomBytes } from 'crypto';

jest.mock('../env', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const fsSync = require('fs');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const os = require('os');
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const pathSync = require('path');
  const tmpDir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'didmail-alias-route-'));
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

jest.mock('../auth', () => ({
  wallet: { secretKey: '00'.repeat(32), address: 'z1TestNode' },
}));

// @ocap/client 间接依赖 ESM 版 node-fetch，jest 无法加载；链交互不在单测中触达，mock 掉构造器即可
jest.mock('@ocap/client', () => jest.fn());

// eslint-disable-next-line import/first
import { getSigner, types } from '@ocap/mcrypto';
// eslint-disable-next-line import/first
import { fromSecretKey } from '@ocap/wallet';
// eslint-disable-next-line import/first
import { Alias, DomainBinding } from '../sqlite';
// eslint-disable-next-line import/first
import { addDomain, verifyDomain, makeChallenge } from '../alias-domain';
// eslint-disable-next-line import/first
import aliasRouter from '../../routes/alias';
// eslint-disable-next-line import/first
import { __clearRateLimits } from '../rate-limit';

const callRoute = async (method: string, path: string, req: any) => {
  const layer = (aliasRouter as any).stack.find(
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
  // 依次执行该路由的中间件链（didMiddleware、限流等）与 handler；
  // 中间件不调用 next（如 401/429 直接响应）时终止链条
  const fns = layer.route.stack.map((s: any) => s.handle);
  const run = async (i: number): Promise<void> => {
    if (i >= fns.length) return;
    let downstream: Promise<void> | null = null;
    const next = (e?: any) => {
      if (e) throw e;
      downstream = run(i + 1);
      return downstream;
    };
    await fns[i](req, res, next);
    if (downstream) await downstream;
  };
  await run(0);
  return res;
};

const txtOk = () => Promise.resolve([`"didmail-verify=${makeChallenge('didmail.io')}"`]);

const keyPair = getSigner(types.KeyType.ED25519).genKeyPair('hex', randomBytes(32));
const w = fromSecretKey(keyPair.secretKey as string);
const authHeaders = { 'x-didmail-did': w.address, 'x-didmail-pk': w.publicKey };

describe('alias routes', () => {
  beforeEach(async () => {
    await Alias.sync({ force: true });
    await DomainBinding.sync({ force: true });
    __clearRateLimits();
  });

  test('GET /resolve/:address is public and returns payload', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtOk);
    await Alias.create({
      alias: 'alice',
      aliasHash: 'h',
      domain: 'didmail.io',
      owner: 'z1alice',
      ownerPk: 'pka',
      assetAddress: 'z35a',
      mintTx: 'tx',
      bindingProof: 'proof',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    });
    const res = await callRoute('get', '/resolve/:address', {
      params: { address: 'alice@didmail.io' },
      ip: '1.1.1.1',
      headers: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.did).toBe('z1alice');
    expect(res.body.bindingProof).toBe('proof');
  });

  test('GET /resolve/:address 404 body shape', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtOk);
    const res = await callRoute('get', '/resolve/:address', {
      params: { address: 'nobody@didmail.io' },
      ip: '1.1.1.2',
      headers: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ALIAS_NOT_FOUND');
  });

  test('GET /availability requires DID headers (401 without)', async () => {
    const res = await callRoute('get', '/availability', {
      query: { alias: 'alice', domain: 'didmail.io' },
      ip: '1.1.1.3',
      headers: {},
    });
    expect(res.statusCode).toBe(401);
  });

  test('GET /availability works with valid DID headers', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtOk);
    const res = await callRoute('get', '/availability', {
      query: { alias: 'alice', domain: 'didmail.io' },
      ip: '1.1.1.4',
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.available).toBe(true);
  });

  test('POST /register/prepare blocked by gate with 409 FEATURE_NOT_ENABLED', async () => {
    const res = await callRoute('post', '/register/prepare', {
      body: { alias: 'alice', domain: 'didmail.io', years: 1 },
      ip: '1.1.1.5',
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('FEATURE_NOT_ENABLED');
  });

  test('rate limit kicks in on resolve', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtOk);
    let last: any;
    for (let i = 0; i < 61; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      last = await callRoute('get', '/resolve/:address', {
        params: { address: 'x@didmail.io' },
        ip: '9.9.9.9',
        headers: {},
      });
    }
    expect(last.statusCode).toBe(429);
  });
});
