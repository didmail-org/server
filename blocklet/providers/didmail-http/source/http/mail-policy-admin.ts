import { uuid, canonicalize } from '@didmail/protocol';
import { bindings, value } from '../runtime/bindings';
import { readMembersAdmin } from './members-admin';
import { readArcSession } from '../identity/session';
import { readProtocolBody } from '../identity/protocol-request';
import { afsPolicyEnabled, policyOperation, readAfsPolicy, recoverAfsAdmissions } from '../storage/afs-mail-policy';
import {
  admissionError,
  canonicalMailDid,
  readMailPolicy,
  validatePolicy,
} from '../policy/mail-admission';

const respond = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
function kindOf(value: unknown): 'allow' | 'deny' {
  if (value !== 'allow' && value !== 'deny')
    return admissionError(400, 'INVALID_ACCESS_LIST', 'kind must be allow or deny');
  return value;
}
export async function handleMailPolicyAdmin(request: Request): Promise<Response> {
  try {
    let session: Awaited<ReturnType<typeof readArcSession>>;
    try {
      session = await readArcSession({ headers: Object.fromEntries(request.headers) });
    } catch {
      return admissionError(503, 'ADMIN_IDENTITY_UNAVAILABLE', 'ARC session could not be verified');
    }
    if (!session.authenticated || !session.user)
      return admissionError(401, 'ADMIN_AUTHENTICATION_REQUIRED', 'ARC login required');
    if (!['owner', 'admin'].includes(session.user.role))
      return admissionError(403, 'ADMIN_ROLE_REQUIRED', 'Administrator role required');
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (
      mutation &&
      request.headers.has('cookie') &&
      request.headers.get('origin') !== new URL(value('DIDMAIL_URL')).origin
    )
      return admissionError(403, 'INVALID_ORIGIN', 'Same-origin request required for cookie authentication');
    const url = new URL(request.url),
      isPolicy = url.pathname === '/api/admin/mail-policy';
    if (afsPolicyEnabled()) await recoverAfsAdmissions();
    if (url.pathname === '/api/admin/members') {
      if (request.method !== 'GET') return respond({code:'METHOD_NOT_ALLOWED'},405);
      return await readMembersAdmin(request);
    }
    if (afsPolicyEnabled() && url.pathname !== '/api/admin/mail-health') {
      const actor = { did: session.user.did, role: session.user.role };
      if (request.method === 'GET') {
        if (isPolicy) { const state = await readAfsPolicy(); return respond({ revision: state.revision, policy: state.policy, updatedAt: state.updatedAt, updatedBy: state.updatedBy, accessSource: state.accessSource }); }
        return respond(await policyOperation('list', { actor, args: { kind: kindOf(url.searchParams.get('kind')), after: url.searchParams.get('after') || '', limit: Number(url.searchParams.get('limit') || 50) } }));
      }
      if (!(request.method === 'PUT' || (!isPolicy && request.method === 'DELETE'))) return respond({ code: 'METHOD_NOT_ALLOWED' }, 405);
      const body = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readProtocolBody(request, 16 * 1024)));
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.hasOwn(body, 'type')) admissionError(400, 'INVALID_MAIL_POLICY', 'Unexpected request fields');
      if (!isPolicy) canonicalMailDid(body.did);
      return respond(await policyOperation('edit', { actor, args: { ...body, type: isPolicy ? 'policy' : request.method === 'PUT' ? 'put' : 'delete' } }));
    }
    if (request.method === 'GET') {
      const snapshot = await readMailPolicy();
      if (isPolicy) return respond({...snapshot,accessSource:value('DIDMAIL_MEMBER_ACCESS')==='arc'?'arc':'legacy'});
      if(url.pathname==='/api/admin/mail-health'){
        const queues=await bindings.DB.prepare("SELECT state,count(*) AS count,min(accepted_at) AS oldestAcceptedAt FROM dmp_messages WHERE lifecycle='live' GROUP BY state").all();
        const attention=await bindings.DB.prepare("SELECT id AS messageId,state,updated_at AS updatedAt,last_problem_json AS problem,payment_hash AS paymentTransactionId,index_hash AS notificationTransactionId FROM dmp_messages WHERE lifecycle='live' AND (state='reconciliation_required' OR last_problem_json IS NOT NULL) ORDER BY updated_at LIMIT 50").all();
        return respond({queues:queues.results,attention:attention.results.map(row=>({...row,problem:row.problem?JSON.parse(String(row.problem)):null})),observedAt:new Date().toISOString()});
      }
      const kind = kindOf(url.searchParams.get('kind')),
        after = url.searchParams.get('after') || '';
      const limit = Number(url.searchParams.get('limit') || 50);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        return admissionError(400, 'INVALID_PAGINATION', 'limit must be 1..100');
      if (after) canonicalMailDid(after);
      const rows = await bindings.DB.prepare(
        'SELECT did,remark,created_at AS createdAt,created_by AS createdBy FROM mail_access_entries WHERE kind=? AND did>? ORDER BY did LIMIT ?',
      )
        .bind(kind, after, limit + 1)
        .all<{ did: string; remark: string; createdAt: string; createdBy: string }>();
      const entries = rows.results.slice(0, limit);
      return respond({
        revision: snapshot.revision,
        kind,
        entries,
        nextCursor: rows.results.length > limit ? entries[entries.length - 1].did : null,
      });
    }
    if(url.pathname==='/api/admin/mail-health')return respond({code:'METHOD_NOT_ALLOWED'},405);
    if (!(request.method === 'PUT' || (!isPolicy && request.method === 'DELETE')))
      return respond({ code: 'METHOD_NOT_ALLOWED' }, 405);
    const body = JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readProtocolBody(request, 16 * 1024)),
    );
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !Number.isSafeInteger(body.expectedRevision) ||
      body.expectedRevision < 1
    )
      return admissionError(400, 'INVALID_REVISION', 'A positive expectedRevision is required');
    const expectedFields = isPolicy
      ? ['expectedRevision', 'policy']
      : request.method === 'PUT'
        ? ['expectedRevision', 'kind', 'did', 'remark']
        : ['expectedRevision', 'kind', 'did'];
    if (Object.keys(body).sort().join(',') !== expectedFields.sort().join(','))
      return admissionError(400, 'INVALID_MAIL_POLICY', 'Unexpected request fields');
    if (isPolicy) {
      validatePolicy(body.policy);
      if (value('DIDMAIL_MEMBER_ACCESS') === 'arc' && body.policy.accessMode !== (await readMailPolicy()).policy.accessMode)
        admissionError(409,'ACCESS_MANAGED_BY_NODE_NFT','Sending access is determined by the service node NFT stake');
      if (body.policy.ordinary.enabled)
        admissionError(409, 'INVALID_MAIL_POLICY', 'VC mail has been removed');

    }
    if (!isPolicy && body.kind === 'allow' && value('DIDMAIL_MEMBER_ACCESS') === 'arc') return admissionError(409, 'ARC_MEMBERS_MANAGED', 'Manage members and invitations in ARC');
    const kind = isPolicy ? null : kindOf(body.kind),
      did = isPolicy ? null : canonicalMailDid(body.did);
    if (!isPolicy && request.method === 'PUT' && (typeof body.remark !== 'string' || body.remark.length > 500))
      return admissionError(400, 'INVALID_REMARK', 'Remark must be a string of at most 500 characters');
    const actor = session.user.did,
      now = new Date().toISOString(),
      mutationId = uuid();
    const write = isPolicy
      ? bindings.DB.prepare(
          'UPDATE mail_service_policy SET policy_json=?,revision=revision+1,updated_at=?,updated_by=?,mutation_id=? WHERE id=1 AND revision=?',
        ).bind(canonicalize(body.policy), now, actor, mutationId, body.expectedRevision)
      : bindings.DB.prepare(
          'UPDATE mail_service_policy SET revision=revision+1,updated_at=?,updated_by=?,mutation_id=? WHERE id=1 AND revision=?',
        ).bind(now, actor, mutationId, body.expectedRevision);
    const commands = [write];
    if (!isPolicy)
      commands.push(
        request.method === 'PUT'
          ? bindings.DB.prepare(
              'INSERT INTO mail_access_entries(kind,did,remark,created_at,created_by) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mail_service_policy WHERE id=1 AND mutation_id=?) ON CONFLICT(kind,did) DO UPDATE SET remark=excluded.remark',
            ).bind(kind, did, body.remark, now, actor, mutationId)
          : bindings.DB.prepare(
              'DELETE FROM mail_access_entries WHERE kind=? AND did=? AND EXISTS(SELECT 1 FROM mail_service_policy WHERE id=1 AND mutation_id=?)',
            ).bind(kind, did, mutationId),
      );
    commands.push(
      bindings.DB.prepare(
        'INSERT INTO mail_policy_audit(revision,actor,action,target,created_at) SELECT revision,?,?,?,? FROM mail_service_policy WHERE id=1 AND mutation_id=?',
      ).bind(
        actor,
        isPolicy ? 'policy.update' : 'list.' + request.method.toLowerCase(),
        isPolicy ? null : kind + ':' + did,
        now,
        mutationId,
      ),
    );
    const results = await bindings.DB.batch(commands);
    if (!results[0].meta.changes)
      return admissionError(409, 'MAIL_POLICY_CONFLICT', 'Policy changed; reload before editing', 'refresh_policy');
    return respond({ revision: body.expectedRevision + 1 });
  } catch (error) {
    const e = error as Error & { status?: number; code?: string; recoveryAction?: string };
    return respond(
      {
        code: e.code || 'INVALID_REQUEST',
        detail: e.status && e.status < 500 ? e.message : 'Mail policy request could not be completed',
        recoveryAction: e.recoveryAction || 'none',
      },
      e.status || (error instanceof SyntaxError ? 400 : 503),
    );
  }
}
