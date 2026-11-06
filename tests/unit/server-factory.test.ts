import { beforeEach, expect, jest, test } from '@jest/globals';

jest.mock('../support/node/libs/template-cache-store', () => {
  const pages = new Map();
  return {
    readTemplateCache: jest.fn((scope: string, cursor: string) => Promise.resolve(pages.get(`${scope}:${cursor}`))),
    writeTemplateCache: jest.fn((scope: string, cursor: string, data: unknown) => {
      pages.set(`${scope}:${cursor}`, data);
      return Promise.resolve();
    }),
    templateCacheGeneration: jest.fn(() => Promise.resolve(0)),
    reset: () => pages.clear(),
  };
});
// eslint-disable-next-line import/first
import readServerFactory from '../../blocklet/providers/didmail-http/source/api/src/libs/server-factory';

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>{{ctx.id}}</text></svg>';
const state = (minted = 1) => ({
  address: 'factory',
  name: 'Node factory',
  description: 'Node NFT',
  limit: 0,
  owner: 'issuer',
  numMinted: minted,
  input: { tokens: [{ symbol: 'TBA', value: '1000000000000000000' }] },
  context: { genesisTime: '2026-01-01', renaissanceTime: `2026-10-${minted}` },
  output: { display: { type: 'svg', content: svg } },
});
const client = { getFactoryState: jest.fn<() => Promise<any>>() };
beforeEach(() => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  require('../support/node/libs/template-cache-store').reset();
  client.getFactoryState.mockReset().mockResolvedValue({ state: state() });
});
test('normal reads persist only fixed metadata and survive an unavailable chain', async () => {
  const first = await readServerFactory(client, 'chain-a', 'factory');
  expect(first.name).toBe('Node factory');
  expect(first).not.toHaveProperty('minted');
  expect(first).not.toHaveProperty('updated_at');
  expect(first).not.toHaveProperty('display');
  client.getFactoryState.mockRejectedValue(new Error('offline'));
  expect(await readServerFactory(client, 'chain-a', 'factory')).toEqual(first);
  expect(client.getFactoryState).toHaveBeenCalledTimes(1);
  await expect(readServerFactory(client, 'chain-b', 'factory')).rejects.toThrow('offline');
});
test('details explicitly query live counters and the output SVG, refreshing cached metadata', async () => {
  await readServerFactory(client, 'chain-a', 'factory');
  client.getFactoryState.mockResolvedValue({ state: { ...state(7), name: 'Updated factory' } });
  const details = await readServerFactory(client, 'chain-a', 'factory', true);
  expect(details.minted).toBe(7);
  expect(details.updated_at).toBe('2026-10-7');
  expect(details.display).toBe(svg);
  const cached = await readServerFactory(client, 'chain-a', 'factory');
  expect(cached.name).toBe('Updated factory');
  expect(cached).not.toHaveProperty('minted');
  expect(client.getFactoryState).toHaveBeenCalledTimes(2);
});
test('failed detail refresh never overwrites existing metadata or masquerades as live data', async () => {
  const cached = await readServerFactory(client, 'chain-a', 'factory');
  client.getFactoryState.mockRejectedValue(new Error('offline'));
  await expect(readServerFactory(client, 'chain-a', 'factory', true)).rejects.toThrow('offline');
  expect(await readServerFactory(client, 'chain-a', 'factory')).toEqual(cached);
});
