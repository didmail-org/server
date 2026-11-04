import { canonicalize } from '@didmail/protocol';
import type { ContactPreparation, ContactPreparationSnapshot } from '../api/src/libs/contact-preparation';
import { contactPreparationCommitment } from '../api/src/libs/contact-preparation';
export type {
  ContactPreparation,
  ContactPreparationSnapshot,
  ContactRecoveryPolicy,
} from '../api/src/libs/contact-preparation';
import { toBase58 } from '@ocap/util';
import {
  ContactPaymentBinding,
  contactContentHash,
  contactPaymentUnits,
  snapshotContactPaymentBinding,
  verifyContactPayment,
} from '../api/src/libs/contact-payment-evidence';

interface PreparationRow {
  id: string;
  sender: string;
  chain_id: string;
  snapshot_json: string;
  ciphertext: string;
  created_at: number;
  expires_at: number;
  accepted_at: number | null;
  payment_hash: string | null;
  signed_payment: string | null;
  unsigned_payment: string | null;
  public_key: string | null;
}
export class ContactPreparationError extends Error {
  constructor(
    readonly code:
      | 'INVALID_PREPARATION'
      | 'PREPARATION_NOT_FOUND'
      | 'PREPARATION_CONFLICT'
      | 'PREPARATION_EXPIRED'
      | 'PREPARATION_QUOTA_EXCEEDED',
  ) {
    super(code);
  }
}
const fail = (code: ContactPreparationError['code']): never => {
  throw new ContactPreparationError(code);
};
const clockValue = (clock: () => number): number => {
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 0) return fail('INVALID_PREPARATION');
  return value;
};
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256 && !/\s/.test(value);
const snapshotOf = (input: ContactPreparationSnapshot): Readonly<ContactPreparationSnapshot> => {
  if (!input || Object.keys(input).sort().join(',') !== 'binding,policy') return fail('INVALID_PREPARATION');
  const binding = snapshotContactPaymentBinding(input.binding);
  const policy = Object.freeze({ ...input.policy });
  if (
    Object.keys(policy).sort().join(',') !==
      'chainEndpoint,confirmationPolicy,contactFactory,mintAmount,mintChainFee,namecardFactory' ||
    Object.values(policy).some((value) => !text(value)) ||
    !['arcblock-committed', 'arcblock-dolt-ledger/1'].includes(policy.confirmationPolicy) ||
    !/^(0|[1-9][0-9]{0,77})$/.test(policy.mintAmount) ||
    BigInt(policy.mintAmount) > BigInt(binding.serviceAmount)
  )
    return fail('INVALID_PREPARATION');
  contactPaymentUnits(policy.mintChainFee);
  let url: URL;
  try {
    url = new URL(policy.chainEndpoint);
  } catch {
    return fail('INVALID_PREPARATION');
  }
  if (
    url.href !== policy.chainEndpoint ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' &&
        (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost')))
    )
  )
    return fail('INVALID_PREPARATION');
  return Object.freeze({ binding, policy });
};
const contactHash = (binding: ContactPaymentBinding, ciphertext: string): string =>
  contactContentHash(binding.sender, binding.receiver, ciphertext, binding.namecard);
const view = (row: PreparationRow): Readonly<ContactPreparation> => {
  const snapshot = snapshotOf(JSON.parse(row.snapshot_json));
  if (
    snapshot.binding.preparationId !== row.id ||
    snapshot.binding.sender !== row.sender ||
    snapshot.binding.chainId !== row.chain_id ||
    contactHash(snapshot.binding, row.ciphertext) !== snapshot.binding.contentHash
  )
    return fail('INVALID_PREPARATION');
  return Object.freeze({
    snapshot,
    ciphertext: row.ciphertext,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    payment:
      row.payment_hash === null
        ? null
        : Object.freeze({
            transactionId: row.payment_hash,
            signedOrigin: row.signed_payment!,
            unsignedOrigin: row.unsigned_payment!,
            publicKey: row.public_key!,
            acceptedAt: row.accepted_at!,
          }),
  });
};

/** Internal only. Every operation uses a primary-first session; no signing or network access. */
export class ContactPreparationStore {
  constructor(
    private readonly database: D1Database,
    private readonly clock: () => number = Date.now,
  ) {}

  private row(db: D1DatabaseSession, id: string, sender: string) {
    return db
      .prepare('SELECT * FROM contact_preparations WHERE id=? AND sender=?')
      .bind(id, sender)
      .first<PreparationRow>();
  }

