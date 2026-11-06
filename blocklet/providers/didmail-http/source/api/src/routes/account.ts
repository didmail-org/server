import { Router } from 'express';
import GraphQLClient from '@ocap/client';
import chainReads from '../runtime/chain-read';
import { wallet } from '../libs/auth';
import env from '../libs/env';
import logger from '../libs/logger';
import { gasStakeQuote, stakeForGas, revokeGasStake, claimGasStake } from '../libs/gas-stake';
import { nodeTransferQuote, transferToOwner } from '../libs/node-transfer';

if (!env.chainHost) throw new Error('env.chainHost is required');
const client = new GraphQLClient(env.chainHost, false);
const router = Router();

/**
 * 创建空的账户状态
 * @returns 空的账户状态对象
 */
function createEmptyAccountState(chainStatus: 'unregistered' | 'unavailable' = 'unregistered') {
  return {
    address: wallet.address,
    moniker: env.appName,
    chainStatus,
    chainId: env.chainId,
    nonce: 0,
    balance: '0',
    tokens: [],
    assets: [],
    context: {
      genesisTx: {
        hash: '',
        height: '0',
        time: '',
        tx: '',
        index: '0',
        tags: [],
        code: '0',
        gasUsed: '0',
        gasWanted: '0',
        fee: { amount: [], gas: '0' },
        data: {},
      },
      renaissanceTx: {
        hash: '',
        height: '0',
        time: '',
        tx: '',
        index: '0',
        tags: [],
        code: '0',
        gasUsed: '0',
        gasWanted: '0',
        fee: { amount: [], gas: '0' },
        data: {},
      },
      genesisTime: '',
      renaissanceTime: '',
    },
  };
}

// get server node account state
router.get('/state', async (_req, res) => {
  try {
    logger.info(`获取账户状态: ${wallet.address}`);
    const { state } = await chainReads(client).getAccountState({ address: wallet.address });

    // 如果状态为空，返回空状态而不是 404
    if (!state) {
      logger.warn(`账户状态为空: ${wallet.address}`);
      return res.json(createEmptyAccountState());
    }

    return res.json({ ...state, address: wallet.address, chainStatus: 'ready', chainId: env.chainId });
  } catch (error) {
    // Return only structured diagnostic fields; never leak headers, secrets or stacks.
    const chainError = {
      code: String(error.code || 'CHAIN_READ_FAILED'),
      stage: String(error.stage || 'chain'),
      ...(error.path ? { path: String(error.path) } : {}),
      ...(error.reason ? { reason: String(error.reason) } : {}),
      ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}),
    };
    logger.error('Node account chain read failed', { ...chainError, message: error.message, chainHost: env.chainHost });
    return res.json({ ...createEmptyAccountState('unavailable'), chainError });
  }
});

router.get('/transfer', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    return res.json(await nodeTransferQuote(req.user));
  } catch (error) {
    return res
      .status((error.nodeTransferError && error.status) || 503)
      .json({ message: error.nodeTransferError ? error.message : 'Node balance could not be verified.' });
  }
});
router.post('/transfer', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    return res.json(await transferToOwner(req.user, req.body?.amount));
  } catch (error) {
    logger.error('Node transfer failed', { code: error.code || 'TRANSFER_FAILED' });
    return res.status((error.nodeTransferError && error.status) || 503).json({
      message: error.nodeTransferError
        ? error.message
        : 'Transfer could not be confirmed. Check the node balance and transaction history before retrying.',
    });
  }
});

router.get('/gas-stake', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    return res.json(await gasStakeQuote(req.user));
  } catch (error) {
    return res
      .status((error.gasStakeError && error.status) || 503)
      .json({ message: error.gasStakeError ? error.message : 'Gas staking rules could not be verified.' });
  }
});
router.post('/gas-stake', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    return res.json(await stakeForGas(req.user, req.body?.policyId));
  } catch (error) {
    return res.status((error.gasStakeError && error.status) || 503).json({
      message: error.gasStakeError
        ? error.message
        : 'Gas stake could not be confirmed. Check the stake state before retrying.',
    });
  }
});

router.post('/gas-stake/revoke', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    return res.json(await revokeGasStake(req.user, req.body?.policyId));
  } catch (error) {
    return res.status((error.gasStakeError && error.status) || 503).json({
      message: error.gasStakeError
        ? error.message
        : 'Gas stake could not be confirmed. Check the stake state before retrying.',
    });
  }
});

router.post('/gas-stake/claim', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    return res.json(await claimGasStake(req.user, req.body?.policyId, req.body?.evidence));
  } catch (error) {
    return res.status((error.gasStakeError && error.status) || 503).json({
      message: error.gasStakeError
        ? error.message
        : 'Gas stake could not be confirmed. Check the stake state before retrying.',
    });
  }
});

export default router;
