import {
  accountOrigin,
  accountPkceChallenge,
  b64u,
  unb64u,
  canonicalize,
  parseCanonical,
  utf8,
  digest,
  isUuid,
  randomBytes,
  identityId,
  expectKeys,
  validateAccountLinkStatement,
  verifyAccountLink,
  validateAccountRecoveryCapsule,
  type AccountLinkStatement,
  type AccountLinkProof,
  type AccountRecoveryCapsule,
} from '@didmail/protocol';
import { bindings, value } from '../runtime/bindings';
import { authenticateProtocolRequest, readProtocolBody } from '../identity/protocol-request';
import { identityMatches } from '../protocol/dmp-settlement';
import wallet from '../identity/wallet';
import { activeArcMember, accountLinksEnabled } from '../identity/arc-members';
import { readArcSession } from '../identity/session';
import { admissionError as fail } from '../policy/mail-admission';
import { rateLimit } from '../runtime/rate-limit';
interface Link {
  arc_id: string;
  mailbox_id: string;
  mailbox_public_key: string;
  revision: number;
  revoked: number;
  capsule_json: string | null;
  capsule_digest: string | null;
}
interface Intent {
  id: string;
  client_id: string;
  client_public_key: string;
  operation: 'link' | 'recover' | 'revoke';
  pkce_challenge: string;
  challenge: string;
  create_digest: string;
  expires_at: string;
  arc_id: string | null;
  csrf_digest: string | null;
  statement_json: string | null;
  completed_digest: string | null;
  result_json: string | null;
}
const origin = () => accountOrigin(value('DIDMAIL_ACCOUNT_ORIGIN'));
const serviceId = () => identityId(wallet().address);
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const html = (body: string, status = 200) =>
  new Response(
    '<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DIDMail 邮箱授权</title><style>body{font-family:system-ui,sans-serif;margin:0;background:#f5f7fb;color:#172033}main{box-sizing:border-box;max-width:42rem;margin:2rem auto;padding:1.5rem;background:white;border-radius:1rem;overflow-wrap:anywhere}p{line-height:1.6}strong{display:block;font-size:1.8rem;letter-spacing:.15rem}button,a{display:inline-block;padding:.8rem 1rem;border:0;border-radius:.5rem;background:#2459cf;color:white;font-size:1rem;text-decoration:none}button{cursor:pointer}</style><main><h1>DIDMail 邮箱授权</h1>' +
      body +
      '</main></html>',
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'referrer-policy': 'strict-origin',
        'x-frame-options': 'DENY',
        'content-security-policy':
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      },
    },
  );
