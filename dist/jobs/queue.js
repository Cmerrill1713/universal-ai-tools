import { log, LogContext } from '@/utils/logger';
export async function createQueue() {
    try {
        const { Queue } = await import('bullmq');
        const queue = new Queue('agent-jobs', {
            connection: { url: process.env.REDIS_URL },
        });
        log.info('✅ BullMQ queue initialized', LogContext.SYSTEM);
        return {
            async enqueue(job) {
                const j = await queue.add(job.type, job.payload, { removeOnComplete: true });
                return { id: j.id, queued: true };
            },
            async close() {
                await queue.close();
            },
        };
    }
    catch (e) {
        try {
            const PgBoss = (await import('pg-boss')).default;
            const boss = new PgBoss(process.env.DATABASE_URL || '');
            await boss.start();
            log.info('✅ pg-boss queue initialized', LogContext.SYSTEM);
            return {
                async enqueue(job) {
                    const id = await boss.send(job.type, job.payload);
                    return { id, queued: !!id };
                },
                async close() {
                    await boss.stop();
                },
            };
        }
        catch (err) {
            log.warn('⚠️ No queue backend available (BullMQ/pg-boss not installed)', LogContext.SYSTEM);
            return null;
        }
    }
}
//# sourceMappingURL=queue.js.map