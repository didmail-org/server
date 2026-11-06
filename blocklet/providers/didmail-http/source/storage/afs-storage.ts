import type { FetchPort, ObjectStore, SqlDatabase } from '../runtime/contracts';
// Native SQL/object client over the private ARC_STORAGE port. The provider
// owns durable AFS commits; these interfaces preserve persisted SQL predicates.
type StatementInput = { sql: string; params: unknown[] };
export function createAfsStorage(binding: FetchPort) {
  const parameter = (value: any) => value instanceof ArrayBuffer ? { bytes: Buffer.from(value).toString('base64') } : ArrayBuffer.isView(value) ? { bytes: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') } : value;
  const results = (batch: any[]) => batch.map(result => ({ ...result, results: result.results.map((row: object) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value && typeof value === 'object' && 'bytes' in value ? [...Buffer.from(value.bytes, 'base64')] : value]))) }));
  const call = async (input: unknown) => {
    if (!binding) throw new Error('AFS business storage binding unavailable');
    const response = await binding.fetch(new Request('http://arc-storage.internal/storage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }));
    const body = await response.json() as any;
    if (!response.ok) throw Object.assign(new Error(body.error || 'Instance business storage unavailable'), { code: body.code, status: response.status });
    return body.data;
  };
  class Statement {
    constructor(readonly input: StatementInput) {}
    bind(...params: unknown[]) { return new Statement({ ...this.input, params: params.map(parameter) }); }
    async all() { return results(await call({ op: 'transaction', statements: [this.input] }))[0]; }
    run() { return this.all(); }
    async first(column?: string) { const row = (await this.all()).results[0] ?? null; return column && row ? row[column] : row; }
    async raw(options?: { columnNames?: boolean }) { const rows = (await this.all()).results; const names = Object.keys(rows[0] ?? {}); return [...(options?.columnNames ? [names] : []), ...rows.map((row: object) => Object.values(row))]; }
  }
  const database = {
    prepare: (sql: string) => new Statement({ sql, params: [] }),
    batch: async (statements: Statement[]) => results(await call({ op: 'transaction', statements: statements.map(s => s.input) })),
    // Every operation reads the current AFS version; there are no replicas.
    withSession: () => ({ ...database, getBookmark: () => null }),
  };
  const metadata = (value: any) => ({ key: value.key, size: value.size, etag: value.sha256, httpEtag: '"' + value.sha256 + '"', uploaded: new Date(value.uploaded), httpMetadata: value.httpMetadata, customMetadata: value.customMetadata ?? {} });
  const objects = {
    async get(key: string) {
      const value = await call({ op: 'get', key }); if (!value) return null;
      const bytes = Uint8Array.from(Buffer.from(value.bytes, 'base64'));
      return { ...metadata(value), body: new Response(bytes).body, arrayBuffer: async () => bytes.buffer, text: async () => new TextDecoder().decode(bytes), json: async () => JSON.parse(new TextDecoder().decode(bytes)) };
    },
    async head(key: string) { const value = await call({ op: 'head', key }); return value ? metadata(value) : null; },
    async put(key: string, input: any, options?: { httpMetadata?: object }) {
      const bytes = new Uint8Array(await new Response(input).arrayBuffer());
      return metadata(await call({ op: 'put', key, bytes: Buffer.from(bytes).toString('base64'), httpMetadata: options?.httpMetadata ?? {} }));
    },
    delete: (keys: string | string[]) => call({ op: 'delete', keys }),
  };
  return { database: database as unknown as SqlDatabase, objects: objects as unknown as ObjectStore };
}
