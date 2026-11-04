import { accountOrigin, addressOf } from '@didmail/protocol';
import { bindings, value } from './bindings';
import { admissionError } from './mail-admission';

// Dedicated internal contract, supplied by the trusted instance-scoped member bridge.
export function accountLinksEnabled(): boolean {
  if (value('DIDMAIL_ACCOUNT_LINKS_ENABLED') !== '1' || !bindings.ARC_MEMBERS || !value('DIDMAIL_ARC_INSTANCE_ID'))
    return false;
  try {
    accountOrigin(value('DIDMAIL_ACCOUNT_ORIGIN'));
    return true;
  } catch {
    return false;
  }
}
export async function activeArcMember(did: string): Promise<boolean> {
  addressOf(did);
  if (!accountLinksEnabled())
    return admissionError(503, 'MEMBERSHIP_UNAVAILABLE', 'An authoritative ARC active-member source is required');
  try {
    const instanceId = value('DIDMAIL_ARC_INSTANCE_ID');
    const target = new URL('https://arc-members.internal/member');
    target.searchParams.set('instanceId', instanceId);
    target.searchParams.set('did', did);
    const response = await bindings.ARC_MEMBERS!.fetch(
      new Request(target, { signal: AbortSignal.timeout(5000), redirect: 'manual' }),
    );
    if (response.status === 404) return false;
    if (!response.ok) throw new Error();
    const text = await response.text();
    if (text.length > 4096) throw new Error();
    const result = JSON.parse(text);
    if (
      result.did !== did ||
      result.instanceId !== instanceId ||
      typeof result.active !== 'boolean' ||
      !['owner', 'admin', 'member', 'guest'].includes(result.role)
    )
      throw new Error();
    return result.active && result.role !== 'guest';
  } catch {
    return admissionError(503, 'MEMBERSHIP_UNAVAILABLE', 'ARC membership could not be authoritatively verified');
  }
}
