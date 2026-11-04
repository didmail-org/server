import { fromSecretKey } from '@ocap/wallet';
import { getSigner, types, toTxHash } from '@ocap/mcrypto';
import { fromBase58, toBase58, toUint8Array } from '@ocap/util';
import { contactMintVariables, prepareContactMint, verifyContactMint } from '../contact-mint-evidence';
import type { ContactPreparation } from '../contact-preparation';

const { encodeTx, decodeTx } = require('@didmail/ocap-message-cbor/cbor');
const f = require('../../../../tests/fixtures/namecard-payment.json');
const { record } = require('../../../../tests/fixtures/namecard-payment-record.json');

const keys = getSigner(types.KeyType.ED25519).genKeyPair('hex', new Uint8Array(32).fill(3));
const operator = fromSecretKey(keys.secretKey, { pk: 0, hash: 1 });
const key = toUint8Array(operator.publicKey);
const preparation: ContactPreparation = {
  snapshot: {
    binding: {
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
    },
    policy: {
      chainEndpoint: 'https://beta.abtnetwork.io/api/',
      namecardFactory: f.policy.namecardFactory,
      contactFactory: f.policy.contactFactory,
      mintAmount: f.terms.mintAmount,
      mintChainFee: '3',
      confirmationPolicy: 'arcblock-committed',
    },
  },
  ciphertext: f.encrypted,
  createdAt: 1800000000000,
  expiresAt: 1800000600000,
  payment: {
    transactionId: record.id,
    signedOrigin: record.signedOrigin,
    unsignedOrigin: record.unsignedOrigin,
    publicKey: toBase58(new Uint8Array(f.publicKey)),
    acceptedAt: 1800000000001,
  },
};
const premint = () => ({
  address: 'zPublicAsset',
  issuer: { id: f.terms.developerPayee, pk: 'z', name: 'Public issuer' },
  variables: Object.entries(contactMintVariables(preparation)).map(([name, value]) => ({ name, value })),
});
const encode = (tx: any) => encodeTx({ ...tx, itx: { type: 'AcquireAssetV3Tx', value: tx.itx } });
const resign = (source: string, change: (tx: any) => void) => {
  const tx = decodeTx(fromBase58(source));
  const headers = [{ signer: tx.from, pk: tx.pk }];
  tx.signature = undefined;
  tx.signatures = headers;
  tx.signaturesList = headers;
  change(tx);
  const multi = [{ ...tx.signatures[0], signature: toUint8Array(operator.sign(encode(tx))) }];
  const primary = { ...tx, signatures: multi, signaturesList: multi };
  return toBase58(encode({ ...primary, signature: toUint8Array(operator.sign(encode(primary))) }));
};
let original: Awaited<ReturnType<typeof prepareContactMint>>;
beforeAll(async () => {
  original = await prepareContactMint(preparation, premint(), operator, 1800000000002);
});

