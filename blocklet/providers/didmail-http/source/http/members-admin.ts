import { identityId } from '@didmail/protocol';
import { bindings, value } from '../runtime/bindings';
import { accountLinksEnabled } from '../identity/arc-members';
import { admissionError } from '../policy/mail-admission';

// Called only after the shared owner/admin session gate. No membership or link mutation.
export async function readMembersAdmin(request: Request): Promise<Response> {
  if (!accountLinksEnabled()) return admissionError(503, 'MEMBERSHIP_UNAVAILABLE', 'ARC member service is unavailable');
  const url = new URL(request.url);
  if (
    [...url.searchParams.keys()].some((key) => !['page', 'search', 'role', 'active'].includes(key)) ||
    [...url.searchParams.keys()].length !== new Set(url.searchParams.keys()).size
  )
    return admissionError(400, 'INVALID_MEMBER_QUERY', 'Invalid member query');
  const page = Number(url.searchParams.get('page') || 1),
    search = url.searchParams.get('search') || '';
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || search.length > 100 || Array.from(search).some(character => character.charCodeAt(0) < 32))
    return admissionError(400, 'INVALID_MEMBER_QUERY', 'Invalid member query');
  const role = url.searchParams.get('role') || '',
    active = url.searchParams.get('active') || '';
  if (
    (role && !['owner', 'admin', 'member', 'guest'].includes(role)) ||
    (active && !['active', 'inactive'].includes(active))
  )
    return admissionError(400, 'INVALID_MEMBER_QUERY', 'Invalid member query');
  const instanceId = value('DIDMAIL_ARC_INSTANCE_ID');
  const target = new URL('https://arc-members.internal/members');
  for (const [key, val] of Object.entries({ instanceId, page: String(page), search }))
    target.searchParams.set(key, val);
  if (role) target.searchParams.set('role', role);
  if (active) target.searchParams.set('active', active);
  const response = await bindings.ARC_MEMBERS!.fetch(
    new Request(target, { redirect: 'manual', signal: AbortSignal.timeout(5000) }),
  );
  if (!response.ok) return admissionError(503, 'MEMBERSHIP_UNAVAILABLE', 'ARC member service is unavailable');
  const raw = await response.text();
  if (raw.length > 32768) throw Error('Invalid member response');
  const result = JSON.parse(raw);
  if (
    result.instanceId !== instanceId ||
    result.page !== page ||
    result.pageSize !== 20 ||
    !Number.isSafeInteger(result.total) ||
    result.total < 0 ||
    !Array.isArray(result.members) ||
    result.members.length > 20 ||
    result.members.length > result.total
  )
    throw Error('Invalid member response');
  const seen = new Set<string>();
  const members: { did: string; name: string; role: string; active: boolean }[] = result.members.map(
    (m: { did: string; name: string; role: string; active: boolean }) => {
      if (
        identityId(m.did) !== m.did ||
        seen.has(m.did) ||
        typeof m.name !== 'string' ||
        m.name.length > 200 ||
        !['owner', 'admin', 'member', 'guest'].includes(m.role) ||
        typeof m.active !== 'boolean'
      )
        throw Error('Invalid member');
      if ((role && m.role !== role) || (active && m.active !== (active === 'active')))
        throw Error('Member filter was not applied');
      seen.add(m.did);
      return { did: m.did, name: m.name, role: m.role, active: m.active };
    },
  );
  const links = members.length
    ? await bindings.DB.prepare(
        `SELECT arc_id,mailbox_id,revision,revoked,updated_at FROM account_links WHERE arc_id IN (${members.map(() => '?').join(',')})`,
      )
        .bind(...members.map((m) => m.did))
        .all<{ arc_id: string; mailbox_id: string; revision: number; revoked: number; updated_at: string }>()
    : { results: [] };
  return Response.json(
    {
      page,
      pageSize: 20,
      total: result.total,
      members: members.map((m) => {
        const link = links.results.find((row) => row.arc_id === m.did);
        return {
          ...m,
          binding: link
            ? {
                mailboxId: link.mailbox_id,
                revision: link.revision,
                revoked: !!link.revoked,
                updatedAt: link.updated_at,
              }
            : null,
        };
      }),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
