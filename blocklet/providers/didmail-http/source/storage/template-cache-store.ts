// Relational pointers and large encrypted object payloads remain separate AFS records.
import { createTemplateCache, type TemplateCacheStorage } from '../api/src/runtime/template-cache-core';
import { bindings } from '../runtime/bindings';

const storage: TemplateCacheStorage = {
  async readPointer(scope, cursor) {
    const row = await bindings.DB.prepare('SELECT payload FROM template_list_cache WHERE scope = ? AND cursor = ?')
      .bind(scope, cursor)
      .first<{ payload: string }>();
    return row?.payload ?? null;
  },
  async readObject(key) {
    const object = await bindings.BLOBS.get(key);
    return object ? object.json() : null;
  },
  async generation(scope) {
    await bindings.DB.prepare('INSERT INTO template_cache_scopes (scope) VALUES (?) ON CONFLICT(scope) DO NOTHING')
      .bind(scope)
      .run();
    const row = await bindings.DB.prepare('SELECT generation FROM template_cache_scopes WHERE scope = ?')
      .bind(scope)
      .first<{ generation: number }>();
    return row!.generation;
  },
  createKey: () => `template-cache/${crypto.randomUUID()}`,
  async writeObject(key, value) {
    await bindings.BLOBS.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json' } });
  },
  async commitPointer(scope, cursor, key, generation, previous) {
    const result = await bindings.DB.prepare(
      'INSERT INTO template_list_cache (scope, cursor, payload) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM template_cache_scopes WHERE scope = ? AND generation = ?) ON CONFLICT(scope, cursor) DO UPDATE SET payload = excluded.payload WHERE template_list_cache.payload = ?',
    )
      .bind(scope, cursor, key, scope, generation, previous)
      .run();
    return Boolean(result.meta.changes);
  },
  async deleteObject(key) {
    await bindings.BLOBS.delete(key);
  },
  async invalidatePointers(scope) {
    const result = await bindings.DB.batch([
      bindings.DB.prepare(
        'INSERT INTO template_cache_scopes (scope, generation) VALUES (?, 1) ON CONFLICT(scope) DO UPDATE SET generation = generation + 1',
      ).bind(scope),
      bindings.DB.prepare('SELECT payload FROM template_list_cache WHERE scope = ?').bind(scope),
      bindings.DB.prepare('DELETE FROM template_list_cache WHERE scope = ?').bind(scope),
    ]);
    return (result[1]!.results as { payload: string }[]).map((row) => row.payload);
  },
  async deleteObjects(keys) {
    await bindings.BLOBS.delete(keys);
  },
  reportCleanupFailure(error) {
    console.error('Old template cache object cleanup failed', error);
  },
};

const cache = createTemplateCache(storage);
export const readTemplateCache = <T>(scope: string, cursor: string): Promise<T | null> =>
  cache.read(scope, cursor) as Promise<T | null>;
export const templateCacheGeneration = cache.generation;
export const writeTemplateCache = cache.write;
export const invalidateTemplateCache = cache.invalidate;
