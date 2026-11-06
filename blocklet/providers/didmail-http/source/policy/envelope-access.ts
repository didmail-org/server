import { bindings } from '../runtime/bindings';
import { admissionError, memberAuthorization } from './mail-admission';

export type EnvelopeCategory = 'public' | 'members';
export async function verifiedEnvelopeMember(sender: string) {
  const auth = await memberAuthorization(sender);
  if (auth.denied) admissionError(403, 'SENDER_NOT_ALLOWED', 'This account is blocked', 'choose_service');
  return auth;
}
export async function requireEnvelopeAccess(planId: string, sender: string, required = true) {
  const row = await bindings.DB.prepare('SELECT category FROM envelopes WHERE address=? AND enabled=1 LIMIT 1')
    .bind(planId).first<{category:EnvelopeCategory}>();
  if (!row) {
    if (required) admissionError(409, 'PLAN_UNAVAILABLE', 'Envelope is not published', 'choose_plan');
    return null; // Isolated settlement adapters have no real envelope assets.
  }
  if (row.category === 'public') return { category: row.category, arcId: '', linkRevision: 0 };
  const auth = await verifiedEnvelopeMember(sender);
  if (!auth.member) admissionError(403, 'ENVELOPE_MEMBER_REQUIRED', 'This envelope requires an active bound ARC member', 'bind_mailbox');
  return { category: row.category, arcId: auth.arcId, linkRevision: auth.linkRevision };
}
export function envelopeAdmission(access: Awaited<ReturnType<typeof requireEnvelopeAccess>>, planId:string, sender:string) {
  if (!access) return {sql:'1=1',values:[] as (string|number)[]};
  const values:(string|number)[]=[planId,access.category];
  let sql="EXISTS(SELECT 1 FROM envelopes WHERE address=? AND enabled=1 AND category=?)";
  if(access.category==='members'){
    sql+=" AND EXISTS(SELECT 1 FROM account_links WHERE mailbox_id=? AND arc_id=? AND revision=? AND revoked=0)";
    values.push(sender,access.arcId,access.linkRevision);
  }
  return {sql,values};
}
export async function publicEnvelopeSelection() {
  const {Envelope}=await import('../storage/database');
  const row=await Envelope.findOne({where:{enabled:true,category:'public'},order:[['id','ASC']]});
  if(!row)return null;
  const data=row.toJSON() as any;
  return {...data,price:String(data.price).trim().split(/\s+/)[0],token:typeof data.token==='string'?JSON.parse(data.token):data.token};
}
