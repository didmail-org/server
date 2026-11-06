import { Attachment, Mail } from './sqlite';

const destroyMailWithAttachments = async (mailId: number) => {
  await Attachment.destroy({ where: { mailId } });
  return Mail.destroy({ where: { id: mailId } });
};

// Named export kept for a stable import site across mail send/sign/storage paths.
// eslint-disable-next-line import/prefer-default-export
export { destroyMailWithAttachments };
