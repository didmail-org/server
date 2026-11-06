// HTTP compatibility fixture only. No startup/exported product server: the
// assertions exercise retained signed-download routes through their Node ports.
import 'express-async-errors';
import http from 'http';
import express, { ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import routes from '../../blocklet/providers/didmail-http/source/api/src/routes/index';
import env from './node/libs/env';

// eslint-disable-next-line import/prefer-default-export
export function createApp() {
  const app = express();
  const forward = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const target = new URL(req.url || '/', env.arcUrl);
    const upstream = http.request(
      target,
      { method: req.method, headers: { ...req.headers, host: env.arcHost } },
      (response) => {
        const headers = { ...response.headers };
        const extension = target.pathname.split('.').pop();
        if (response.statusCode === 200 && target.pathname.startsWith('/assets/')) {
          if (extension === 'js') headers['content-type'] = 'application/javascript';
          if (extension === 'css') headers['content-type'] = 'text/css';
        }
        res.writeHead(response.statusCode || 503, headers);
        response.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(503);
      res.end();
    });
    req.pipe(upstream);
  };
  app.use((req, res, next) => {
    if (req.path === '/api/afs/rpc') forward(req, res);
    else next();
  });
  app.use(cookieParser(), express.json({ limit: '1mb' }), express.urlencoded({ extended: true, limit: '1mb' }), cors());
  app.get('/runtime-config.js', (_req, res) =>
    res.type('js').send(`window.blocklet=${JSON.stringify({ prefix: '/', appUrl: env.appUrl })};`),
  );
  app.use('/api', routes);
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));
  app.use((req, res) => forward(req, res));
  // Express recognizes an error handler by all four arguments.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(((error, _req, res, _next) =>
    res.status(error.status || 500).json({ message: 'Internal server error' })) as ErrorRequestHandler);
  return app;
}
