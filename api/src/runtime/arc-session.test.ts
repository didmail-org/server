import { parseArcSession } from './arc-session';

describe('ARC session authority response', () => {
  it('preserves a verified user and rejects incomplete authenticated identities', () => {
    const session = { authenticated: true, user: { did: 'fixture-did', role: 'owner', fullName: 'Fixture' } };
    expect(parseArcSession(JSON.stringify(session))).toEqual(session);
    for (const value of [
      { authenticated: true, user: null },
      { authenticated: true, user: { did: 'fixture-did' } },
      { authenticated: true, user: { did: 1, role: 'owner' } },
      { authenticated: 'true', user: { did: 'fixture-did', role: 'owner' } },
    ])
      expect(() => parseArcSession(JSON.stringify(value))).toThrow();
  });

  it('keeps an anonymous session anonymous and rejects invalid JSON', () => {
    expect(parseArcSession('{"authenticated":false,"user":null}')).toEqual({ authenticated: false, user: null });
    expect(() => parseArcSession('{')).toThrow();
  });
});
