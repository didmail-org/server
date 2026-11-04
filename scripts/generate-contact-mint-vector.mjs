// Reproducible offline fixtures. Public fixed seeds, no wallet/config/RPC/broadcast.
import fs from 'node:fs/promises';
import { fromSecretKey } from '@ocap/wallet';
import { getSigner, types, toTxHash } from '@ocap/mcrypto';
import { fromBase58, toBase58, toUint8Array } from '@ocap/util';
import { encodeTx, decodeTx } from '@didmail/ocap-message-cbor/cbor';
import { canonicalize, digest, utf8, signArtifact, identityId } from '@didmail/protocol';
import { createHash } from 'node:crypto';
const source = JSON.parse(
  await fs.readFile(new URL('../tests/fixtures/contact-recovery-record.json', import.meta.url), 'utf8'),
);
const pair = (seed) => getSigner(types.KeyType.ED25519).genKeyPair('hex', new Uint8Array(32).fill(seed));
const payer = fromSecretKey(pair(1).secretKey, { pk: 0, hash: 1 });
const node = (role) =>
  fromSecretKey(pair(3).secretKey, {
    pk: 0,
    hash: 1,
    ...(role === 'application' ? { role: types.RoleType.ROLE_APPLICATION } : {}),
  });
const encode = (tx) => encodeTx({ ...tx, itx: { type: 'AcquireAssetV3Tx', value: tx.itx } });
const sign = (tx, wallet) => {
  const headers = [{ signer: tx.from, pk: tx.pk }];
  tx.signature = undefined;
  tx.signatures = headers;
  tx.signaturesList = headers;
  const multi = [{ ...headers[0], signature: toUint8Array(wallet.sign(encode(tx))) }];
  tx.signatures = multi;
  tx.signaturesList = multi;
  tx.signature = toUint8Array(wallet.sign(encode(tx)));
  return encode(tx);
};
function mintTx(record) {
  const { binding: b, policy: p } = record.recovery.snapshot;
  const variables = {
    sender: b.sender,
    receiver: b.receiver,
    pk: toBase58(toUint8Array(payer.publicKey)),
    contact: record.recovery.ciphertext,
    namecard: b.namecard,
    didmailPreparationId: b.preparationId,
    didmailPaymentHash: record.id,
    didmailContentHash: b.contentHash,
    didmailEndpoint: b.endpoint,
  };
  return {
    from: b.servicePayee,
    pk: toUint8Array(node('account').publicKey),
    chainId: b.chainId,
    nonce: 1800000000002,
    serviceFee: p.mintChainFee,
    itx: {
      typeUrl: 'fg:t:acquire_asset_v3',
      factory: p.contactFactory,
      address: 'zPublicContactMintAsset',
      owner: b.receiver,
      issuer: { id: b.developerPayee, pk: 'z', name: 'Public issuer' },
      inputs: [{ owner: b.servicePayee, tokens: [{ address: b.tokenAddress, value: p.mintAmount }] }],
      variables: Object.entries(variables).map(([name, value]) => ({ name, value })),
    },
  };
}
const cases = source.cases.map((c) => {
  const bytes = sign(mintTx(c.record), node(c.serviceRole));
  return {
    ...c,
    mint: { signedOrigin: toBase58(bytes), transactionId: toTxHash(bytes), assetId: 'zPublicContactMintAsset' },
  };
});
const mutations = [];
const add = (name, change, { innerInvalid = false, outerInvalid = false } = {}) => {
  const tx = mintTx(cases[0].record);
  change(tx);
  let bytes = sign(tx, node('account'));
  if (innerInvalid) {
    const parsed = decodeTx(bytes);
    parsed.signatures[0].signature[0] ^= 1;
    parsed.signaturesList = parsed.signatures;
    parsed.signature = undefined;
    parsed.signature = toUint8Array(node('account').sign(encode(parsed)));
    bytes = encode(parsed);
  }
  if (outerInvalid) {
    const parsed = decodeTx(bytes);
    parsed.signature[0] ^= 1;
    bytes = encode(parsed);
  }
  mutations.push({ name, signedOrigin: toBase58(bytes) });
};
for (const [name, change] of [
  ['network', (t) => (t.chainId = 'other')],
  ['mint fee', (t) => (t.serviceFee = '4')],
  ['recipient', (t) => (t.itx.owner = cases[0].record.owner)],
  ['factory', (t) => (t.itx.factory = 'foreign')],
  ['asset', (t) => (t.itx.address = 'foreign')],
  ['token', (t) => (t.itx.inputs[0].tokens[0].address = 'foreign')],
  ['mint amount', (t) => (t.itx.inputs[0].tokens[0].value = '1')],
  ['input owner', (t) => (t.itx.inputs[0].owner = cases[0].record.owner)],
  ['issuer', (t) => (t.itx.issuer.id = '0x' + '1'.repeat(40))],
  ['nonce', (t) => (t.nonce = 9007199254740992)],
  ['delegator', (t) => (t.delegator = cases[0].record.owner)],
  ['gas', (t) => (t.gas = 1)],
  ['duplicate variable', (t) => t.itx.variables.push(t.itx.variables[0])],
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
  ].map((name) => ['variable ' + name, (t) => (t.itx.variables.find((v) => v.name === name).value = 'different')]),
])
  add(name, change);
