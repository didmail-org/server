import { Op } from 'sequelize';
import { Mail, Attachment } from './sqlite';
import { destroyMailWithAttachments } from './mail-lifecycle';
import logger from './logger';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export interface CleanupResult {
  deletedMailCount: number;
  deletedAttachmentCount: number;
  freedBytes: number;
}

/**
 * Delete mails (and their attachment BLOBs) whose expiredAt is older than `before`.
 * Returns counts of deleted mails/attachments and the sum of attachment plaintext sizes freed.
 */
export const deleteExpiredMailsWithAttachments = async (before = new Date()): Promise<CleanupResult> => {
  const expiredMails = await Mail.findAll({
    where: {
      expiredAt: {
        [Op.lt]: before,
      },
    },
    attributes: ['id', 'totalAttachmentSize'],
  });

  const mailIds = expiredMails.map((mail) => mail.get('id') as number);
  const totalAttachmentSizes = expiredMails.map((mail) => (mail.get('totalAttachmentSize') as number | null) ?? 0);

  const attachmentCounts = await Promise.all(mailIds.map((mailId) => Attachment.count({ where: { mailId } })));
  const deletionResults = await Promise.allSettled(mailIds.map((mailId) => destroyMailWithAttachments(mailId)));

  let deletedMailCount = 0;
  let deletedAttachmentCount = 0;
  let freedBytes = 0;
  deletionResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      deletedMailCount += 1;
      deletedAttachmentCount += attachmentCounts[index] ?? 0;
      freedBytes += totalAttachmentSizes[index] ?? 0;
    } else {
      logger.error(`Failed to cleanup expired mail ${mailIds[index]}: ${result.reason}`);
    }
  });

  return { deletedMailCount, deletedAttachmentCount, freedBytes };
};

/**
 * Start a background interval that deletes expired mail attachment BLOBs.
 * Returns a stop function for graceful shutdown.
 */
export const startAttachmentCleanupScheduler = (intervalMs = DEFAULT_INTERVAL_MS): (() => void) => {
  const run = async () => {
    try {
      const result = await deleteExpiredMailsWithAttachments();
      if (result.deletedMailCount > 0) {
        logger.info(
          `Attachment cleanup completed: ${result.deletedMailCount} expired mail(s), ` +
            `${result.deletedAttachmentCount} attachment(s), ${result.freedBytes} byte(s) freed`,
        );
      }
    } catch (err) {
      logger.error(`Attachment cleanup failed: ${(err as Error).message}`);
    }
  };

  // Run once shortly after startup, then on the interval.
  const timeout = setTimeout(run, 5000);
  const interval = setInterval(run, intervalMs);

  return () => {
    clearTimeout(timeout);
    clearInterval(interval);
  };
};
