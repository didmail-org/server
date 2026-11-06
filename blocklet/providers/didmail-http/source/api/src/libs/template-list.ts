import { createHash, randomUUID } from 'crypto';
import { fromTokenToUnit } from '@ocap/util';
import env from './env';
import { wallet } from './auth';
import templateToken from '../runtime/template-token';
import { Envelope, Namecard } from './sqlite';
import {
  readTemplateCache,
  templateCacheGeneration,
  writeTemplateCache,
  invalidateTemplateCache,
} from './template-cache-store';

type Kind = 'envelope' | 'namecard';
export function templateCacheScope(kind: Kind, factoryAddress: string) {
  return createHash('sha256')
    .update(JSON.stringify([env.chainHost, wallet.address, kind, factoryAddress]))
    .digest('hex');
}
export function invalidateTemplateList(kind: Kind, factoryAddress: string) {
  return invalidateTemplateCache(templateCacheScope(kind, factoryAddress));
}
export async function templateListPage(
  kind: Kind,
  factoryAddress: string,
  client: any,
  cursor: string,
  refresh: boolean,
) {
  const scope = templateCacheScope(kind, factoryAddress);
  let cached = await readTemplateCache(scope, cursor);
  const root = cursor === '0' ? cached : await readTemplateCache(scope, '0');
  // A refreshed first page changes offset pagination. Never reuse later pages from the old ordering.
  if (cursor !== '0' && cached?.rootVersion !== root?.version) cached = null;
  let snapshot = cached;
  let source = 'cache';
  let syncError = false;
  const repairPreview = cached && cached.previewVersion !== 1 && cached.items.some((item: any) => !item.display);
  if (!snapshot || refresh || repairPreview) {
    const generation = await templateCacheGeneration(scope);
    try {
      const [response, token] = await Promise.all([
        client.listAssets({
          ownerAddress: wallet.address,
          factoryAddress,
          paging: { cursor, size: 10, order: [{ field: 'genesisTime', type: 'desc' }] },
        }),
        templateToken(),
      ]);
      if (!Array.isArray(response.assets) || !response.page || !token?.address)
        throw new Error('Chain template list is unavailable');
      const items = await Promise.all(
        response.assets.map(async (asset: any) => {
          let data = typeof asset.data.value === 'string' ? JSON.parse(asset.data.value) : asset.data.value;
          // OCAP indexed assets can retain the mint-time empty display after UpdateAssetTx.
          // Repair only missing previews; normal cached list reads do not query each asset.
          if (!data.display) {
            const { state } = await client.getAssetState({ address: asset.address });
            if (
              !state ||
              state.address !== asset.address ||
              state.owner !== wallet.address ||
              state.parent !== factoryAddress
            )
              throw new Error('Template asset state could not be verified');
            data = typeof state.data.value === 'string' ? JSON.parse(state.data.value) : state.data.value;
          }
          return {
            address: asset.address,
            name: data.name,
            description: data.description,
            price: data.price,
            ...(kind === 'envelope' ? { retentionPeriod: data.retentionPeriod, endpoint: data.endpoint } : {}),
            display: data.display,
            created_at: asset.genesisTime,
            token: {
              address: token.address,
              symbol: token.symbol,
              value: fromTokenToUnit(data.price || '0', token.decimal).toString(),
              decimals: token.decimal,
            },
          };
        }),
      );
      snapshot = {
        items,
        previewVersion: 1,
        paging: response.page,
        syncedAt: new Date().toISOString(),
        version: randomUUID(),
        rootVersion: root?.version,
      };
      await writeTemplateCache(scope, cursor, snapshot, generation);
      source = 'chain';
    } catch (error) {
      if (!cached) throw error;
      // An unavailable chain must never replace a good snapshot with an empty list.
      snapshot = cached;
      syncError = true;
    }
  }
  const model = kind === 'envelope' ? Envelope : Namecard;
  // Publishing is local policy, never part of the chain cache (also removes N+1 reads).
  const published = await model.findAll({
    where: { address: snapshot.items.map((item: any) => item.address) },
    attributes: ['address', 'enabled', 'category'],
  });
  const enabled = new Map(published.map((row: any) => [row.get('address'), Boolean(row.get('enabled'))]));
  const categories = new Map(published.map((row: any) => [row.get('address'), row.get('category') || 'public']));
  const items = snapshot.items.map((item: any) => ({
    ...item,
    enabled: enabled.get(item.address) || false,
    category: categories.get(item.address) || 'public',
  }));
  return {
    [kind === 'envelope' ? 'envelopes' : 'namecards']: items,
    paging: snapshot.paging,
    cache: { source, syncedAt: snapshot.syncedAt, stale: syncError, syncError },
  };
}