add('inner signature', () => {}, { innerInvalid: true });
add('outer signature', () => {}, { outerInvalid: true });
function refreshRecord(record) {
  const context = record.recovery;
  const b = context.snapshot.binding;
  b.contentHash = createHash('sha3-256')
    .update(b.sender + b.receiver + context.ciphertext + b.namecard)
    .digest('hex')
    .toUpperCase();
  record.contentHash = b.contentHash;
  const unsignedContext = {
    snapshot: context.snapshot,
    ciphertext: context.ciphertext,
    createdAt: context.createdAt,
    expiresAt: context.expiresAt,
  };
  context.proof = signArtifact(
    'DIDMAIL-CONTACT-PREPARATION/1',
    unsignedContext,
    identityId(b.servicePayee),
    toUint8Array(node('account').secretKey),
  ).proof;
  const payment = decodeTx(fromBase58(record.unsignedOrigin));
  payment.itx.data.value = {
    ...payment.itx.data.value,
    contentHash: b.contentHash,
    preparationSha256: digest(utf8(canonicalize(unsignedContext))),
  };
  const encodePayment = (t) => encodeTx({ ...t, itx: { type: 'TransferV3Tx', value: t.itx } });
  const header = [{ signer: payment.from, pk: payment.pk }];
  payment.signature = undefined;
  payment.signatures = header;
  payment.signaturesList = header;
  record.unsignedOrigin = toBase58(encodePayment(payment));
  const multi = [{ ...header[0], signature: toUint8Array(payer.sign(encodePayment(payment))) }];
  payment.signatures = multi;
  payment.signaturesList = multi;
  payment.signature = toUint8Array(payer.sign(encodePayment(payment)));
  const paymentBytes = encodePayment(payment);
  record.signedOrigin = toBase58(paymentBytes);
  record.id = toTxHash(paymentBytes);

  return record;
}
const largeRecord = structuredClone(cases[0].record);
largeRecord.recovery.ciphertext = 'b'.repeat(65536);
refreshRecord(largeRecord);
const largeBytes = sign(mintTx(largeRecord), node('account'));
// Compact only the repeated public ciphertext; tests expand it before validation.
largeRecord.recovery.ciphertext = null;
const large = {
  record: largeRecord,
  ciphertextPattern: { character: 'b', length: 65536 },
  mint: { signedOrigin: toBase58(largeBytes), transactionId: toTxHash(largeBytes), assetId: 'zPublicContactMintAsset' },
  rawBytes: largeBytes.length,
};
const zeroRecord = structuredClone(cases[0].record);
zeroRecord.recovery.snapshot.policy.mintChainFee = '0';
refreshRecord(zeroRecord);
const zeroBytes = sign(mintTx(zeroRecord), node('account'));
const emptyIssuer = mintTx(cases[0].record);
emptyIssuer.itx.issuer.pk = '';
emptyIssuer.itx.issuer.name = '';
const emptyBytes = sign(emptyIssuer, node('account'));
const additionalCases = [
  {
    name: 'zero mint fee',
    record: zeroRecord,
    mint: { signedOrigin: toBase58(zeroBytes), transactionId: toTxHash(zeroBytes), assetId: 'zPublicContactMintAsset' },
  },
];
mutations.push({ name: 'missing issuer fields', signedOrigin: toBase58(emptyBytes) });
process.stdout.write(
  JSON.stringify({ publicFixture: true, format: 'contact-mint/1', cases, mutations, large, additionalCases }, null, 2) +
    '\n',
);
