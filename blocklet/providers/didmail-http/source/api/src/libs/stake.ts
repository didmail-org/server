import { fromTokenToUnit, fromUnitToToken } from '@ocap/util';
import { toStakeAddress } from '@arcblock/did-util';
import chainReads from '../runtime/chain-read';
import getWallet from '../runtime/wallet';
import env from './env';
import logger from './logger';

const GraphQLClient = require('@ocap/client');

const { revokeWaitingPeriod, factoryOwner, serverNodeFactory } = env;

const wallet = getWallet();
const client = new GraphQLClient(env.chainHost, false);

/**
 * 将 AssetState 转换为 IndexedAssetState 格式
 * @param assetState - 原始资产状态
 * @returns 转换后的索引资产状态
 */
function convertAssetStateToIndexed(assetState: GraphQLClient.AssetState): GraphQLClient.IndexedAssetState {
  return {
    address: assetState.address,
    owner: assetState.owner,
    genesisTime: assetState.context?.genesisTime || '',
    renaissanceTime: assetState.context?.renaissanceTime || '',
    moniker: assetState.moniker,
    readonly: assetState.readonly,
    consumedTime: assetState.consumedTime,
    issuer: assetState.issuer,
    parent: assetState.parent,
    transferrable: assetState.transferrable,
    ttl: assetState.ttl?.toString() || '',
    display: assetState.display,
    endpoint: assetState.endpoint,
    tags: assetState.tags,
    data: assetState.data,
  };
}

/**
 * 创建空的质押状态
 * @returns 空的质押状态对象
 */
function createEmptyStakeState(): GraphQLClient.StakeState {
  return {
    address: toStakeAddress(env.appId, factoryOwner),
    sender: '',
    receiver: '',
    revocable: false,
    revokeWaitingPeriod,
    message: '',
    nonce: '',
    assets: [],
    tokens: [],
    revokedAssets: [],
    revokedTokens: [],
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
  } as unknown as GraphQLClient.StakeState;
}

/**
 * 查询用户拥有的 DIDMail 服务节点 NFT
 * @returns 用户拥有的节点 NFT 列表，如果查询失败则返回空数组
 */
const getAssets = async (): Promise<GraphQLClient.IndexedAssetState[]> => {
  try {
    const { assets } = await chainReads(client).listAssets({
      ownerAddress: wallet.address,
      factoryAddress: serverNodeFactory,
    });
    return assets;
  } catch (error) {
    logger.error('Failed to get assets:', error);
    if (String(error.code).startsWith('AFS_CHAIN_')) throw error;
    return [];
  }
};

/**
 * 获取质押状态并判断是否已质押
 * @returns 质押状态和是否已质押的标志，如果查询失败则返回未质押状态
 */
const getStaked = async (): Promise<GraphQLClient.StakeState & { staked: boolean }> => {
  try {
    const stakeAddress = toStakeAddress(env.appId, factoryOwner);
    const { state } = await chainReads(client).getStakeState(
      { address: stakeAddress },
      { ignoreFields: ['state.context'] },
    );
    const staked = Boolean(
      state && state.assets?.length && state.tokens?.length && BigInt(state.tokens[0]?.value || '0') > 0n,
    );
    return { ...(state || createEmptyStakeState()), address: state?.address || stakeAddress, staked };
  } catch (error) {
    logger.error('Failed to get staked state:', error);
    if (String(error.code).startsWith('AFS_CHAIN_')) throw error;
    return { ...createEmptyStakeState(), staked: false };
  }
};

/**
 * 获取完整的质押状态，包括用户拥有的资产和质押的资产
 * @returns 完整的质押状态，如果查询失败则返回空状态
 */
const getStakeState = async (): Promise<
  GraphQLClient.StakeState & { staked: boolean; ownerAssets: GraphQLClient.IndexedAssetState[] }
