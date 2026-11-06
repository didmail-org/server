import { fromPublicKey } from '@ocap/wallet';
import { bindings } from '../runtime/bindings';
import { Envelope, Namecard } from '../storage/database';
import { authenticateProtocolRequest } from '../identity/protocol-request';
import { identityMatches } from '../protocol/dmp-settlement';
import { verifiedEnvelopeMember } from '../policy/envelope-access';

const headers = {
  'cache-control': 'private, no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers':
    'x-didmail-did,x-didmail-pk,content-digest,dmp-identity,dmp-identity-key,signature-input,signature',
};
export async function handleEnvelopeList(
  request: Request,
  kind: 'envelopes' | 'namecards' = 'envelopes',
): Promise<Response> {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const url = new URL(request.url),
      page = Number(url.searchParams.get('page') || 1),
      size = Number(url.searchParams.get('pageSize') || 10);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > 1000 ||
      !Number.isSafeInteger((page - 1) * size)
    )
      return json({ code: 'INVALID_PAGINATION' }, 400);
    let member = false,
      identityId: string | undefined;
    if (['dmp-identity', 'signature-input', 'signature'].some((key) => request.headers.has(key))) {
      const { auth } = await authenticateProtocolRequest(request, 0, identityMatches);
      identityId = auth.identityId;
      member = (await verifiedEnvelopeMember(auth.identityId)).member;
    } else {
      // Legacy identity headers are public information, never membership proof.
      const did = request.headers.get('x-didmail-did'),
        pk = request.headers.get('x-didmail-pk');
      if (!did || !pk) return json({ code: 'AUTHENTICATION_REQUIRED' }, 401);
      try {
        if (fromPublicKey(pk).address !== did) return json({ code: 'AUTHENTICATION_FAILED' }, 401);
      } catch {
        return json({ code: 'AUTHENTICATION_FAILED' }, 401);
      }
    }
    const model = kind === 'namecards' ? Namecard : Envelope;
    const condition = member ? 'enabled=1' : "enabled=1 AND category='public'";
    const selected = await bindings.DB.prepare(
      `SELECT id FROM ${kind} WHERE ${condition} ORDER BY CASE WHEN category='members' THEN 0 ELSE 1 END,id ASC LIMIT ? OFFSET ?`,
    )
      .bind(size, (page - 1) * size)
      .all<{ id: number }>();
    const rows = selected.results.length
      ? await model.findAll({ where: { id: selected.results.map((item) => item.id) } })
      : [];
    const byId = new Map(rows.map((row) => [Number(row.get('id')), row.toJSON()]));
    const envelopes = selected.results.map((item) => byId.get(item.id));
    const count = await bindings.DB.prepare(`SELECT count(*) AS n FROM ${kind} WHERE ${condition}`).first<{
      n: number;
    }>();
    const first = await bindings.DB.prepare(
      `SELECT id FROM ${kind} WHERE ${condition} ORDER BY CASE WHEN category='members' THEN 0 ELSE 1 END,id ASC LIMIT 1`,
    ).first<{ id: number }>();
    const defaultRow = first ? await model.findOne({ where: { id: first.id } }) : null;
    const raw = defaultRow?.toJSON() as any;
    const defaultEnvelope = raw
      ? {
          ...raw,
          price: String(raw.price).trim().split(/\s+/)[0],
          token: typeof raw.token === 'string' ? JSON.parse(raw.token) : raw.token,
        }
      : null;
    return json({
      [kind]: envelopes,
      ...(kind === 'envelopes' ? { defaultEnvelope } : {}),
      total: count?.n || 0,
      totalPages: Math.ceil((count?.n || 0) / size),
      page,
      member,
      ...(identityId ? { identityId } : {}),
    });
  } catch (error) {
    const e = error as Error & { status?: number; code?: string };
    return json({ code: e.code || 'ENVELOPES_UNAVAILABLE' }, e.status || 503);
  }
}
