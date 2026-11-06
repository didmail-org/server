import { Router } from 'express';
import GraphQLClient from '@ocap/client';
import { getHasher, types } from '@ocap/mcrypto';
import { toBase58, fromTokenToUnit } from '@ocap/util';
import { fromAddress } from '@ocap/wallet';
import getWallet from '../../../identity/wallet';
import nextPaymentNonce from '../../../identity/payment-nonce';
import env from '../../../config/env';
import { getForgeState } from '../libs/forge';
import { Contact } from '../../../storage/database';
import logger from '../libs/logger';
import { verifyLegacyContactPayment } from '../libs/legacy-contact-payment';

const router = Router();
if (!env.chainHost) throw new Error('env.chainHost is required');
const client = new GraphQLClient(env.chainHost, false);
const hashFn = getHasher(types.HashType.SHA3);
const encoder = new TextEncoder();
const wallet = getWallet();
const factoryWallet = fromAddress(env.factoryOwner);

router.post('/send', async (req, res) => {
  const { account } = req as ExtendedRequest;
  if (!account) {
    return res.status(400).json({ success: false, error: 'Account is required' });
  }
  const forgeState = await getForgeState();
  const { receiver, contact, namecard } = req.body;
  const hash = hashFn(
    new Uint8Array([
      ...encoder.encode(account!.did),
      ...encoder.encode(receiver),
      ...encoder.encode(contact),
      ...encoder.encode(namecard),
    ]),
    1,
  )
    .slice(-64)
    .toUpperCase();
  const { state: namecardState } = await client.getAssetState({ address: namecard });
  const { price } = JSON.parse(namecardState.data.value);
  const assetPrice = env.contactPrice;
  const payment = price;
  const dividend = (payment - assetPrice) * 0.1;
  const credit = payment - dividend;
  const tokenAddress = forgeState.token.address;
  const contactEntity = await Contact.create({
    sender: account!.did,
    receiver,
    contact,
    namecard,
    payment,
    credit,
    dividend,
    hash,
    size: contact.length,
  });
  try {
    const paymentToken = {
      address: tokenAddress,
      value: fromTokenToUnit(payment, 18).toString(),
    };
    const creditToken = {
      address: tokenAddress,
      value: fromTokenToUnit(credit, 18).toString(),
    };
    const divideToken = {
      address: tokenAddress,
      value: fromTokenToUnit(dividend, 18).toString(),
    };
    const tx = {
      from: account.did,
      pk: account.pk,
      nonce: await nextPaymentNonce(),
      signatures: [],
      itx: {
        inputs: [{ owner: account.did, tokens: [paymentToken] }],
        outputs: [
          { owner: wallet.address, tokens: [creditToken] },
          { owner: factoryWallet.address, tokens: [divideToken] },
        ],
      },
    };
    const encoded = await client.encodeTransferV3Tx({ tx, wallet });
    const origin = toBase58(encoded.buffer);
    await contactEntity.update({ preparedOrigin: origin, sendStatus: 'prepared' });
    return res.json({ _id: contactEntity.get('id'), origin, hash });
  } catch (error) {
    await contactEntity.destroy();
    logger.error(`Error inserting contact: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to send contact' });
  }
});

router.post('/send/sign', async (req, res) => {
  const { account } = req as ExtendedRequest;
  if (!account) {
    return res.status(400).json({ success: false, error: 'Account is required' });
  }
  const { id, origin, hash } = req.body;
  const contact = await Contact.findOne({ where: { id } });
  if (!contact || contact.get('sender') !== account.did || contact.get('hash') !== hash) {
    return res.status(404).json({ success: false, error: 'Contact not found' });
  }
  if (contact.get('sendStatus') === 'sent')
    return res.json({
      paymentTx: contact.get('paymentTx'),
      assetTx: contact.get('assetTx'),
      asset: contact.get('asset'),
    });
  let tx: any;
  try {
    tx = await verifyLegacyContactPayment(client, contact.get('preparedOrigin'), origin, account);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid payment transaction' });
  }
  const forgeState = await getForgeState();
  const [claimed] = await Contact.update({ sendStatus: 'submitting' }, { where: { id, sendStatus: 'prepared' } });
  if (!claimed)
    return res.status(409).json({ success: false, error: 'Contact delivery is processing or requires reconciliation' });
  let paymentTx = '';
  let assetTx = '';
  try {
    paymentTx = await client.sendTransferV3Tx({ tx, wallet });
    await contact.update({ paymentTx, sendStatus: 'paid' });
    const inputs = {
      sender: contact.get('sender') as string,
      receiver: contact.get('receiver') as string,
      pk: account.pk as string,
      contact: contact.get('contact') as string,
      namecard: contact.get('namecard') as string,
    };
    const token = {
      address: forgeState.token.address,
      value: fromTokenToUnit(env.contactPrice, 18).toString(),
    };
    const itx = await (client as any).preMintAsset({
      factory: env.contactFactory,
      inputs,
      owner: contact.get('receiver') as string,
      wallet: factoryWallet,
    });
    let acquireAssetTx = {
      from: wallet.address,
      pk: wallet.publicKey,
      signatures: [] as { signer: string; pk: string }[],
      itx: {
        factory: itx.factory,
        address: itx.address,
        inputs: [{ owner: wallet.address, tokens: [token] }],
        owner: contact.get('receiver') as string,
        variables: itx.variables,
        issuer: itx.issuer,
      },
    };
    acquireAssetTx.signatures.push({
      signer: wallet.address,
      pk: wallet.publicKey,
    });
    let signTx = await client.multiSignAcquireAssetV3Tx({ tx: acquireAssetTx, wallet });
    acquireAssetTx = { ...signTx, itx: acquireAssetTx.itx };
    signTx = await client.signAcquireAssetV3Tx({ tx: acquireAssetTx, wallet });
    acquireAssetTx = { ...signTx, itx: acquireAssetTx.itx };
    assetTx = await client.sendAcquireAssetV3Tx({ tx: acquireAssetTx, wallet });
    await contact.update({ assetTx, sendStatus: 'minted' });
  } catch (error) {
    await contact.update({ sendStatus: 'review' });
    logger.error(`Error sending contact: ${error.message}`, error);
    return res.status(503).json({
      success: false,
      error: 'Contact delivery requires reconciliation; do not pay again',
      paymentTx,
      assetTx,
    });
  }
  const {
    info: {
      tx: { itxJson },
    },
  } = await client.getTx({ hash: assetTx });
  if (itxJson) {
    logger.info(itxJson);
    const asset = (itxJson as any).address ?? '';
    logger.info(`assetTx: ${assetTx}, asset: ${asset}`);
    await contact.update({ paymentTx, assetTx, asset, sendStatus: 'sent' });
    return res.json({ paymentTx, assetTx, asset });
  }
  return res.status(500).json({ success: false, error: 'Failed to process transaction' });
});

export default router;
