import { log, LogContext } from '@/utils/logger';
async function startBullWorker() {
    const { Worker } = await import('bullmq');
    const worker = new Worker('agent-jobs', async (job) => {
        const { type, payload } = job.data;
        log.info('🧵 Processing job', LogContext.SYSTEM, { type });
        if (type === 'agent.execute') {
            const { default: UniversalAIToolsServer } = await import('../server');
            return { ok: true, received: payload };
        }
        return { ok: true };
    }, { connection: { url: process.env.REDIS_URL } });
    return worker;
}
async function startPgBossWorker() {
    const PgBoss = (await import('pg-boss')).default;
    const boss = new PgBoss(process.env.DATABASE_URL || '');
    await boss.start();
    await boss.work('agent.execute', async (job) => {
        log.info('🧵 Processing pg-boss job', LogContext.SYSTEM, { id: job.id });
        return { ok: true, received: job.data };
    });
    return boss;
}
export async function startAgentWorker() {
    try {
        return await startBullWorker();
    }
    catch {
        try {
            return await startPgBossWorker();
        }
        catch {
            log.warn('⚠️ No worker backend available (BullMQ/pg-boss)', LogContext.SYSTEM);
            return null;
        }
    }
}
//# sourceMappingURL=agent-worker.js.map