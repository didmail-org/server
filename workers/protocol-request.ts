import type { IdentityMatcher } from '@didmail/protocol';
import { authenticateProtocolRequest as authenticate, readProtocolBody } from '../api/src/runtime/protocol-auth';
import { bindings } from './bindings';
import { rateLimit } from './rate-limit';

export { readProtocolBody };

export async function authenticateProtocolRequest(request: Request, maxBytes: number, matches: IdentityMatcher) {
  return authenticate(request, maxBytes, matches, {
    async consumeNonce(identityId, nonce, expiresAt) {
      const result = await bindings.DB.prepare(
        'INSERT OR IGNORE INTO dmp_nonces(identity_id,nonce,expires_at) VALUES(?,?,?)',
      )
        .bind(identityId, nonce, expiresAt)
        .run();
      return Boolean(result.meta.changes);
    },
    allowIdentity: (identityId) => rateLimit('dmp:did:' + identityId, 300, 60000),
  });
}
