import { fromAddress, fromPublicKey, type WalletObject } from '@ocap/wallet';
import { fromBase58, toUint8Array } from '@ocap/util';
import { toTxHash } from '@ocap/mcrypto';
import { canonicalize } from '@didmail/protocol';
import type { ContactPreparation } from './contact-preparation';
import { contactPreparationCommitment } from './contact-preparation';
import { contactContentHash, contactPaymentUnits, verifyContactPayment } from './contact-payment-evidence';
import { encodeContactBytes, decodeContactBytes } from './contact-base58';

const { decodeTx, encodeTx } = require('@didmail/ocap-message-cbor/cbor');

export interface ContactMintBytes {
  readonly signedOrigin: string;
  readonly transactionId: string;
  readonly assetId: string;
}
export interface ContactPreMint {
  readonly address: string;
  readonly variables: ReadonlyArray<{ readonly name: string; readonly value: string }>;
  readonly issuer: { readonly id: string; readonly pk: string; readonly name: string };
}
const deny = (): never => {
  throw new Error('INVALID_CONTACT_MINT');
};
const fields = (value: any, keys: string[]) =>
  value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
const same = (value: unknown, expected: Uint8Array) =>
  value instanceof Uint8Array &&
  value.length === expected.length &&
  value.every((byte, index) => byte === expected[index]);
const encode = (tx: any): Uint8Array => encodeTx({ ...tx, itx: { type: 'AcquireAssetV3Tx', value: tx.itx } });
const payeeMatches = (a: string, b: string) =>
  /^0x[0-9a-fA-F]{40}$/.test(a) && /^0x[0-9a-fA-F]{40}$/.test(b) ? a.toLowerCase() === b.toLowerCase() : a === b;
export function contactMintVariables(preparation: ContactPreparation): Readonly<Record<string, string>> {
  if (!preparation.payment) return deny();
  const b = preparation.snapshot.binding;
  return Object.freeze({
    sender: b.sender,
    receiver: b.receiver,
    pk: preparation.payment.publicKey,
    contact: preparation.ciphertext,
    namecard: b.namecard,
    didmailPreparationId: b.preparationId,
    didmailPaymentHash: preparation.payment.transactionId,
    didmailContentHash: b.contentHash,
    didmailEndpoint: b.endpoint,
  });
}
async function checkedPreparation(original: ContactPreparation): Promise<ContactPreparation> {
  const p = structuredClone(original);
  if (
    !p.payment ||
    typeof p.ciphertext !== 'string' ||
    !p.ciphertext ||
    new TextEncoder().encode(p.ciphertext).length > 65536
  )
    return deny();
  const b = p.snapshot.binding;
  const { policy } = p.snapshot;
  if (
    contactContentHash(b.sender, b.receiver, p.ciphertext, b.namecard) !== b.contentHash ||
    typeof policy.contactFactory !== 'string' ||
    !policy.contactFactory ||
    policy.contactFactory.length > 256 ||
    contactPaymentUnits(policy.mintAmount) > contactPaymentUnits(b.serviceAmount)
  )
    return deny();
  contactPaymentUnits((contactPaymentUnits(policy.mintAmount) + contactPaymentUnits(policy.mintChainFee)).toString());
  const payment = await verifyContactPayment(
    p.payment.signedOrigin,
    b,
    fromBase58(p.payment.publicKey),
    contactPreparationCommitment(p),
  );
  if (payment.transactionId !== p.payment.transactionId || payment.unsignedOrigin !== p.payment.unsignedOrigin)
    return deny();
  return p;
}
function validateBody(itx: any, p: ContactPreparation, assetId: string) {
  const b = p.snapshot.binding;
  if (
    !fields(itx, [
      'typeUrl',
      'factory',
      'address',
      'inputs',
      'inputsList',
      'owner',
      'variables',
      'variablesList',
      'issuer',
    ]) ||
    itx.typeUrl !== 'fg:t:acquire_asset_v3' ||
    itx.factory !== p.snapshot.policy.contactFactory ||
    itx.address !== assetId ||
    !assetId ||
    assetId.length > 256 ||
    itx.owner !== b.receiver ||
    itx.inputs?.length !== 1
  )
    return deny();
  const input = itx.inputs[0];
  if (
    !fields(input, ['owner', 'tokens', 'tokensList', 'assets', 'assetsList']) ||
    input.owner !== b.servicePayee ||
    input.assets?.length ||
    input.assetsList?.length ||
    input.tokens?.length !== 1
  )
    return deny();
  const token = input.tokens[0];
  if (
    !fields(token, ['address', 'value']) ||
    token.address !== b.tokenAddress ||
    token.value !== p.snapshot.policy.mintAmount
  )
    return deny();
  const { issuer } = itx;
  if (
    !fields(issuer, ['id', 'pk', 'name']) ||
    typeof issuer.id !== 'string' ||
    !payeeMatches(issuer.id, b.developerPayee) ||
    typeof issuer.pk !== 'string' ||
    issuer.pk.length > 256 ||
    typeof issuer.name !== 'string' ||
    issuer.name.length > 512
  )
    return deny();
  const expected = contactMintVariables(p);
  const variables: Record<string, string> = {};
  if (!Array.isArray(itx.variables) || itx.variables.length !== Object.keys(expected).length) return deny();
  for (const variable of itx.variables) {
    if (
      !fields(variable, ['name', 'value']) ||
      typeof variable.name !== 'string' ||
      !Object.hasOwn(expected, variable.name) ||
      Object.hasOwn(variables, variable.name) ||
      typeof variable.value !== 'string' ||
      variable.value !== expected[variable.name]
    )
      return deny();
    variables[variable.name] = variable.value;
  }
  if (canonicalize(variables) !== canonicalize(expected)) return deny();
  return true;
}

