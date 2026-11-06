import { isValid } from '@arcblock/did';
import { isDeepStrictEqual } from 'node:util';
import { Router } from 'express';
import multer from 'multer';
import GraphQLClient from '@ocap/client';
import { toBase58, fromBase58, fromTokenToUnit } from '@ocap/util';
import { fromPublicKey, fromAddress } from '@ocap/wallet';
import { getDefaultEnvelope } from '../libs/mail-service-policy';
import getWallet from '../runtime/wallet';
import {
  buildAttachmentMeta,
  computeMailHashWithAttachments,
  isAttachmentConflictError,
  parseAttachmentInputs,
  storeAttachments,
  validateAttachments,
} from '../libs/attachment';
import {
  getAttachmentForMail,
  getAttachmentMetadataForMail,
  verifyAttachmentDownloadAuth,
} from '../libs/attachment-download';
import { calculateAttachmentStorageCost, calculatePaymentWei } from '../libs/attachment-pricing';
import env from '../libs/env';
import { getForgeState } from '../libs/forge';
import logger from '../libs/logger';
import { destroyMailWithAttachments } from '../libs/mail-lifecycle';
import { Attachment, Mail, Envelope, getAttachmentConfig } from '../libs/sqlite';

if (!env.chainHost) throw new Error('env.chainHost is required');
const client = new GraphQLClient(env.chainHost, false);
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024, files: 20, fields: 64 },
});
const wallet = getWallet();
const factoryWallet = fromAddress(env.factoryOwner);

router.get('/attachment-config', async (_req, res) => {
  const config = await getAttachmentConfig();
  return res.json({
    maxFileSizeBytes: config.get('maxFileSizeBytes'),
    maxFileCount: config.get('maxFileCount'),
    pricePerBytePerDay: config.get('pricePerBytePerDay'),
    updatedAt: config.get('updatedAt'),
  });
});

