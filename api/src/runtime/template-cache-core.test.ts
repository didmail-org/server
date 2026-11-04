import { createTemplateCache, type TemplateCacheStorage } from './template-cache-core';

function fixture() {
  let version = 0;
  let pointer: string | null = null;
  let next = 0;
  const objects = new Map<string, unknown>();
  const storage: TemplateCacheStorage = {
    readPointer: () => Promise.resolve(pointer),
    readObject: (key) => Promise.resolve(objects.get(key) ?? null),
    generation: () => Promise.resolve(version),
    createKey: () => `key-${++next}`,
    writeObject: (key, value) => {
      objects.set(key, value);
      return Promise.resolve();
    },
    commitPointer: (_scope, _cursor, key, expected, previous) => {
      if (version !== expected || pointer !== previous) return Promise.resolve(false);
      pointer = key;
      return Promise.resolve(true);
    },
    deleteObject: (key) => {
      objects.delete(key);
      return Promise.resolve();
    },
    invalidatePointers: () => {
      version++;
      const old = pointer ? [pointer] : [];
      pointer = null;
      return Promise.resolve(old);
    },
    deleteObjects: (keys) => {
      keys.forEach((key) => objects.delete(key));
      return Promise.resolve();
    },
    reportCleanupFailure: () => {},
  };
  return { storage, objects, cache: createTemplateCache(storage) };
}

test('a stale refresh cannot restore data after invalidation', async () => {
  const { cache, objects } = fixture();
  const generation = await cache.generation('scope');
  await cache.write('scope', '0', { items: ['original'] }, generation);
  await cache.invalidate('scope');
  await cache.write('scope', '0', { items: ['stale'] }, generation);
  expect(await cache.read('scope', '0')).toBeNull();
  expect(objects.size).toBe(0);
});

test('concurrent refreshes retain one version and clean the losing object', async () => {
  const { cache, objects } = fixture();
  const generation = await cache.generation('scope');
  await Promise.all([
    cache.write('scope', '0', { items: ['first'] }, generation),
    cache.write('scope', '0', { items: ['second'] }, generation),
  ]);
  expect([{ items: ['first'] }, { items: ['second'] }]).toContainEqual(await cache.read('scope', '0'));
  expect(objects.size).toBe(1);
});

test('a failed pointer commit removes the new object and propagates the failure', async () => {
  const { storage, cache, objects } = fixture();
  await cache.write('scope', '0', { items: ['retained'] }, 0);
  storage.commitPointer = () => Promise.reject(new Error('storage unavailable'));
  await expect(cache.write('scope', '0', { items: ['new'] }, 0)).rejects.toThrow('storage unavailable');
  expect(await cache.read('scope', '0')).toEqual({ items: ['retained'] });
  expect(objects.size).toBe(1);
});
