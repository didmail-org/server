/** Caller identity returned by the selected ARC session authority. */
export interface ArcSession {
  authenticated: boolean;
  user: null | { did: string; role: string; fullName?: string; sourceProvider?: string };
  provider?: string;
}

/** Parse the same authority response on any host; callers still verify HTTP status and limits. */
export function parseArcSession(body: string): ArcSession {
  const session = JSON.parse(body) as ArcSession;
  if (
    typeof session.authenticated !== 'boolean' ||
    (session.authenticated &&
      (!session.user || typeof session.user.did !== 'string' || typeof session.user.role !== 'string'))
  )
    throw new Error('Invalid ARC session');
  return session;
}
