import test from 'node:test';
import assert from 'node:assert/strict';
import { createNodeStore, scopeFor, NODE_CACHE_KEY } from '../../ui/node-state.js';
import { request } from '../../ui/shared.js';
const session = {
  authenticated: true,
  user: { did: 'user-a', role: 'owner' },
  node: { address: 'node-a', chainId: 'beta', cacheKey: 'config-a' },
};
const account = (nonce = 1) => ({
  address: 'node-a',
  chainId: 'beta',
  chainStatus: 'ready',
  nonce,
  tokens: [{ symbol: 'TBA', decimal: 18, value: '900719925474099312345' }],
  context: { diagnostic: 'not cached' },
});
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
test('query core coalesces requests and restores only display fields across page stores', async () => {
  const storage = memoryStorage();
  let calls = 0;
  let store = createNodeStore(session, {
    storage,
    fetcher: async () => {
      calls++;
      return account();
    },
  });
  try {
    const [a, b] = await Promise.all([store.read('account'), store.read('account')]);
    assert.deepEqual(a, b);
    assert.equal(calls, 1);
    assert.ok(!storage.getItem(NODE_CACHE_KEY).includes('diagnostic'));
    store.dispose();
    store = createNodeStore(session, {
      storage,
      fetcher: async () => {
        calls++;
        return account(2);
      },
    });
    assert.equal(store.get('account').restored, true);
    assert.equal((await store.read('account')).nonce, 1);
    assert.equal(calls, 1);
    await store.read('account', { force: true });
    assert.equal(store.get('account').data.nonce, 2);
    assert.equal(calls, 2);
  } finally {
    store.dispose();
  }
});
test('stale values remain visible while an observer refreshes in the background', async () => {
  const storage = memoryStorage();
  const initial = createNodeStore(session, { storage, fetcher: async () => account() });
  await initial.read('account');
  initial.dispose();
  const snapshot = JSON.parse(storage.getItem(NODE_CACHE_KEY));
  snapshot.resources.account.updatedAt = Date.now() - 20_000;
  storage.setItem(NODE_CACHE_KEY, JSON.stringify(snapshot));
  const gate = deferred();
  let calls = 0;
  const store = createNodeStore(session, {
    storage,
    fetcher: async () => {
      calls++;
      await gate.promise;
      return account(2);
    },
  });
  try {
    assert.equal(store.get('account').data.nonce, 1);
    assert.equal(store.get('account').stale, true);
    store.watch('account', () => {});
    assert.equal(store.get('account').fetching, true);
    const pending = store.read('account');
    gate.resolve();
    await pending;
    assert.equal(calls, 1);
    assert.equal(store.get('account').data.nonce, 2);
    assert.equal(store.get('account').restored, false);
  } finally {
    gate.resolve();
    store.dispose();
  }
});
test('identity, node, network and config changes prevent hydration; denied sessions cannot construct a store', async () => {
  for (const changed of [
    { ...session, user: { did: 'user-b', role: 'owner' } },
    { ...session, node: { ...session.node, address: 'node-b' } },
    { ...session, node: { ...session.node, chainId: 'main' } },
    { ...session, node: { ...session.node, cacheKey: 'config-b' } },
  ]) {
    const storage = memoryStorage();
    const initial = createNodeStore(session, { storage, fetcher: async () => account() });
    await initial.read('account');
    initial.dispose();
    const store = createNodeStore(changed, { storage });
    assert.equal(store.get('account').data, undefined);
    assert.equal(storage.getItem(NODE_CACHE_KEY), undefined);
    store.dispose();
  }
  for (const denied of [{ authenticated: false }, { authenticated: true, user: { did: 'user-a', role: 'member' } }]) {
    assert.equal(scopeFor(denied), null);
    assert.throws(() => createNodeStore(denied), /Unauthorized/);
  }
});
test('unavailable chain responses do not overwrite or persist a false zero; storage failures are optional', async () => {
  let failing = false;
  const storage = memoryStorage();
  const store = createNodeStore(session, {
    storage,
    fetcher: async () => (failing ? { ...account(), chainStatus: 'unavailable', tokens: [] } : account()),
  });
  try {
    await store.read('account');
    failing = true;
    await assert.rejects(store.read('account', { force: true }), /Chain data/);
    assert.equal(store.get('account').data.tokens[0].value, '900719925474099312345');
    assert.ok(store.get('account').error);
    assert.equal(JSON.parse(storage.getItem(NODE_CACHE_KEY)).resources.account, undefined);
  } finally {
    store.dispose();
  }
  const noStorage = createNodeStore(session, {
    storage: {
      getItem() {
        throw Error('disabled');
      },
      setItem() {
        throw Error('quota');
      },
      removeItem() {
        throw Error('disabled');
      },
    },
    fetcher: async () => account(),
  });
  try {
    assert.equal((await noStorage.read('account')).nonce, 1);
  } finally {
    noStorage.dispose();
  }
});
test('a pre-write read cannot repopulate the snapshot after invalidation', async (t) => {
  const old = deferred(),
    fresh = deferred();
  let calls = 0;
  const storage = memoryStorage();
  const store = createNodeStore(session, {
    storage,
    fetcher: async () => {
      calls++;
      return calls === 1 ? account(1) : calls === 2 ? old.promise : fresh.promise;
    },
  });
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }));
  try {
    await store.read('account');
    const obsolete = store.read('account', { force: true }).catch(() => {});
    await new Promise((done) => setTimeout(done, 0));
    await request('/api/stake/add', { method: 'POST', body: { amount: 1 } });
    assert.equal(storage.getItem(NODE_CACHE_KEY), undefined);
    const pending = store.read('account');
    fresh.resolve(account(3));
    await pending;
    old.resolve(account(2));
    await obsolete;
    assert.equal(store.get('account').data.nonce, 3);
    assert.equal(JSON.parse(storage.getItem(NODE_CACHE_KEY)).resources.account.data.nonce, 3);
  } finally {
    old.resolve(account(2));
    fresh.resolve(account(3));
    store.dispose();
  }
});
