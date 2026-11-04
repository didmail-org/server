import { Router } from 'express';
// eslint-disable-next-line import/no-extraneous-dependencies
import { optimize } from 'svgo';
// eslint-disable-next-line import/no-extraneous-dependencies
import multer from 'multer';
import { fromUnitToToken } from '@ocap/util';
import { fromAddress } from '@ocap/wallet';
import chainReads from '../runtime/chain-read';
import { wallet } from '../libs/auth';
import env from '../libs/env';
import { Namecard } from '../libs/sqlite';
import { templateListPage, invalidateTemplateList } from '../libs/template-list';
// @ts-ignore
// import logger from '../libs/logger';

const storage = multer.memoryStorage();
const upload = multer({ storage });
if (!env.chainHost) throw new Error('env.chainHost is required');
const GraphQLClient = require('@ocap/client');

const client = new GraphQLClient(env.chainHost, false);
const router = Router();
const factoryAddress = env.namecardFactory;
const factoryOwnWallet = fromAddress(env.factoryOwner);

router.get('/factory', async (_req, res) => {
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
  const { name, price, description } = req.body;
  const category = req.body.category ?? 'public';
  if (!['public', 'members'].includes(category)) return res.status(400).json({ message: 'Invalid namecard category' });
  const fileBuffer = req.file?.buffer;
  const fileName = req.file?.originalname;
  if (fileBuffer && fileName?.endsWith('.svg')) {
    let content = fileBuffer.toString('utf-8');
    const containsRequiredStrings = content.includes('{{contact.name}}');
    if (!containsRequiredStrings) {
      return res.status(400).json({ message: 'SVG file does not contain required strings: {{contact.name}}' });
    }
    content = content.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;'); // 转义
    const optimized = optimize(content, {
      plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false } } }],
    });
    content = optimized.data;
    const inputs = {
      name,
      description,
      price,
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
    await Namecard.findOrCreate({
      where: { address: asset },
      defaults: { category, price: String(price), token: '{}', description, svg: content, enabled: false },
    });
    // A successful on-chain operation must not be reported as failed by an optional cache cleanup.
    let cacheInvalidated = true;
    try {
      await invalidateTemplateList('namecard', factoryAddress);
    } catch (error) {
      cacheInvalidated = false;
      console.error('Template cache invalidation failed after creation', error);
    }
    return res.json({ asset, cacheInvalidated });
  }
  return res.status(400).json({ message: 'Invalid file type' });
});

router.get('/list', async (req, res) => {
  const cursor = req.query.cursor === undefined ? '0' : req.query.cursor;
  if (typeof cursor !== 'string' || cursor.length > 2048)
    return res.status(400).json({ message: 'Invalid list cursor' });
  const page = await templateListPage(
    'namecard',
    factoryAddress,
    chainReads(client),
    cursor,
    req.query.refresh === '1',
  );
  res.set('Cache-Control', 'no-store');
  return res.json(page);
});

router.post('/db/update', async (req, res) => {
  const { address, price, token, description, svg, enabled } = req.body;
  const namecard = await Namecard.findOne({ where: { address } });
  const category = String(namecard?.get('category') ?? 'public');
  if (req.body.category !== undefined && req.body.category !== category)
    return res
      .status(409)
      .json({ code: 'NAMECARD_CATEGORY_IMMUTABLE', message: 'Namecard category cannot be changed after creation' });
  if (!namecard) {
    await Namecard.create({ address, category, price, token: JSON.stringify(token), description, svg, enabled });
  } else {
    await Namecard.update({ price, token: JSON.stringify(token), description, svg, enabled }, { where: { address } });
  }
  return res.json({ message: 'Updated successfully' });
});

router.delete('/clean', async (_req, res) => {
  await Namecard.update({ enabled: false }, { where: {} });
  await invalidateTemplateList('namecard', factoryAddress);
  return res.json({ message: 'Cleaned successfully' });
});

export default router;
