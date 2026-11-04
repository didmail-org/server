import { identityId, addressOf } from '@didmail/protocol';
import { bindings } from './bindings';
import { authenticateProtocolRequest, readProtocolBody } from './protocol-request';
import { identityMatches } from './dmp-settlement';
import { verifiedEnvelopeMember } from './envelope-access';

const json = (body: unknown, init: { status: number }) =>
  Response.json(body, {
    ...init,
    headers: { 'access-control-allow-origin': '*', 'cache-control': 'private, no-store' },
  });

// Legacy contact routes require fresh DID proof for member-only templates at both stages.
export async function authorizeNamecardSend(request: Request): Promise<Response | null> {
  try {
    const bytes = await readProtocolBody(request.clone(), 1024 * 1024);
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)) as Record<string, unknown>;
    const signing = new URL(request.url).pathname.replace(/\/$/, '').toLowerCase().endsWith('/sign');
    let address = body.namecard,
      sender = request.headers.get('x-didmail-did') || '';
    if (signing) {
      const row = await bindings.DB.prepare('SELECT sender,namecard FROM contacts WHERE id=? AND hash=?')
        .bind(body.id, body.hash)
        .first<{ sender: string; namecard: string }>();
      if (!row) return json({ code: 'CONTACT_NOT_FOUND' }, { status: 404 });
      if (row.sender !== sender) return json({ code: 'AUTHENTICATION_FAILED' }, { status: 403 });
      address = row.namecard;
    }
    if (typeof address !== 'string') return json({ code: 'INVALID_NAMECARD' }, { status: 400 });
    const row = await bindings.DB.prepare('SELECT category FROM namecards WHERE address=? AND enabled=1')
      .bind(address)
      .first<{ category: string }>();
    if (!row) return json({ code: 'NAMECARD_UNAVAILABLE' }, { status: 409 });
    const signed = ['dmp-identity', 'signature-input', 'signature'].some((key) => request.headers.has(key));
    if (signed) {
      const { auth } = await authenticateProtocolRequest(request.clone(), 1024 * 1024, identityMatches);
      if (addressOf(auth.identityId) !== sender) return json({ code: 'AUTHENTICATION_FAILED' }, { status: 403 });
      sender = addressOf(auth.identityId);
    }
    if (row.category === 'members' && (!signed || !(await verifiedEnvelopeMember(identityId(sender))).member))
      return json({ code: 'NAMECARD_MEMBER_REQUIRED' }, { status: 403 });
    return null;
  } catch (error) {
    const e = error as { status?: number; code?: string };
    return json(
      { code: e.code || 'NAMECARD_ACCESS_UNAVAILABLE' },
      { status: e.status || (error instanceof SyntaxError ? 400 : 503) },
    );
  }
}
