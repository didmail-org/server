import type { SqlDatabase } from '../../runtime/contracts';
import { canonicalize, uuid, validateChainConfirmation, type ChainConfirmation } from '@didmail/protocol';
import { fromBase58 } from '@ocap/util';
import { toTxHash } from '@ocap/mcrypto';
import { verifyContactPayment } from './contact-payment-evidence';
import type { ContactPreparation } from './contact-preparation';
import { contactPreparationCommitment } from './contact-preparation';
import { ContactPreparationStore } from './contact-preparation-store';
import { reserveWalletLane } from '../../identity/wallet-lane';
import { decodeContactBytes } from './contact-base58';

export interface ContactMint {
  readonly signedOrigin: string;
  readonly transactionId: string;
  readonly assetId: string;
}
export interface ContactChainEvidence {
  readonly confirmation: ChainConfirmation;
  readonly rejected?: boolean;
  readonly assetId?: string;
}
/** Adapters must independently verify chain membership, mint bytes and asset content.
 * There is deliberately no default adapter or production scheduler yet. */
export interface ContactSettlementAdapter {
  paymentEvidence(preparation: Readonly<ContactPreparation>): Promise<ContactChainEvidence | null>;
  prepareMint(preparation: Readonly<ContactPreparation>): Promise<ContactMint>;
  verifyMint(preparation: Readonly<ContactPreparation>, mint: Readonly<ContactMint>): Promise<void>;
  mintEvidence(
    preparation: Readonly<ContactPreparation>,
    mint: Readonly<ContactMint>,
  ): Promise<ContactChainEvidence | null>;
  broadcast(preparation: Readonly<ContactPreparation>, signedOrigin: string): Promise<void>;
}
export interface ContactJobRow {
  preparation_id: string;
  state: string;
  payment_evidence: string | null;
  signed_mint: string | null;
  mint_hash: string | null;
  asset_id: string | null;
  delivery_evidence: string | null;
  problem_code: string | null;
  next_attempt_at: number;
  lease_owner: string | null;
  lease_expires_at: number;
  lease_fence: number;
}
const fail = (code: string): never => {
  throw new Error(code);
};
const mintOf = (row: ContactJobRow): Readonly<ContactMint> => {
  if (!row.signed_mint || !row.mint_hash || !row.asset_id) return fail('MINT_EVIDENCE_MISSING');
  return Object.freeze({ signedOrigin: row.signed_mint, transactionId: row.mint_hash, assetId: row.asset_id });
};
function checkEvidence(value: ContactChainEvidence, preparation: ContactPreparation, hash: string): ChainConfirmation {
  try {
    const confirmation = structuredClone(value.confirmation);
    if (
      confirmation.chainId !== preparation.snapshot.binding.chainId ||
      confirmation.transactionId !== hash ||
      validateChainConfirmation(confirmation) !== preparation.snapshot.policy.confirmationPolicy
    )
      return fail('CONFLICTING_CHAIN_EVIDENCE');
    // Canonicalize before any further asynchronous operation; adapters cannot mutate saved evidence.
    canonicalize(confirmation);
    return Object.freeze(confirmation);
  } catch {
    return fail('CONFLICTING_CHAIN_EVIDENCE');
  }
}
const TERMINAL = new Set([
  'CONFLICTING_CHAIN_EVIDENCE',
  'MINT_EVIDENCE_MISSING',
  'INVALID_CONTACT_MINT',
  'MINT_TRANSACTION_REJECTED',
  'ACCEPTED_PAYMENT_MISSING',
  'INVALID_ACCEPTED_PAYMENT',
  'INVALID_PREPARATION',
  'ACCEPTED_CHAIN_PROFILE_CHANGED',
  'CONTACT_FACTORY_TERMS_CHANGED',
  'CONTACT_FACTORY_UNSUPPORTED',
]);

