import { Envelope } from './sqlite';
import env from './env';

// The first published NFT is the stable default. Disabling it selects the next published NFT.
export const getDefaultEnvelope = async () => {
  const row = await Envelope.findOne({ where: { enabled: true }, order: [['id', 'ASC']] });
  if (!row) return null;
  const data = row.toJSON() as any;
  return {
    ...data,
    price: String(data.price).trim().split(/\s+/)[0],
    token: typeof data.token === 'string' ? JSON.parse(data.token) : data.token,
  };
};
export const publicMailPolicy = async () => {
  const defaultEnvelope = await getDefaultEnvelope();
  return {
    version: 1,
    directEnabled: Boolean(defaultEnvelope),
    defaultEnvelope,
    restricted: false, // Legacy sending restriction alias, not public visibility.
    sendingRestricted: false,
    visibilityBasis: 'staked-server-node-nft',
    nodeDid: env.appId,
    name: env.appName,
    chainId: env.chainId,
    chainHost: env.chainHost,
    mailFactory: env.mailFactory,
    token: { address: env.tokenId, decimal: 18 },
    indexing: 'public-chain',
  };
};
