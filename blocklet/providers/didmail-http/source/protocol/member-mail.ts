import { type Manifest, type Quote } from '@didmail/protocol';
import { afsPolicyEnabled } from '../storage/afs-mail-policy';
import { value } from '../runtime/bindings';
import { accountLinksEnabled } from '../identity/arc-members';
import { admissionError, memberAuthorization, type PolicySnapshot } from '../policy/mail-admission';

function setting(name: string, fallback: number, max: number): number {
  const n = Number(value(name, String(fallback)));
  if (!Number.isSafeInteger(n) || n < 1 || n > max)
    admissionError(503, 'INTERNAL_POLICY_INVALID', 'Invalid internal mail policy');
  return n;
}
export function internalPolicy() {
  return {
    retentionSeconds: setting('DMP_INTERNAL_RETENTION_DAYS', 30, 36500) * 86400,
  };
}
export async function memberPair(manifest: Manifest) {
  if (!manifest.automaticDelivery || !accountLinksEnabled()) return null;
  const sender = await memberAuthorization(manifest.senderId);
  if (sender.denied) admissionError(403, 'SENDER_NOT_ALLOWED', 'Sender is blocked');
  if (!sender.member) return null;
  const recipient =
    manifest.recipientId === manifest.senderId ? sender : await memberAuthorization(manifest.recipientId);
  return recipient.member && !recipient.denied ? { sender, recipient } : null;
}
export function memberPairGuard(manifest: Manifest, pair: NonNullable<Awaited<ReturnType<typeof memberPair>>>) {
  return {
    sql: [manifest.senderId, manifest.recipientId]
      .map(
        () => `EXISTS(SELECT 1 FROM account_links WHERE mailbox_id=? AND arc_id=? AND revision=? AND revoked=0)
      ${afsPolicyEnabled() ? '' : "AND NOT EXISTS(SELECT 1 FROM mail_access_entries WHERE kind='deny' AND did IN (?,?))"}`,
      )
      .join(' AND '),
    values: [pair.sender, pair.recipient].flatMap((a, i) => [
      i ? manifest.recipientId : manifest.senderId,
      a.arcId,
      a.linkRevision,
      ...(afsPolicyEnabled() ? [] : [i ? manifest.recipientId : manifest.senderId, a.arcId]),
    ]),
  };
}
export async function checkInternalQuote(manifest: Manifest, quote: Quote, policy: PolicySnapshot) {
  const pair = await memberPair(manifest);
  if (
    !pair ||
    quote.memberBindings?.senderRevision !== pair.sender.linkRevision ||
    quote.memberBindings?.recipientRevision !== pair.recipient.linkRevision ||
    quote.policyRevision !== policy.revision ||
    quote.retention.mode !== 'finite' ||
    quote.retention.durationSeconds !== internalPolicy().retentionSeconds
  )
    admissionError(
      409,
      'DELIVERY_TERMS_CHANGED',
      'Member eligibility or internal terms changed; prepare new terms before authorizing any payment',
      'refresh_quote',
    );
  return memberPairGuard(manifest, pair);
}
