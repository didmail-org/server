import { describe, test, expect, beforeEach } from '@jest/globals';

jest.mock('../support/node/libs/env', () => ({
  __esModule: true,
  default: {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    dataDir: require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'didmail-alias-domain-')),
    chainHost: 'https://beta.abtnetwork.io/api/',
    appId: 'zNKTestAppId',
  },
}));

jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/auth', () => ({
  wallet: { secretKey: '00'.repeat(32), address: 'z1TestNode' },
}));

// eslint-disable-next-line import/first
import { DomainBinding } from '../support/node/libs/sqlite';
// eslint-disable-next-line import/first
import {
  addDomain,
  verifyDomain,
  recheckDomains,
  assertAliasWritable,
  listPublicDomains,
  unbindDomain,
  makeChallenge,
  AliasGateError,
  DOMAIN_GRACE_MS,
} from '../../blocklet/providers/didmail-http/source/api/src/libs/alias-domain';

const txtWith = (challenge: string) => (name: string) => {
  expect(name).toBe('_didmail-challenge.didmail.io');
  return Promise.resolve([`"didmail-verify=${challenge}"`]);
};
const txtEmpty = () => Promise.resolve([] as string[]);

describe('alias-domain', () => {
  beforeEach(async () => {
    await DomainBinding.sync({ force: true });
  });

  test('addDomain creates pending row with challenge', async () => {
    const row = await addDomain('DIDMail.IO');
    expect(row.get('domain')).toBe('didmail.io');
    expect(row.get('status')).toBe('pending');
    expect(row.get('challenge')).toBe(makeChallenge('didmail.io'));
  });

  test('verifyDomain succeeds when TXT matches, stores encrypted key', async () => {
    const challenge = makeChallenge('didmail.io');
    await addDomain('didmail.io');
    const row = await verifyDomain('didmail.io', txtWith(challenge));
    expect(row.get('status')).toBe('verified');
    expect(row.get('domainKeyEnc')).toBeTruthy();
    expect(row.get('verifiedAt')).toBeGreaterThan(0);
  });

  test('verifyDomain fails when TXT missing', async () => {
    await addDomain('didmail.io');
    await expect(verifyDomain('didmail.io', txtEmpty)).rejects.toMatchObject({
      statusCode: 400,
      code: 'DNS_VERIFICATION_FAILED',
    });
  });

  test('re-verifying an already-verified domain keeps the domain key stable', async () => {
    const fetcher = txtWith(makeChallenge('didmail.io'));
    await addDomain('didmail.io');
    const first = await verifyDomain('didmail.io', fetcher);
    const keyEnc = first.get('domainKeyEnc');
    expect(keyEnc).toBeTruthy();
    const second = await verifyDomain('didmail.io', fetcher);
    expect(second.get('status')).toBe('verified');
    expect(second.get('domainKeyEnc')).toBe(keyEnc);
  });

  test('gate: register blocked before verification and allowed after', async () => {
    await expect(assertAliasWritable('didmail.io')).rejects.toBeInstanceOf(AliasGateError);
    await addDomain('didmail.io');
    await expect(assertAliasWritable('didmail.io')).rejects.toMatchObject({ statusCode: 409 });
    await verifyDomain('didmail.io', txtWith(makeChallenge('didmail.io')));
    const row = await assertAliasWritable('didmail.io');
    expect(row.get('status')).toBe('verified');
  });

  test('recheck: verified → grace → verified on recovery; grace expiry → unbound', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtWith(makeChallenge('didmail.io')));

    await recheckDomains(txtEmpty);
    let row = await DomainBinding.findOne({ where: { domain: 'didmail.io' } });
    expect(row!.get('status')).toBe('grace');
    expect(row!.get('graceUntil')).toBeGreaterThan(Date.now() + DOMAIN_GRACE_MS - 60_000);

    await recheckDomains(txtWith(makeChallenge('didmail.io')));
    row = await DomainBinding.findOne({ where: { domain: 'didmail.io' } });
    expect(row!.get('status')).toBe('verified');

    // grace 过期 → unbound
    await recheckDomains(txtEmpty);
    await DomainBinding.update({ graceUntil: Date.now() - 1000 }, { where: { domain: 'didmail.io' } });
    await recheckDomains(txtEmpty);
    row = await DomainBinding.findOne({ where: { domain: 'didmail.io' } });
    expect(row!.get('status')).toBe('unbound');
    expect(row!.get('domainKeyEnc')).toBeNull();
  });

  test('grace blocks writes but resolve path stays readable', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtWith(makeChallenge('didmail.io')));
    await recheckDomains(txtEmpty);
    await expect(assertAliasWritable('didmail.io')).rejects.toMatchObject({
      statusCode: 409,
      code: 'DOMAIN_NOT_VERIFIED',
    });
    const pub = await listPublicDomains();
    expect(pub.enabled).toBe(false); // 无 verified 域名 → 功能关闭
    expect(pub.domains[0]!.status).toBe('grace'); // 但域名仍可见（读宽）
  });

  test('listPublicDomains enabled when any verified domain exists', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtWith(makeChallenge('didmail.io')));
    const pub = await listPublicDomains();
    expect(pub.enabled).toBe(true);
    expect(pub.domains[0]!.domainKeyFingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  test('unbindDomain moves to unbound and wipes key', async () => {
    await addDomain('didmail.io');
    await verifyDomain('didmail.io', txtWith(makeChallenge('didmail.io')));
    const row = await unbindDomain('didmail.io');
    expect(row.get('status')).toBe('unbound');
    expect(row.get('domainKeyEnc')).toBeNull();
  });
});
