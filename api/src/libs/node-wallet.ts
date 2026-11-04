import { fromSecretKey, WalletType, WalletObject } from '@ocap/wallet';
import { types } from '@ocap/mcrypto';

// An unprefixed hex string is interpreted as UTF-8 by the installed SDK. A
// 64-character string can therefore look like a seed|public-key pair while
// its public key does not belong to the seed used for signing. Reject it;
// silently changing the encoding could change an existing node's identity.
export default function createNodeWallet(secret: string, expectedAddress?: string): WalletObject {
  if (!/^0x[\da-f]{64}([\da-f]{64})?$/i.test(secret) || !secret.startsWith('0x'))
    throw new Error('Node secret key must be explicitly 0x-prefixed hexadecimal');
  const type = WalletType({
    role: types.RoleType.ROLE_APPLICATION,
    pk: types.KeyType.ED25519,
    hash: types.HashType.SHA3,
  });
  const candidate = fromSecretKey(secret, type);
  if (secret.length === 130) {
    const fromSeed = fromSecretKey(secret.slice(0, 66), type);
    if (candidate.publicKey !== fromSeed.publicKey) throw new Error('Node secret key has an inconsistent public key');
  }
  if (expectedAddress && expectedAddress !== candidate.address) throw new Error('Node wallet address mismatch');
  return candidate;
}
