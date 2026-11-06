import GraphQLClient from '@ocap/client';
import { fromRandom } from '@ocap/wallet';
import { toBase58 } from '@ocap/util';
import { verifyLegacyContactPayment } from '../../blocklet/providers/didmail-http/source/api/src/libs/legacy-contact-payment';

jest.mock('cross-fetch', () => global.fetch);
const client = new GraphQLClient('https://example.invalid', false) as any;
client.getContext = () => Promise.resolve({ chainId: 'beta', chainInfo: { id: 'beta' } });
const sender = fromRandom();
const account = { did: sender.address, pk: toBase58(sender.publicKey) };
async function fixture() {
  const original = await client.encodeTransferV3Tx({
    tx: {
      from: sender.address,
      pk: sender.publicKey,
      signatures: [],
      itx: {
        inputs: [{ owner: sender.address, tokens: [{ address: sender.address, value: '1000' }] }],
        outputs: [{ owner: fromRandom().address, tokens: [{ address: sender.address, value: '1000' }] }],
      },
    },
    wallet: sender,
  });
  const prepared = toBase58(original.buffer);
  const sign = async (change?: (tx: any) => void) => {
    let tx = client.decodeTx(prepared);
    change?.(tx);
    tx.signaturesList.push({ signer: sender.address, pk: sender.publicKey });
    tx = { ...(await client.multiSignTransferV3Tx({ tx, wallet: sender })), itx: tx.itx };
    tx = { ...(await client.signTransferV3Tx({ tx, wallet: sender })), itx: tx.itx };
    return toBase58((await client.encodeTransferV3Tx({ tx, wallet: sender })).buffer);
  };
  return { prepared, sign };
}
test('accepts both original sender signatures and rejects changed payment and forged signatures offline', async () => {
  const { prepared, sign } = await fixture();
  const signed = await sign();
  await expect(verifyLegacyContactPayment(client, prepared, signed, account)).resolves.toMatchObject({
    from: sender.address,
  });
  await Promise.all(
    [
      (tx: any) => {
        tx.itx = {
          inputs: [{ owner: sender.address, tokens: [{ address: sender.address, value: '1' }] }],
          outputs: [{ owner: sender.address, tokens: [{ address: sender.address, value: '1' }] }],
        };
      },
      (tx: any) => {
        tx.chainId = 'different';
      },
      (tx: any) => {
        tx.nonce += 1;
      },
    ].map(async (change) => {
      await expect(verifyLegacyContactPayment(client, prepared, await sign(change), account)).rejects.toThrow();
    }),
  );
  const decoded = client.decodeTx(signed);
  decoded.signature = new Uint8Array(64);
  const forged = toBase58((await client.encodeTransferV3Tx({ tx: decoded, wallet: sender })).buffer);
  await expect(verifyLegacyContactPayment(client, prepared, forged, account)).rejects.toThrow();
  await expect(verifyLegacyContactPayment(client, null, signed, account)).rejects.toThrow();
});
