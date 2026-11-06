import { sha256 } from './vendor/noble-hashes/sha2.js';
import { sha3_256, sha3_384, sha3_512, keccak_256, keccak_384, keccak_512 } from './vendor/noble-hashes/sha3.js';

// ABT DID checksum contract, checked against the installed @arcblock/did.
// Protocol 1 accepts canonical base58 ArcBlock identities only.
export function canonicalMailDid(value) {
  if (typeof value !== 'string' || !/^did:abt:z[1-9A-HJ-NP-Za-km-z]{20,64}$/.test(value)) throw Object.assign(new Error('Canonical ArcBlock DID required'), { code: 'INVALID_DID', status: 400 });
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let number = 0n;
  for (const char of value.slice(9)) number = number * 58n + BigInt(alphabet.indexOf(char));
  const hex = number.toString(16).padStart(52, '0');
  if (hex.length !== 52) throw Object.assign(new Error('Invalid DID length'), { code: 'INVALID_DID', status: 400 });
  const bytes = Uint8Array.from(hex.match(/../g), byte => parseInt(byte, 16));
  const hash = [keccak_256, sha3_256, keccak_384, sha3_384, keccak_512, sha3_512, sha256][bytes[1] & 31];
  if (!hash || !hash(bytes.slice(0, 22)).slice(0, 4).every((byte, i) => byte === bytes[22 + i])) throw Object.assign(new Error('Invalid DID checksum'), { code: 'INVALID_DID', status: 400 });
  return value;
}
