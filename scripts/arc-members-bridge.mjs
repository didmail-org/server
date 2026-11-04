import { addressOf, identityId } from '@didmail/protocol';
import { arcHttpTransport } from './arc-http-transport.mjs';
const roles = new Set(['owner', 'admin', 'member', 'guest']);
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
async function json(response) {
  if (!response.ok || !response.body) throw Error('Unavailable member source');
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) throw Error('Oversized member source');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const value of chunks) {
    bytes.set(value, offset);
    offset += value.length;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
/** Private read-only binding. The scoped console list supplies the instance
 * role and approved state in one lookup. Operator-provisioned token
 * stays in this closure and is never received from the browser or forwarded.
 */
export default function createMembersForward({ origin, publicOrigin, instanceId, namespace, token, fetcher }) {
  const source = new URL(origin);
  if (
    source.username ||
    source.password ||
    source.search ||
    source.hash ||
    source.pathname !== '/' ||
    !(
      source.protocol === 'https:' ||
      (source.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(source.hostname))
    ) ||
    typeof instanceId !== 'string' ||
    !instanceId ||
    instanceId.length > 256 ||
    typeof namespace !== 'string' ||
    !/^[a-z][a-z0-9-]{0,63}$/.test(namespace) ||
    typeof token !== 'string' ||
    !token ||
    token.length > 4096 ||
    /[\r\n]/.test(token)
  )
    throw Error('Invalid ARC members bridge configuration');
  const transport = arcHttpTransport(origin, publicOrigin);
  fetcher ||= transport;
  const headers = { accept: 'application/json', authorization: 'Bearer ' + token };
  return async (request) => {
    const incoming = new URL(request.url);
    if (incoming.pathname === '/members') {
      if (
        request.method !== 'GET' ||
        incoming.origin !== 'https://arc-members.internal' ||
        [...incoming.searchParams.keys()].some(
          (key) => !['instanceId', 'page', 'search', 'role', 'active'].includes(key),
        ) ||
        [...incoming.searchParams.keys()].length !== new Set(incoming.searchParams.keys()).size ||
        !['instanceId', 'page', 'search'].every((key) => incoming.searchParams.has(key)) ||
        incoming.searchParams.get('instanceId') !== instanceId
      )
        return reply({ code: 'MEMBERS_SOURCE_FORBIDDEN' }, 403);
      const page = Number(incoming.searchParams.get('page'));
      const search = incoming.searchParams.get('search') || '';
      const role = incoming.searchParams.get('role') || '';
      const active = incoming.searchParams.get('active') || '';
      if ((role && !roles.has(role)) || (active && !['active', 'inactive'].includes(active)))
        return reply({ code: 'INVALID_MEMBER_QUERY' }, 400);
      if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || search.length > 100 || /[\x00-\x1f]/.test(search))
        return reply({ code: 'INVALID_MEMBER_QUERY' }, 400);
      try {
        const target = new URL('/.well-known/service/api/team/members', source);
        for (const [key, val] of Object.entries({
          instance: instanceId,
          blocklet: namespace,
          page: String(page),
          pageSize: '20',
          search,
        }))
          target.searchParams.set(key, val);
        if (role) target.searchParams.set('role', role);
        if (active) target.searchParams.set('approved', active === 'active' ? '1' : '0');
        const data = await json(
          await fetcher(target, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(10000) }),
        );
        if (
          data.ok !== true ||
          data.aggregated === true ||
          !Array.isArray(data.users) ||
          data.users.length > 20 ||
          !Number.isSafeInteger(data.paging?.total) ||
          data.paging.total < 0 ||
          data.users.length > data.paging.total
        )
          throw Error('Invalid member list');
        const seen = new Set();
        const members = data.users.map((user) => {
          const did = identityId(user.did);
          if (
            user.instance_did !== instanceId ||
            !roles.has(user.role) ||
            ![true, false, 0, 1].includes(user.approved) ||
            seen.has(did)
          )
            throw Error('Invalid scoped member');
          seen.add(did);
          if (
            (role && user.role !== role) ||
            (active && (user.approved === true || user.approved === 1) !== (active === 'active'))
          )
            throw Error('Member filter was not applied');
          const name = user.fullName || user.name || user.username || '';
          return {
            did,
            name: typeof name === 'string' ? name.slice(0, 200) : '',
            role: user.role,
            active: user.approved === true || user.approved === 1,
          };
        });
        return reply({ instanceId, members, page, pageSize: 20, total: data.paging.total });
      } catch {
        return reply({ code: 'MEMBERSHIP_UNAVAILABLE' }, 503);
      }
    }
    if (
      request.method !== 'GET' ||
      incoming.origin !== 'https://arc-members.internal' ||
      incoming.pathname !== '/member' ||
      [...incoming.searchParams.keys()].sort().join(',') !== 'did,instanceId' ||
      incoming.searchParams.get('instanceId') !== instanceId
    )
      return reply({ code: 'MEMBERS_SOURCE_FORBIDDEN' }, 403);
    const did = incoming.searchParams.get('did');
    let raw;
    try {
      raw = addressOf(did);
    } catch {
      return reply({ code: 'INVALID_MEMBER_DID' }, 400);
    }
    try {
      const detail = new URL('/.well-known/service/api/team/members', source);
      detail.searchParams.set('instance', instanceId);
      detail.searchParams.set('search', raw);
      detail.searchParams.set('page', '1');
      detail.searchParams.set('pageSize', '2');
      detail.searchParams.set('blocklet', namespace);
      const data = await json(
        await fetcher(detail, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(10000) }),
      );
      if (
        data.ok === true &&
        data.aggregated !== true &&
        Array.isArray(data.users) &&
        data.users.length === 0 &&
        data.paging?.total === 0
      )
        return reply({ code: 'MEMBER_NOT_FOUND' }, 404);
      const user =
        data.aggregated !== true &&
        data.ok === true &&
        Array.isArray(data.users) &&
        data.users.length === 1 &&
        data.paging?.total === 1 &&
        data.users[0];
      if (
        !user ||
        typeof user.did !== 'string' ||
        identityId(user.did) !== did ||
        ![true, false, 0, 1].includes(user.approved) ||
        !roles.has(user.role) ||
        user.instance_did !== instanceId
      )
        throw Error('Invalid approved state');
      return reply({ instanceId, did, role: user.role, active: user.approved === true || user.approved === 1 });
    } catch {
      return reply({ code: 'MEMBERSHIP_UNAVAILABLE' }, 503);
    }
  };
}