  async read(id: string, sender: string): Promise<Readonly<ContactPreparation> | null> {
    const row = await this.row(this.database.withSession('first-primary'), id, sender);
    return row ? view(row) : null;
  }

  /** The service constructs the trusted snapshot; request bodies must never be passed as node quotes. */
  async create(
    input: ContactPreparationSnapshot,
    ciphertext: string,
    expiresAt: number,
  ): Promise<Readonly<ContactPreparation>> {
    const snapshot = snapshotOf(input),
      now = clockValue(this.clock);
    if (
      typeof ciphertext !== 'string' ||
      !ciphertext ||
      new TextEncoder().encode(ciphertext).length > 64 * 1024 ||
      contactHash(snapshot.binding, ciphertext) !== snapshot.binding.contentHash ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= now ||
      expiresAt - now > 60 * 60 * 1000
    )
      return fail('INVALID_PREPARATION');
    const json = canonicalize(snapshot),
      { preparationId: id, sender, chainId } = snapshot.binding;
    const db = this.database.withSession('first-primary');
    await db
      .prepare(
        `INSERT INTO contact_preparations
      (id,sender,chain_id,snapshot_json,ciphertext,created_at,expires_at)
      SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM contact_preparations
       WHERE sender=? AND payment_hash IS NULL AND expires_at>?)<8
      ON CONFLICT(id) DO NOTHING`,
      )
      .bind(id, sender, chainId, json, ciphertext, now, expiresAt, sender, now)
      .run();
    const row = await this.row(db, id, sender);
    if (!row) {
      const pending = await db
        .prepare(
          'SELECT COUNT(*) AS count FROM contact_preparations WHERE sender=? AND payment_hash IS NULL AND expires_at>?',
        )
        .bind(sender, now)
        .first<{ count: number }>();
      if (pending!.count >= 8) return fail('PREPARATION_QUOTA_EXCEEDED');
    }
    if (!row || row.snapshot_json !== json || row.ciphertext !== ciphertext || row.expires_at !== expiresAt)
      return fail('PREPARATION_CONFLICT');
    return view(row);
  }

  /** Verifies against saved terms, then atomically reserves exactly one original payment. */
  async accept(
    id: string,
    sender: string,
    signedOrigin: string,
    authenticatedPublicKey: Uint8Array,
  ): Promise<Readonly<ContactPreparation>> {
    if (!(authenticatedPublicKey instanceof Uint8Array) || authenticatedPublicKey.length !== 32)
      return fail('INVALID_PREPARATION');
    const publicKeyBytes = new Uint8Array(authenticatedPublicKey);
    const db = this.database.withSession('first-primary'),
      row = await this.row(db, id, sender);
    if (!row) return fail('PREPARATION_NOT_FOUND');
    const original = view(row);
    const verified = await verifyContactPayment(
      signedOrigin,
      original.snapshot.binding,
      publicKeyBytes,
      contactPreparationCommitment(original),
    );
    const publicKey = toBase58(publicKeyBytes);
    const now = clockValue(this.clock);
    // A single SQL statement commits all evidence together. A lost response is retried with the same bytes.
    await db
      .prepare(
        `UPDATE contact_preparations SET
      accepted_at=?,payment_hash=?,signed_payment=?,unsigned_payment=?,public_key=?
      WHERE id=? AND sender=? AND snapshot_json=? AND ciphertext=? AND expires_at=? AND chain_id=? AND created_at=?
      AND payment_hash IS NULL AND expires_at>?`,
      )
      .bind(
        now,
        verified.transactionId,
        verified.signedOrigin,
        verified.unsignedOrigin,
        publicKey,
        id,
        sender,
        row.snapshot_json,
        row.ciphertext,
        row.expires_at,
        row.chain_id,
        row.created_at,
        now,
      )
      .run();
    const persisted = await this.row(db, id, sender);
    if (!persisted) return fail('PREPARATION_NOT_FOUND');
    if (
      persisted.snapshot_json !== row.snapshot_json ||
      persisted.ciphertext !== row.ciphertext ||
      persisted.expires_at !== row.expires_at ||
      persisted.created_at !== row.created_at
    )
      return fail('PREPARATION_CONFLICT');
    if (persisted.payment_hash === null && persisted.expires_at <= now) return fail('PREPARATION_EXPIRED');
    if (
      persisted.payment_hash !== verified.transactionId ||
      persisted.signed_payment !== verified.signedOrigin ||
      persisted.unsigned_payment !== verified.unsignedOrigin ||
      persisted.public_key !== publicKey
    )
      return fail('PREPARATION_CONFLICT');
    return view(persisted);
  }
}