> => {
  try {
    const [ownerAssets, stakeState] = await Promise.all([getAssets(), getStaked()]);
    const { staked, assets: stakeAssets, revokedAssets } = stakeState;

    // 获取已质押的资产状态
    if (stakeAssets && stakeAssets.length > 0) {
      const states = await Promise.all(
        stakeAssets.map(async (asset) => {
          try {
            const { state } = await chainReads(client).getAssetState({ address: asset });
            return convertAssetStateToIndexed(state);
          } catch (error) {
            logger.error(`Failed to get asset state for ${asset}:`, error);
            if (String(error.code).startsWith('AFS_CHAIN_')) throw error;
            return null;
          }
        }),
      );
      ownerAssets.push(...states.filter((state): state is GraphQLClient.IndexedAssetState => state !== null));
    }

    // 获取已撤销的资产状态
    if (revokedAssets && revokedAssets.length > 0) {
      const states = await Promise.all(
        revokedAssets.map(async (asset) => {
          try {
            const { state } = await chainReads(client).getAssetState({ address: asset });
            return convertAssetStateToIndexed(state);
          } catch (error) {
            logger.error(`Failed to get revoked asset state for ${asset}:`, error);
            if (String(error.code).startsWith('AFS_CHAIN_')) throw error;
            return null;
          }
        }),
      );
      ownerAssets.push(...states.filter((state): state is GraphQLClient.IndexedAssetState => state !== null));
    }

    // 去重资产列表
    const uniqueAssets = ownerAssets.filter(
      (asset, index, self) => index === self.findIndex((t) => t.address === asset.address),
    );
    return { ...stakeState, staked, ownerAssets: uniqueAssets };
  } catch (error) {
    logger.error('Failed to get stake state:', error);
    if (String(error.code).startsWith('AFS_CHAIN_')) throw error;
    return { ...createEmptyStakeState(), staked: false, ownerAssets: [] };
  }
};

// 质押代币配置
const stakeToken = { address: env.tokenId, value: fromTokenToUnit(1, 18).toString() };

/**
 * 质押节点 NFT
 * @param assetAddress - 要质押的 NFT 地址
 * @returns 交易哈希和质押地址，如果质押失败则返回 undefined
 */
const stakeAsset = async (assetAddress: string) => {
  try {
    const from = wallet.address;
    const to = factoryOwner;
    const address = toStakeAddress(env.appId, to);
    let tx = await client.multiSignStakeTx({
      tx: {
        itx: {
          address,
          receiver: to,
          locked: false,
          message: 'DID Mail Server Node Stake Asset',
          revokeWaitingPeriod,
          slashers: [to],
          nonce: '',
          inputs: [
            {
              owner: from,
              assets: [assetAddress],
              tokens: [stakeToken],
            },
          ],
        },
        signatures: [
          {
            signer: from,
            pk: wallet.publicKey,
          },
        ],
      },
      wallet,
    });

    tx = await client.signStakeTx({ tx, wallet });
    const hash = await client.sendStakeTx({ tx, wallet });
    return [hash, address];
  } catch (error) {
    logger.error('Failed to stake asset:', error);
    return undefined;
  }
};

/**
 * 添加质押代币
 * @param amount - 要添加的代币数量
 * @returns 交易哈希，如果添加失败则返回 undefined
 */
const addStakeToken = async (amount: Number) => {
  try {
    const { state: factoryState } = await client.getFactoryState({ address: serverNodeFactory });
    const to = factoryState.owner;
    const hash = await client.stake({
      tokens: [
        {
          address: env.tokenId,
          value: amount,
        },
      ],
      to,
      slashers: [to],
      message: 'DID Mail Server Node Add Statk Token',
      nonce: '',
      wallet,
    });
    return hash;
  } catch (error) {
    logger.error('Failed to add stake token:', error);
    return undefined;
  }
};

/**
 * 撤销质押
 * @returns 交易哈希，如果未质押或撤销失败则返回 undefined
 */
const revokeStake = async () => {
  try {
    const stakeState = await getStaked();
    const { address, assets, tokens, staked } = stakeState;
    logger.info(`stake address: ${address}`);
    if (!staked) return undefined;
    const token = tokens[0]
      ? { address: tokens[0].address, value: fromUnitToToken(tokens[0].value, 18).toString() }
      : undefined;
    const hash = await client.revokeStake({
      assets,
      tokens: [token],
      from: address,
      wallet,
    });
    return hash;
  } catch (error) {
    logger.error('Failed to revoke stake:', error);
    return undefined;
  }
};

/**
 * 领取已撤销的质押
 * @returns 交易哈希，如果没有可领取的质押或领取失败则返回 undefined
 */
const claimStake = async (): Promise<string | undefined> => {
  try {
    const stakeAddress = toStakeAddress(env.appId, factoryOwner);
    const { state: stakeState } = await client.getStakeState({ address: stakeAddress });
    if (!stakeState || stakeState.revokedTokens.length === 0) return undefined;
    const { transactions } = await client.listTransactions({
      stakeFilter: {
        stakes: [stakeAddress],
      },
      typeFilter: { types: ['revoke_stake'] },
      validityFilter: { validity: 'VALID' },
    });
    if (transactions.length === 0) return undefined;
    const tx = transactions[0];
    const hash = await client.claimStake({ from: stakeAddress, evidence: tx.hash, wallet });
    return hash;
  } catch (error) {
    logger.error('Failed to claim stake:', error);
    return undefined;
  }
};

export { getAssets, getStaked, getStakeState, stakeAsset, revokeStake, claimStake, addStakeToken };
