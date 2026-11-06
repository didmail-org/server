type Rpc = (method: 'read' | 'list', path: string, options?: Record<string, unknown>) => Promise<any>;
type Entry = { path: string; content?: any; meta?: { kind?: string; provenance?: { provider?: string } } };

function failure(message: string) {
  return Object.assign(new Error(message), { code: 'AFS_CHAIN_UNAVAILABLE' });
}
function segment(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9:-]+$/.test(value)) throw failure('Invalid chain resource address');
  return value;
}
// OCAP exposes indexed timestamps at the top level. Keep the original SDK's
// context fields for REST consumers without discarding provider-supplied data.
function sdkState(content: any) {
  return {
    ...content,
    context: {
      ...content.context,
      genesisTime: content.context?.genesisTime ?? content.genesisTime ?? '',
      renaissanceTime: content.context?.renaissanceTime ?? content.renaissanceTime ?? '',
    },
  };
}
export default function createAfsChainReader(rpc: Rpc, root: string) {
  if (!/^\/dev\/chain\/[a-z][a-z0-9-]*$/.test(root)) throw failure('Invalid ARC chain mount');
  let capabilityFlight: Promise<void> | undefined;
  function ready() {
    if (!capabilityFlight)
      capabilityFlight = (async () => {
        const result = await rpc('read', `${root}/.meta/.capabilities`);
        const entry = result?.data;
        if (
          entry?.meta?.provenance?.provider !== 'ocap' ||
          entry.content?.operations?.read !== true ||
          !(entry.content?.operations?.list === true || entry.content?.operations?.list?.supported)
        )
          throw failure('ARC chain mount does not expose the required OCAP read/list capabilities');
      })().catch((error) => {
        capabilityFlight = undefined;
        throw error;
      });
    return capabilityFlight;
  }
  async function read(kind: string, address: string) {
    await ready();
    const path = `${root}/${kind}/${segment(address)}`;
    let result;
    try {
      result = await rpc('read', path);
    } catch (error) {
      if (error.code === 'AFS_CHAIN_NOT_FOUND') return null;
      throw error;
    }
    const entry: Entry = result?.data;
    const expectedKind = {
      factories: 'factory',
      assets: 'asset',
      accounts: 'account',
      stakes: 'stake',
      tokens: 'token',
    }[kind];
    if (
      entry?.path !== path ||
      entry.meta?.provenance?.provider !== 'ocap' ||
      entry.meta?.kind !== `ocap:${expectedKind}` ||
      !entry.content ||
      typeof entry.content !== 'object' ||
      entry.content.address !== address
    )
      throw failure(`Invalid OCAP entity response for ${kind}`);
    return sdkState(entry.content);
  }
  async function list(path: string, options: Record<string, unknown>) {
    await ready();
    const result = await rpc('list', path, options);
    if (!Array.isArray(result?.data)) throw failure('Invalid OCAP collection response');
    return result;
  }
  async function all(path: string, where?: Record<string, string>) {
    const items: Entry[] = [];
    const seen = new Set<string>();
    let bytes = 0;
    while (items.length < 10_000) {
      // Sequential offsets depend on the number of entries actually returned.
      // eslint-disable-next-line no-await-in-loop
      const result = await list(path, { limit: 10, offset: items.length, ...(where ? { where } : {}) });
      for (const entry of result.data) {
        if (typeof entry.path !== 'string' || seen.has(entry.path))
          throw failure('OCAP pagination repeated or omitted an entry path');
        seen.add(entry.path);
      }
      bytes += new TextEncoder().encode(JSON.stringify(result.data)).byteLength;
      if (bytes > 32 * 1024 * 1024) throw failure('OCAP collection exceeds the safe snapshot size');
      items.push(...result.data);
      if (result.total !== undefined) {
        if (!Number.isSafeInteger(result.total) || result.total < items.length)
          throw failure('OCAP pagination returned an invalid total');
        if (items.length === result.total) return items;
        if (!result.data.length) throw failure('OCAP pagination ended before the declared total');
      } else if (result.data.length < 10) return items;
    }
    throw failure('OCAP collection exceeds the safe scan limit; refusing an incomplete result');
  }
  return {
    async getConfig() {
      await ready();
      const path = `${root}/config`;
      const entry = (await rpc('read', path))?.data;
      if (
        entry?.path !== path ||
        entry.meta?.kind !== 'ocap:config' ||
        entry.meta?.provenance?.provider !== 'ocap' ||
        !entry.content ||
        typeof entry.content !== 'object'
      )
        throw failure('Invalid OCAP chain configuration');
      return { config: JSON.stringify(entry.content) };
    },
    getFactoryState: async ({ address }: { address: string }) => ({ state: await read('factories', address) }),
    getTokenState: async ({ address }: { address: string }) => ({ state: await read('tokens', address) }),
    getAssetState: async ({ address }: { address: string }) => ({ state: await read('assets', address) }),
    async getStakeState({ address }: { address: string }) {
      const state = await read('stakes', address);
      if (!state) return { state: null };
      if (
        !Array.isArray(state.assets) ||
        !Array.isArray(state.tokens) ||
        !Array.isArray(state.revokedAssets ?? []) ||
        !Array.isArray(state.revokedTokens ?? [])
      )
        throw failure('Invalid OCAP stake state');
      const tokens = [...state.tokens, ...(state.revokedTokens ?? [])];
      if (tokens.some((token) => !/^\d+$/.test(String(token.value)))) throw failure('Invalid OCAP stake amount');
      return {
        state: { ...state, revokedAssets: state.revokedAssets ?? [], revokedTokens: state.revokedTokens ?? [] },
      };
    },
    async getAccountState({ address }: { address: string }) {
      const state = await read('accounts', address);
      if (!state) return { state: null };
      // New OCAP versions include full token balances in the live account read.
      // Older versions expose them only as a related collection. Reuse complete
      // live rows, keeping the collection fallback and exact integer validation.
      const embedded =
        Array.isArray(state.tokens) &&
        state.tokens.length > 0 &&
        state.tokens.every(
          (token: any) => token.address && token.symbol && token.decimal != null && token.value != null,
        );
      const entries: Entry[] = embedded
        ? state.tokens.map((token: any) => ({ path: `${root}/tokens/${segment(token.address)}`, content: token }))
        : await all(`${root}/accounts/${segment(address)}/tokens`);
      const tokens = entries.map((entry) => {
        const token = entry.content;
        if (!token || typeof token.address !== 'string' || entry.path !== `${root}/tokens/${token.address}`)
          throw failure('Invalid OCAP account token');
        const value = token.value ?? token.balance;
        if (typeof value !== 'string') throw failure('Invalid OCAP integer token amount');
        const decimal = Number(token.decimal);
        if (!/^\d+$/.test(value) || !Number.isInteger(decimal) || decimal < 0 || decimal > 36)
          throw failure('Invalid OCAP account token amount');
        return { ...token, value, decimal };
      });
      return { state: { ...state, tokens } };
    },
    async listTransactions(input: any) {
      const addresses = input.stakeFilter?.stakes;
      if (!Array.isArray(addresses) || addresses.length !== 1 || input.validityFilter?.validity !== 'VALID')
        throw failure('A single stake and valid transactions are required');
      const address = segment(addresses[0]);
      const entries = await all(`${root}/stakes/${address}/transactions`);
      const transactions = entries
        .map((entry) => {
          const tx = entry.content;
          if (
            !tx ||
            !/^[a-fA-F0-9]{64}$/.test(tx.hash || '') ||
            entry.path !== `${root}/transactions/${tx.hash}` ||
            entry.meta?.provenance?.provider !== 'ocap' ||
            entry.meta?.kind !== `ocap:transaction:${tx.type}`
          )
            throw failure('Invalid OCAP stake transaction');
          return tx;
        })
        .filter((tx) => tx.valid === true && ['0', 'OK'].includes(String(tx.code)));
      return { transactions };
    },
    async listAssets(input: any) {
      const where: Record<string, string> = {};
      if (input.ownerAddress) where.ownerAddress = segment(input.ownerAddress);
      if (input.factoryAddress) where.factoryAddress = segment(input.factoryAddress);
      if (!Object.keys(where).length) throw failure('An owner or factory is required for the NFT list');
      const path = `${root}/assets`;
      const paging = input.paging || { cursor: '0', size: 100 };
      const cursor = String(paging.cursor ?? '0');
      const size = Number(paging.size ?? 10);
      if (
        !/^\d+$/.test(cursor) ||
        !Number.isSafeInteger(Number(cursor)) ||
        !Number.isInteger(size) ||
        size < 1 ||
        size > 100
      )
        throw failure('Invalid NFT page');
      const offset = Number(cursor) * size;
      if (!Number.isSafeInteger(offset)) throw failure('Invalid NFT offset');
      if (paging.order?.some((order: any) => order.field !== 'genesisTime' || order.type !== 'desc'))
        throw failure('Unsupported NFT sort order');
      // beta.66 list reports orderByIgnored for the attempted sort shapes.
      // Enumerate the *server-filtered* set in bounded pages and explicitly sort
      // it, rather than silently presenting incorrect cross-page ordering.
      const entries = await all(path, where);
      const assets = entries
        .map((entry: Entry) => {
          const asset = entry.content;
          if (
            !asset ||
            !asset.address ||
            !entry.path.startsWith(`${root}/assets/`) ||
            (input.ownerAddress && asset.owner !== input.ownerAddress) ||
            (input.factoryAddress && asset.parent !== input.factoryAddress)
          )
            throw failure('OCAP NFT filters were not enforced');
          return asset;
        })
        .sort(
          (a: any, b: any) =>
            String(b.genesisTime).localeCompare(String(a.genesisTime)) || a.address.localeCompare(b.address),
        );
      return {
        assets: input.paging ? assets.slice(offset, offset + size) : assets,
        page: { cursor, total: assets.length, next: input.paging ? offset + size < assets.length : false },
      };
    },
  };
}
