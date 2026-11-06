import axios from 'axios';
import { createHash } from 'crypto';

import {
  decryptDomainKey,
  domainKeyFingerprint,
  encryptDomainKey,
  generateDomainKey,
  normalizeDomain,
} from './alias-crypto';
import env from '../../../config/env';
import { DomainBinding } from '../../../storage/database';

export type DomainStatus = 'pending' | 'verified' | 'grace' | 'unbound';
export const DOMAIN_GRACE_MS = 30 * 24 * 3600 * 1000;
export type TxtFetcher = (name: string) => Promise<string[]>;

export const dohTxtFetcher: TxtFetcher = async (name) => {
  const { data } = await axios.get('https://cloudflare-dns.com/dns-query', {
    params: { name, type: 'TXT' },
    headers: { accept: 'application/dns-json' },
    timeout: 10_000,
  });
  return ((data.Answer || []) as Array<{ data: string }>).map((a) => a.data);
};

export const makeChallenge = (domain: string): string =>
  createHash('sha256')
    .update(`${env.appId}:${normalizeDomain(domain)}`)
    .digest('hex')
    .slice(0, 32);

export class AliasGateError extends Error {
  statusCode: number;

  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const challengeName = (domain: string) => `_didmail-challenge.${normalizeDomain(domain)}`;
const expectedTxt = (domain: string) => `didmail-verify=${makeChallenge(domain)}`;
const txtMatches = (answers: string[], domain: string) =>
  answers.some((a) => a.replace(/^"|"$/g, '').split('""').join('') === expectedTxt(domain));

export const addDomain = async (domain: string) => {
  const d = normalizeDomain(domain);
  const [row] = await DomainBinding.findOrCreate({
    where: { domain: d },
    defaults: { domain: d, challenge: makeChallenge(d) },
  });
  if (row.get('status') === 'unbound') {
    await row.update({ status: 'pending', challenge: makeChallenge(d), verifiedAt: null, graceUntil: null });
  }
  return row;
};

export const verifyDomain = async (domain: string, fetcher: TxtFetcher = dohTxtFetcher) => {
  const d = normalizeDomain(domain);
  const row = await DomainBinding.findOne({ where: { domain: d } });
  if (!row) throw new AliasGateError(404, 'DOMAIN_NOT_FOUND', 'Domain not registered on this node');
  const answers = await fetcher(challengeName(d));
  if (!txtMatches(answers, d)) {
    throw new AliasGateError(400, 'DNS_VERIFICATION_FAILED', `TXT record ${expectedTxt(d)} not found`);
  }
  await row.update({
    status: 'verified',
    verifiedAt: Date.now(),
    lastCheckedAt: Date.now(),
    graceUntil: null,
    domainKeyEnc: (row.get('domainKeyEnc') as string | null) ?? encryptDomainKey(generateDomainKey()),
  });
  return row;
};

export const recheckDomains = async (fetcher: TxtFetcher = dohTxtFetcher) => {
  const rows = await DomainBinding.findAll({ where: { status: ['verified', 'grace'] } });
  await Promise.all(
    rows.map(async (row) => {
      const d = row.get('domain') as string;
      const answers = await fetcher(challengeName(d)).catch(() => [] as string[]);
      const ok = txtMatches(answers, d);
      if (row.get('status') === 'verified' && !ok) {
        await row.update({ status: 'grace', graceUntil: Date.now() + DOMAIN_GRACE_MS, lastCheckedAt: Date.now() });
      } else if (row.get('status') === 'grace' && ok) {
        await row.update({ status: 'verified', graceUntil: null, lastCheckedAt: Date.now() });
      } else if (row.get('status') === 'grace' && !ok && (row.get('graceUntil') as number) < Date.now()) {
        await row.update({ status: 'unbound', domainKeyEnc: null, lastCheckedAt: Date.now() });
      } else {
        await row.update({ lastCheckedAt: Date.now() });
      }
    }),
  );
};

export const assertAliasWritable = async (domain: string) => {
  const d = normalizeDomain(domain);
  const row = await DomainBinding.findOne({ where: { domain: d } });
  if (!row) throw new AliasGateError(409, 'FEATURE_NOT_ENABLED', 'This node has no verified domain');
  if (row.get('status') !== 'verified') {
    throw new AliasGateError(409, 'DOMAIN_NOT_VERIFIED', `Domain ${d} is not verified (status: ${row.get('status')})`);
  }
  return row;
};

export const listPublicDomains = async () => {
  const rows = await DomainBinding.findAll({ where: { status: ['verified', 'grace'] } });
  const domains = rows.map((r) => ({
    domain: r.get('domain') as string,
    status: r.get('status') as DomainStatus,
    aliasPrice: r.get('aliasPrice') as string,
    renewPricePerYear: r.get('renewPricePerYear') as string,
    minLength: r.get('minLength') as number,
    maxLength: r.get('maxLength') as number,
    domainKeyFingerprint: r.get('domainKeyEnc')
      ? domainKeyFingerprint(decryptDomainKey(r.get('domainKeyEnc') as string))
      : null,
  }));
  return { enabled: domains.some((d) => d.status === 'verified'), domains };
};

export const updateDomainPricing = async (
  domain: string,
  updates: Partial<{ aliasPrice: string; renewPricePerYear: string; minLength: number; maxLength: number }>,
) => {
  const row = await DomainBinding.findOne({ where: { domain: normalizeDomain(domain) } });
  if (!row) throw new AliasGateError(404, 'DOMAIN_NOT_FOUND', 'Domain not registered on this node');
  await row.update(updates);
  return row;
};

export const unbindDomain = async (domain: string) => {
  const row = await DomainBinding.findOne({ where: { domain: normalizeDomain(domain) } });
  if (!row) throw new AliasGateError(404, 'DOMAIN_NOT_FOUND', 'Domain not registered on this node');
  await row.update({ status: 'unbound', domainKeyEnc: null, graceUntil: null });
  return row;
};
