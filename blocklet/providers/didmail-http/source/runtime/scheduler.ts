import { bindings } from './bindings';
import type { TaskContext } from './contracts';

export async function runScheduledJobs(context: TaskContext) {
    context.waitUntil(
      (async () => {
        const { deleteExpiredMailsWithAttachments } = await import('../api/src/libs/attachment-cleanup');
        console.log(await deleteExpiredMailsWithAttachments());
        const { processDmpJobs, cleanupDmp } = await import('../protocol/dmp-jobs');
        console.log(await processDmpJobs(), await cleanupDmp());
        await bindings.DB.prepare('DELETE FROM account_link_intents WHERE expires_at < ?').bind(new Date().toISOString()).run();
        await bindings.DB.prepare('DELETE FROM rate_limits WHERE resetAt < ?').bind(Date.now()).run();
      })(),
    );
}
