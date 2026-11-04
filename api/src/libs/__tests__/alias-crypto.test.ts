import { describe, test, expect } from '@jest/globals';
import { createHmac, randomBytes } from 'crypto';

jest.mock('../auth', () => ({
  wallet: { secretKey: '00'.repeat(32), address: 'z1TestNode' },
}));

// eslint-disable-next-line import/first
import { getSigner, types } from '@ocap/mcrypto';
// eslint-disable-next-line import/first
import { fromSecretKey } from '@ocap/wallet';
// eslint-disable-next-line import/first
import {
  ALIAS_REGEX,
  normalizeAlias,
  normalizeDomain,
  generateDomainKey,
  domainKeyFingerprint,
  aliasHash,
  encryptAlias,
  decryptAlias,
  encryptDomainKey,
  decryptDomainKey,
  buildBindingMessage,
  verifyBindingProof,
} from '../alias-crypto';

describe('alias-crypto', () => {
  test('normalizeAlias lowercases and trims', () => {
    expect(normalizeAlias('  Alice ')).toBe('alice');
    expect(ALIAS_REGEX.test(normalizeAlias('alice_01-x'))).toBe(true);
    expect(ALIAS_REGEX.test('ab')).toBe(false);
    expect(ALIAS_REGEX.test('has.dot')).toBe(false);
    expect(ALIAS_REGEX.test('UPPER')).toBe(false); // 正则只接受已归一化的小写
  });

  test('normalizeDomain converts to punycode', () => {
    expect(normalizeDomain('DIDMail.IO')).toBe('didmail.io');
    expect(normalizeDomain('例子.cn')).toBe('xn--fsqu00a.cn');
  });

  test('aliasHash matches independent HMAC computation', () => {
    const key = generateDomainKey();
    const expected = createHmac('sha256', Buffer.from(key, 'base64')).update('alice@didmail.io').digest('hex');
    expect(aliasHash(key, 'Alice', 'DIDMail.IO')).toBe(expected);
    // 无 key 不可正向计算：不同 key 结果不同
    expect(aliasHash(generateDomainKey(), 'alice', 'didmail.io')).not.toBe(expected);
  });

  test('encryptAlias/decryptAlias round-trip; ciphertext contains no plaintext', () => {
    const key = generateDomainKey();
    const enc = encryptAlias(key, 'alice');
    expect(enc).not.toContain('alice');
    expect(Buffer.from(enc, 'base64').toString('utf8')).not.toContain('alice');
    expect(decryptAlias(key, enc)).toBe('alice');
    expect(() => decryptAlias(generateDomainKey(), enc)).toThrow();
  });

  test('domainKey encrypt/decrypt round-trip + fingerprint', () => {
    const key = generateDomainKey();
    expect(decryptDomainKey(encryptDomainKey(key))).toBe(key);
    expect(domainKeyFingerprint(key)).toMatch(/^[0-9a-f]{16}$/);
  });

  test('bindingProof sign/verify round-trip with a real wallet', async () => {
    // ed25519 的 secretKey 需为完整的 64 字节密钥（seed‖pk），故先用随机种子生成密钥对
    const keyPair = getSigner(types.KeyType.ED25519).genKeyPair('hex', randomBytes(32));
    const w = fromSecretKey(keyPair.secretKey as string);
    const msg = buildBindingMessage('alice@didmail.io', w.address, 1820000000);
    expect(msg).toBe(`didmail:alias:alice@didmail.io:${w.address}:1820000000`);
    const sig = w.sign(msg);
    await expect(verifyBindingProof(w.publicKey, msg, sig)).resolves.toBe(true);
    await expect(verifyBindingProof(w.publicKey, `${msg}x`, sig)).resolves.toBe(false);
  });
});