router.post(
  '/send',
  upload.fields([
    { name: 'subject', maxCount: 1 },
    { name: 'content', maxCount: 1 },
    { name: 'attachment', maxCount: 20 },
  ]),
  async (req, res) => {
    const { account } = req as ExtendedRequest;
    if (!account) {
      return res.status(400).json({ success: false, error: 'Account is required' });
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const subjectFile = files?.subject?.[0];
    const contentFile = files?.content?.[0];
    if (!subjectFile || !contentFile) {
      return res.status(400).json({ success: false, error: 'Subject and content are required' });
    }
    const subjectArray = new Uint8Array(subjectFile.buffer);
    const contentArray = new Uint8Array(contentFile.buffer);

    let attachmentInputs;
    try {
      attachmentInputs = parseAttachmentInputs(files?.attachment, req.body.attachmentMeta);
      await validateAttachments(attachmentInputs);
    } catch (error) {
      return res.status(400).json({ success: false, error: (error as Error).message });
    }

    const { receiver } = req.body;
    const defaultEnvelope = req.body.envelope ? null : await getDefaultEnvelope();
    const envelope = req.body.envelope || defaultEnvelope?.address;
    if (typeof receiver !== 'string' || !isValid(receiver))
      return res.status(400).json({ error: 'Invalid receiver DID' });
    if (!envelope || typeof envelope !== 'string' || !isValid(envelope))
      return res
        .status(409)
        .json({ error: 'Select an envelope or ask the operator to create and enable an envelope NFT' });
    const published = await Envelope.findOne({ where: { address: envelope, enabled: true } });
    if (!published) return res.status(409).json({ error: 'Envelope is not enabled on this server' });

    const forgeState = await getForgeState();
    const hash = computeMailHashWithAttachments({
      did: account!.did,
      receiver,
      subjectArray,
      contentArray,
      envelope,
      attachments: attachmentInputs,
    });
    const { state: envelopeState } = await client.getAssetState({ address: envelope });
    if (!envelopeState || envelopeState.parent !== env.envelopeFactory)
      return res.status(400).json({ error: 'Invalid envelope NFT factory' });
    const { retentionPeriod, price } = JSON.parse(envelopeState.data.value);
    if (
      !Number.isSafeInteger(Number(retentionPeriod)) ||
      Number(retentionPeriod) < 0 ||
      Number(retentionPeriod) > 36500
    )
      return res.status(400).json({ error: 'Invalid retention period' });
    if (
      (req.body.expectedEnvelopePrice && String(req.body.expectedEnvelopePrice) !== String(price)) ||
      (req.body.expectedRetentionDays && Number(req.body.expectedRetentionDays) !== Number(retentionPeriod))
    )
      return res.status(409).json({ error: 'Envelope terms changed; refresh before sending' });
    const expiredAt =
      Number(retentionPeriod) === 0
        ? '9999-12-31T23:59:59.999Z'
        : new Date(Date.now() + Number(retentionPeriod) * 24 * 60 * 60 * 1000).toISOString();
    const config = await getAttachmentConfig();
    const totalAttachmentSize = attachmentInputs.reduce((sum, item) => sum + item.size, 0);
    const storageCostWei = calculateAttachmentStorageCost(
      totalAttachmentSize,
      retentionPeriod,
      config.get('pricePerBytePerDay') as string,
    );
    let paymentWei: string;
    let creditWei: string;
    let dividendWei: string;
    try {
      ({ paymentWei, creditWei, dividendWei } = calculatePaymentWei(price, storageCostWei, env.mailPrice));
    } catch (error) {
      return res.status(400).json({ success: false, error: (error as Error).message });
    }
    const tokenAddress = forgeState.token.address;
    const mail = await Mail.create({
      sender: account!.did,
      receiver,
      subject: toBase58(subjectArray),
      content: toBase58(contentArray),
      expiredAt,
      envelope,
      payment: paymentWei,
      credit: creditWei,
      dividend: dividendWei,
      size: contentArray.length + subjectArray.length,
      hash,
      totalAttachmentSize,
      attachmentCount: attachmentInputs.length,
      attachmentStorageCost: storageCostWei,
    });
    const mailId = Number(mail.get('id'));
    try {
      await storeAttachments(mailId, attachmentInputs);
    } catch (error) {
      await destroyMailWithAttachments(mailId);
      if (isAttachmentConflictError(error)) {
        return res.status(409).json({ success: false, error: (error as Error).message });
      }
      logger.error(`Error storing attachments: ${(error as Error).message}`);
      return res.status(500).json({ success: false, error: 'Failed to store attachments' });
    }
    try {
      const paymentToken = {
        address: tokenAddress,
        value: paymentWei,
      };
      const creditToken = {
        address: tokenAddress,
        value: creditWei,
      };
      const divideToken = {
        address: tokenAddress,
        value: dividendWei,
      };
      const tx = {
        from: account.did,
        pk: account.pk,
        signatures: [],
        itx: {
          inputs: [{ owner: account.did, tokens: [paymentToken] }],
          outputs: [
            { owner: wallet.address, tokens: [creditToken] },
            { owner: factoryWallet.address, tokens: [divideToken] },
          ],
        },
      };
      // Bind each payment to this upload, including otherwise identical sends.
      (tx.itx as any).data = { typeUrl: 'json', value: { mailId, hash } };
      const encoded = await client.encodeTransferV3Tx({ tx, wallet });
      const origin = toBase58(encoded.buffer);
      await mail.update({ preparedOrigin: origin });
      return res.json({ _id: mail.get('id'), origin, hash, paymentWei, expiredAt, envelope });
    } catch (error) {
      await destroyMailWithAttachments(mailId);
      logger.error(`Error inserting mail: ${(error as Error).message}`);
      return res.status(500).json({ success: false, error: 'Failed to send mail' });
    }
  },
);

router.post('/send/sign', async (req, res) => {
  const { account } = req as ExtendedRequest;
  if (!account) {
    return res.status(400).json({ success: false, error: 'Account is required' });
  }
  let paymentTx = '';
  let assetTx = '';
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { _id, origin, hash } = req.body;
  const mail = await Mail.findOne({ where: { id: _id } });
  if (!mail || mail.get('sender') !== account.did || mail.get('hash') !== hash)
    return res.status(404).json({ success: false, error: 'Mail not found' });
  if (mail.get('sendStatus') === 'sent')
    return res.json({ paymentTx: mail.get('paymentTx'), assetTx: mail.get('assetTx'), asset: mail.get('asset') });
  if (new Date(mail.get('expiredAt') as string).getTime() <= Date.now())
    return res.status(410).json({ error: 'Mail expired' });
  const forgeState = await getForgeState();
  let tx: any;
  try {
    tx = client.decodeTx(origin);
    const expected: any = client.decodeTx(mail.get('preparedOrigin') as string);
    if (
      tx.from !== expected.from ||
      !isDeepStrictEqual(tx.pk, expected.pk) ||
      tx.nonce !== expected.nonce ||
      !isDeepStrictEqual(tx.itx, expected.itx)
    )
      throw new Error('Payment does not match prepared mail');
  } catch {
    return res.status(400).json({ error: 'Invalid payment transaction' });
  }
  const [claimed] = await Mail.update({ sendStatus: 'submitting' }, { where: { id: _id, sendStatus: 'prepared' } });
  if (!claimed)
    return res.status(409).json({ error: 'Delivery is already processing or needs operator reconciliation', _id });
  try {
    paymentTx = await client.sendTransferV3Tx({ tx, wallet });
    await mail.update({ paymentTx, sendStatus: 'paid' });
    const attachmentRows = await Attachment.findAll({ where: { mailId: mail.get('id') } });
    const attachments = buildAttachmentMeta(
      attachmentRows.map((row) => ({
        id: row.get('id') as string,
        encryptedName: row.get('encryptedName') as string,
        encryptedMime: row.get('encryptedMime') as string,
        size: row.get('size') as number,
        hash: row.get('hash') as string,
      })),
    );
    const inputs = {
      id: `${mail.get('id') as string}`,
      sender: mail.get('sender') as string,
      receiver: mail.get('receiver') as string,
      pk: account.pk as string,
      subject: mail.get('subject') as string,
      envelope: mail.get('envelope') as string,
      server: env.appName,
      endpoint: env.appUrl,
      hash: mail.get('hash') as string,
      expiredAt: `${mail.get('expiredAt') as string}`,
      receipt: paymentTx as string,
      attachments,
      totalAttachmentSize: mail.get('totalAttachmentSize'),
      attachmentStorageCost: mail.get('attachmentStorageCost'),
    };
    const token = {
      address: forgeState.token.address,
      value: fromTokenToUnit(env.mailPrice, 18).toString(),
    };
    const itx = await (client as any).preMintAsset({
      factory: env.mailFactory,
      inputs,
      owner: mail.get('receiver') as string,
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
        owner: mail.get('receiver') as string,
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
    await mail.update({ assetTx, sendStatus: 'minted' });
  } catch (error) {
    await mail.update({ sendStatus: 'review' });
    logger.error(`Error sending mail: ${(error as Error).message}`, error);
    return res
      .status(500)
      .json({ success: false, error: 'Delivery requires reconciliation; do not pay again', _id, paymentTx });
  }
  try {
    const {
      info: {
        tx: { itxJson },
      },
    } = await client.getTx({ hash: assetTx });
    if (itxJson && (itxJson as any).address) {
      const asset = (itxJson as any).address;
      await mail.update({ paymentTx, assetTx, asset, sendStatus: 'sent' });
      return res.json({ paymentTx, assetTx, asset });
    }
  } catch (error) {
    logger.error(`Mint confirmation pending: ${(error as Error).message}`);
  }
  logger.error('Failed to retrieve transaction details');
  return res
    .status(503)
    .json({ error: 'Mint confirmation requires reconciliation; do not pay again', _id, paymentTx, assetTx });
});

router.get('/download/:id/attachment/:attachmentId', async (req, res) => {
  try {
    const { account } = req as ExtendedRequest;
    if (!account) {
      return res.status(400).json({ success: false, error: 'Account is required' });
    }
    const { id, attachmentId } = req.params;
    const { sign, timeStamp } = req.query;
    const auth = await verifyAttachmentDownloadAuth(
      account,
      id,
      attachmentId,
      typeof sign === 'string' ? sign : '',
      typeof timeStamp === 'string' ? timeStamp : '',
    );
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }
    const mail = await Mail.findOne({ where: { id } });
    if (!mail) {
      return res.status(404).json({ success: false, error: 'Mail not found' });
    }
    if (mail.get('sendStatus') !== 'sent') return res.status(409).json({ error: 'Mail delivery is not confirmed' });
    if (![mail.get('sender'), mail.get('receiver')].includes(account.did))
      return res.status(403).json({ error: 'Mail access denied' });
    const expiredAt = new Date(mail.get('expiredAt') as string);
    if (!Number.isNaN(expiredAt.getTime()) && expiredAt < new Date()) {
      return res.status(404).json({ success: false, error: 'Mail expired' });
    }
    const attachment = await getAttachmentForMail(parseInt(id, 10), attachmentId);
    if (!attachment) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }
    const content = attachment.get('content') as Buffer;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="attachment.bin"');
    res.setHeader('Content-Length', String(content.length));
    return res.send(content);
  } catch (error) {
    logger.error(`Error downloading attachment: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to download attachment' });
  }
});

router.get('/download/:id', async (req, res) => {
  try {
    const { account } = req as ExtendedRequest;
    if (!account) {
      return res.status(400).json({ success: false, error: 'Account is required' });
    }
    const { id } = req.params;
    const { sign, timeStamp } = req.query;
    if (!sign || typeof sign !== 'string' || !timeStamp || typeof timeStamp !== 'string') {
      return res.status(400).json({ success: false, error: 'Sign or timeStamp is required' });
    }
    if (!/^\d+$/.test(timeStamp) || Math.abs(Date.now() - Number(timeStamp)) > 1000 * 60 * 60) {
      return res.status(401).json({ success: false, error: 'Time expired' });
    }
    let verify = false;
    try {
      verify = await fromPublicKey(account.pk).verify(`${id}-${timeStamp}`, sign);
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!verify) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const mail = await Mail.findOne({ where: { id } });
    if (!mail) {
      return res.status(404).json({ success: false, error: 'Mail not found' });
    }
    if (mail.get('sendStatus') !== 'sent') return res.status(409).json({ error: 'Mail delivery is not confirmed' });
    if (![mail.get('sender'), mail.get('receiver')].includes(account.did))
      return res.status(403).json({ error: 'Mail access denied' });
    const expiredAt = new Date(mail.get('expiredAt') as string);

    if (!Number.isNaN(expiredAt.getTime()) && expiredAt < new Date()) {
      return res.status(404).json({ success: false, error: 'Mail expired' });
    }

    const content = mail.get('content') as string;
    let contentBuffer;
    try {
      contentBuffer = fromBase58(content);
    } catch (error) {
      contentBuffer = Buffer.from(content, 'base64');
    }
    await mail.update({ downloadAt: new Date().toISOString() });

    const attachmentRows = await getAttachmentMetadataForMail(parseInt(id, 10));
    if (attachmentRows.length > 0) {
      const attachments = buildAttachmentMeta(
        attachmentRows.map((row) => ({
          id: row.get('id') as string,
          encryptedName: row.get('encryptedName') as string,
          encryptedMime: row.get('encryptedMime') as string,
          size: row.get('size') as number,
          hash: row.get('hash') as string,
        })),
      );
      res.setHeader('X-Attachments-Metadata', JSON.stringify(attachments));
    }

    res.setHeader('Content-Disposition', 'attachment; filename="mail.bin"');
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.send(contentBuffer);
  } catch (error) {
    logger.error(`Error downloading mail: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to download mail' });
  }
});

export default router;
