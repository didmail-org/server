import { fromAddress, fromPublicKey } from '@ocap/wallet';
import { getHasher, types, toTxHash } from '@ocap/mcrypto';
import { canonicalize } from '@didmail/protocol';
import { decodeContactBytes, encodeContactBytes } from './contact-base58';

// Keep the installed chain SDK unchanged. Both current clients use this CBOR codec.
const { decodeTx, encodeTx } = require('@didmail/ocap-message-cbor/cbor');

export interface ContactPaymentBinding {
  readonly chainId: string;
  readonly endpoint: string;
  readonly preparationId: string;
  readonly sender: string;
  readonly receiver: string;
  readonly namecard: string;
  readonly contentHash: string;
  readonly tokenAddress: string;
  readonly totalAmount: string;
  readonly servicePayee: string;
  readonly serviceAmount: string;
  readonly developerPayee: string;
  readonly developerAmount: string;
  readonly chainFee: string;
}

export interface VerifiedContactPayment {
  readonly transactionId: string;
  readonly signedOrigin: string;
  readonly unsignedOrigin: string;
  readonly binding: Readonly<ContactPaymentBinding>;
}

const verified = new WeakSet<object>();
export const isVerifiedContactPayment = (value: unknown): value is VerifiedContactPayment =>
  typeof value === 'object' && value !== null && verified.has(value);

export class InvalidContactPayment extends Error {
  constructor() {
    super('Contact payment does not match the original preparation and signatures');
  }
}
const deny = (): never => {
  throw new InvalidContactPayment();
};
const same = (a: unknown, b: Uint8Array): boolean =>
  a instanceof Uint8Array && a.length === b.length && a.every((value, index) => value === b[index]);
const units = (value: unknown): bigint => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value)) return deny();
  const result = BigInt(value);
  return result < 2n ** 256n ? result : deny();
};
export { units as contactPaymentUnits };
export const contactContentHash = (sender: string, receiver: string, ciphertext: string, namecard: string): string =>
  getHasher(types.HashType.SHA3)(new TextEncoder().encode(sender + receiver + ciphertext + namecard), 1)
    .slice(-64)
    .toUpperCase();
const fieldsOnly = (value: unknown, fields: string[]): boolean =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).every((key) => fields.includes(key));
const encode = (tx: any): Uint8Array => encodeTx({ ...tx, itx: { type: 'TransferV3Tx', value: tx.itx } });

