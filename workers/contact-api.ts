import { addressOf, isUuid, parseCanonical, uuid, signArtifact, identityId } from '@didmail/protocol';
import { toUint8Array } from '@ocap/util';
import type { WalletObject } from '@ocap/wallet';
import { InvalidContactPayment } from '../api/src/libs/contact-payment-evidence';
import { ContactPreparationError, ContactPreparationStore } from './contact-preparation-store';
import { ContactQuoteUnavailable, type ContactPreparationInput } from '../api/src/libs/contact-quote';
import type { ContactPreparation, ContactPreparationSnapshot } from '../api/src/libs/contact-preparation';
import { bindings } from './bindings';
import { identityMatches } from './dmp-settlement';
import { problem } from './dmp-api';
import { authenticateProtocolRequest } from './protocol-request';
import { rateLimit } from './rate-limit';
import { readContactStatus } from './contact-status';
import wallet from './wallet';

export interface ContactQuoteProvider {
  prepare(input: ContactPreparationInput): Promise<Readonly<ContactPreparationSnapshot>>;
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'cache-control': 'private, no-store', ...headers } });
type ContactSigner = Pick<WalletObject<any>, 'address' | 'secretKey'>;
const preparationProof = (preparation: Readonly<ContactPreparation>, signer?: ContactSigner) => {
  const node = signer ?? wallet();
  if (node.address !== preparation.snapshot.binding.servicePayee) throw new ContactQuoteUnavailable();
  return signArtifact(
    'DIDMAIL-CONTACT-PREPARATION/1',
    {
      snapshot: preparation.snapshot,
      ciphertext: preparation.ciphertext,
      createdAt: preparation.createdAt,
      expiresAt: preparation.expiresAt,
    },
    identityId(node.address),
    toUint8Array(node.secretKey),
  ).proof;
};
const response = (preparation: Readonly<ContactPreparation>, status = 200, signer?: ContactSigner) =>
  json(
    {
      protocolVersion: 1,
      preparationId: preparation.snapshot.binding.preparationId,
      state: preparation.payment ? 'accepted' : 'prepared',
      ...preparation,
      preparationProof: preparationProof(preparation, signer),
    },
    status,
    { location: `/v1/contact-preparations/${preparation.snapshot.binding.preparationId}` },
  );
const exact = (body: unknown, fields: string[]): body is Record<string, unknown> =>
  !!body &&
  typeof body === 'object' &&
  !Array.isArray(body) &&
  Object.keys(body).sort().join(',') === [...fields].sort().join(',');
const text = (value: unknown): value is string =>
  typeof value === 'string' && !!value && value.length <= 256 && !/\s/.test(value);

