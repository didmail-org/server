import { env } from 'cloudflare:workers';
export interface Bindings {
  DB: D1Database;
  BLOBS: R2Bucket;
  ASSETS: Fetcher;
  ARC?: Fetcher;
  ARC_CHAIN?: Fetcher;
  ARC_MEMBERS?: Fetcher;
  NODE_SECRET_KEY?: string;
  NODE_ADDRESS?: string;
  DIDMAIL_URL: string;
  [key: string]: unknown;
}
export const bindings = env as unknown as Bindings;
export const value = (name: string, fallback = ''): string => String(bindings[name] ?? fallback);