/** Fenced, durable coordinator. All broadcasts consume previously persisted original bytes. */
export async function processContactJobs(
  database: SqlDatabase,
  adapter: ContactSettlementAdapter,
  options: { clock?: () => number; limit?: number; leaseMs?: number } = {},
): Promise<{ processed: number }> {
  const clock = options.clock ?? Date.now,
    limit = options.limit ?? 4,
    leaseMs = options.leaseMs ?? 120000;
  const now = () => {
    const value = clock();
    if (!Number.isSafeInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER - 240000)
      return fail('INVALID_JOB_CLOCK');
    return value;
  };
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 32 ||
    !Number.isInteger(leaseMs) ||
    leaseMs < 1000 ||
    leaseMs > 120000
  )
    return fail('INVALID_JOB_OPTIONS');
  const db = database.withSession('first-primary');
  // Accepted evidence and job creation need not be one dual write: restart discovers any missing job.
  await db
    .prepare(
      `INSERT INTO contact_jobs(preparation_id)
    SELECT p.id FROM contact_preparations p WHERE p.payment_hash IS NOT NULL AND p.job_pending=1
    ORDER BY p.accepted_at,p.id LIMIT ? ON CONFLICT DO NOTHING`,
    )
    .bind(limit)
    .run();
  // Clear only after the durable job exists. A lost INSERT acknowledgment leaves
  // the indexed marker intact so a later attempt retries the same insert.
  await db
    .prepare(
      `UPDATE contact_preparations SET job_pending=0 WHERE id IN (
    SELECT p.id FROM contact_preparations p JOIN contact_jobs j ON j.preparation_id=p.id
    WHERE p.payment_hash IS NOT NULL AND p.job_pending=1 ORDER BY p.accepted_at,p.id LIMIT ?)`,
    )
    .bind(limit)
    .run();
  const rowOf = (id: string) =>
    db.prepare('SELECT * FROM contact_jobs WHERE preparation_id=?').bind(id).first<ContactJobRow>();
  const change = async (row: ContactJobRow, fields: Record<string, string | number | null>): Promise<ContactJobRow> => {
    const allowed = [
      'state',
      'payment_evidence',
      'signed_mint',
      'mint_hash',
      'asset_id',
      'delivery_evidence',
      'problem_code',
      'next_attempt_at',
    ];
    if (!Object.keys(fields).length || Object.keys(fields).some((key) => !allowed.includes(key)))
      return fail('INVALID_JOB_UPDATE');
    const previous: Record<string, string> = {
      payment_pending: 'queued',
      payment_confirmed: 'payment_pending',
      payment_rejected: 'payment_pending',
      mint_pending: 'payment_confirmed',
      delivered: 'mint_pending',
    };
    const stateGuard =
      fields.state && fields.state !== 'reconciliation_required'
        ? ` AND state='${previous[String(fields.state)] ?? 'invalid'}'`
        : '';
    const evidenceGuard =
      (fields.signed_mint !== undefined ? ' AND signed_mint IS NULL' : '') +
      (fields.payment_evidence !== undefined ? ' AND payment_evidence IS NULL' : '') +
      (fields.delivery_evidence !== undefined ? ' AND delivery_evidence IS NULL' : '');
    const result = await db
      .prepare(
        `UPDATE contact_jobs SET ${Object.keys(fields)
          .map((key) => key + '=?')
          .join(',')}
      WHERE preparation_id=? AND lease_owner=? AND lease_fence=? AND lease_expires_at>?
      AND state IN ('queued','payment_pending','payment_confirmed','mint_pending')${stateGuard}${evidenceGuard}`,
      )
      .bind(...Object.values(fields), row.preparation_id, row.lease_owner, row.lease_fence, now())
      .run();
    if (!result.meta.changes) return fail('JOB_LEASE_LOST');
    return (await rowOf(row.preparation_id))!;
  };
  const assertLease = async (row: ContactJobRow) => {
    const at = now();
    const renewed = await db
      .prepare(
        `UPDATE contact_jobs SET lease_expires_at=? WHERE preparation_id=?
      AND lease_owner=? AND lease_fence=? AND lease_expires_at>?
      AND state IN ('queued','payment_pending','payment_confirmed','mint_pending')`,
      )
      .bind(at + leaseMs, row.preparation_id, row.lease_owner, row.lease_fence, at)
      .run();
    if (!renewed.meta.changes) return fail('JOB_LEASE_LOST');
  };
  // Namespaced owners share the existing payer/operator exclusion with DMP jobs.
  const laneId = (row: ContactJobRow) => 'contact:' + row.preparation_id;
  const takeLane = async (row: ContactJobRow, preparation: ContactPreparation, lane: 'payer' | 'operator') => {
    const binding = preparation.snapshot.binding,
      wallet = 'did:abt:' + (lane === 'payer' ? binding.sender : binding.servicePayee);
    return reserveWalletLane(db, {
      chainId: binding.chainId,
      walletId: wallet,
      lane,
      owner: laneId(row),
      lease: { id: row.preparation_id, owner: row.lease_owner!, fence: row.lease_fence, now: now() },
    });
  };
  const cleanupLanes = async () => {
    // Safe even if a worker died after committing its terminal/confirmed state but before releasing.
    await db
      .prepare(
        `DELETE FROM dmp_wallet_lanes WHERE message_id LIKE 'contact:%' AND EXISTS(
      SELECT 1 FROM contact_jobs j WHERE message_id='contact:'||j.preparation_id AND
      ((lane='payer' AND (j.payment_evidence IS NOT NULL OR j.state='payment_rejected')) OR
       (lane='operator' AND j.state='delivered')))`,
      )
      .run();
  };
  await cleanupLanes();
  const due = await db
    .prepare(
      `SELECT j.preparation_id,p.sender FROM contact_jobs j
    JOIN contact_preparations p ON p.id=j.preparation_id
    WHERE j.state IN ('queued','payment_pending','payment_confirmed','mint_pending')
    AND j.next_attempt_at<=? AND j.lease_expires_at<=? ORDER BY j.next_attempt_at,p.accepted_at,p.id LIMIT ?`,
    )
    .bind(now(), now(), limit)
    .all<{ preparation_id: string; sender: string }>();
  let processed = 0;
  for (const candidate of due.results) {
    const owner = uuid();
    let row = await db
      .prepare(
        `UPDATE contact_jobs SET lease_owner=?,lease_expires_at=?,lease_fence=lease_fence+1
      WHERE preparation_id=? AND lease_expires_at<=? AND lease_fence<9007199254740991
      AND state IN ('queued','payment_pending','payment_confirmed','mint_pending') RETURNING *`,
      )
      .bind(owner, now() + leaseMs, candidate.preparation_id, now())
      .first<ContactJobRow>();
    if (!row) continue;
    processed++;
    const lease = row;
    try {
      const preparation = await new ContactPreparationStore(database, now).read(row.preparation_id, candidate.sender);
      if (!preparation?.payment) return fail('ACCEPTED_PAYMENT_MISSING');
      const payment = preparation.payment;
      // Re-validate persisted original bytes before every attempt, rather than trusting mutable job fields.
      try {
        const verified = await verifyContactPayment(
          payment.signedOrigin,
          preparation.snapshot.binding,
          fromBase58(payment.publicKey),
          contactPreparationCommitment(preparation),
        );
        if (verified.transactionId !== payment.transactionId || verified.unsignedOrigin !== payment.unsignedOrigin)
          fail('INVALID_ACCEPTED_PAYMENT');
      } catch {
        fail('INVALID_ACCEPTED_PAYMENT');
      }
      if (row.state === 'queued') row = await change(row, { state: 'payment_pending' });
      if (row.state === 'payment_pending') {
        if (!(await takeLane(row, preparation, 'payer'))) {
          await change(row, { next_attempt_at: now() + 3000 });
          continue;
        }
        await assertLease(row);
        const evidence = await adapter.paymentEvidence(preparation);
        if (!evidence) {
          await assertLease(row);
          await adapter.broadcast(preparation, payment.signedOrigin);
          await change(row, { next_attempt_at: now() + 3000 });
          continue;
        }
        const confirmation = checkEvidence(evidence, preparation, payment.transactionId);
        if (evidence.rejected) {
          row = await change(row, { state: 'payment_rejected', problem_code: 'PAYMENT_REJECTED' });
          continue;
        }
        row = await change(row, {
          state: 'payment_confirmed',
          payment_evidence: canonicalize(confirmation),
          problem_code: null,
        });
        await cleanupLanes();
      }
      if (row.state === 'payment_confirmed') {
        if (!(await takeLane(row, preparation, 'operator'))) {
          await change(row, { next_attempt_at: now() + 3000 });
          continue;
        }
        await assertLease(row);
        const prepared = Object.freeze({ ...(await adapter.prepareMint(preparation)) });
        if (
          typeof prepared.signedOrigin !== 'string' ||
          prepared.signedOrigin.length > 96000 ||
          typeof prepared.assetId !== 'string' ||
          !prepared.assetId ||
          prepared.assetId.length > 256 ||
          toTxHash(decodeContactBytes(prepared.signedOrigin)) !== prepared.transactionId
        )
          fail('INVALID_CONTACT_MINT');
        await adapter.verifyMint(preparation, prepared);
        row = await change(row, {
          state: 'mint_pending',
          signed_mint: prepared.signedOrigin,
          mint_hash: prepared.transactionId,
          asset_id: prepared.assetId,
        });
      }
      if (row.state === 'mint_pending') {
        const mint = mintOf(row);
        if (!(await takeLane(row, preparation, 'operator'))) {
          await change(row, { next_attempt_at: now() + 3000 });
          continue;
        }
        await adapter.verifyMint(preparation, mint);
        await assertLease(row);
        const evidence = await adapter.mintEvidence(preparation, mint);
        if (!evidence) {
          await assertLease(row);
          await adapter.broadcast(preparation, mint.signedOrigin);
          await change(row, { next_attempt_at: now() + 3000 });
          continue;
        }
        const mintConfirmation = checkEvidence(evidence, preparation, mint.transactionId);
        if (evidence.rejected) fail('MINT_TRANSACTION_REJECTED');
        if (evidence.assetId !== mint.assetId) fail('CONFLICTING_CHAIN_EVIDENCE');
        await assertLease(row);
        const paid = await adapter.paymentEvidence(preparation);
        if (!paid || paid.rejected) throw new Error('CONFLICTING_CHAIN_EVIDENCE');
        const paymentConfirmation = checkEvidence(paid, preparation, payment.transactionId);
        if (canonicalize(paymentConfirmation) !== row.payment_evidence) fail('CONFLICTING_CHAIN_EVIDENCE');
        row = await change(row, {
          state: 'delivered',
          delivery_evidence: canonicalize({
            payment: paymentConfirmation,
            mint: mintConfirmation,
            assetId: mint.assetId,
          }),
          problem_code: null,
        });
      }
    } catch (error) {
      if (error.message !== 'JOB_LEASE_LOST') {
        const terminal = TERMINAL.has(error.message);
        try {
          await change(lease, {
            ...(terminal ? { state: 'reconciliation_required' } : {}),
            problem_code: terminal ? error.message : 'CHAIN_UNAVAILABLE',
            next_attempt_at: now() + 10000,
          });
        } catch {
          /* A newer fenced worker, a committed terminal state or unavailable storage owns recovery. */
        }
      }
    } finally {
      await db
        .prepare(
          'UPDATE contact_jobs SET lease_owner=NULL,lease_expires_at=0 WHERE preparation_id=? AND lease_owner=? AND lease_fence=?',
        )
        .bind(lease.preparation_id, owner, lease.lease_fence)
        .run();
      await cleanupLanes();
    }
  }
  return { processed };
}
