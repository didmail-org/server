import { createHash } from 'node:crypto';
import env from './env';

// Public identity/configuration only. Never include session tokens or wallet secrets.
export default function withNodeScope<T extends { authenticated: boolean; user: null | { role: string } }>(session: T) {
  if (!session.authenticated || !session.user || !['owner', 'admin'].includes(session.user.role)) return session;
  const cacheKey = createHash('sha256')
    .update(
      JSON.stringify([env.appId, env.chainId, env.chainHost, env.tokenId, env.factoryOwner, env.serverNodeFactory]),
    )
    .digest('hex');
  return { ...session, node: { address: env.appId, chainId: env.chainId, tokenId: env.tokenId, cacheKey } };
}
