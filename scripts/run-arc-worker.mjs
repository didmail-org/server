// Local development wiring: ARC serves the UI/identity; business code runs inside workerd.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';
import ts from 'typescript';
import http from 'node:http';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import createChainForward from './arc-chain-bridge.mjs';
import { previewPersistenceOptions } from './preview-persistence.mjs';
import { previewChainOutbound } from './preview-outbound.mjs';
import { arcResponseHeaders } from './arc-response-headers.mjs';
import { previewRouting } from './preview-routing.mjs';
import { previewMembersConfiguration } from './preview-members.mjs';
import { previewArcService } from './preview-arc-service.mjs';
const config = ts.parseConfigFileTextToJson('wrangler.jsonc', await fs.readFile('wrangler.jsonc', 'utf8')).config;
const origin = process.env.DIDMAIL_ARC_PREVIEW_URL || 'http://didmail-server.localhost:8788';
const instance = process.env.DIDMAIL_ARC_INSTANCE || 'didmail-web';
let arc = process.env.DIDMAIL_LOCAL_ARC_URL;
if (!arc) {
  const inspect = () => spawnSync('arc', ['service', 'status', '--instance', instance, '--json'], { encoding: 'utf8' });
  let result = inspect();
  let record;
  try {
    record = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
  } catch {}
  if (!record || record.status !== 'up') {
    result = spawnSync(
      'arc',
      [
        'service',
        'start',
        '--purpose',
        'evidence',
        '--instance',
        instance,
        '--home',
        path.resolve('.arc', instance),
        '--port',
        '0',
        '--blocklet',
        path.resolve('blocklet/dist'),
        '--json',
      ],
      { encoding: 'utf8', env: { ...process.env, ARC_DEV_LIVE_RENDER: '0' } },
    );
    if (result.status !== 0) throw new Error(result.stderr || 'ARC failed to start');
    record = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
  }
  if (!record.blocklets?.includes(path.resolve('blocklet/dist')))
    throw new Error('ARC instance belongs to another application package');
  arc = `http://127.0.0.1:${record.port}`;
}
const port = Number(new URL(origin).port || 80);
try {
  await fs.access('.dev.vars');
} catch {
  const result = spawnSync(process.execPath, ['scripts/setup.mjs'], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Development wallet setup failed');
  const wallet = JSON.parse(await fs.readFile('.data/node-wallet.json', 'utf8'));
  await fs.writeFile('.dev.vars', `NODE_SECRET_KEY=${wallet.secretKey}\nNODE_ADDRESS=${wallet.address}\n`, {
    mode: 0o600,
    flag: 'wx',
  });
}
const secrets = parse(await fs.readFile('.dev.vars'));
const members = previewMembersConfiguration({ bindings: { ...config.vars, ...secrets }, arc, publicOrigin: origin });
const routing = previewRouting({
  origin,
  arc,
  aliases: process.env.DIDMAIL_ARC_PREVIEW_ALIASES,
  listenHost: process.env.DIDMAIL_ARC_PREVIEW_HOST,
});
const forward = async (request) => {
  let route;
  try {
    route = routing.resolve(request.url);
  } catch {
    return new Response('Unconfigured preview origin', { status: 421 });
  }
  const { target, publicOrigin } = route;
  const headers = new Headers(request.headers);
  headers.set('host', new URL(publicOrigin).host);
  headers.set('x-forwarded-host', new URL(publicOrigin).host);
  headers.set('x-forwarded-proto', new URL(publicOrigin).protocol.slice(0, -1));
  const body = !['GET', 'HEAD'].includes(request.method) ? Buffer.from(await request.arrayBuffer()) : undefined;
  headers.set('accept-encoding', 'identity');
  headers.delete('connection');
  headers.delete('transfer-encoding');
  headers.delete('content-length');
  if (body) headers.set('content-length', String(body.length));
  return new Promise((resolve, reject) => {
    const transport = target.protocol === 'https:' ? https : http;
    const upstream = transport.request(
      target,
      { method: request.method, headers: Object.fromEntries(headers) },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          const responseHeaders = arcResponseHeaders(response.headers);
          resolve(
            new Response(
              request.method === 'HEAD' || [204, 205, 304].includes(response.statusCode) ? null : Buffer.concat(chunks),
              { status: response.statusCode, headers: responseHeaders },
            ),
          );
        });
      },
    );
    upstream.setTimeout(10000, () => upstream.destroy(new Error('Local ARC request timed out')));
    upstream.on('error', reject);
    upstream.end(body);
  });
};
// A separate internal Service Binding exercises the daemon's chain data plane.
// Public /afs requests still use the normal ARC identity/forwarded-host gate.
const chainForward = createChainForward(arc);
const arcService = await previewArcService(forward);
const mf = new Miniflare(
  convertV4MiniflareOptions({
    name: 'didmail-arc-preview',
    port,
    host: routing.listenHost,
    modules: true,
    scriptPath: '.worker/index.mjs',
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    bindings: { ...members.workerBindings, DIDMAIL_URL: origin, ARC_RENDER_UI: 'true' },
    d1Databases: { DB: config.d1_databases[0].database_id },
    r2Buckets: { BLOBS: config.r2_buckets[0].bucket_name },
    ...previewPersistenceOptions('.wrangler/state/arc-preview'),
    serviceBindings: {
      ARC: arcService.binding,
      ARC_CHAIN: chainForward,
      ASSETS: arcService.binding,
      ...members.serviceBindings,
    },
    ...(process.env.DIDMAIL_PREVIEW_USE_NODE_NETWORK === '1'
      ? { outboundService: previewChainOutbound(secrets.CHAIN_HOST || config.vars.CHAIN_HOST) }
      : {}),
  }),
);
await mf.ready;
const db = await mf.getD1Database('DB');
await db.prepare('CREATE TABLE IF NOT EXISTS didmail_preview_migrations (name TEXT PRIMARY KEY)').run();
for (const name of (await fs.readdir('workers/migrations')).sort()) {
  if (await db.prepare('SELECT name FROM didmail_preview_migrations WHERE name = ?').bind(name).first()) continue;
  const sql = await fs.readFile(path.join('workers/migrations', name), 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.replace(/^--.*$/gm, '').trim())
    .filter(Boolean)
    .map((s) =>
      s
        .replace(/^CREATE TABLE (?!IF NOT EXISTS\b)/i, 'CREATE TABLE IF NOT EXISTS ')
        .replace(/^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS\b)/i, (_m, u) => `CREATE ${u || ''}INDEX IF NOT EXISTS `),
    );
  await db.batch([
    ...statements.map((s) => db.prepare(s)),
    db.prepare('INSERT INTO didmail_preview_migrations VALUES (?)').bind(name),
  ]);
}
console.log(`ARC + workerd ready: ${origin}\nAdmin: ${origin}/admin\nARC upstream: ${arc}`);
const cronSeconds = Number(process.env.DIDMAIL_PREVIEW_CRON_SECONDS || 0);
if (!Number.isInteger(cronSeconds) || (cronSeconds !== 0 && (cronSeconds < 5 || cronSeconds > 3600)))
  throw new Error('Preview cron interval must be zero or 5–3600 seconds');
let cronBusy = false;
const cronTimer = cronSeconds
  ? setInterval(async () => {
      if (cronBusy) return;
      cronBusy = true;
      try {
        const worker = await mf.getWorker();
        await worker.scheduled({ cron: '* * * * *' });
      } catch (error) {
        console.error('Preview scheduled event failed:', error.message);
      } finally {
        cronBusy = false;
      }
    }, cronSeconds * 1000)
  : undefined;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    if (cronTimer) clearInterval(cronTimer);
    mf.dispose()
      .then(() => arcService.close())
      .then(() => process.exit(0));
  });
