// Legacy Node adapter. Workers replaces this file with the D1/R2 implementation.
import { QueryTypes } from 'sequelize';
import sequelize from './sqlite';

let initialized: Promise<unknown> | undefined;
function ready() {
  initialized ||= (async () => {
    await sequelize.query(
      'CREATE TABLE IF NOT EXISTS template_cache_scopes (scope TEXT PRIMARY KEY, generation INTEGER NOT NULL DEFAULT 0)',
    );
    await sequelize.query(
      'CREATE TABLE IF NOT EXISTS template_list_cache (scope TEXT NOT NULL, cursor TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (scope, cursor))',
    );
  })().catch((error) => {
    initialized = undefined;
    throw error;
  });
  return initialized;
}
export async function readTemplateCache(scope: string, cursor: string): Promise<any | null> {
  await ready();
  const rows = await sequelize.query<{ payload: string }>(
    'SELECT payload FROM template_list_cache WHERE scope = ? AND cursor = ?',
    { replacements: [scope, cursor], type: QueryTypes.SELECT },
  );
  return rows[0] ? JSON.parse(rows[0].payload) : null;
}
export async function templateCacheGeneration(scope: string): Promise<number> {
  await ready();
  await sequelize.query('INSERT INTO template_cache_scopes (scope) VALUES (?) ON CONFLICT(scope) DO NOTHING', {
    replacements: [scope],
  });
  const rows = await sequelize.query<{ generation: number }>(
    'SELECT generation FROM template_cache_scopes WHERE scope = ?',
    { replacements: [scope], type: QueryTypes.SELECT },
  );
  return rows[0]!.generation;
}
export async function writeTemplateCache(scope: string, cursor: string, value: unknown, generation: number) {
  await ready();
  await sequelize.query(
    'INSERT INTO template_list_cache (scope, cursor, payload) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM template_cache_scopes WHERE scope = ? AND generation = ?) ON CONFLICT(scope, cursor) DO UPDATE SET payload = excluded.payload',
    { replacements: [scope, cursor, JSON.stringify(value), scope, generation] },
  );
}
export async function invalidateTemplateCache(scope: string) {
  await ready();
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      'INSERT INTO template_cache_scopes (scope, generation) VALUES (?, 1) ON CONFLICT(scope) DO UPDATE SET generation = generation + 1',
      { replacements: [scope], transaction },
    );
    await sequelize.query('DELETE FROM template_list_cache WHERE scope = ?', { replacements: [scope], transaction });
  });
}
