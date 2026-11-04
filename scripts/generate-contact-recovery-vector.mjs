// Offline public seed vector. No environment, wallet file, chain read or broadcast.
import fs from 'node:fs/promises';
import { fromSecretKey } from '@ocap/wallet';
import { getSigner, types, toTxHash } from '@ocap/mcrypto';
import { fromBase58, toBase58, toUint8Array } from '@ocap/util';
import { encodeTx, decodeTx } from '@didmail/ocap-message-cbor/cbor';
import { canonicalize, digest, utf8, signArtifact, identityId } from '@didmail/protocol';

const f = JSON.parse(await fs.readFile(new URL('../tests/fixtures/namecard-payment.json', import.meta.url), 'utf8'));
const { record: legacy } = JSON.parse(
  await fs.readFile(new URL('../tests/fixtures/namecard-payment-record.json', import.meta.url), 'utf8'),
);
const key = getSigner(types.KeyType.ED25519).genKeyPair('hex', new Uint8Array(32).fill(1));
const payer = fromSecretKey(key.secretKey, { pk: 0, hash: 1 });
const nodeKey = getSigner(types.KeyType.ED25519).genKeyPair('hex', new Uint8Array(32).fill(3));
const preparationId = '12345678-1234-4234-8234-123456789abc';
const cases = ['account', 'application'].flatMap((serviceRole) => {
  const service = fromSecretKey(nodeKey.secretKey, {
    pk: 0,
    hash: 1,
    ...(serviceRole === 'application' ? { role: types.RoleType.ROLE_APPLICATION } : {}),
  });
  return ['arcblock-committed', 'arcblock-dolt-ledger/1'].map((confirmationPolicy) => {
    const preparation = {
      snapshot: {
        binding: {
          chainId: f.policy.chainId,
          endpoint: legacy.endpoint,
          preparationId,
          sender: legacy.owner,
          receiver: legacy.receiver,
          namecard: legacy.namecard,
          contentHash: legacy.contentHash,
          tokenAddress: f.policy.tokenAddress,
          totalAmount: f.terms.totalAmount,
          servicePayee: service.address,
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
          confirmationPolicy,
        },
      },
      ciphertext: f.encrypted,
      createdAt: 1800000000000,
      expiresAt: 1800000600000,
    };
    const preparationSha256 = digest(utf8(canonicalize(preparation)));
    const authenticatedPreparation = signArtifact(
      'DIDMAIL-CONTACT-PREPARATION/1',
      preparation,
      identityId(service.address),
      toUint8Array(service.secretKey),
    );
    const tx = decodeTx(fromBase58(legacy.unsignedOrigin));
    tx.itx.data.value = { ...tx.itx.data.value, preparationId, preparationSha256 };
    tx.itx.outputs[0].owner = service.address;
    const encode = (value) => encodeTx({ ...value, itx: { type: 'TransferV3Tx', value: value.itx } });
    const headers = [{ signer: tx.from, pk: tx.pk }];
    tx.signatures = headers;
    tx.signaturesList = headers;
    tx.signature = undefined;
    const unsigned = encode(tx);
    const multi = [{ ...headers[0], signature: toUint8Array(payer.sign(unsigned)) }];
    tx.signatures = multi;
    tx.signaturesList = multi;
    tx.signature = toUint8Array(payer.sign(encode(tx)));
    const signed = encode(tx);
    return {
      confirmationPolicy,
      serviceRole,
      preparationSha256,
      record: {
        ...legacy,
        id: toTxHash(signed),
        preparationId,
        unsignedOrigin: toBase58(unsigned),
        signedOrigin: toBase58(signed),
        recovery: authenticatedPreparation,
      },
    };
  });
});
process.stdout.write(
  JSON.stringify(
    {
      publicFixture: true,
      format: 'contact-recovery/1',
      codec: '@ocap/message@1.30.24 canonical CBOR',
      seed: '32 bytes of 0x01, public test identity',
      cases,
    },
    null,
    2,
  ) + '\n',
);
