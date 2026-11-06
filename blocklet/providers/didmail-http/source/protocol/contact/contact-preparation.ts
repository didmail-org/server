import { canonicalize, digest, isUuid, utf8 } from '@didmail/protocol';
import type { ContactPaymentBinding } from './contact-payment-evidence';

export interface ContactRecoveryPolicy {
  readonly chainEndpoint: string;
  readonly namecardFactory: string;
  readonly contactFactory: string;
  readonly mintAmount: string;
  readonly mintChainFee: string;
  readonly confirmationPolicy: 'arcblock-committed' | 'arcblock-dolt-ledger/1';
}
export interface ContactPreparationSnapshot {
  readonly binding: Readonly<ContactPaymentBinding>;
  readonly policy: Readonly<ContactRecoveryPolicy>;
}
export interface ContactPreparation {
  readonly snapshot: Readonly<ContactPreparationSnapshot>;
  readonly ciphertext: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly payment: Readonly<{
    transactionId: string;
    signedOrigin: string;
    unsignedOrigin: string;
    publicKey: string;
    acceptedAt: number;
  }> | null;
}

/** Recovery-profile payments bind every approved condition, including the original expiry.
 * Numeric legacy fixture/route IDs keep their historical metadata; recovery HTTP IDs are UUIDs. */
export function contactPreparationCommitment(
  preparation: Pick<ContactPreparation, 'snapshot' | 'ciphertext' | 'createdAt' | 'expiresAt'>,
): string | undefined {
  if (!isUuid(preparation.snapshot.binding.preparationId)) return undefined;
  return digest(
    utf8(
      canonicalize({
        snapshot: preparation.snapshot,
        ciphertext: preparation.ciphertext,
        createdAt: preparation.createdAt,
        expiresAt: preparation.expiresAt,
      }),
    ),
  );
}
