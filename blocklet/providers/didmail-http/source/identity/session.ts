import type { Request, Response, NextFunction } from 'express';
import { value } from '../runtime/bindings';
import { arcFetch } from './arc';
import { parseArcSession } from '../api/src/runtime/arc-session';
export async function readArcSession(req: Pick<Request, 'headers'>) {
  const headers = new Headers({ accept: 'application/json' });
  for (const name of ['cookie', 'authorization']) if (req.headers[name]) headers.set(name, String(req.headers[name]));
  const response = await arcFetch(
    new Request(new URL('/.well-known/service/api/did/session', value('DIDMAIL_URL')), {
      headers,
      signal: AbortSignal.timeout(5000),
    }),
  );
  if (!response.ok) throw new Error('ARC session verification failed');
  const body = await response.text();
  if (body.length > 128 * 1024) throw new Error('ARC session response too large');
  return parseArcSession(body);
}
export async function arcUser(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await readArcSession(req);
    if (!session.authenticated || !session.user) return res.status(401).json({ message: 'Unauthorized' });
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.cookie &&
      req.headers.origin !== new URL(value('DIDMAIL_URL')).origin
    )
      return res.status(403).json({ message: 'Invalid request origin' });
    req.user = {
      did: session.user.did,
      role: session.user.role,
      fullName: session.user.fullName || session.user.did,
      provider: 'arc',
      walletOS: '',
    };
    next();
  } catch {
    return res.status(503).json({ message: 'ARC identity service unavailable' });
  }
}