async function getIntent(id: string): Promise<Intent> {
  if (!isUuid(id)) return fail(400, 'INVALID_INTENT', 'Invalid intent ID');
  const row = await bindings.DB.prepare('SELECT * FROM account_link_intents WHERE id=?').bind(id).first<Intent>();
  if (!row) return fail(404, 'INTENT_NOT_FOUND', 'Intent not found');
  if (Date.parse(row.expires_at) <= Date.now())
    return fail(410, 'INTENT_EXPIRED', 'Restart authorization with a new intent');
  return row;
}
async function getLink(arc: string) {
  return bindings.DB.prepare('SELECT * FROM account_links WHERE arc_id=?').bind(arc).first<Link>();
}
async function browserSession(request: Request) {
  let session;
  try {
    session = await readArcSession({ headers: Object.fromEntries(request.headers) });
  } catch {
    return fail(503, 'IDENTITY_UNAVAILABLE', 'ARC identity verification unavailable');
  }
  if (!session.authenticated || !session.user) return fail(401, 'ARC_LOGIN_REQUIRED', 'Sign in to ARC first');
  const did = identityId(session.user.did);
  return did;
}
async function browser(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.origin !== origin())
    return new Response(null, {
      status: 302,
      headers: {
        location: origin() + url.pathname + url.search,
        'cache-control': 'no-store',
        'referrer-policy': 'strict-origin',
      },
    });
  if (!['GET', 'POST'].includes(request.method)) return html('<p>不支持此操作。</p>', 405);
  let arc: string;
  try {
    arc = await browserSession(request);
  } catch (e) {
    if (e.code === 'ARC_LOGIN_REQUIRED' && request.method === 'GET')
      return html(
        `<p>先登录 ARC，再确认绑定邮箱。</p><a href="/.well-known/service/login?return_to=${encodeURIComponent(url.pathname + url.search)}">使用 ARC 登录</a>`,
      );
    throw e;
  }
  if (request.method === 'GET' && url.pathname === '/account/authorize') {
    const row = await getIntent(url.searchParams.get('id') || '');
    if (row.operation === 'link' && !(await activeArcMember(arc)))
      return fail(403, 'MEMBER_REQUIRED', 'Active membership required to link a mailbox');
    if (row.arc_id && row.arc_id !== arc)
      return fail(409, 'ARC_IDENTITY_CHANGED', 'This intent was approved by a different ARC account');
    if (row.statement_json) return html('<p>已经确认。请回到 DIDMail 客户端继续。</p>');
    const csrf = b64u(randomBytes(32));
    await bindings.DB.prepare(
      'UPDATE account_link_intents SET csrf_digest=?,arc_id=? WHERE id=? AND statement_json IS NULL',
    )
      .bind(digest(utf8(csrf)), arc, row.id)
      .run();
    return html(
      `<p>请求：${escapeHtml(row.operation)}。请核对客户端显示的验证码：</p><strong>${row.challenge.slice(0, 8)}</strong><p>邮箱/设备：${escapeHtml(row.client_id)}</p><p>批准只绑定身份。邮箱私钥保存在你的客户端。</p><form action="/account/approve" method="post"><input type="hidden" name="id" value="${row.id}"><input type="hidden" name="csrf" value="${csrf}"><button name="consent" value="yes">确认授权</button></form>`,
    );
  }
  if (request.method !== 'POST' || url.pathname !== '/account/approve') return html('<p>页面不存在。</p>', 404);
  if (
    request.headers.get('origin') !== origin() ||
    request.headers.get('content-type') !== 'application/x-www-form-urlencoded'
  )
    return fail(403, 'INVALID_ORIGIN', 'Same-origin form required');
  const fields = new URLSearchParams(new TextDecoder().decode(await readProtocolBody(request, 4096)));
  if ([...fields.keys()].sort().join(',') !== 'consent,csrf,id' || fields.get('consent') !== 'yes')
    return fail(400, 'CONSENT_REQUIRED', 'Explicit consent required');
  const row = await getIntent(fields.get('id') || '');
  if (row.operation === 'link' && !(await activeArcMember(arc)))
    return fail(403, 'MEMBER_REQUIRED', 'Active membership required to link a mailbox');
  if (row.arc_id !== arc || !row.csrf_digest || row.csrf_digest !== digest(utf8(fields.get('csrf') || '')))
    return fail(403, 'CSRF_FAILED', 'Authorization form expired or identity changed');
  if (row.statement_json) return html('<p>已经确认。请回到客户端。</p>');
  const link = await getLink(arc);
  if (
    row.operation === 'link' &&
    link &&
    (link.mailbox_id !== row.client_id || link.mailbox_public_key !== row.client_public_key)
  )
    return fail(409, 'MAILBOX_EXISTS', 'Restore the existing mailbox instead of creating another');
  if (
    row.operation !== 'link' &&
    (!link || link.revoked || (row.operation === 'revoke' && link.mailbox_id !== row.client_id))
  )
    return fail(409, 'MAILBOX_UNAVAILABLE', 'No matching active mailbox');
  if (row.operation === 'recover' && !link?.capsule_json)
    return fail(409, 'BACKUP_UNAVAILABLE', 'Use an offline backup or your original device');
  const statement: AccountLinkStatement = {
    version: 1,
    operation: row.operation,
    intentId: row.id,
    challenge: row.challenge,
    origin: origin(),
    serviceId: serviceId(),
    clientId: row.client_id,
    clientPublicKey: row.client_public_key,
    arcId: arc,
    mailboxId: link?.mailbox_id || row.client_id,
    mailboxPublicKey: link?.mailbox_public_key || row.client_public_key,
    pkceChallenge: row.pkce_challenge,
    expiresAt: row.expires_at,
    revision: link?.revision || 0,
    recoveryDigest: link?.capsule_digest || null,
  };
  validateAccountLinkStatement(statement, identityMatches);
  const result = await bindings.DB.prepare(
    'UPDATE account_link_intents SET statement_json=? WHERE id=? AND statement_json IS NULL AND arc_id=? AND csrf_digest=?',
  )
    .bind(canonicalize(statement), row.id, arc, row.csrf_digest)
    .run();
  if (!result.meta.changes) return fail(409, 'INTENT_CHANGED', 'Restart authorization');
  return html('<p>授权已确认。请回到 DIDMail 客户端完成操作。</p>');
}
async function complete(
  row: Intent,
  body: { verifier: string; proof: AccountLinkProof | null; capsule: AccountRecoveryCapsule | null },
) {
  if (!row.statement_json) return fail(409, 'AUTHORIZATION_PENDING', 'Approve in ARC first');
  const statement = JSON.parse(row.statement_json) as AccountLinkStatement;
  const fingerprint = digest(utf8(canonicalize(body)));
  const link = await getLink(statement.arcId);
  if (row.result_json) {
    if (row.completed_digest !== fingerprint) return fail(409, 'INTENT_CONFLICT', 'Completion payload changed');
    const result = JSON.parse(row.result_json);
    if (!link || link.revision !== result.revision || (link.revoked && row.operation !== 'revoke'))
      return fail(409, 'BINDING_CHANGED', 'Binding changed after completion');
    return result;
  }
  if ((link?.revision || 0) !== statement.revision)
    return fail(409, 'BINDING_CHANGED', 'Binding or backup changed after authorization');
  if (row.operation === 'link' && !(await activeArcMember(statement.arcId)))
    return fail(403, 'MEMBER_REQUIRED', 'Active membership required');
  if (row.operation === 'recover') {
    if (
      body.proof !== null ||
      body.capsule !== null ||
      !link ||
      link.revoked ||
      link.capsule_digest !== statement.recoveryDigest ||
      !link.capsule_json
    )
      return fail(409, 'BACKUP_CHANGED', 'Backup no longer matches authorization');
    const result = {
      mailboxId: link.mailbox_id,
      revision: link.revision,
      revoked: false,
      capsule: JSON.parse(link.capsule_json),
    };
    await bindings.DB.prepare(
      'UPDATE account_link_intents SET completed_digest=?,result_json=? WHERE id=? AND result_json IS NULL AND EXISTS(SELECT 1 FROM account_links WHERE arc_id=? AND revision=? AND revoked=0)',
    )
      .bind(fingerprint, canonicalize(result), row.id, statement.arcId, statement.revision)
      .run();
    const saved = await getIntent(row.id);
    if (saved.completed_digest !== fingerprint) return fail(409, 'BINDING_CHANGED', 'Binding changed');
    return result;
  }
  if (!body.proof || !verifyAccountLink(body.proof, identityMatches))
    return fail(403, 'INVALID_LINK_PROOF', 'Mailbox signature required');
  const { proof: _, ...signedStatement } = body.proof;
  if (canonicalize(signedStatement) !== row.statement_json)
    return fail(403, 'STATEMENT_MISMATCH', 'Proof differs from approved identities');
  if (body.capsule !== null) {
    validateAccountRecoveryCapsule(body.capsule);
    if (body.capsule.mailboxId !== statement.mailboxId || row.operation !== 'link')
      return fail(400, 'INVALID_CAPSULE', 'Capsule mailbox mismatch');
  }
  // Reactivation preserves the existing capsule unless an explicitly signed replacement is provided.
  const capsule = body.capsule ? canonicalize(body.capsule) : link?.capsule_json || null;
  const revoked = row.operation === 'revoke' ? 1 : 0,
    revision = statement.revision + 1,
    now = new Date().toISOString();
  const result = { mailboxId: statement.mailboxId, revision, revoked: !!revoked, capsule: null };
  const proofJson = canonicalize(body.proof);
  await bindings.DB.batch([
    bindings.DB.prepare(
      `INSERT OR IGNORE INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,revoked,capsule_json,capsule_digest,proof_json,created_at,updated_at) SELECT ?,?,?,1,0,?,?,?,?,? WHERE ?=0 AND EXISTS(SELECT 1 FROM account_link_intents WHERE id=? AND result_json IS NULL)`,
    ).bind(
      statement.arcId,
      statement.mailboxId,
      statement.mailboxPublicKey,
      capsule,
      capsule ? digest(utf8(capsule)) : null,
      proofJson,
      now,
      now,
      statement.revision,
      row.id,
    ),
    bindings.DB.prepare(
      `UPDATE account_links SET revision=revision+1,revoked=?,capsule_json=?,capsule_digest=?,proof_json=?,updated_at=? WHERE arc_id=? AND mailbox_id=? AND mailbox_public_key=? AND revision=? AND ?>0 AND EXISTS(SELECT 1 FROM account_link_intents WHERE id=? AND result_json IS NULL)`,
    ).bind(
      revoked,
      revoked ? null : capsule,
      revoked || !capsule ? null : digest(utf8(capsule)),
      proofJson,
      now,
      statement.arcId,
      statement.mailboxId,
      statement.mailboxPublicKey,
      statement.revision,
      statement.revision,
      row.id,
    ),
    bindings.DB.prepare(
      `UPDATE account_link_intents SET completed_digest=?,result_json=? WHERE id=? AND result_json IS NULL AND EXISTS(SELECT 1 FROM account_links WHERE arc_id=? AND mailbox_id=? AND revision=? AND proof_json=?)`,
    ).bind(fingerprint, canonicalize(result), row.id, statement.arcId, statement.mailboxId, revision, proofJson),
  ]);
  const saved = await getIntent(row.id);
  if (saved.completed_digest !== fingerprint)
    return fail(409, 'BINDING_CONFLICT', 'This ARC identity or mailbox already has a different binding');
  return JSON.parse(saved.result_json!);
}
export async function handleAccountLinks(request: Request): Promise<Response> {
  const url = new URL(request.url),
    browserRoute = url.pathname.startsWith('/account/');
  try {
    if (url.pathname === '/v1/account-links/capabilities' && request.method === 'GET')
      return json({
        version: 1,
        enabled: accountLinksEnabled(),
        authorizationOrigin: accountLinksEnabled() ? origin() : null,
      });
    if (!accountLinksEnabled())
      return fail(503, 'MEMBERSHIP_UNAVAILABLE', 'Authoritative ARC active-member source is not configured');
    if (!(await rateLimit('account:ip:' + (request.headers.get('cf-connecting-ip') || 'local'), 120, 60000)))
      return fail(429, 'RATE_LIMITED', 'Try later');
    if (browserRoute) return await browser(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (!['POST', 'PUT'].includes(request.method)) return fail(405, 'METHOD_NOT_ALLOWED', 'Method not supported');
    if (request.headers.get('content-type') !== 'application/json')
      return fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Canonical JSON required');
    const { auth, bytes } = await authenticateProtocolRequest(request, 140000, identityMatches);
    const body = parseCanonical(bytes) as Record<string, unknown>;
    if (url.pathname === '/v1/account-links/binding' && request.method === 'POST') {
      expectKeys(body, []);
      const row = await bindings.DB.prepare('SELECT revision,revoked FROM account_links WHERE mailbox_id=?')
        .bind(auth.identityId).first<{ revision:number; revoked:number }>();
      return json({ mailboxId:auth.identityId, linked:Boolean(row && !row.revoked), revision:row?.revision || 0, revoked:Boolean(row?.revoked) });
    }
    if (url.pathname === '/v1/account-links/intents' && request.method === 'POST') {
      expectKeys(body, ['intentId', 'operation', 'pkceChallenge']);
      if (!isUuid(body.intentId) || !['link', 'recover', 'revoke'].includes(String(body.operation)))
        return fail(400, 'INVALID_INTENT', 'Invalid intent');
      unb64u(body.pkceChallenge as string, 32);
      const fingerprint = digest(bytes),
        challenge = b64u(randomBytes(32)),
        expires = new Date(Date.now() + 600000).toISOString();
      if (!(await bindings.DB.prepare('SELECT id FROM account_link_intents WHERE id=?').bind(body.intentId).first())) {
        const pending = await bindings.DB.prepare(
          'SELECT count(*) AS n FROM account_link_intents WHERE client_id=? AND expires_at>?',
        )
          .bind(auth.identityId, new Date().toISOString())
          .first<{ n: number }>();
        if ((pending?.n || 0) >= 8) return fail(429, 'TOO_MANY_INTENTS', 'Finish or wait for existing intents');
      }
      await bindings.DB.prepare(
        'INSERT OR IGNORE INTO account_link_intents(id,client_id,client_public_key,operation,pkce_challenge,challenge,create_digest,expires_at) VALUES(?,?,?,?,?,?,?,?)',
      )
        .bind(
          body.intentId,
          auth.identityId,
          b64u(auth.publicKey),
          body.operation,
          body.pkceChallenge,
          challenge,
          fingerprint,
          expires,
        )
        .run();
      const row = await getIntent(body.intentId);
      if (
        row.client_id !== auth.identityId ||
        row.client_public_key !== b64u(auth.publicKey) ||
        row.create_digest !== fingerprint
      )
        return fail(409, 'INTENT_CONFLICT', 'Intent ID already used');
      return json({
        intentId: row.id,
        authorizationUrl: origin() + '/account/authorize?id=' + row.id,
        expiresAt: row.expires_at,
        displayCode: row.challenge.slice(0, 8),
      });
    }
    if (url.pathname === '/v1/account-links/backup' && request.method === 'PUT') {
      expectKeys(body, ['expectedRevision', 'capsule']);
      if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 1)
        return fail(400, 'INVALID_REVISION', 'Expected revision required');
      if (body.capsule !== null) {
        validateAccountRecoveryCapsule(body.capsule);
        if (body.capsule.mailboxId !== auth.identityId) return fail(400, 'INVALID_CAPSULE', 'Mailbox mismatch');
      }
      const encoded = body.capsule === null ? null : canonicalize(body.capsule);
      const row = await bindings.DB.prepare(
        'UPDATE account_links SET capsule_json=?,capsule_digest=?,revision=revision+1,updated_at=? WHERE mailbox_id=? AND mailbox_public_key=? AND revoked=0 AND revision=? RETURNING revision',
      )
        .bind(
          encoded,
          encoded ? digest(utf8(encoded)) : null,
          new Date().toISOString(),
          auth.identityId,
          b64u(auth.publicKey),
          body.expectedRevision,
        )
        .first<{ revision: number }>();
      if (!row) return fail(409, 'BINDING_CHANGED', 'Active binding revision mismatch');
      return json({ mailboxId: auth.identityId, revision: row.revision });
    }
    const match = /^\/v1\/account-links\/intents\/([a-f0-9-]+)\/(status|complete)$/.exec(url.pathname);
    if (!match || request.method !== 'POST') return fail(404, 'RESOURCE_NOT_FOUND', 'Account link resource not found');
    expectKeys(body, match[2] === 'status' ? ['verifier'] : ['verifier', 'proof', 'capsule']);
    const row = await getIntent(match[1]);
    if (
      row.client_id !== auth.identityId ||
      row.client_public_key !== b64u(auth.publicKey) ||
      accountPkceChallenge(body.verifier as string) !== row.pkce_challenge
    )
      return fail(403, 'INVALID_CLIENT', 'Intent client or PKCE mismatch');
    if (match[2] === 'status')
      return json(
        row.statement_json ? { status: 'approved', statement: JSON.parse(row.statement_json) } : { status: 'pending' },
      );
    return json(await complete(row, body as unknown as Parameters<typeof complete>[1]));
  } catch (error) {
    const status = error.status || 400,
      code = error.code || 'INVALID_ACCOUNT_REQUEST';
    // Never log request bodies, ARC credentials, verifier, capsule or secrets.
    const messages: Record<string, string> = {
      MEMBER_REQUIRED: '请使用已接受邀请的活跃非访客成员账户登录 ARC；恢复已有邮箱请在客户端选择恢复。',
      MAILBOX_EXISTS: '此 ARC 账户已绑定邮箱，请回到客户端选择恢复原邮箱。',
      MEMBERSHIP_UNAVAILABLE: '节点暂时不能核验成员状态，请稍后重试或联系管理员。',
      BACKUP_UNAVAILABLE: '节点没有可用的恢复文件，请使用原设备或离线备份。',
      CSRF_FAILED: '授权页面已过期或登录账户发生变化，请从客户端重新打开。',
      BINDING_CHANGED: '邮箱绑定或备份已更新，请从客户端重新授权。',
      INTENT_EXPIRED: '授权已过期，请从客户端重新发起。',
    };
    return browserRoute
      ? html('<p>' + escapeHtml(Object.hasOwn(messages,code)?messages[code]:'无法完成授权，请回到客户端重试。') + '</p>', status)
      : json({ code, status, detail: status >= 500 ? 'Account service unavailable' : code }, status);
  }
}
