import type { FetchPort } from '../runtime/contracts';
import { uuid } from '@didmail/protocol';
import { bindings, value } from '../runtime/bindings';
import { recoverAdmissions } from '../../../didmail-native/recover.mjs';
export const afsPolicyEnabled = () => value('DIDMAIL_POLICY_BACKEND') === 'afs';
export type AfsPolicyState = {
  revision: number; policy: any; updatedAt: string; updatedBy: string; accessSource: string;
  entries: { kind: string; did: string; remark: string; createdAt: string; createdBy: string }[];
  admissions: Record<string, { revision: number; startedAt: string }>;
};
export async function policyOperation(op: string, args: Record<string, unknown> = {}): Promise<any> {
  const binding = bindings.ARC_MAIL_POLICY as FetchPort | undefined;
  if (!binding) throw Object.assign(new Error('Instance policy binding is unavailable'), { status: 503, code: 'MAIL_POLICY_UNAVAILABLE' });
  const response = await binding.fetch(new Request('http://arc-policy.internal/policy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...args, op }) }));
  const body = await response.json() as { data?: unknown; code?: string; detail?: string };
  if (!response.ok) throw Object.assign(new Error(body.detail || 'Instance policy unavailable'), { status: response.status, code: body.code || 'MAIL_POLICY_UNAVAILABLE', recoveryAction: 'refresh_policy' });
  return body.data;
}
export async function readAfsPolicy(): Promise<AfsPolicyState> {
  const state = await policyOperation('read') as AfsPolicyState;
  if (state.accessSource !== (value('DIDMAIL_MEMBER_ACCESS') === 'arc' ? 'arc' : 'legacy'))
    throw Object.assign(new Error('ARC policy access mode does not match this runtime'), { code: 'MAIL_POLICY_UNAVAILABLE', status: 503 });
  return state;
}
export const closeAdmissionFence = (token: string, revision: number) => bindings.DB.prepare(
  'INSERT INTO didmail_admission_fences(token,policy_revision,open) VALUES(?,?,0) ON CONFLICT(token) DO UPDATE SET open=0',
).bind(token, revision).run();

export async function recoverAfsAdmissions(now = Date.now()) {
  await recoverAdmissions({ read: readAfsPolicy, revoke: closeAdmissionFence, release: token => policyOperation('end', { token }) }, now);
}
export async function withAfsAdmission<T>(snapshot: { revision: number; afsFence?: string }, action: () => Promise<T>): Promise<T> {
  if (!afsPolicyEnabled()) return action();
  await recoverAfsAdmissions();
  const token = uuid();
  try {
    await policyOperation('begin', { token, revision: snapshot.revision });
    await bindings.DB.prepare('INSERT INTO didmail_admission_fences(token,policy_revision,open) VALUES(?,?,1) ON CONFLICT(token) DO NOTHING').bind(token, snapshot.revision).run();
    snapshot.afsFence = token;
    return await action();
  } finally {
    delete snapshot.afsFence;
    try { await closeAdmissionFence(token, snapshot.revision); await policyOperation('end', { token }); }
    catch { console.error('AFS admission release deferred to fenced recovery'); }
  }
}
