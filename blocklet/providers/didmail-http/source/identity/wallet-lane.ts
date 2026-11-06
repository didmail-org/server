import type { SqlDatabase } from '../runtime/contracts';
interface LaneReservation {
  chainId: string;
  walletId: string;
  lane: 'payer' | 'operator';
  owner: string;
  expiresAt?: string;
  lease?: { id: string; owner: string; fence: number; now: number };
}

/** Release naturally expired, unaccepted payer reservations without deleting mail. */
export async function cleanupExpiredPayerLanes(
  database: Pick<SqlDatabase, 'prepare'>,
  now = new Date().toISOString(),
): Promise<number> {
  const result = await database
    .prepare(
      "DELETE FROM dmp_wallet_lanes WHERE lane='payer' AND expires_at<=? AND EXISTS(SELECT 1 FROM dmp_messages WHERE id=message_id AND accepted_at IS NULL)",
    )
    .bind(now)
    .run();
  return result.meta.changes;
}

/** A chain account has one nonce sequence across both payer and operator roles. */
export async function reserveWalletLane(
  database: Pick<SqlDatabase, 'prepare'>,
  reservation: LaneReservation,
): Promise<boolean> {
  const { chainId, walletId, lane, owner, expiresAt, lease } = reservation;
  const guard = lease
    ? ` AND EXISTS(SELECT 1 FROM contact_jobs WHERE preparation_id=? AND lease_owner=? AND lease_fence=? AND lease_expires_at>?)`
    : '';
  const args: Array<string | number | null> = [
    chainId,
    walletId,
    lane,
    owner,
    expiresAt ?? null,
    chainId,
    walletId,
    owner,
  ];
  if (lease) args.push(lease.id, lease.owner, lease.fence, lease.now);
  await database
    .prepare(
      `INSERT INTO dmp_wallet_lanes(chain_id,wallet_id,lane,message_id,expires_at)
    SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM dmp_wallet_lanes WHERE chain_id=? AND wallet_id=? AND message_id!=?)
    ${guard} ON CONFLICT DO NOTHING`,
    )
    .bind(...args)
    .run();
  const result = await database
    .prepare(
      `SELECT message_id FROM dmp_wallet_lanes WHERE chain_id=? AND wallet_id=? AND lane=?
    AND NOT EXISTS(SELECT 1 FROM dmp_wallet_lanes WHERE chain_id=? AND wallet_id=? AND message_id!=?)`,
    )
    .bind(chainId, walletId, lane, chainId, walletId, owner)
    .first<{ message_id: string }>();
  return result?.message_id === owner;
}
