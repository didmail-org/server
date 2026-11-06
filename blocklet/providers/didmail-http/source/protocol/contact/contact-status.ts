import type { SqlDatabase } from '../../runtime/contracts';
import { canonicalize, validateChainConfirmation, type ChainConfirmation } from '@didmail/protocol';
import { toTxHash } from '@ocap/mcrypto';
import { decodeContactBytes } from '../../../../../../api/src/libs/contact-base58';
import type { ContactPreparation } from '../../../../../../api/src/libs/contact-preparation';
import type { ContactJobRow, ContactMint } from './contact-jobs';

export interface ContactRecoveryStatus {
  readonly protocolVersion: 1;
  readonly preparationId: string;
  readonly state:
    | 'prepared'
    | 'accepted'
    | 'queued'
    | 'payment_pending'
    | 'payment_confirmed'
    | 'mint_pending'
    | 'delivered'
    | 'payment_rejected'
    | 'reconciliation_required';
  readonly preparation: Readonly<ContactPreparation>;
  readonly mint: Readonly<ContactMint> | null;
  readonly paymentConfirmation: ChainConfirmation | null;
  readonly delivery: {
    readonly payment: ChainConfirmation;
    readonly mint: ChainConfirmation;
    readonly assetId: string;
  } | null;
  readonly problemCode: 'CHAIN_UNAVAILABLE' | 'PAYMENT_REJECTED' | 'RECONCILIATION_REQUIRED' | null;
}
const deny = (): never => {
  throw new Error('CONTACT_STATUS_UNAVAILABLE');
};
const states = [
  'queued',
  'payment_pending',
  'payment_confirmed',
  'mint_pending',
  'delivered',
  'payment_rejected',
  'reconciliation_required',
] as const;

/** Private projection of durable observations. It performs no RPC, signing, or job advancement.
 * Clients must independently verify original bytes and chain membership before reporting delivery. */
export async function readContactStatus(
  database: SqlDatabase,
  preparation: Readonly<ContactPreparation>,
): Promise<ContactRecoveryStatus> {
  const { binding, policy } = preparation.snapshot;
  const row = await database
    .withSession('first-primary')
    .prepare('SELECT * FROM contact_jobs WHERE preparation_id=?')
    .bind(binding.preparationId)
    .first<ContactJobRow>();
  if (!row)
    return Object.freeze({
      protocolVersion: 1,
      preparationId: binding.preparationId,
      state: preparation.payment ? 'accepted' : 'prepared',
      preparation,
      mint: null,
      paymentConfirmation: null,
      delivery: null,
      problemCode: null,
    });
  if (!preparation.payment || !states.includes(row.state as (typeof states)[number])) return deny();
  const confirmation = (raw: unknown, hash: string): ChainConfirmation => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || canonicalize(raw).length > 4096) return deny();
    const value = raw as ChainConfirmation;
    if (
      value.chainId !== binding.chainId ||
      value.transactionId !== hash ||
      validateChainConfirmation(value) !== policy.confirmationPolicy
    )
      return deny();
    return value;
  };
  const paymentConfirmation =
    row.payment_evidence === null
      ? null
      : confirmation(JSON.parse(row.payment_evidence), preparation.payment.transactionId);
  const hasMint = [row.signed_mint, row.mint_hash, row.asset_id].filter((value) => value !== null).length;
  if (hasMint !== 0 && hasMint !== 3) return deny();
  if (hasMint && !['mint_pending', 'delivered', 'reconciliation_required'].includes(row.state)) return deny();
  if (
    paymentConfirmation &&
    !['payment_confirmed', 'mint_pending', 'delivered', 'reconciliation_required'].includes(row.state)
  )
    return deny();
  let mint: Readonly<ContactMint> | null = null;
  if (hasMint) {
    if (
      !row.signed_mint ||
      !row.asset_id ||
      row.asset_id.length > 256 ||
      toTxHash(decodeContactBytes(row.signed_mint)) !== row.mint_hash
    )
      return deny();
    mint = Object.freeze({ signedOrigin: row.signed_mint, transactionId: row.mint_hash!, assetId: row.asset_id });
  }
  if (['payment_confirmed', 'mint_pending', 'delivered'].includes(row.state) && !paymentConfirmation) return deny();
  if (['mint_pending', 'delivered'].includes(row.state) && !mint) return deny();
  let delivery: ContactRecoveryStatus['delivery'] = null;
  if (row.delivery_evidence !== null) {
    const value = JSON.parse(row.delivery_evidence);
    if (
      !mint ||
      !paymentConfirmation ||
      !value ||
      Object.keys(value).sort().join(',') !== 'assetId,mint,payment' ||
      value.assetId !== mint.assetId ||
      canonicalize(value.payment) !== canonicalize(paymentConfirmation)
    )
      return deny();
    delivery = Object.freeze({
      payment: paymentConfirmation,
      mint: confirmation(value.mint, mint.transactionId),
      assetId: mint.assetId,
    });
  }
  if ((row.state === 'delivered') !== !!delivery) return deny();
  const problemCode =
    row.state === 'reconciliation_required'
      ? 'RECONCILIATION_REQUIRED'
      : row.state === 'payment_rejected'
        ? 'PAYMENT_REJECTED'
        : row.problem_code
          ? 'CHAIN_UNAVAILABLE'
          : null;
  return Object.freeze({
    protocolVersion: 1,
    preparationId: binding.preparationId,
    state: row.state as ContactRecoveryStatus['state'],
    preparation,
    mint,
    paymentConfirmation,
    delivery,
    problemCode,
  });
}
