import { beforeAll, beforeEach, afterAll, test, expect } from '@jest/globals';

jest.mock('../env', () => ({
  __esModule: true,
  default: {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    dataDir: require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'didmail-template-cache-')),
    chainHost: 'https://cache.test/api/',
  },
}));
jest.mock('../auth', () => ({ wallet: { address: 'node-test' } }));
jest.mock('../forge', () => ({ getForgeState: jest.fn() }));
// eslint-disable-next-line import/first
import sequelize, { Envelope, Namecard } from '../sqlite';
// eslint-disable-next-line import/first
import { getForgeState } from '../forge';
// eslint-disable-next-line import/first
import { templateListPage, templateCacheScope, invalidateTemplateList } from '../template-list';
// eslint-disable-next-line import/first
import { readTemplateCache, templateCacheGeneration, writeTemplateCache } from '../template-cache-store';

const token = { address: 'token-test', symbol: 'TBA', decimal: 18 };
const asset = (name = 'Original') => ({
  address: 'asset-test',
  genesisTime: '2026-10-24T00:00:00Z',
  data: {
    value: JSON.stringify({
      name,
      description: 'Template',
      price: '0.001',
      retentionPeriod: 7,
      display: '<svg>template</svg>',
    }),
  },
});
const page = (name = 'Original') => ({ assets: [asset(name)], page: { cursor: '0', next: false, total: 1 } });
const client = { listAssets: jest.fn<Promise<any>, []>(), getAssetState: jest.fn<Promise<any>, [any]>() };
beforeAll(async () => {
  await Envelope.sync({ force: true });
  await Namecard.sync({ force: true });
});
afterAll(async () => {
  await sequelize.close();
});
beforeEach(async () => {
  await invalidateTemplateList('envelope', 'factory');
  await invalidateTemplateList('namecard', 'factory');
  await Envelope.destroy({ where: {} });
  await Namecard.destroy({ where: {} });
  client.listAssets.mockReset().mockResolvedValue(page());
  client.getAssetState.mockReset().mockResolvedValue({ state: { ...asset(), owner: 'node-test', parent: 'factory' } });
  jest
    .mocked(getForgeState)
    .mockReset()
    .mockResolvedValue({ token } as any);
});
test('first read persists the chain page; subsequent reads use it and merge current publication policy', async () => {
  const first = await templateListPage('envelope', 'factory', client, '0', false);
  expect(first.cache.source).toBe('chain');
  expect(first.envelopes[0].token.value).toBe('1000000000000000');
  await Envelope.create({
    address: 'asset-test',
    name: 'local',
    price: '0.001',
    token: '{}',
    retentionPeriod: 7,
    enabled: true,
  });
  client.listAssets.mockRejectedValue(new Error('offline'));
  const second = await templateListPage('envelope', 'factory', client, '0', false);
  expect(second.envelopes[0].enabled).toBe(true);
  expect(second.envelopes[0].name).toBe('Original');
  expect(second.cache.source).toBe('cache');
  expect(client.listAssets).toHaveBeenCalledTimes(1);
  expect(getForgeState).toHaveBeenCalledTimes(1);
});
test('explicit refresh replaces the snapshot; a chain failure preserves the last successful data', async () => {
  await templateListPage('envelope', 'factory', client, '0', false);
  client.listAssets.mockResolvedValue(page('Changed'));
  const fresh = await templateListPage('envelope', 'factory', client, '0', true);
  expect(fresh.envelopes[0].name).toBe('Changed');
  client.listAssets.mockRejectedValue(new Error('offline'));
  const fallback = await templateListPage('envelope', 'factory', client, '0', true);
  expect(fallback.envelopes[0].name).toBe('Changed');
  expect(fallback.cache).toMatchObject({ source: 'cache', stale: true, syncError: true });
  expect((await templateListPage('envelope', 'factory', client, '0', false)).cache.syncError).toBe(false);
});
test('a failed initial sync or missing forge token never creates a false empty cache', async () => {
  client.listAssets.mockRejectedValueOnce(new Error('offline'));
  await expect(templateListPage('envelope', 'factory', client, '0', false)).rejects.toThrow('offline');
  jest.mocked(getForgeState).mockResolvedValueOnce({} as any);
  await expect(templateListPage('envelope', 'factory', client, '0', false)).rejects.toThrow('unavailable');
  expect(await readTemplateCache(templateCacheScope('envelope', 'factory'), '0')).toBeNull();
});
test('snapshot scope separates kinds, factories and cursors; successful empty pages are cached', async () => {
  await templateListPage('envelope', 'factory', client, '0', false);
  client.listAssets.mockResolvedValue({ assets: [], page: { cursor: '1', total: 0, next: false } });
  const empty = await templateListPage('namecard', 'factory', client, '0', false);
  expect(empty.namecards).toEqual([]);
  await templateListPage('envelope', 'factory', client, '1', false);
  await templateListPage('envelope', 'factory-2', client, '0', false);
  await templateListPage('namecard', 'factory', client, '0', false);
  expect(client.listAssets).toHaveBeenCalledTimes(4);
});
test('invalidation clears all pages and prevents a read from the old generation from restoring data', async () => {
  const scope = templateCacheScope('envelope', 'factory');
  const generation = await templateCacheGeneration(scope);
  await writeTemplateCache(scope, '0', { items: [] }, generation);
  await writeTemplateCache(scope, '1', { items: [] }, generation);
  await invalidateTemplateList('envelope', 'factory');
  await writeTemplateCache(scope, '0', { items: ['old'] }, generation);
  expect(await readTemplateCache(scope, '0')).toBeNull();
  expect(await readTemplateCache(scope, '1')).toBeNull();
});

