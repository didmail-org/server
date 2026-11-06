import { isDeepStrictEqual } from 'node:util';
import { fromPublicKey } from '@ocap/wallet';
import { toUint8Array } from '@ocap/util';

/** Validate the original preparation and both sender signatures before any node-funded work. */
// eslint-disable-next-line import/prefer-default-export
export async function verifyLegacyContactPayment(
  client: any,
  preparedOrigin: unknown,
  signedOrigin: unknown,
  account: { did: string; pk: string },
) {
  if (
    typeof preparedOrigin !== 'string' ||
    !preparedOrigin ||
    typeof signedOrigin !== 'string' ||
    signedOrigin.length > 68000
  )
    throw new Error('Invalid contact payment');
  const expected = client.decodeTx(preparedOrigin);
  const tx = client.decodeTx(signedOrigin);
  const payer = fromPublicKey(account.pk);
  if (
    tx.from !== account.did ||
    tx.from !== expected.from ||
    payer.address !== account.did ||
    tx.chainId !== expected.chainId ||
    String(tx.nonce) !== String(expected.nonce) ||
    !isDeepStrictEqual(tx.pk, expected.pk) ||
    !isDeepStrictEqual(toUint8Array(tx.pk), toUint8Array(account.pk)) ||
    !isDeepStrictEqual(tx.itx, expected.itx) ||
    tx.delegator ||
    tx.serviceFee !== expected.serviceFee ||
    !tx.signature
  )
    throw new Error('Contact payment differs from preparation');
  const signatures = tx.signaturesList || tx.signatures;
  if (
    !Array.isArray(signatures) ||
    signatures.length !== 1 ||
    signatures[0].signer !== account.did ||
    signatures[0].delegator ||
    !signatures[0].signature ||
    !isDeepStrictEqual(signatures[0].pk, tx.pk)
  )
    throw new Error('Invalid contact payment signatures');
  const primary = { ...tx, signature: undefined, itx: tx.itx };
  const encoded = await client.encodeTransferV3Tx({ tx: primary, wallet: payer });
  if (!(await payer.verify(encoded.buffer, toUint8Array(tx.signature))))
    throw new Error('Invalid contact payment signature');
  const multi = { ...primary, signaturesList: signatures.map((s: any) => ({ ...s, signature: undefined })) };
  const multiEncoded = await client.encodeTransferV3Tx({ tx: multi, wallet: payer });
  if (!(await payer.verify(multiEncoded.buffer, toUint8Array(signatures[0].signature))))
    throw new Error('Invalid contact payment signature');
  return tx;
}
