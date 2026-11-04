import { fromAddress, fromPublicKey } from '@ocap/wallet';
import { toUint8Array } from '@ocap/util';
import { contactContentHash, contactPaymentUnits, snapshotContactPaymentBinding } from './contact-payment-evidence';
import type { ContactPreparationSnapshot, ContactRecoveryPolicy } from './contact-preparation';

export interface ContactNodePolicy {
  readonly endpoint: string;
  readonly chainEndpoint: string;
  readonly chainId: string;
  readonly tokenAddress: string;
  readonly servicePayee: string;
  readonly developerPayee: string;
  readonly namecardFactory: string;
  readonly contactFactory: string;
  readonly confirmationPolicy: ContactRecoveryPolicy['confirmationPolicy'];
}
export interface ContactPreparationInput {
  readonly preparationId: string;
  readonly sender: string;
  readonly receiver: string;
  readonly namecard: string;
  readonly ciphertext: string;
}
export interface ContactQuoteEvidence {
  readonly asset: unknown;
  readonly factory: unknown;
  readonly recipient: unknown;
  readonly fees: unknown;
}
export class ContactQuoteUnavailable extends Error {
  constructor() {
    super('CONTACT_QUOTE_UNAVAILABLE');
  }
}
const deny = (): never => {
  throw new ContactQuoteUnavailable();
};
const text = (value: unknown): value is string =>
  typeof value === 'string' && !!value && value.length <= 256 && !/\s/.test(value);
const priceUnits = (value: unknown): bigint => {
  if (typeof value !== 'string' || value.length > 97 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/.test(value)) return deny();
  const [whole, fraction = ''] = value.split('.');
  return contactPaymentUnits((BigInt(whole!) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))).toString());
};

/** Only evidence obtained from the configured chain is allowed here, never request-supplied quotes. */
export function contactQuoteFromChain(
  policy: ContactNodePolicy,
  input: ContactPreparationInput,
  evidence: ContactQuoteEvidence,
): Readonly<ContactPreparationSnapshot> {
  try {
    if (
      Object.values(policy).some((value) => !text(value)) ||
      !text(input.receiver) ||
      !text(input.namecard) ||
      !['arcblock-committed', 'arcblock-dolt-ledger/1'].includes(policy.confirmationPolicy)
    )
      return deny();
    const asset = evidence.asset as any;
    const factory = evidence.factory as any;
    const recipient = evidence.recipient as any;
    if (
      asset?.code !== 'OK' ||
      factory?.code !== 'OK' ||
      recipient?.code !== 'OK' ||
      asset.state?.address !== input.namecard ||
      asset.state?.parent !== policy.namecardFactory ||
      asset.state?.owner !== policy.servicePayee ||
      factory.state?.address !== policy.contactFactory ||
      typeof factory.state?.owner !== 'string' ||
      !(/^0x[0-9a-fA-F]{40}$/.test(policy.developerPayee)
        ? /^0x[0-9a-fA-F]{40}$/.test(factory.state.owner) &&
          factory.state.owner.toLowerCase() === policy.developerPayee.toLowerCase()
        : factory.state.owner === policy.developerPayee) ||
      recipient.state?.address !== input.receiver ||
      typeof recipient.state?.pk !== 'string' ||
      recipient.state.pk.length > 100 ||
      !/^(z[1-9A-HJ-NP-Za-km-z]+|0x[0-9a-fA-F]{64})$/.test(recipient.state.pk) ||
      typeof asset.state?.data?.value !== 'string' ||
      asset.state.data.value.length > 65536
    )
      return deny();
    const recipientType = fromAddress(input.receiver).type;
    const recipientKey = toUint8Array(recipient.state.pk);
    if (
      recipientType.pk !== 0 ||
      recipientType.hash !== 1 ||
      recipientKey.length !== 32 ||
      fromPublicKey(recipientKey, recipientType).address !== input.receiver
    )
      return deny();
    const total = priceUnits(JSON.parse(asset.state.data.value).price);
    const tokens = factory.state.input?.tokens;
    if (
      !Array.isArray(tokens) ||
      tokens.length !== 1 ||
      tokens[0]?.address !== policy.tokenAddress ||
      tokens[0]?.decimal !== 18
    )
      return deny();
    const mint = contactPaymentUnits(tokens[0].value);
    if (total < mint) return deny();
    const fees = evidence.fees as any;
    const chain = fees?.getChainInfo?.info;
    const rows = fees?.getForgeState?.state?.txConfig?.txFee;
    if (
      fees?.getChainInfo?.code !== 'OK' ||
      fees?.getForgeState?.code !== 'OK' ||
      chain?.network !== policy.chainId ||
      chain.synced !== true ||
      (chain.consensusVersion !== undefined &&
        chain.consensusVersion !== null &&
        typeof chain.consensusVersion !== 'string') ||
      !Array.isArray(rows) ||
      rows.length > 256
    )
      return deny();
    if (policy.confirmationPolicy === 'arcblock-dolt-ledger/1') {
      if (chain.consensusVersion !== '@ocap/statedb-dolt v1.20.2' || chain.blockHeight !== '0') return deny();
    } else if (
      /^@ocap\/statedb-dolt(?:\s|$)/i.test((chain.consensusVersion ?? '').trim()) ||
      typeof chain.blockHeight !== 'string' ||
      !/^[1-9][0-9]*$/.test(chain.blockHeight)
    )
      return deny();
    for (const row of rows) {
      if (!text(row?.typeUrl)) return deny();
      contactPaymentUnits(row.fee);
    }
    const feeFor = (type: string): string => {
      const matches = rows.filter((row) => row.typeUrl === type);
      if (matches.length > 1) return deny();
      return matches[0]?.fee ?? '0';
    };
    const chainFee = feeFor('fg:t:transfer_v3');
    const mintChainFee = feeFor('fg:t:acquire_asset_v3');
    const developer = (total - mint) / 10n;
    const binding = snapshotContactPaymentBinding({
      chainId: policy.chainId,
      endpoint: policy.endpoint,
      preparationId: input.preparationId,
      sender: input.sender,
      receiver: input.receiver,
      namecard: input.namecard,
      contentHash: contactContentHash(input.sender, input.receiver, input.ciphertext, input.namecard),
      tokenAddress: policy.tokenAddress,
      totalAmount: total.toString(),
      servicePayee: policy.servicePayee,
      serviceAmount: (total - developer).toString(),
      developerPayee: policy.developerPayee,
      developerAmount: developer.toString(),
      chainFee,
    });
    return Object.freeze({
      binding,
      policy: Object.freeze({
        chainEndpoint: policy.chainEndpoint,
        namecardFactory: policy.namecardFactory,
        contactFactory: policy.contactFactory,
        mintAmount: mint.toString(),
        mintChainFee,
        confirmationPolicy: policy.confirmationPolicy,
      }),
    });
  } catch {
    return deny();
  }
}