test('refreshing the first page makes older offset pages miss the cache', async () => {
  await templateListPage('envelope', 'factory', client, '0', false);
  await templateListPage('envelope', 'factory', client, '1', false);
  await templateListPage('envelope', 'factory', client, '1', false);
  expect(client.listAssets).toHaveBeenCalledTimes(2);
  await templateListPage('envelope', 'factory', client, '0', true);
  await templateListPage('envelope', 'factory', client, '1', false);
  expect(client.listAssets).toHaveBeenCalledTimes(4);
});

test.each(['envelope', 'namecard'] as const)(
  '%s empty indexed previews are hydrated from current state and cached',
  async (kind) => {
    const indexed = asset();
    indexed.data.value = JSON.stringify({ ...JSON.parse(indexed.data.value), display: '' });
    client.listAssets.mockResolvedValue({ assets: [indexed], page: { cursor: '0', next: false, total: 1 } });
    const first = await templateListPage(kind, 'factory', client, '0', false);
    expect(first[kind === 'envelope' ? 'envelopes' : 'namecards'][0].display).toBe('<svg>template</svg>');
    const count = client.getAssetState.mock.calls.length;
    const second = await templateListPage(kind, 'factory', client, '0', false);
    expect(second.cache.source).toBe('cache');
    expect(client.getAssetState).toHaveBeenCalledTimes(count);
  },
);
test('existing cached empty previews upgrade without a manual refresh; foreign asset states never repair them', async () => {
  await templateListPage('envelope', 'factory', client, '0', false);
  const scope = templateCacheScope('envelope', 'factory');
  const snapshot = await readTemplateCache(scope, '0');
  snapshot.items[0].display = '';
  delete snapshot.previewVersion;
  await writeTemplateCache(scope, '0', snapshot, await templateCacheGeneration(scope));
  const indexed = asset();
  indexed.data.value = JSON.stringify({ ...JSON.parse(indexed.data.value), display: '' });
  client.listAssets.mockResolvedValue({ assets: [indexed], page: { cursor: '0', next: false, total: 1 } });
  client.getAssetState.mockResolvedValueOnce({ state: { ...asset(), owner: 'foreign', parent: 'factory' } });
  const bad = await templateListPage('envelope', 'factory', client, '0', false);
  expect(bad.cache.syncError).toBe(true);
  expect(bad.envelopes[0].display).toBe('');
  const repaired = await templateListPage('envelope', 'factory', client, '0', false);
  expect(repaired.envelopes[0].display).toBe('<svg>template</svg>');
  expect((await readTemplateCache(scope, '0')).previewVersion).toBe(1);
});
