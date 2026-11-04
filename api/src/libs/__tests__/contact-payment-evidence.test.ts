import { fromSecretKey } from '@ocap/wallet';
import { getSigner, types } from '@ocap/mcrypto';
import { fromBase58, toBase58, toUint8Array } from '@ocap/util';
import {
  verifyContactPayment,
  isVerifiedContactPayment,
  InvalidContactPayment,
  ContactPaymentBinding,
} from '../contact-payment-evidence';

const { decodeTx, encodeTx } = require('@didmail/ocap-message-cbor/cbor');
const source = require('../../../../tests/fixtures/namecard-payment-record.json');
const dart = require('../../../../tests/fixtures/namecard-payment-dart.json');
const f = require('../../../../tests/fixtures/namecard-payment.json');

const { record } = source;
const binding: ContactPaymentBinding = {
  chainId: f.policy.chainId,
  endpoint: record.endpoint,
  preparationId: record.preparationId,
  sender: record.owner,
  receiver: record.receiver,
  namecard: record.namecard,
  contentHash: record.contentHash,
  tokenAddress: f.policy.tokenAddress,
  totalAmount: f.terms.totalAmount,
  servicePayee: f.terms.servicePayee,
  serviceAmount: f.terms.serviceAmount,
  developerPayee: f.terms.developerPayee,
  developerAmount: f.terms.developerAmount,
  chainFee: f.terms.chainFee,
};
const keys = getSigner(types.KeyType.ED25519).genKeyPair('hex', new Uint8Array(32).fill(1));
const payer = fromSecretKey(keys.secretKey, { pk: 0, hash: 1 });
const publicKey = toUint8Array(payer.publicKey);
const encode = (tx: any) => encodeTx({ ...tx, itx: { type: 'TransferV3Tx', value: tx.itx } });
const outer = (tx: any) => {
  const unsigned = { ...tx, signature: undefined };
  return { ...unsigned, signature: toUint8Array(payer.sign(encode(unsigned))) };
};
const resign = (change: (tx: any) => void) => {
  const tx = decodeTx(fromBase58(record.signedOrigin));
  const headers = [{ signer: tx.from, pk: tx.pk }];
  tx.signature = undefined;
  tx.signatures = headers;
  tx.signaturesList = headers;
  change(tx);
  const signedHeaders = [{ ...headers[0], signature: toUint8Array(payer.sign(encode(tx))) }];
  return toBase58(encode(outer({ ...tx, signatures: signedHeaders, signaturesList: signedHeaders })));
};

describe('offline canonical contact payment evidence', () => {
  test.each([
    ['actual SDK CBOR', record],
    ['actual Dart CBOR', dart.record],
  ])('%s retains original transaction bytes and hash', async (_, value) => {
    const result = await verifyContactPayment(value.signedOrigin, binding, publicKey);
    expect(result.transactionId).toBe(value.id);
    expect(result.signedOrigin).toBe(value.signedOrigin);
    expect(result.unsignedOrigin).toBe(value.unsignedOrigin);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.binding)).toBe(true);
    expect(isVerifiedContactPayment(result)).toBe(true);
    expect(isVerifiedContactPayment({ ...result })).toBe(false);
  });
  test.each([
    'chainId',
    'endpoint',
    'preparationId',
    'receiver',
    'namecard',
    'contentHash',
    'tokenAddress',
    'servicePayee',
    'developerPayee',
    'chainFee',
  ])('rejects replacement preparation %s', async (field) => {
    await expect(
      verifyContactPayment(
        record.signedOrigin,
        { ...binding, [field]: field === 'endpoint' ? 'https://other.invalid' : 'different' },
        publicKey,
      ),
    ).rejects.toBeInstanceOf(InvalidContactPayment);
  });
  test.each([
    [
      'receiver metadata',
      (tx: any) => {
        tx.itx.data.value.receiver = record.owner;
      },
    ],
    [
      'extra metadata',
      (tx: any) => {
        tx.itx.data.value.extra = true;
      },
    ],
    [
      'service payee',
      (tx: any) => {
        tx.itx.outputs[0].owner = record.owner;
      },
    ],
    [
      'developer payee',
      (tx: any) => {
        tx.itx.outputs[1].owner = record.owner;
      },
    ],
    [
      'token',
      (tx: any) => {
        tx.itx.inputs[0].tokens[0].address = 'other-token';
      },
    ],
    [
      'inflated amount',
      (tx: any) => {
        tx.itx.outputs[0].tokens[0].value = '9999999999999999999';
      },
    ],
    [
      'fee',
      (tx: any) => {
        tx.serviceFee = '8';
      },
    ],
    [
      'network',
      (tx: any) => {
        tx.chainId = 'main';
      },
    ],
    [
      'delegator',
      (tx: any) => {
        tx.delegator = record.owner;
      },
    ],
  ])('rejects a valid payer signature outside the snapshot: %s', async (_, change) => {
    await expect(verifyContactPayment(resign(change), binding, publicKey)).rejects.toBeInstanceOf(
      InvalidContactPayment,
    );
  });
  test('checks the inner signature even when the outer signature is valid', async () => {
    const tx = decodeTx(fromBase58(record.signedOrigin));
    tx.signatures[0].signature[0] = (tx.signatures[0].signature[0] + 1) % 256;
    await expect(verifyContactPayment(toBase58(encode(outer(tx))), binding, publicKey)).rejects.toBeInstanceOf(
      InvalidContactPayment,
    );
  });
  test('checks the outer signature independently', async () => {
    const tx = decodeTx(fromBase58(record.signedOrigin));
    tx.signature[0] = (tx.signature[0] + 1) % 256;
    await expect(verifyContactPayment(toBase58(encode(tx)), binding, publicKey)).rejects.toBeInstanceOf(
      InvalidContactPayment,
    );
  });
  test('rejects another authenticated key before granting evidence', async () => {
    await expect(verifyContactPayment(record.signedOrigin, binding, new Uint8Array(32))).rejects.toBeInstanceOf(
      InvalidContactPayment,
    );
  });
  test('does not reinterpret other encodings, oversized input or malformed bindings', async () => {
    await Promise.all(
      [toBase58(new Uint8Array([1, 2, 3])), `z${'1'.repeat(68001)}`].map(async (signed) => {
        await expect(verifyContactPayment(signed, binding, publicKey)).rejects.toBeInstanceOf(InvalidContactPayment);
      }),
    );
    await expect(
      verifyContactPayment(record.signedOrigin, { ...binding, secretKey: 'never store credentials' } as any, publicKey),
    ).rejects.toBeInstanceOf(InvalidContactPayment);
  });
  test('captures scalar terms before an asynchronous verifier can yield', async () => {
    const mutable = { ...binding };
    const key = new Uint8Array(publicKey);
    const pending = verifyContactPayment(record.signedOrigin, mutable, key);
    mutable.receiver = 'changed';
    key.fill(0);
    expect((await pending).binding.receiver).toBe(binding.receiver);
  });
});
