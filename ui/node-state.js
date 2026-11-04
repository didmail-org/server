import { QueryClient, QueryObserver } from '@tanstack/query-core';
import { request, onMutation } from './shared.js';
export const NODE_CACHE_KEY = 'didmail:node-state:v1';
export const NODE_STALE_TIME = 15_000;
const MAX_SNAPSHOT_AGE = 300_000;
const resources = {
  account: { path: '/api/account/state', ttl: NODE_STALE_TIME },
  stake: { path: '/api/stake/state', ttl: NODE_STALE_TIME, optional404: true },
  forge: { path: '/api/forge/state', ttl: MAX_SNAPSHOT_AGE },
};
export function scopeFor(session) {
  if (!session?.authenticated || !['owner', 'admin'].includes(session.user?.role) || !session.user?.did) return null;
  const node = session.node;
  return JSON.stringify([
    session.provider || session.user.sourceProvider || 'arc',
    session.user.did,
    session.user.role,
    node?.chainId || '',
    node?.address || '',
    node?.cacheKey || '',
  ]);
}
function browserStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}
export function clearNodeSnapshot(storage = browserStorage()) {
  try {
    storage?.removeItem(NODE_CACHE_KEY);
  } catch {
    /* Memory-only mode when browser storage is disabled. */
  }
}
function displayData(kind, data) {
  const tokens = (list) => list?.map(({ address, symbol, value, decimal }) => ({ address, symbol, value, decimal }));
  if (kind === 'account')
    return {
      address: data.address,
      chainId: data.chainId,
      chainStatus: data.chainStatus,
      moniker: data.moniker,
      balance: data.balance,
      nonce: data.nonce,
      tokens: tokens(data.tokens),
    };
  if (kind === 'stake')
    return {
      address: data.address,
      staked: data.staked,
      assets: data.assets,
      ownerAssets: data.ownerAssets?.map(({ address, data }) => ({ address, data })),
      revokedAssets: data.revokedAssets,
      tokens: tokens(data.tokens),
      revokedTokens: tokens(data.revokedTokens),
      revokeWaitingPeriod: data.revokeWaitingPeriod,
    };
  return { address: data.address, token: data.token };
}
// Request-cache state is scoped to a freshly verified ARC identity and node.
// Hydrated values are display snapshots, never authorization or transaction input.
export function createNodeStore(session, { storage = browserStorage(), fetcher = request, now = Date.now } = {}) {
  const scope = scopeFor(session);
  if (!scope) throw new Error('Unauthorized');
  const node = session.node;
  const persistent = Boolean(node?.address && node?.chainId && node?.cacheKey);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false },
    },
  });
  client.mount();
  const restored = new Set();
  const stops = new Set();
  let disposed = false;
  const key = (kind) => ['didmail-node', scope, kind];
  const validAccount = (data) =>
    data &&
    data.chainStatus !== 'unavailable' &&
    (!node?.address || data.address === node.address) &&
    (!node?.chainId || data.chainId === node.chainId);
  const options = (kind) => ({
    queryKey: key(kind),
    staleTime: resources[kind].ttl,
    refetchInterval: false,
    queryFn: async ({ signal }) => {
      const data = await fetcher(resources[kind].path, { signal, optional404: Boolean(resources[kind].optional404) });
      if (kind === 'account' && !validAccount(data))
        throw Object.assign(new Error('Chain data is unavailable. Balances and stake could not be verified.'), {
          diagnostic: data?.chainStatus === 'unavailable' ? data.chainError : undefined,
        });
      return data || {};
    },
  });
  if (persistent) {
    try {
      const snapshot = JSON.parse(storage?.getItem(NODE_CACHE_KEY) || 'null');
      if (snapshot?.scope !== scope) clearNodeSnapshot(storage);
      else
        for (const [kind, record] of Object.entries(snapshot.resources || {})) {
          if (
            !Object.hasOwn(resources, kind) ||
            !Number.isFinite(record.updatedAt) ||
            now() - record.updatedAt > MAX_SNAPSHOT_AGE ||
            record.updatedAt > now() + 1000 ||
            !record.data ||
            (kind === 'account' && !validAccount(record.data))
          )
            continue;
          client.setQueryData(key(kind), record.data, { updatedAt: record.updatedAt });
          restored.add(kind);
        }
    } catch {
      clearNodeSnapshot(storage);
    }
  }
  const persist = () => {
    if (!persistent || disposed) return;
    const snapshot = { scope, resources: {} };
    for (const kind of Object.keys(resources)) {
      const state = client.getQueryState(key(kind));
      if (!state?.data || state.isInvalidated || now() - state.dataUpdatedAt > MAX_SNAPSHOT_AGE || state.error)
        continue;
      const data = displayData(kind, state.data);
      if (JSON.stringify(data).length > 128 * 1024) continue;
      snapshot.resources[kind] = { updatedAt: state.dataUpdatedAt, data };
    }
    try {
      storage?.setItem(NODE_CACHE_KEY, JSON.stringify(snapshot));
    } catch {
      /* Cache is optional. */
    }
  };
  const cacheStop = client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && ['success', 'error'].includes(event.action.type)) {
      if (event.action.type === 'success') restored.delete(event.query.queryKey[2]);
      persist();
    }
  });
  const affected = (path) => /^\/api\/(?:stake\/|servers\/acquire|(?:envelope|namecard)\/acquire)/.test(path);
  const invalidate = async () => {
    const predicate = (query) => ['account', 'stake'].includes(query.queryKey[2]);
    await client.cancelQueries({ predicate });
    await client.invalidateQueries({ predicate, refetchType: 'none' });
    clearNodeSnapshot(storage);
    restored.clear();
  };
  const mutationStop = onMutation(async (phase, path) => {
    if (!affected(path)) return;
    await invalidate();
    // Subscribers keep their last values but see them as stale. The caller's
    // post-write refresh coalesces with this background revalidation.
    if (phase === 'settled')
      void client
        .refetchQueries({ type: 'active', predicate: (query) => ['account', 'stake'].includes(query.queryKey[2]) })
        .catch(() => {});
  });
  const get = (kind) => {
    const state = client.getQueryState(key(kind));
    return {
      data: state?.data,
      error: state?.error,
      updatedAt: state?.dataUpdatedAt || 0,
      fetching: state?.fetchStatus === 'fetching',
      stale: !state?.data || Boolean(state.isInvalidated) || now() - state.dataUpdatedAt >= resources[kind].ttl,
      restored: restored.has(kind),
    };
  };
  return {
    scope,
    node,
    get active() {
      return !disposed;
    },
    get,
    async read(kind, { force = false } = {}) {
      if (disposed) throw new Error('Node state is closed');
      if (force) await client.invalidateQueries({ queryKey: key(kind), refetchType: 'none' });
      return client.fetchQuery({ ...options(kind), staleTime: force ? 0 : resources[kind].ttl });
    },
    watch(kind, listener) {
      const observer = new QueryObserver(client, options(kind));
      const stop = observer.subscribe(() => listener(get(kind)));
      stops.add(stop);
      listener(get(kind));
      return () => {
        stop();
        stops.delete(stop);
      };
    },
    invalidate,
    dispose() {
      disposed = true;
      mutationStop();
      cacheStop();
      stops.forEach((stop) => stop());
      stops.clear();
      client.clear();
      client.unmount();
    },
  };
}
let current;
export function nodeStore(session) {
  const scope = scopeFor(session);
  if (!scope) {
    current?.dispose();
    current = undefined;
    clearNodeSnapshot();
    return null;
  }
  if (!current || current.scope !== scope) {
    current?.dispose();
    current = createNodeStore(session);
  }
  return current;
}
export function closeNodeStore({ forget = false } = {}) {
  current?.dispose();
  current = undefined;
  if (forget) clearNodeSnapshot();
}
