import { Router } from 'express';
import GraphQLClient from '@ocap/client';
import axios from 'axios';
import getWallet from '../runtime/wallet';
import { stakeAsset, revokeStake, claimStake, addStakeToken, getStakeState } from '../libs/stake';
import env from '../libs/env';
import logger from '../libs/logger';

// 检查必需的环境变量
if (!env.chainHost) throw new Error('env.chainHost is required');
if (!env.appUrl) throw new Error('env.appUrl is required');
if (!env.tokenId) throw new Error('env.tokenId is required');

const router = Router();
const client = new GraphQLClient(env.chainHost, false);
const wallet = getWallet();

router.get('/state', async (_req, res) => {
  try {
    const stakeState = await getStakeState();
    if (!stakeState) {
      logger.warn('getStakeState returned null or undefined');
      return res.status(404).json({
        error: '未找到质押状态',
        message: '请确保已经质押了节点 NFT',
      });
    }
    return res.json(stakeState);
  } catch (error) {
    logger.error('getStakeState error:', {
      error: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      error: '获取质押状态失败',
      message: error instanceof Error ? error.message : '未知错误',
      details: error instanceof Error ? error.stack : undefined,
    });
  }
});

router.post('/asset', async (req, res) => {
  const { assetAddress } = req.body;
  await stakeAsset(assetAddress);
  return res.json({ message: 'staked' });
});

router.post('/add', async (req, res) => {
  const { amount } = req.body;
  logger.info(`addStakeToken: ${amount}`);
  const hash = await addStakeToken(amount);
  return res.json({ hash });
});

router.post('/revoke', async (_req, res) => {
  const hash = await revokeStake();
  return res.json({ hash });
});

router.post('/claim', async (_req, res) => {
  try {
    const hash = await claimStake();
    if (!hash) {
      return res.status(404).json({
        error: '未找到可领取的质押',
        message: '请确保已经撤销了质押并且等待期已过',
      });
    }
    return res.json({ hash });
  } catch (error) {
    logger.error('claimStake error:', {
      error: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      error: '领取质押失败',
      message: error instanceof Error ? error.message : '未知错误',
      details: error instanceof Error ? error.stack : undefined,
    });
  }
});

router.post('/update-endpoint', async (req, res) => {
  try {
    const { asset } = req.body;
    const { state } = await client.getAssetState({ address: asset });
    const value = JSON.parse(state.data.value);
    const {
      continent_code: continent,
      country_code: country,
      region_code: region,
    } = await axios.get('https://api.ip.sb/geoip').then((axiosRes) => axiosRes.data);
    const data = { ...value, endpoint: env.appUrl, location: `${continent}-${country}-${region}` };
    const hash = await client.updateAsset({
      address: asset,
      moniker: state.moniker,
      data: { typeUrl: 'json', value: data },
      wallet,
    });
    return res.status(200).json({ hash });
  } catch (error) {
    logger.error(`updateAsset error: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: error.errors?.[0]?.message || error.message || 'Failed to update endpoint' });
  }
});

export default router;
