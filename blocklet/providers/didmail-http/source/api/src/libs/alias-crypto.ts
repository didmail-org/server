import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { domainToASCII } from 'url';

import { fromPublicKey } from '@ocap/wallet';

import { wallet } from './auth';

export const ALIAS_REGEX = /^[a-z0-9_-]{4,32}$/;

export const normalizeAlias = (alias: string): string => alias.trim().toLowerCase();

export const normalizeDomain = (domain: string): string => domainToASCII(domain.trim().toLowerCase());

export const generateDomainKey = (): string => randomBytes(32).toString('base64');

export const domainKeyFingerprint = (domainKey: string): string =>
  createHash('sha256').update(Buffer.from(domainKey, 'base64')).digest('hex').slice(0, 16);

export const aliasHash = (domainKey: string, alias: string, domain: string): string =>
  createHmac('sha256', Buffer.from(domainKey, 'base64'))
    .update(`${normalizeAlias(alias)}@${normalizeDomain(domain)}`)
    .digest('hex');

// base64(iv(12) ‖ tag(16) ‖ ciphertext)
export const encryptAlias = (domainKey: string, alias: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(domainKey, 'base64'), iv);
  const ct = Buffer.concat([cipher.update(alias, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
};

export const decryptAlias = (domainKey: string, payload: string): string => {
  const buf = Buffer.from(payload, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(domainKey, 'base64'), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
};

// 惰性求值：仅在加解密时读取 wallet，避免 import 即依赖 blocklet 运行时
const masterKey = (): Buffer =>
  createHash('sha256')
    .update(Buffer.from(wallet.secretKey as string, 'hex'))
    .digest();

export const encryptDomainKey = (domainKey: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const ct = Buffer.concat([cipher.update(domainKey, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
};

export const decryptDomainKey = (payload: string): string => {
  const buf = Buffer.from(payload, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
};

export const buildBindingMessage = (address: string, did: string, expiresAt: number): string =>
  `didmail:alias:${address}:${did}:${expiresAt}`;

export const verifyBindingProof = async (pk: string, message: string, proof: string): Promise<boolean> => {
  try {
    return await fromPublicKey(pk).verify(message, proof);
  } catch {
    return false;
  }
};
