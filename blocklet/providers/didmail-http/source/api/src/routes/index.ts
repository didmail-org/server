import { Router, Request, Response, NextFunction } from 'express';
// import cache from 'express-cache-headers';
import { toStakeAddress } from '@arcblock/did-util';
import { isValid } from '@arcblock/did';
import chainReads from '../runtime/chain-read';
import { arcUser } from '../runtime/session';
import stakeRouter from './stake';
import serversRouter from './servers';
import accountRouter from './account';
import envelopeRouter from './envelope';
import namecardRouter from './namecard';
import storageRouter from './storage';
import mailRouter from './mail';
import { getDefaultEnvelope, publicMailPolicy } from '../libs/mail-service-policy';
import contactRouter from './contact';
import aliasRouter from './alias';
import adminRouter from './admin';
import domainsRouter from './domains';
import checkAuthAndRole from '../middleware/auth-middleware';
import { Envelope, Namecard } from '../libs/sqlite';
import env from '../libs/env';
import didMiddleware from '../middleware/didmail-middleware';
import { listPublicDomains } from '../libs/alias-domain';
import getServerNodeNFT, { getCredentialList } from '../nft/templates/server-node';
import { getPublicForgeState } from '../libs/forge';
import logger from '../libs/logger';

const GraphQLClient = require('@ocap/client');

const options = { ignoreFields: ['state.context'] };

if (!env.chainHost) throw new Error('env.chainHost is required');

const client = new GraphQLClient(env.chainHost, false);
const { factoryOwner } = env;
const router = Router();
const svgHeaders = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'X-Content-Type-Options': 'nosniff',
};

// 添加用于检测移动设备的中间件
const detectDevice = (req: Request, _res: Response, next: NextFunction) => {
  const userAgent = req.get('user-agent') || '';
  (req as any).isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  next();
};

// 将设备检测中间件应用到路由
router.use(detectDevice);

router.get('/display', async (req, res) => {
  const { assetId } = req.query;
  if (!assetId) {
    return res.status(400).json({ message: 'assetId is required' });
  }
  if (!isValid(assetId as string)) {
    return res.status(400).json({ message: 'invalid assetId' });
  }
  const { state: asset } = await chainReads(client).getAssetState({ address: assetId }, options);
  if (!asset) {
    return res.status(404).send('Invalid request: nft asset not found');
  }
  const svg = getServerNodeNFT(asset);
  res.set(svgHeaders);
  res.type('svg');
  res.send(svg);
  return res;
});

router.get('/status', async (req, res) => {
  const { assetId } = req.query;
  const { state: asset } = await chainReads(client).getAssetState(
    { address: assetId },
    { ignoreFields: ['state.context'] },
  );
  if (!asset) {
    return res.status(404).json({ message: 'Asset not found' });
  }
  return res.jsonp(getCredentialList(asset));
});

router.get('/display/:address', arcUser, checkAuthAndRole, async (req, res) => {
  const { address } = req.params;
  // @ts-ignore
  const { state } = await chainReads(client).getAssetState({ address }, { ignoreFields: ['state.context'] });
  if (!state) {
    return res.status(404).json({ message: 'Asset not found' });
  }
  // UpdateAsset stores envelope/namecard previews in data.value.display.
  // Retain the mint-time display.content fallback for legacy assets.
  let value = state.data?.value;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = undefined;
    }
  }
  const display = value && typeof value === 'object' && !Array.isArray(value) ? value.display : undefined;
  let svg = typeof display === 'string' && display.trim() ? display : undefined;
  if (!svg && typeof state.display?.content === 'string' && state.display.content.trim()) svg = state.display.content;
  if (!svg) return res.status(404).json({ message: 'Asset display not found' });
  res.set(svgHeaders);
  res.type('svg');
  res.send(svg);
  return res;
});

router.get('/forge/state', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const forgeState = await getPublicForgeState();
  if (!forgeState)
    return res.status(503).json({
      status: 'unavailable',
      code: 'FORGE_STATE_UNAVAILABLE',
      message: 'Native chain terms are unavailable',
    });
  return res.json(forgeState);
});

router.get('/server/:address', didMiddleware, async (req, res) => {
  const timeStamp = new Date().getTime();
  const { address } = req.params;
  const stakeAddress = toStakeAddress(env.appId, factoryOwner);
  // @ts-ignore
  const { state } = await chainReads(client).getStakeState(
    { address: stakeAddress },
    { ignoreFields: ['state.context'] },
  );
  if (!state || !state.assets.includes(address || '')) {
    return res.status(404).json({ message: 'Server Stake not found' });
  }
  const { state: asset } = await chainReads(client).getAssetState({ address }, options);
  const content = getServerNodeNFT(asset);
  const svg = `data:image/svg+xml;base64,${Buffer.from(content).toString('base64')}`;
  return res.json({ timeStamp, svg, ...state });
});

router.get('/envelopes', didMiddleware, async (req: Request & { isMobile?: boolean }, res) => {
  // 移动端默认使用更小的页面大小
  const defaultPageSize = req.isMobile ? 5 : 10;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : defaultPageSize;

  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000)
    return res.status(400).json({ message: 'Invalid pagination' });
  const defaultEnvelope = await getDefaultEnvelope();
  return Envelope.findAndCountAll({
    where: { enabled: true, category: 'public' },
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  }).then(({ count, rows }) => {
    return res.json({
      total: count,
      page,
      totalPages: Math.ceil(count / pageSize),
      envelopes: rows,
      defaultEnvelope,
      isMobile: req.isMobile,
    });
  });
});

router.get('/namecards', didMiddleware, (req: Request & { isMobile?: boolean }, res) => {
  // 移动端默认使用更小的页面大小
  const defaultPageSize = req.isMobile ? 5 : 10;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : defaultPageSize;

  Namecard.findAndCountAll({
    where: { enabled: true, category: 'public' },
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  }).then(({ count, rows }) => {
    return res.json({
      total: count,
      page,
      totalPages: Math.ceil(count / pageSize),
      namecards: rows,
      isMobile: req.isMobile,
    });
  });
  return null;
});

// 公开能力探测端点（客户端功能探测，见设计文档 §4.1.4），必须注册在带鉴权的 /servers 挂载之前
router.get('/servers/domains', async (_req, res) => {
  try {
    return res.json(await listPublicDomains());
  } catch (error) {
    logger.error(`GET /servers/domains error: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Internal error', code: 'INTERNAL_ERROR' });
  }
});

router.get('/mail/service-config', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.json(await publicMailPolicy());
});

router.use('/account', arcUser, checkAuthAndRole, accountRouter);
router.use('/stake', arcUser, checkAuthAndRole, stakeRouter);
router.use('/servers', arcUser, checkAuthAndRole, serversRouter);
router.use('/envelope', arcUser, checkAuthAndRole, envelopeRouter);
router.use('/namecard', arcUser, checkAuthAndRole, namecardRouter);
router.use('/storage', arcUser, checkAuthAndRole, storageRouter);
router.use('/admin', arcUser, checkAuthAndRole, adminRouter);
router.use('/admin/domains', arcUser, checkAuthAndRole, domainsRouter);
router.use(
  '/mail',
  (req, res, next) => {
    if (req.method === 'GET' && req.path === '/attachment-config') return next();
    return didMiddleware(req, res, next);
  },
  mailRouter,
);
router.use('/alias', aliasRouter);
router.use('/contact', didMiddleware, contactRouter);
export default router;
