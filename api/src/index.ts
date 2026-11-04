import 'express-async-errors';
import fs from 'fs';
import http from 'http';
import express, { ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import httpProxy from 'http-proxy';
import withNodeScope from './libs/node-scope';
import env from './libs/env';
import getWallet from './runtime/wallet';
import { initializeDatabase } from './runtime/database';
import { readArcSession } from './runtime/session';
import routes from './routes';
import sequelize from './libs/sqlite';
import logger from './libs/logger';
import { startAttachmentCleanupScheduler } from './libs/attachment-cleanup';

const { version } = require('../../package.json');

export function createApp() {
  const app = express();
  const proxy = httpProxy.createProxyServer({ target: env.arcUrl, ws: true });
  app.set('trust proxy', 'loopback');
  // ARC beta.66 serves custom web-cache assets with an HTML MIME default.
  // Preserve its bytes and correct the response type at the compatibility gateway.
  proxy.on('proxyRes', (upstream, req) => {
    const pathname = (req.url || '').split('?')[0] || '';
    if (upstream.statusCode !== 200 || !/^(\/assets\/|\/images\/|\/logo\.svg$|\/favicon\.ico$)/.test(pathname)) return;
    const types: Record<string, string> = {
      js: 'application/javascript; charset=utf-8',
      css: 'text/css; charset=utf-8',
      svg: 'image/svg+xml',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      ico: 'image/x-icon',
      woff: 'font/woff',
      woff2: 'font/woff2',
    };
    const extension = pathname.split('.').pop() || '';
    if (types[extension]) upstream.headers['content-type'] = types[extension];
  });

  proxy.on('error', (_error, _req, res) => {
    if ('writeHead' in res && !res.headersSent) {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'ARC runtime unavailable' }));
    } else if ('destroy' in res) res.destroy();
  });
  // Proxy before parsing bodies so ARC receives the original bytes and cookies.
  const prepareProxy = (req: http.IncomingMessage) => {
    req.headers.host = env.arcHost;
    req.headers['x-forwarded-host'] = new URL(env.appUrl).host;
    req.headers['x-forwarded-proto'] = new URL(env.appUrl).protocol.slice(0, -1);
  };
  app.use((req, res, next) => {
    if (
      req.path === '/api/afs/rpc' ||
      req.path.startsWith('/.well-known/') ||
      req.path === '/__blocklet__.js' ||
      req.path === '/__meta__.js' ||
      req.path === '/mcp' ||
      req.path.startsWith('/mcp/') ||
      req.path === '/afs' ||
      req.path.startsWith('/afs/') ||
      req.path === '/ws'
    ) {
      prepareProxy(req);
      proxy.web(req, res);
      return;
    }
    next();
  });
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cors());
  app.get('/runtime-config.js', (_req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .type('js')
      .send(
        `window.blocklet=${JSON.stringify({
          prefix: '/',
          CHAIN_ID: process.env.CHAIN_ID || 'beta',
          mode: process.env.NODE_ENV || 'development',
          version,
          appUrl: env.appUrl,
          REVOKE_WAITING_PERIOD: env.revokeWaitingPeriod,
        }).replace(/</g, '\\u003c')};`,
      );
  });
  app.get('/api/health', async (_req, res) => {
    await sequelize.authenticate();
    res.json({ status: 'ok', runtime: 'arc', version, node: getWallet().address });
  });
  app.get('/api/runtime/session', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      res.json(withNodeScope(await readArcSession(req)));
    } catch {
      res.status(503).json({ message: 'ARC identity service unavailable' });
    }
  });
  app.use('/api', routes);
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));
  // ARC Web Device serves the React bundle. Client routes share its index.
  app.use((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.sendStatus(405);
      return;
    }
    if (req.path === '/admin' || req.path.startsWith('/admin/')) req.url = '/';
    prepareProxy(req);
    proxy.web(req, res);
  });
  // Express identifies error handlers by their four arguments.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(((error, _req, res, _next) => {
    logger.error(error.message);
    res
      .status(error.status || 500)
      .json({ message: error.status === 413 ? 'Request too large' : 'Internal server error' });
  }) as ErrorRequestHandler);
  return { app, proxy, prepareProxy };
}

export async function startServer() {
  fs.mkdirSync(env.dataDir, { recursive: true, mode: 0o700 });
  await initializeDatabase();
  const { app, proxy, prepareProxy } = createApp();
  const server = http.createServer(app);
  server.on('upgrade', (req, socket, head) => {
    prepareProxy(req);
    proxy.ws(req, socket, head);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.port, process.env.DIDMAIL_HOST || '127.0.0.1', () => resolve());
  });
  const stopCleanup = startAttachmentCleanupScheduler();
  const close = async () => {
    stopCleanup();
    proxy.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await sequelize.close();
  };
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  logger.info(`DIDMail ARC v${version} ready at ${env.appUrl}`);
  return { server, close };
}
if (require.main === module)
  startServer().catch((error) => {
    logger.error(error.message);
    process.exit(1);
  });
