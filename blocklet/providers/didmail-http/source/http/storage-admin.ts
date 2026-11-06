import type { FetchPort } from '../runtime/contracts';
import { bindings, value } from '../runtime/bindings';
import { readArcSession } from '../identity/session';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const union = `SELECT id,'legacy:'||id AS storageKey,sender,receiver,envelope,hash,size,paymentTx,assetTx,asset,payment,credit,dividend,createdAt,downloadAt,sendStatus,NULL AS fundingMode,NULL AS sponsorCost,NULL AS deliveryProblemJson,NULL AS nextAttemptAt,NULL AS indexAttemptsJson FROM mails
 UNION ALL SELECT id,'dmp:'||id,sender_id,recipient_id,json_extract(manifest_json,'$.planId'),manifest_hash,
 (SELECT coalesce(sum(size_bytes),0) FROM dmp_chunks WHERE message_id=m.id),payment_hash,coalesce(json_extract(receipt_json,'$.index.transactionId'),index_hash),coalesce(json_extract(receipt_json,'$.index.assetId'),asset_id),json_extract(quote_json,'$.totalAmount'),json_extract(quote_json,'$.serviceAmount'),json_extract(quote_json,'$.developerAmount'),created_at,NULL,state,json_extract(quote_json,'$.funding.mode'),json_extract(quote_json,'$.funding.amount'),last_problem_json,
 CASE WHEN next_attempt_at>0 THEN strftime('%Y-%m-%dT%H:%M:%fZ',next_attempt_at/1000.0,'unixepoch') ELSE NULL END,
 (SELECT json_group_array(transaction_id) FROM (SELECT transaction_id FROM dmp_index_attempts WHERE message_id=m.id ORDER BY rejected_at)) FROM dmp_messages m WHERE lifecycle='live'`;
export async function handleStorageAdmin(request: Request): Promise<Response> {
  try {
    const session = await readArcSession({ headers: Object.fromEntries(request.headers) });
    if (!session.authenticated || !session.user) return json({ message: 'Unauthorized' }, 401);
    if (!['owner', 'admin'].includes(session.user.role)) return json({ message: 'Administrator role required' }, 403);
    const url = new URL(request.url);
    if (
      request.method !== 'GET' &&
      request.headers.has('cookie') &&
      request.headers.get('origin') !== new URL(value('DIDMAIL_URL')).origin
    )
      return json({ message: 'Invalid request origin' }, 403);
    if (url.pathname === '/api/storage/size' && request.method === 'GET') {
      let bytes: number;
      const response = await (bindings.ARC_STORAGE as FetchPort).fetch(
        new Request('http://arc-storage.internal/storage', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op: 'usage' }),
        }),
      );
      const body = (await response.json()) as { data?: { sizeBytes: number; basis: string } };
      if (!response.ok || body.data?.basis !== 'afs-json') throw Error('AFS usage unavailable');
      bytes = body.data.sizeBytes;
      if (!Number.isSafeInteger(bytes) || bytes < 0) throw Error('Database size unavailable');
      return json({
        size: (bytes / 1024).toFixed(2) + ' KB',
        sizeBytes: bytes,
        basis: 'afs-json', includesObjects: false,
      });
    }
    if (url.pathname === '/api/storage/mails' && request.method === 'GET') {
      const page = Number(url.searchParams.get('page') || 1),
        pageSize = Number(url.searchParams.get('pageSize') || 10),
        search = url.searchParams.get('search') || '';
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > 100000 ||
        !Number.isSafeInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100 ||
        search.length > 256
      )
        return json({ message: 'Invalid pagination or search' }, 400);
      const where = search
        ? ` WHERE id=? OR storageKey=? OR sender=? OR receiver=? OR envelope=? OR hash=? OR paymentTx=? OR assetTx=? OR replace(sender,'did:abt:','')=? OR replace(receiver,'did:abt:','')=?`
        : '';
      const args = search
        ? [...Array(8).fill(search), search.replace(/^did:abt:/, ''), search.replace(/^did:abt:/, '')]
        : [];
      const count = await bindings.DB.prepare('SELECT count(*) AS n FROM (' + union + ')' + where)
        .bind(...args)
        .first<{ n: number }>();
      const rows = await bindings.DB.prepare(
        'SELECT * FROM (' +
          union +
          ')' +
          where +
          ' ORDER BY julianday(createdAt) DESC,storageKey DESC LIMIT ? OFFSET ?',
      )
        .bind(...args, pageSize, (page - 1) * pageSize)
        .all();
      return json({
        total: count?.n || 0,
        page,
        totalPages: Math.ceil((count?.n || 0) / pageSize),
        mails: rows.results.map(({ deliveryProblemJson, indexAttemptsJson, ...row }) => ({
          ...row,
          deliveryProblem: deliveryProblemJson ? JSON.parse(String(deliveryProblemJson)) : null,
          indexAttempts: indexAttemptsJson ? JSON.parse(String(indexAttemptsJson)) : [],
        })),
      });
    }
    const target = /^\/api\/storage\/mails\/delete\/(dmp:[0-9a-f-]{36})$/.exec(decodeURIComponent(url.pathname));
    if (target && request.method === 'DELETE') {
      const [kind, id] = target[1].split(':'),
        prefix = 'dmp',
        now = new Date().toISOString();
      const row = await bindings.DB.prepare(`SELECT state,accepted_at,lifecycle FROM ${prefix}_messages WHERE id=?`)
        .bind(id)
        .first<{ state: string; accepted_at: string | null; lifecycle: string }>();
      if (!row || row.lifecycle === 'deleted') return json({ message: 'Mail not found' }, 404);
      const changed = await bindings.DB.prepare(
        `UPDATE ${prefix}_messages SET lifecycle='deleting',state='expired',revision=revision+1,updated_at=? WHERE id=? AND lifecycle IN ('live','deleting') AND lease_expires_at<=? AND (accepted_at IS NULL OR state IN ('delivered','rejected','expired'))`,
      )
        .bind(now, id, Date.now())
        .run();
      if (!changed.meta.changes)
        return json({ message: 'Mail delivery is in progress; retry after reconciliation' }, 409);
      const chunks = await bindings.DB.prepare(`SELECT object_key FROM ${prefix}_chunks WHERE message_id=?`)
        .bind(id)
        .all<{ object_key: string }>();
      for (let i = 0; i < chunks.results.length; i += 100)
        await bindings.BLOBS.delete(chunks.results.slice(i, i + 100).map((x) => x.object_key));
      const statements = [
        bindings.DB.prepare(`DELETE FROM ${prefix}_chunks WHERE message_id=?`).bind(id),
        bindings.DB.prepare(
          `UPDATE ${prefix}_messages SET lifecycle='deleted' WHERE id=? AND lifecycle='deleting'`,
        ).bind(id),
      ];
      if (kind === 'dmp')
        statements.push(
          bindings.DB.prepare("DELETE FROM dmp_wallet_lanes WHERE message_id=? AND lane='payer'").bind(id),
        );
      await bindings.DB.batch(statements);
      return json({ message: 'Mail deleted successfully' });
    }
    return json({ message: 'Method not allowed' }, 405);
  } catch {
    return json({ message: 'Storage request unavailable' }, 503);
  }
}
