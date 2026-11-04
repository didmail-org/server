import http from 'http';
import https from 'https';
import { Request, Response, NextFunction } from 'express';
import env from './env';

import { parseArcSession, type ArcSession } from './arc-session';

export type { ArcSession } from './arc-session';

// Ask the selected ARC instance to verify its own cookie/bearer. Never trust caller-supplied roles.
export function readArcSession(req: Request): Promise<ArcSession> {
  return new Promise((resolve, reject) => {
    const target = new URL('/.well-known/service/api/did/session', env.arcUrl);
    const transport = target.protocol === 'https:' ? https : http;
    const upstream = transport.request(
      target.toString(),
      {
        headers: {
          host: env.arcHost,
          accept: 'application/json',
          ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
          ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
        },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          body += chunk;
          if (body.length > 128 * 1024) response.destroy(new Error('ARC session response too large'));
        });
        response.on('error', reject);
        response.on('end', () => {
          try {
            if (response.statusCode !== 200) throw new Error('ARC session verification failed');
            resolve(parseArcSession(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    upstream.setTimeout(5000, () => upstream.destroy(new Error('ARC session verification timed out')));
    upstream.on('error', reject);
    upstream.end();
  });
}

export const arcUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await readArcSession(req);
    if (!session.authenticated || !session.user) return res.status(401).json({ message: 'Unauthorized' });
    // Cookie-authorized mutations must originate from this public entry point.
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.cookie &&
      req.headers.origin !== new URL(env.appUrl).origin
    ) {
      return res.status(403).json({ message: 'Invalid request origin' });
    }
    req.user = {
      did: session.user.did,
      role: session.user.role,
      fullName: session.user.fullName || session.user.did,
      provider: session.provider || session.user.sourceProvider || 'arc',
      walletOS: '',
    };
    next();
    return undefined;
  } catch {
    return res.status(503).json({ message: 'ARC identity service unavailable' });
  }
};
