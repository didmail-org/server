import { fromPublicKey } from '@ocap/wallet';
import { Attachment } from './sqlite';

type AuthOk = { ok: true };
type AuthFail = { ok: false; status: number; error: string };
type AuthResult = AuthOk | AuthFail;

const verifyAttachmentDownloadAuth = async (
  account: { pk: string },
  id: string,
  attachmentId: string,
  sign: string,
  timeStamp: string,
): Promise<AuthResult> => {
  if (!sign || !timeStamp) {
    return { ok: false, status: 400, error: 'Sign or timeStamp is required' };
  }
  if (!/^\d+$/.test(timeStamp) || Math.abs(Date.now() - Number(timeStamp)) > 1000 * 60 * 60) {
    return { ok: false, status: 401, error: 'Time expired' };
  }
  try {
    const verify = await fromPublicKey(account.pk).verify(`${id}-${attachmentId}-${timeStamp}`, sign);
    if (!verify) {
      return { ok: false, status: 401, error: 'Unauthorized' };
    }
  } catch {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true };
};

const getAttachmentForMail = (mailId: number, attachmentId: string) =>
  Attachment.findOne({ where: { id: attachmentId, mailId } });

const getAttachmentMetadataForMail = (mailId: number) =>
  Attachment.findAll({
    where: { mailId },
    attributes: ['id', 'encryptedName', 'encryptedMime', 'size', 'hash'],
  });

export { verifyAttachmentDownloadAuth, getAttachmentForMail, getAttachmentMetadataForMail };
