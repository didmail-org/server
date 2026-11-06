import { Router } from 'express';

import { normalizeDomain } from '../libs/alias-crypto';
import {
  addDomain,
  verifyDomain,
  updateDomainPricing,
  unbindDomain,
  makeChallenge,
  AliasGateError,
} from '../libs/alias-domain';
import logger from '../libs/logger';

const router = Router();

const handle = (fn: (req: any) => Promise<any>) => async (req: any, res: any) => {
  try {
    return res.json(await fn(req));
  } catch (error) {
    if (error instanceof AliasGateError) {
      return res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
    }
    logger.error(`domains route error: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
};

router.post(
  '/',
  handle(async (req) => {
    const row = await addDomain(req.body.domain);
    const domain = normalizeDomain(row.get('domain') as string);
    return {
      domain,
      status: row.get('status'),
      txtRecord: `_didmail-challenge.${domain}`,
      txtValue: `didmail-verify=${makeChallenge(domain)}`,
    };
  }),
);

router.post(
  '/verify',
  handle(async (req) => {
    const row = await verifyDomain(req.body.domain);
    return { domain: row.get('domain'), status: row.get('status'), verifiedAt: row.get('verifiedAt') };
  }),
);

router.put(
  '/:domain',
  handle(async (req) => {
    const { aliasPrice, renewPricePerYear, minLength, maxLength } = req.body;
    const row = await updateDomainPricing(req.params.domain, { aliasPrice, renewPricePerYear, minLength, maxLength });
    return row.toJSON();
  }),
);

router.delete(
  '/:domain',
  handle(async (req) => {
    const row = await unbindDomain(req.params.domain);
    return { domain: row.get('domain'), status: row.get('status') };
  }),
);

export default router;
