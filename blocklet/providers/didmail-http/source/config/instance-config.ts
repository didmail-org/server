import { arcFetch } from '../identity/arc';
import { value } from '../runtime/bindings';

// Transitional consumers read the SAME ARC object as the native page. There is
// no D1 mirror or write-through fallback. The native ARC action owns updates.
export async function readInstanceAttachmentConfig() {
  const response = await arcFetch(new Request(new URL('/api/afs/rpc', value('DIDMAIL_URL')), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'read', path: '/didmail-native/attachment-config.json' }),
    signal: AbortSignal.timeout(5000),
  }));
  if (!response.ok) throw Object.assign(new Error('ARC configuration unavailable'), { status: 503 });
  const result = await response.json() as { ok?: boolean; data?: { content?: string } };
  if (!result.ok || typeof result.data?.content !== 'string') throw Object.assign(new Error('ARC configuration unavailable'), { status: 503 });
  const config = JSON.parse(result.data.content);
  if (!Number.isSafeInteger(config.maxFileSizeBytes) || config.maxFileSizeBytes <= 0 ||
      !Number.isSafeInteger(config.maxFileCount) || config.maxFileCount <= 0 ||
      typeof config.pricePerBytePerDay !== 'string' || !/^\d+$/.test(config.pricePerBytePerDay) ||
      typeof config.updatedAt !== 'string' || Number.isNaN(Date.parse(config.updatedAt)))
    throw Object.assign(new Error('Invalid ARC configuration'), { status: 503 });
  return {
    get: (field: string) => config[field],
    toJSON: () => ({ ...config }),
    update: async (_updates: unknown): Promise<never> => { throw Object.assign(new Error('Attachment policy is managed by ARC'), { status: 409, code: 'CONFIG_MANAGED_BY_ARC' }); },
  };
}
