import { createPrivateKey, createPublicKey, verify } from 'node:crypto';
import { fromPublicKey, fromSecretKey, WalletType } from '@ocap/wallet';
import { types } from '@ocap/mcrypto';
import createNodeWallet from '../../blocklet/providers/didmail-http/source/api/src/libs/node-wallet';

// Declared public seed only. Node's Ed25519 derives the public key independently
// of the SDK; the challenge is deliberately not a transaction or signing input.
const seed = Buffer.alloc(32, 1);
const key = createPrivateKey({
  key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
  format: 'der',
  type: 'pkcs8',
});
const publicKey = createPublicKey(key);
const publicBytes = (publicKey.export({ format: 'der', type: 'spki' }) as Buffer).subarray(-32);
const type = WalletType({
  role: types.RoleType.ROLE_APPLICATION,
  pk: types.KeyType.ED25519,
  hash: types.HashType.SHA3,
});
const { address } = fromPublicKey(publicBytes, type);

test.each([`0x${seed.toString('hex')}`, `0x${Buffer.concat([seed, publicBytes]).toString('hex')}`])(
  'explicit seed or coherent seed/public pair retains independently derived node identity and signing authority',
  async (secret) => {
    const wallet = createNodeWallet(secret, address);
    expect(wallet.address).toBe(address);
    expect(Buffer.from(wallet.publicKey.replace(/^0x/, ''), 'hex')).toEqual(publicBytes);
    const challenge = Buffer.from('DIDMail public node ownership check; not a transaction');
    const signature = wallet.sign(challenge);
    expect(await wallet.verify(challenge, signature)).toBe(true);
    const hash = wallet.hash(challenge);
    expect(
      verify(
        null,
        Buffer.from(hash.replace(/^0x/, ''), 'hex'),
        publicKey,
        Buffer.from(signature.replace(/^0x/, ''), 'hex'),
      ),
    ).toBe(true);
  },
);

test('bare hex advertised identity does not prove ownership and is rejected instead of silently changed', async () => {
  const bare = seed.toString('hex');
  const old = fromSecretKey(bare, type);
  const challenge = Buffer.from('DIDMail public node ownership check; not a transaction');
  expect(old.address).not.toBe(address);
  expect(await old.verify(challenge, old.sign(challenge))).toBe(false);
  expect(() => createNodeWallet(bare, old.address)).toThrow('explicitly 0x-prefixed');
});

test('explicit seed/public pair with unrelated public half is rejected before use', () => {
  expect(() => createNodeWallet(`0x${Buffer.concat([seed, Buffer.alloc(32, 2)]).toString('hex')}`)).toThrow(
    'inconsistent public key',
  );
});

test('a valid secret cannot silently replace a different configured node identity', () => {
  expect(() => createNodeWallet(`0x${seed.toString('hex')}`, 'different-node')).toThrow('Node wallet address mismatch');
});

test.each(['', '0x01', `0X${seed.toString('hex')}`, `0x${'gg'.repeat(32)}`, ` 0x${seed.toString('hex')}`])(
  'invalid or ambiguous node encoding is rejected',
  (secret) => expect(() => createNodeWallet(secret)).toThrow(),
);
