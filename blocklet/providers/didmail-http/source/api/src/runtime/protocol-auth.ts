import { concat, verifyRequest, type IdentityMatcher } from '@didmail/protocol';

const reject = (status: number, code: string, detail: string, recoveryAction: string): never => {
  throw Object.assign(new Error(detail), { status, code, recoveryAction });
};
export async function readProtocolBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    return reject(413, 'BODY_TOO_LARGE', 'Request body exceeds limit', 'none');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  // eslint-disable-next-line no-constant-condition -- Read until the stream is complete.
  while (true) {
    // eslint-disable-next-line no-await-in-loop -- Stream reads are sequential.
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > maxBytes) {
      // A cloned request tees the stream. Cancellation waits for the unread
      // sibling, so waiting here would prevent the over-limit response.
      // eslint-disable-next-line no-void -- Cancellation must not block the limit response.
      void reader.cancel().catch(() => {});
      return reject(413, 'BODY_TOO_LARGE', 'Request body exceeds limit', 'none');
    }
    parts.push(chunk.value);
  }
  return concat(...parts);
}

/** The nonce operation must atomically reject a nonce already consumed by this identity. */
export interface ProtocolAuthStorage {
  consumeNonce(identityId: string, nonce: string, expiresAt: number): Promise<boolean>;
  allowIdentity(identityId: string): Promise<boolean>;
}

/** HTTP replay protection is independent from the durable identity of a signed chain payment. */
export async function authenticateProtocolRequest(
  request: Request,
  maxBytes: number,
  matches: IdentityMatcher,
  storage: ProtocolAuthStorage,
) {
  const bytes = await readProtocolBody(request, maxBytes);
  let auth: ReturnType<typeof verifyRequest>;
  try {
    auth = verifyRequest(request.method, request.url, bytes, request.headers, matches);
  } catch {
    return reject(401, 'AUTHENTICATION_FAILED', 'A valid unexpired DID request signature is required', 'authenticate');
  }
  if (!(await storage.consumeNonce(auth.identityId, auth.nonce, auth.expires + 30)))
    return reject(409, 'REQUEST_REPLAYED', 'Request nonce has already been consumed', 'retry_with_new_nonce');
  if (!(await storage.allowIdentity(auth.identityId)))
    return reject(429, 'RATE_LIMITED', 'Identity request limit exceeded', 'wait');
  return { auth, bytes };
}
