import { Router } from 'express';

import didMiddleware from '../middleware/didmail-middleware';
import { AliasGateError } from '../libs/alias-domain';
import {
  buildRegisterTx,
  checkAvailability,
  finalizeRegister,
  listMyAliases,
  resolveAliasAddress,
} from '../libs/alias-service';
import logger from '../libs/logger';
import { rateLimit } from '../libs/rate-limit';

const router = Router();

const handle = (fn: (req: any) => Promise<any>) => async (req: any, res: any) => {
  try {
    return res.json(await fn(req));
  } catch (error) {
    if (error instanceof AliasGateError) {
      return res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
    }
    logger.error(`alias route error: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
};

const limit =
  (keyFn: (req: any) => string, n = 60) =>
  async (req: any, res: any, next: any) => {
    if (!(await rateLimit(keyFn(req), n, 60_000))) {
      return res.status(429).json({ success: false, error: 'Too many requests', code: 'RATE_LIMITED' });
    }
    return next();
  };

// 公开：别名解析（设计文档 §4.5.1），按 IP 限流
router.get(
  '/resolve/:address',
  limit((req) => `resolve:${req.ip}`),
  handle((req) => resolveAliasAddress(req.params.address)),
);

// 以下全部需要 DID 头（didMiddleware 逐路由挂载，保证路由栈内可测）

router.get(
  '/availability',
  didMiddleware,
  limit((req) => `avail:${req.account.did}`),
  handle((req) => checkAvailability(`${req.query.alias}`, `${req.query.domain}`)),
);

router.get(
  '/mine',
  didMiddleware,
  handle(async (req) => ({ aliases: await listMyAliases(req.account.did) })),
);

router.post(
  '/register/prepare',
  didMiddleware,
  limit((req) => `prepare:${req.account.did}`, 20),
  handle((req) => {
    const { alias, domain, years } = req.body;
    return buildRegisterTx(req.account, alias, domain, Number(years) || 1);
  }),
);

router.post(
  '/register/sign',
  didMiddleware,
  limit((req) => `sign:${req.account.did}`, 20),
  handle((req) => {
    const { alias, domain, nonce, origin, bindingProof } = req.body;
    return finalizeRegister(req.account, { alias, domain, nonce, origin, bindingProof });
  }),
);

export default router;
