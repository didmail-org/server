import { toBase58, fromBase58 } from '@ocap/util';
import { createHash } from 'node:crypto';
import { encodeContactBytes, decodeContactBytes } from '../contact-base58';

test('chunked conversion exactly matches installed OCAP multibase for deterministic byte vectors and leading zeroes', () => {
  for (let length = 0; length < 512; length++) {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 73 + length * 17) % 256);
    bytes.fill(0, 0, Math.min(length, length % 17));
    const reference = toBase58(bytes);
    expect(encodeContactBytes(bytes)).toBe(reference);
    expect(decodeContactBytes(reference)).toEqual(new Uint8Array(fromBase58(reference)));
  }
  for (const length of [1, 8, 1024, 16384]) {
    const zeros = new Uint8Array(length);
    expect(encodeContactBytes(zeros)).toBe(`z${'1'.repeat(length)}`);
    expect(decodeContactBytes(`z${'1'.repeat(length)}`)).toEqual(zeros);
  }
});
test('full 64 KiB ciphertext-sized bytes round-trip and equal an independently fixed OCAP hash vector', () => {
  const bytes = Uint8Array.from({ length: 67 * 1024 }, (_, index) => (index * 73 + 19) % 256);
  const encoded = encodeContactBytes(bytes);
  // Independently generated with the installed @ocap/util encoder, not this implementation.
  expect(encoded.length).toBe(93696);
  expect(createHash('sha256').update(encoded).digest('hex')).toBe(
    '71f389422d3dd43733cef4144860d44b942a340832f3bb835436ee778fd83386',
  );
  expect(decodeContactBytes(encoded)).toEqual(bytes);
});
test.each(['', 'x123', 'z0', 'zO', 'zl', 'zI', 'z🙂', 'z1\n', `z${'1'.repeat(96000)}`])(
  'rejects malformed or oversized encoding',
  (value) => {
    expect(() => decodeContactBytes(value)).toThrow('INVALID_CONTACT_ENCODING');
  },
);
test('bounds memory for oversized raw transactions and all-zero encodings', () => {
  expect(() => encodeContactBytes(new Uint8Array(72 * 1024 + 1))).toThrow('INVALID_CONTACT_ENCODING');
  expect(() => decodeContactBytes(`z${'1'.repeat(72 * 1024 + 1)}`)).toThrow('INVALID_CONTACT_ENCODING');
});
