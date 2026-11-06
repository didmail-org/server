// DIDMail's native business ports. SQL statements preserve existing transaction
// predicates; no Cloudflare resource or SDK type is required by the application.
export interface FetchPort { fetch(request: Request): Promise<Response>; }
export interface TaskContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException?(): void; }
export interface QueryResult<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes: number; last_row_id: number; [key: string]: unknown };
}
export interface SqlStatement {
  bind(...values: unknown[]): SqlStatement;
  all<T = Record<string, unknown>>(): Promise<QueryResult<T>>;
  run<T = Record<string, unknown>>(): Promise<QueryResult<T>>;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>;
}
export interface SqlSession {
  prepare(sql: string): SqlStatement;
  batch<T = Record<string, unknown>>(statements: SqlStatement[]): Promise<QueryResult<T>[]>;
  getBookmark(): string | null;
}
export interface SqlDatabase extends Omit<SqlSession, 'getBookmark'> {
  withSession(bookmark?: string): SqlSession;
}
export interface StoredObject {
  key: string; size: number; etag: string; httpEtag: string; uploaded: Date;
  httpMetadata: Record<string, string>; customMetadata: Record<string, string>;
  body: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
}
export interface ObjectStore {
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<Omit<StoredObject, 'body' | 'arrayBuffer' | 'text' | 'json'> | null>;
  put(key: string, value: BodyInit | null, options?: { httpMetadata?: Record<string, string> }): Promise<unknown>;
  delete(keys: string | string[]): Promise<unknown>;
}
