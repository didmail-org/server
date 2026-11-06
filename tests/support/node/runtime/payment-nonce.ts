import { QueryTypes } from 'sequelize';
import sequelize from '../libs/sqlite';

// Shared by contact and alias preparations. The durable row serializes allocations
// across requests and processes, even when the clock stalls or moves backwards.
export default async function nextPaymentNonce(): Promise<number> {
  const now = Date.now();
  if (!Number.isSafeInteger(now) || now < 1) throw new Error('Invalid payment nonce clock');
  await sequelize.query(
    'CREATE TABLE IF NOT EXISTS legacy_payment_nonce (id INTEGER PRIMARY KEY CHECK(id=1),last_nonce INTEGER NOT NULL)',
  );
  // SQLite's Sequelize adapter discards RETURNING rows for SQL beginning with
  // INSERT. The CTE keeps this atomic write on its row-returning all() path.
  const [result] = await sequelize.query<{ nonce: number }>(
    `WITH nonce_clock(value) AS (SELECT ?)
     INSERT INTO legacy_payment_nonce(id,last_nonce) SELECT 1,value FROM nonce_clock WHERE true
     ON CONFLICT(id) DO UPDATE SET last_nonce=max(last_nonce+1,excluded.last_nonce)
     WHERE last_nonce<9007199254740991 RETURNING last_nonce AS nonce`,
    { replacements: [now], type: QueryTypes.SELECT },
  );
  if (!result || !Number.isSafeInteger(result.nonce)) throw new Error('Payment nonce exhausted');
  return result.nonce;
}