/** Internal handler until the durable payment/mint processor and discovery capability are ready. */
export async function handleContactRequest(
  request: Request,
  provider: ContactQuoteProvider,
  signer?: ContactSigner,
): Promise<Response> {
  const requestId = uuid(),
    url = new URL(request.url),
    method = request.method;
  try {
    if (method === 'OPTIONS') return new Response(null, { status: 204 });
    const path = /^\/v1\/contact-preparations\/([0-9a-f-]+)(\/submit|\/status)?$/.exec(url.pathname);
    if (!path || !isUuid(path[1]) || url.search)
      return problem(404, 'RESOURCE_NOT_FOUND', 'Contact preparation resource not found', 'none', requestId);
    if (
      !['GET', 'PUT', 'POST'].includes(method) ||
      (path[2] === '/status' ? method !== 'GET' : path[2] === '/submit' ? method !== 'POST' : method === 'POST')
    )
      return problem(405, 'METHOD_NOT_ALLOWED', 'Method not supported for resource', 'none', requestId);
    if (!(await rateLimit('dmp:ip:' + (request.headers.get('cf-connecting-ip') || 'local'), 600, 60000)))
      return problem(429, 'RATE_LIMITED', 'Too many requests', 'wait', requestId);
    if (method !== 'GET' && request.headers.get('content-type') !== 'application/json')
      return problem(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use the exact protocol media type', 'none', requestId);
    const { auth, bytes } = await authenticateProtocolRequest(request, 96 * 1024, identityMatches);
    const sender = addressOf(auth.identityId),
      id = path[1],
      store = new ContactPreparationStore(bindings.DB);
    if (method === 'GET') {
      if (bytes.length) return problem(400, 'INVALID_CONTACT_REQUEST', 'GET requires an empty body', 'none', requestId);
      const existing = await store.read(id, sender);
      return existing
        ? path[2] === '/status'
          ? json({
              ...(await readContactStatus(bindings.DB, existing)),
              preparationProof: preparationProof(existing, signer),
            })
          : response(existing, 200, signer)
        : problem(404, 'PREPARATION_NOT_FOUND', 'Contact preparation not found', 'none', requestId);
    }
    let body: Record<string, unknown>;
    try {
      body = parseCanonical(bytes) as Record<string, unknown>;
    } catch {
      return problem(400, 'INVALID_CONTACT_REQUEST', 'Use a canonical JSON request', 'none', requestId);
    }
    if (method === 'PUT') {
      if (
        !exact(body, ['protocolVersion', 'receiver', 'namecard', 'ciphertext']) ||
        body.protocolVersion !== 1 ||
        !text(body.receiver) ||
        !text(body.namecard) ||
        typeof body.ciphertext !== 'string' ||
        !body.ciphertext ||
        new TextEncoder().encode(body.ciphertext).length > 65536
      )
        return problem(400, 'INVALID_CONTACT_REQUEST', 'Invalid contact preparation fields', 'none', requestId);
      // Retry the same preparation without silently obtaining a different price or chain profile.
      const existing = await store.read(id, sender);
      if (existing) {
        if (
          existing.snapshot.binding.receiver !== body.receiver ||
          existing.snapshot.binding.namecard !== body.namecard ||
          existing.ciphertext !== body.ciphertext
        )
          return problem(409, 'PREPARATION_CONFLICT', 'Contact preparation is immutable', 'query_status', requestId);
        return response(existing, 200, signer);
      }
      const input = Object.freeze({
        preparationId: id,
        sender,
        receiver: body.receiver,
        namecard: body.namecard,
        ciphertext: body.ciphertext,
      });
      const snapshot = await provider.prepare(input);
      // Providers may only add independently verified economics; they cannot substitute the user's content or identities.
      if (
        snapshot.binding.preparationId !== id ||
        snapshot.binding.sender !== sender ||
        snapshot.binding.servicePayee !== (signer ?? wallet()).address ||
        snapshot.binding.receiver !== input.receiver ||
        snapshot.binding.namecard !== input.namecard
      )
        throw new ContactQuoteUnavailable();
      return response(await store.create(snapshot, input.ciphertext, Date.now() + 600000), 201, signer);
    }
    if (
      !exact(body, ['protocolVersion', 'signedOrigin']) ||
      body.protocolVersion !== 1 ||
      typeof body.signedOrigin !== 'string' ||
      !body.signedOrigin ||
      body.signedOrigin.length > 68000
    )
      return problem(400, 'INVALID_CONTACT_REQUEST', 'Submit only the original signed payment', 'none', requestId);
    const accepted = await store.accept(id, sender, body.signedOrigin, auth.publicKey);
    return response(accepted, 202, signer);
  } catch (error) {
    if (error instanceof InvalidContactPayment)
      return problem(
        409,
        'INVALID_CONTACT_PAYMENT',
        'Payment does not match the saved terms and payer signature',
        'query_status',
        requestId,
      );
    if (error instanceof ContactQuoteUnavailable)
      return problem(
        503,
        'CONTACT_QUOTE_UNAVAILABLE',
        'A fresh independently verified quote is unavailable',
        'wait',
        requestId,
      );
    if (error instanceof ContactPreparationError) {
      const status = {
        INVALID_PREPARATION: 400,
        PREPARATION_NOT_FOUND: 404,
        PREPARATION_CONFLICT: 409,
        PREPARATION_EXPIRED: 410,
        PREPARATION_QUOTA_EXCEEDED: 429,
      }[error.code];
      return problem(
        status,
        error.code,
        'Contact preparation cannot be changed or accepted',
        'query_status',
        requestId,
      );
    }
    const known = error as { status?: number; code?: string; recoveryAction?: string; message?: string };
    if (
      known.status &&
      ['BODY_TOO_LARGE', 'AUTHENTICATION_FAILED', 'REQUEST_REPLAYED', 'RATE_LIMITED'].includes(known.code || '')
    )
      return problem(known.status, known.code!, known.message!, known.recoveryAction, requestId);
    return problem(
      503,
      'CONTACT_SERVICE_UNAVAILABLE',
      'Contact service is temporarily unavailable',
      'query_status',
      requestId,
    );
  }
}
