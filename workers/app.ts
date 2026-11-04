import withNodeScope from '../api/src/libs/node-scope';
import 'express-async-errors';
import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import axios from 'axios';
import routes from '../api/src/routes';
import { readArcSession } from './session';
// Use the native transport for DNS-over-HTTPS, SVG and other Axios requests too.
axios.defaults.adapter = 'fetch';
const app = express();
app.set('trust proxy', false);
// Fetch bodies may arrive without HTTP/1 transfer headers; Express/type-is uses them to detect a body.
app.use((req, _res, next) => {
  if (!['GET', 'HEAD'].includes(req.method) && !req.headers['content-length'] && !req.headers['transfer-encoding'])
    req.headers['transfer-encoding'] = 'chunked';
  next();
});
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cors());
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
app.use((error: any, _req: any, res: any, _next: any) => {
  console.error(error.message);
  res
    .status(error.status || 500)
    .json({ message: error.status === 413 ? 'Request too large' : 'Internal server error' });
});
const server = createServer(app);
server.listen(8080);
export default httpServerHandler({ port: 8080 });
