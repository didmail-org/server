// Bounded multibase base58btc. Eight-digit chunks use exact (<2^47) Number
// arithmetic and native BigInt operations rather than per-byte quadratic JS loops.
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const radix = 58n ** 8n;
const invalid = (): never => {
  throw new Error('INVALID_CONTACT_ENCODING');
};

export function encodeContactBytes(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array) || bytes.length > 72 * 1024) return invalid();
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const hex = Buffer.from(bytes.subarray(zeros)).toString('hex');
  let number = hex ? BigInt(`0x${hex}`) : 0n;
  const chunks: string[] = [];
  while (number) {
    let remainder = Number(number % radix);
    number /= radix;
    let chunk = '';
    while (remainder) {
      chunk = alphabet[remainder % 58] + chunk;
      remainder = Math.floor(remainder / 58);
    }
    chunks.push(number ? chunk.padStart(8, '1') : chunk);
  }
  const result = `z${'1'.repeat(zeros)}${chunks.reverse().join('')}`;
  if (result.length > 96000) return invalid();
  return result;
}

export function decodeContactBytes(encoded: string): Uint8Array {
  if (typeof encoded !== 'string' || !encoded.startsWith('z') || encoded.length > 96000) return invalid();
  const body = encoded.slice(1);
  let number = 0n;
  let zeros = 0;
  while (zeros < body.length && body[zeros] === '1') zeros++;
  for (let offset = zeros; offset < body.length; offset += 8) {
    const chunk = body.slice(offset, offset + 8);
    let value = 0;
    for (const character of chunk) {
      const digit = alphabet.indexOf(character);
      if (digit < 0) return invalid();
      value = value * 58 + digit;
    }
    number = number * (chunk.length === 8 ? radix : 58n ** BigInt(chunk.length)) + BigInt(value);
  }
  let hex = number ? number.toString(16) : '';
  if (hex.length % 2) hex = `0${hex}`;
  const length = zeros + hex.length / 2;
  if (length > 72 * 1024) return invalid();
  const result = new Uint8Array(length);
  result.set(Buffer.from(hex, 'hex'), zeros);
  return result;
}
