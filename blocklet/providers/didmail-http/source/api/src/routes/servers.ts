import { Router } from 'express';
import { fromAddress } from '@ocap/wallet';
import axios from 'axios';
import chainReads from '../runtime/chain-read';
import getWallet from '../runtime/wallet';
import env from '../libs/env';
import logger from '../libs/logger';
import readServerFactory from '../libs/server-factory';
import assertPurchaseBalance from '../libs/purchase-balance';

const GraphQLClient = require('@ocap/client');

if (!env.chainHost) throw new Error('env.chainHost is required');
const client = new GraphQLClient(env.chainHost, false);
const wallet = getWallet();
const owner = wallet.address;
const { serverNodeFactory, factoryOwner } = env;
const factoryOwnWallet = fromAddress(factoryOwner);

const router = Router();

router.get('/factory', async (req, res) => {
  try {
    const factory = await readServerFactory(
      chainReads(client),
      env.chainHost,
      serverNodeFactory,
      req.query.refresh === '1',
    );
    return res.json(factory);
  } catch (error) {
    logger.error(`获取工厂状态失败: ${error.message}`);
    return res.status(error.message.startsWith('Factory') ? 404 : 500).json({
      success: false,
      message: '获取工厂状态失败',
      error: error.message || '未知错误',
    });
  }
});

router.post('/acquire', async (_req, res) => {
  try {
    const reader = chainReads(client);
    const [factory, { state }] = await Promise.all([
      readServerFactory(reader, env.chainHost, serverNodeFactory, true),
      reader.getAccountState({ address: owner }),
    ]);
    assertPurchaseBalance(state?.tokens || [], factory.token);
    const {
      continent_code: continent,
      country_code: country,
      region_code: region,
    } = await axios.get('https://api.ip.sb/geoip').then((axiosRes) => axiosRes.data);
    const inputs = { endpoint: env.appUrl, location: `${continent}-${country}-${region}` };
    const itx = await client.preMintAsset({ factory: serverNodeFactory, inputs, owner, wallet: factoryOwnWallet });
    const hash = await client.acquireAsset({ itx, wallet });
    return res.json({ hash });
  } catch (error) {
    return res.status(error.status || 503).json({
      message: error.errors?.[0]?.message || error.message || 'Purchase could not be completed.',
    });
  }
});

export default router;
