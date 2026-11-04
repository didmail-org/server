import env from './env';
import logger from './logger';

const GraphQLClient = require('@ocap/client');

// 设置客户端配置
const client = new GraphQLClient(env.chainHost, false);

let forgeState: GraphQLClient.ForgeState;

/** Public native terms are unavailable when the upstream state cannot be verified. */
export async function getPublicForgeState(): Promise<GraphQLClient.ForgeState | null> {
  try {
    const { state } = await client.getForgeState({});
    const token = state?.token;
    if (
      !state ||
      typeof state !== 'object' ||
      Array.isArray(state) ||
      !token ||
      typeof token.symbol !== 'string' ||
      !token.symbol.trim() ||
      !Number.isInteger(token.decimal) ||
      token.decimal < 0 ||
      token.decimal > 2147483647
    )
      return null;
    return state;
  } catch {
    return null;
  }
}

/**
 * 创建空的 forge 状态
 * @returns 空的 forge 状态对象
 */
function createEmptyForgeState(): GraphQLClient.ForgeState {
  return {
    moniker: '',
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
  } as unknown as GraphQLClient.ForgeState;
}

/**
 * 获取 forge 状态
 * @returns Promise<GraphQLClient.ForgeState>
 */
async function getForgeState(): Promise<GraphQLClient.ForgeState> {
  try {
    const { state } = await client.getForgeState({});
    return state;
  } catch (error) {
    // 处理网络连接错误
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      logger.error(`网络连接错误: ${error.message}, 目标地址: ${env.chainHost}`);
    } else if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      // 处理 TLS 相关错误
      logger.error(`TLS 证书错误: ${error.message}`);
    } else {
      // 其他错误
      logger.error(`获取 forge 状态失败: ${error.message}`, {
        error,
        stack: error.stack,
        chainHost: env.chainHost,
      });
    }
    return createEmptyForgeState();
  }
}

export async function initializeForgeState() {
  if (!forgeState) {
    forgeState = await getForgeState();
  }
}

export { getForgeState };