/** Pure offline verification of the complete signed mint, independent of SDK fee context. */
export async function verifyContactMint(
  original: ContactPreparation,
  signedOrigin: string,
  assetId: string,
  authenticatedOperatorKey: Uint8Array,
): Promise<Readonly<ContactMintBytes>> {
  try {
    const key = new Uint8Array(authenticatedOperatorKey);
    if (
      !(authenticatedOperatorKey instanceof Uint8Array) ||
      key.length !== 32 ||
      typeof signedOrigin !== 'string' ||
      !signedOrigin.startsWith('z') ||
      signedOrigin.length > 96000 ||
      typeof assetId !== 'string'
    )
      return deny();
    const p = await checkedPreparation(original);
    const b = p.snapshot.binding;
    const { type } = fromAddress(b.servicePayee);
    if (type.pk !== 0 || type.hash !== 1 || fromPublicKey(key, type).address !== b.servicePayee) return deny();
    const bytes = decodeContactBytes(signedOrigin);
    const tx = decodeTx(bytes);
    if (
      encodeContactBytes(bytes) !== signedOrigin ||
      !same(bytes.subarray(0, 3), new Uint8Array([217, 217, 247])) ||
      !fields(tx, [
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
      tx.from !== b.servicePayee ||
      tx.chainId !== b.chainId ||
      !same(tx.pk, key) ||
      !Number.isSafeInteger(tx.nonce) ||
      tx.nonce <= 0 ||
      tx.serviceFee !== p.snapshot.policy.mintChainFee ||
      tx.gas ||
      tx.delegator ||
      tx.receipts?.length ||
      tx.receiptsList?.length ||
      !(tx.signature instanceof Uint8Array) ||
      tx.signature.length !== 64 ||
      tx.signatures?.length !== 1
    )
      return deny();
    validateBody(tx.itx, p, assetId);
    const signer = tx.signatures[0];
    if (
      !fields(signer, ['signer', 'pk', 'signature', 'delegator', 'data']) ||
      signer.signer !== b.servicePayee ||
      !same(signer.pk, key) ||
      signer.delegator ||
      signer.data ||
      !(signer.signature instanceof Uint8Array) ||
      signer.signature.length !== 64
    )
      return deny();
    const verifier = fromPublicKey(key, type);
    const primary = { ...tx, signature: undefined };
    if (!(await verifier.verify(encode(primary), tx.signature))) return deny();
    const headers = [{ ...signer, signature: undefined }];
    if (
      !(await verifier.verify(encode({ ...primary, signatures: headers, signaturesList: headers }), signer.signature))
    )
      return deny();
    return Object.freeze({ signedOrigin, transactionId: toTxHash(bytes), assetId });
  } catch {
    return deny();
  }
}

/** Signs once with the persisted fee, then independently verifies before returning any bytes. */
export async function prepareContactMint(
  original: ContactPreparation,
  originalPreMint: ContactPreMint,
  operator: Pick<WalletObject<any>, 'address' | 'publicKey' | 'sign'>,
  nonce: number,
): Promise<Readonly<ContactMintBytes>> {
  try {
    const preMint = structuredClone(originalPreMint);
    const key = new Uint8Array(toUint8Array(operator.publicKey));
    const p = await checkedPreparation(original);
    const b = p.snapshot.binding;
    if (operator.address !== b.servicePayee || !Number.isSafeInteger(nonce) || nonce <= 0) return deny();
    const itx = {
      typeUrl: 'fg:t:acquire_asset_v3',
      factory: p.snapshot.policy.contactFactory,
      address: preMint.address,
      owner: b.receiver,
      issuer: preMint.issuer,
      variables: preMint.variables,
      inputs: [{ owner: b.servicePayee, tokens: [{ address: b.tokenAddress, value: p.snapshot.policy.mintAmount }] }],
    };
    validateBody(itx, p, preMint.address);
    const headers = [{ signer: b.servicePayee, pk: key }];
    const tx = {
      from: b.servicePayee,
      pk: key,
      chainId: b.chainId,
      nonce,
      serviceFee: p.snapshot.policy.mintChainFee,
      signatures: headers,
      itx,
    };
    const multi = [{ ...headers[0], signature: toUint8Array(operator.sign(encode(tx))) }];
    const primary = { ...tx, signatures: multi };
    const signed = { ...primary, signature: toUint8Array(operator.sign(encode(primary))) };
    return await verifyContactMint(p, encodeContactBytes(encode(signed)), preMint.address, key);
  } catch {
    return deny();
  }
}
