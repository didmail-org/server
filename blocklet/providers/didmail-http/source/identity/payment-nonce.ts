import { bindings } from '../runtime/bindings';

export default async function nextPaymentNonce(): Promise<number> {
  const now = Date.now();
  if (!Number.isSafeInteger(now) || now < 1) throw new Error('Invalid payment nonce clock');
  const result = await bindings.DB.prepare(
    `WITH nonce_clock(value) AS (SELECT ?)
     INSERT INTO legacy_payment_nonce(id,last_nonce) SELECT 1,value FROM nonce_clock WHERE true
     ON CONFLICT(id) DO UPDATE SET last_nonce=max(last_nonce+1,excluded.last_nonce)
     WHERE last_nonce<9007199254740991 RETURNING last_nonce AS nonce`,
  ).bind(now).first<{ nonce: number }>();
  if (!result || !Number.isSafeInteger(result.nonce)) throw new Error('Payment nonce exhausted');
  return result.nonce;
}