/** Copies and validates immutable scalar terms; the caller must supply a trusted node quote. */
export function snapshotContactPaymentBinding(original: ContactPaymentBinding): Readonly<ContactPaymentBinding> {
  const fields = [
    'chainId',
    'endpoint',
    'preparationId',
    'sender',
    'receiver',
    'namecard',
    'contentHash',
    'tokenAddress',
    'totalAmount',
    'servicePayee',
    'serviceAmount',
    'developerPayee',
    'developerAmount',
    'chainFee',
  ];
  if (!fieldsOnly(original, fields) || Object.keys(original).length !== fields.length) return deny();
  // Snapshot caller-owned data before the first await; all accepted values are scalar.
  const binding = Object.freeze({ ...original });
  if (
    Object.values(binding).some(
      (value) => typeof value !== 'string' || !value || value.length > 256 || /\s/.test(value),
    )
  )
    return deny();
  const endpoint = new URL(binding.endpoint);
  if (
    endpoint.origin !== binding.endpoint ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !(
      endpoint.protocol === 'https:' ||
      (endpoint.protocol === 'http:' &&
        (['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname) || endpoint.hostname.endsWith('.localhost')))
    ) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(binding.preparationId) ||
    !/^[A-F0-9]{64}$/.test(binding.contentHash)
  )
    return deny();
  const total = units(binding.totalAmount);
  if (units(binding.serviceAmount) + units(binding.developerAmount) !== total) return deny();
  units((total + units(binding.chainFee)).toString());
  return binding;
}

/** Offline only. Validation never constructs a replacement or exposes a signer. */
export async function verifyContactPayment(
  signedOrigin: string,
  original: ContactPaymentBinding,
  authenticatedPublicKey: Uint8Array,
  preparationSha256?: string,
): Promise<VerifiedContactPayment> {
  try {
    const binding = snapshotContactPaymentBinding(original);
    if (preparationSha256 !== undefined && !/^[a-f0-9]{64}$/.test(preparationSha256)) return deny();
    if (!(authenticatedPublicKey instanceof Uint8Array) || authenticatedPublicKey.length !== 32) return deny();
    const publicKey = new Uint8Array(authenticatedPublicKey);
    const { type } = fromAddress(binding.sender);
    if (
      type.pk !== 0 ||
      type.hash !== 1 ||
      publicKey.length !== 32 ||
      fromPublicKey(publicKey, type).address !== binding.sender
    )
      return deny();
    const total = units(binding.totalAmount);
    const service = units(binding.serviceAmount);
    const developer = units(binding.developerAmount);
    units(binding.chainFee);
    if (service + developer !== total) return deny();
    units((total + units(binding.chainFee)).toString());
    if (typeof signedOrigin !== 'string' || signedOrigin.length > 68000 || !signedOrigin.startsWith('z')) return deny();
    const bytes = decodeContactBytes(signedOrigin);
    if (encodeContactBytes(bytes) !== signedOrigin || !same(bytes.subarray(0, 3), new Uint8Array([217, 217, 247])))
      return deny();
    const tx = decodeTx(bytes);
    if (
      !fieldsOnly(tx, [
        'from',
        'nonce',
        'chainId',
        'pk',
        'signature',
        'signatures',
        'signaturesList',
        'itx',
        'serviceFee',
        'gas',
        'delegator',
        'receipts',
        'receiptsList',
      ]) ||
      !same(encode(tx), bytes) ||
      tx.from !== binding.sender ||
      tx.chainId !== binding.chainId ||
      !same(tx.pk, publicKey) ||
      !Number.isSafeInteger(tx.nonce) ||
      tx.nonce <= 0 ||
      tx.gas ||
      tx.delegator ||
      tx.receipts?.length ||
      tx.receiptsList?.length ||
      !(tx.signature instanceof Uint8Array) ||
      tx.signature.length !== 64 ||
      tx.serviceFee !== binding.chainFee ||
      tx.signatures?.length !== 1
    )
      return deny();
    const signer = tx.signatures[0];
    if (
      !fieldsOnly(signer, ['signer', 'pk', 'signature', 'delegator', 'data']) ||
      signer.signer !== binding.sender ||
      !same(signer.pk, publicKey) ||
      signer.delegator ||
      signer.data ||
      !(signer.signature instanceof Uint8Array) ||
      signer.signature.length !== 64
    )
      return deny();
    const transfer = tx.itx;
    if (
      !fieldsOnly(transfer, ['typeUrl', 'inputs', 'inputsList', 'outputs', 'outputsList', 'data']) ||
      transfer.typeUrl !== 'fg:t:transfer_v3' ||
      transfer.inputs?.length !== 1 ||
      transfer.outputs?.length !== (developer === 0n ? 1 : 2) ||
      !fieldsOnly(transfer.data, ['typeUrl', 'value']) ||
      transfer.data.typeUrl !== 'json'
    )
      return deny();
    const metadata = {
      protocolVersion: 1,
      kind: 'didmail-namecard-payment',
      endpoint: binding.endpoint,
      preparationId: binding.preparationId,
      sender: binding.sender,
      receiver: binding.receiver,
      namecard: binding.namecard,
      contentHash: binding.contentHash,
      ...(preparationSha256 === undefined ? {} : { preparationSha256 }),
    };
    if (canonicalize(transfer.data.value) !== canonicalize(metadata)) return deny();
    const leg = (value: any, owner: string, amount: string) => {
      if (
        !fieldsOnly(value, ['owner', 'tokens', 'tokensList', 'assets', 'assetsList']) ||
        value.owner !== owner ||
        value.assets?.length ||
        value.assetsList?.length ||
        value.tokens?.length !== 1
      )
        deny();
      const token = value.tokens[0];
      if (!fieldsOnly(token, ['address', 'value']) || token.address !== binding.tokenAddress || token.value !== amount)
        deny();
    };
    leg(transfer.inputs[0], binding.sender, binding.totalAmount);
    leg(transfer.outputs[0], binding.servicePayee, binding.serviceAmount);
    if (developer !== 0n) leg(transfer.outputs[1], binding.developerPayee, binding.developerAmount);
    const verifier = fromPublicKey(publicKey, type);
    const primary = { ...tx, signature: undefined };
    if (!(await verifier.verify(encode(primary), tx.signature))) return deny();
    const headers = [{ ...signer, signature: undefined }];
    const unsigned = encode({ ...primary, signatures: headers, signaturesList: headers });
    if (!(await verifier.verify(unsigned, signer.signature))) return deny();
    const result = Object.freeze({
      transactionId: toTxHash(bytes),
      signedOrigin,
      unsignedOrigin: encodeContactBytes(unsigned),
      binding,
    });
    verified.add(result);
    return result;
  } catch {
    return deny();
  }
}
