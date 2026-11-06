import { Router } from 'express';
// eslint-disable-next-line import/no-extraneous-dependencies
import { optimize } from 'svgo';
// eslint-disable-next-line import/no-extraneous-dependencies
import multer from 'multer';
import { fromUnitToToken } from '@ocap/util';
import { fromAddress } from '@ocap/wallet';
import chainReads from '../../../identity/chain-read';
import { wallet } from '../libs/auth';
import env from '../../../config/env';
import { Envelope } from '../../../storage/database';
import { templateListPage, invalidateTemplateList } from '../libs/template-list';
// @ts-ignore
// import logger from '../libs/logger';

const storage = multer.memoryStorage();
const upload = multer({ storage });
if (!env.chainHost) throw new Error('env.chainHost is required');
const GraphQLClient = require('@ocap/client');

const client = new GraphQLClient(env.chainHost, false);
const router = Router();
const factoryAddress = env.envelopeFactory;
const factoryOwnWallet = fromAddress(env.factoryOwner);

router.get('/factory', async (_req, res) => {
  // @ts-ignore
  const { state } = await chainReads(client).getFactoryState({ address: factoryAddress });
  if (!state) {
    return res.status(404).json({ message: 'Factory not found' });
  }
  const token = state.input.tokens.find((t: any) => t.symbol === 'TBA' || t.symbol === 'ABT');
  if (!token) {
    return res.status(404).json({ message: 'Factory not set input token' });
  }
  const price = `${fromUnitToToken(token.value)}  ${token.symbol}`;

  const factory = {
    address: state.address,
    description: state.description,
    limit: state.limit === 0 ? '∞' : state.limit,
    name: state.name,
    minted: state.numMinted,
    owner: state.owner,
    price,
    token,
    created_at: state.context.genesisTime,
    updated_at: state.context.renaissanceTime,
  };
  return res.json(factory);
});

router.post('/acquire', upload.single('file'), async (req, res) => {
  const { name, price, retentionPeriod, description } = req.body;
  const category = req.body.category ?? 'public';
  if (!['public', 'members'].includes(category)) return res.status(400).json({ message: 'Invalid envelope category' });

  const fileBuffer = req.file?.buffer;
  const fileName = req.file?.originalname;
  if (fileBuffer && fileName?.endsWith('.svg')) {
    let content = fileBuffer.toString('utf-8');
    const containsRequiredStrings = content.includes('{{mail.sender}}') && content.includes('{{mail.subject}}');
    if (!containsRequiredStrings) {
      return res
        .status(400)
        .json({ message: 'SVG file does not contain required strings: {{mail.sender}} and {{mail.subject}}' });
    }
    content = content.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;'); // 转义
    const optimized = optimize(content, {
      plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false } } }],
    });
    content = optimized.data;
    // content = content.replace(/&#123;&#123;/g, '{{').replace(/&#125;&#125;/g, '}}'); //反转义
    // logger.info('content', content);
    const inputs = {
      name,
      description,
      price,
      retentionPeriod,
      endpoint: env.appUrl,
    };

    const itx = await client.preMintAsset({
      factory: factoryAddress,
      inputs,
      owner: wallet.address,
      wallet: factoryOwnWallet,
    });
    const acquireHash = await client.acquireAsset({
      itx,
      wallet,
    });
    const { info } = await client.getTx({ hash: acquireHash });
    const asset = info.tx.itxJson.address;
    const { state } = await client.getAssetState({ address: asset });
    const value = JSON.parse(state.data.value);
    const data = { ...value, display: content };
    await client.updateAsset({
      address: asset,
      moniker: state.moniker,
      data: { typeUrl: 'json', value: data },
      wallet,
    });

    // A successful on-chain operation must not be reported as failed by an optional cache cleanup.
    let cacheInvalidated = true;
    try {
      await invalidateTemplateList('envelope', factoryAddress);
    } catch (error) {
      cacheInvalidated = false;
      console.error('Template cache invalidation failed after creation', error);
    }
    await Envelope.findOrCreate({
      where: { address: asset },
      defaults: {
        name,
        price: String(price),
        token: '{}',
        retentionPeriod: Number(retentionPeriod),
        description,
        svg: content,
        enabled: false,
        category,
      },
    });
    return res.json({ asset, cacheInvalidated });
  }
  return res.status(501).json({ message: 'error' });
});

router.get('/list', async (req, res) => {
  const cursor = req.query.cursor === undefined ? '0' : req.query.cursor;
  if (typeof cursor !== 'string' || cursor.length > 2048)
    return res.status(400).json({ message: 'Invalid list cursor' });
  const page = await templateListPage(
    'envelope',
    factoryAddress,
    chainReads(client),
    cursor,
    req.query.refresh === '1',
  );
  res.set('Cache-Control', 'no-store');
  return res.json(page);
});

router.post('/db/update', async (req, res) => {
  const { address, name, price, token, retentionPeriod, description, svg, enabled } = req.body;
  const envelope = await Envelope.findOne({ where: { address } });
  const category = String(envelope?.get('category') ?? 'public');
  if (req.body.category !== undefined && req.body.category !== category)
    return res
      .status(409)
      .json({ code: 'ENVELOPE_CATEGORY_IMMUTABLE', message: 'Envelope category cannot be changed after creation' });
  if (!['public', 'members'].includes(category)) return res.status(400).json({ message: 'Invalid envelope category' });
  if (!envelope) {
    await Envelope.create({
      address,
      category,
      name,
      price,
      token: JSON.stringify(token),
      retentionPeriod,
      description,
      svg,
      enabled,
    });
  } else {
    await Envelope.update(
      { name, price, token: JSON.stringify(token), retentionPeriod, description, svg, enabled },
      { where: { address } },
    );
  }
  return res.json({ message: 'Updated successfully' });
});

router.delete('/clean', async (_req, res) => {
  // Preserve creation-time classification when clearing publication settings.
  await Envelope.update({ enabled: false }, { where: {} });
  await invalidateTemplateList('envelope', factoryAddress);
  res.json({ message: 'Cleaned successfully' });
});

export default router;