test('modern CBOR mint binds original payment, content, recipient, factory and persisted fee without SDK context', async () => {
  const tx = decodeTx(fromBase58(original.signedOrigin));
  expect(operator.address).toBe(preparation.snapshot.binding.servicePayee);
  expect(tx.serviceFee).toBe('3');
  expect(tx.itx.inputs[0].tokens[0].value).toBe(f.terms.mintAmount);
  expect(tx.itx.owner).toBe(record.receiver);
  expect(tx.itx.variables).toContainEqual({ name: 'didmailPaymentHash', value: record.id });
  expect(original.transactionId).toBe(toTxHash(fromBase58(original.signedOrigin)));
  expect(await verifyContactMint(preparation, original.signedOrigin, original.assetId, key)).toEqual(original);
  expect(Object.isFrozen(original)).toBe(true);
});
test.each([
  [
    'network',
    (tx: any) => {
      tx.chainId = 'other';
    },
  ],
  [
    'service fee',
    (tx: any) => {
      tx.serviceFee = '4';
    },
  ],
  [
    'recipient',
    (tx: any) => {
      tx.itx.owner = record.owner;
    },
  ],
  [
    'factory',
    (tx: any) => {
      tx.itx.factory = 'zOther';
    },
  ],
  [
    'asset',
    (tx: any) => {
      tx.itx.address = 'zOther';
    },
  ],
  [
    'token',
    (tx: any) => {
      tx.itx.inputs[0].tokens[0].address = 'zOther';
    },
  ],
  [
    'mint amount',
    (tx: any) => {
      tx.itx.inputs[0].tokens[0].value = '999999999999999';
    },
  ],
  [
    'payer',
    (tx: any) => {
      tx.itx.inputs[0].owner = record.owner;
    },
  ],
  [
    'extra token',
    (tx: any) => {
      tx.itx.inputs[0].tokens.push({ address: 'zOther', value: '1' });
    },
  ],
  [
    'extra input',
    (tx: any) => {
      tx.itx.inputs.push({ owner: record.owner, tokens: [] });
    },
  ],
  [
    'asset transfer',
    (tx: any) => {
      tx.itx.inputs[0].assets = ['zStolenAsset'];
    },
  ],
  [
    'issuer',
    (tx: any) => {
      tx.itx.issuer.id = record.owner;
    },
  ],
  [
    'delegation',
    (tx: any) => {
      tx.delegator = record.owner;
    },
  ],
  [
    'gas',
    (tx: any) => {
      tx.gas = 1;
    },
  ],
  [
    'missing variable',
    (tx: any) => {
      tx.itx.variables.pop();
    },
  ],
  [
    'duplicate variable',
    (tx: any) => {
      const [first] = tx.itx.variables;
      tx.itx.variables[1] = first;
    },
  ],
  [
    'unknown variable',
    (tx: any) => {
      tx.itx.variables[0] = { name: 'arbitrary', value: 'opaque' };
    },
  ],
  ...[
    'sender',
    'receiver',
    'pk',
    'contact',
    'namecard',
    'didmailPreparationId',
    'didmailPaymentHash',
    'didmailContentHash',
    'didmailEndpoint',
  ].map((name) => [
    name,
    (tx: any) => {
      tx.itx.variables.find((v: any) => v.name === name).value = 'replacement';
    },
  ]),
] as Array<[string, (tx: any) => void]>)(
  'rejects independently valid operator signatures with changed %s',
  async (_name, change) => {
    const replacement = resign(original.signedOrigin, change);
    await expect(verifyContactMint(preparation, replacement, original.assetId, key)).rejects.toThrow(
      'INVALID_CONTACT_MINT',
    );
  },
);
test('damaged inner signature cannot be hidden by a fresh valid outer signature', async () => {
  const tx = decodeTx(fromBase58(original.signedOrigin));
  tx.signatures[0].signature[0] = (tx.signatures[0].signature[0] + 1) % 256;
  const primary = { ...tx, signature: undefined };
  const bytes = encode({ ...primary, signature: toUint8Array(operator.sign(encode(primary))) });
  await expect(verifyContactMint(preparation, toBase58(bytes), original.assetId, key)).rejects.toThrow(
    'INVALID_CONTACT_MINT',
  );
});
test('preparation and operator key are snapshotted before asynchronous verification', async () => {
  const p: any = structuredClone(preparation);
  const pk = new Uint8Array(key);
  const pending = verifyContactMint(p, original.signedOrigin, original.assetId, pk);
  pk.fill(0);
  p.ciphertext = 'changed' as never;
  expect(await pending).toEqual(original);
});
test.each(['ciphertext', 'payment hash', 'unsigned payment', 'payer signature', 'mint amount', 'chain fee'])(
  'rejects broken saved %s before returning signed mint',
  async (field) => {
    const p: any = structuredClone(preparation);
    if (field === 'ciphertext') p.ciphertext = 'changed';
    if (field === 'payment hash') p.payment.transactionId = 'A'.repeat(64);
    if (field === 'unsigned payment') p.payment.unsignedOrigin = p.payment.signedOrigin;
    if (field === 'payer signature') p.payment.signedOrigin = p.payment.unsignedOrigin;
    if (field === 'mint amount')
      p.snapshot.policy.mintAmount = (BigInt(p.snapshot.binding.serviceAmount) + 1n).toString();
    if (field === 'chain fee') p.snapshot.policy.mintChainFee = '-1';
    await expect(prepareContactMint(p, premint(), operator, 1800000000002)).rejects.toThrow('INVALID_CONTACT_MINT');
  },
);
test('invalid factory variables are rejected before the operator signs', async () => {
  const spy = jest.spyOn(operator, 'sign');
  try {
    const changed = premint();
    changed.variables[0]!.value = 'replacement';
    await expect(prepareContactMint(preparation, changed, operator, 1800000000002)).rejects.toThrow(
      'INVALID_CONTACT_MINT',
    );
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});
