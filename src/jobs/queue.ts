// Job queue scaffolding (Redis or Postgres)
import { log, LogContext } from '@/utils/logger';

export type JobData = { type: string; payload: any };

export interface EnqueueResult {
  id?: string | number;
  queued: boolean;
}

export interface QueueAPI {
  enqueue(job: JobData): Promise<EnqueueResult>;
  close(): Promise<void>;
}

export async function createQueue(): Promise<QueueAPI | null> {
  // Try BullMQ first (Redis)
  try {
    const { Queue } = await import('bullmq');
    const queue = new Queue('agent-jobs', {
      connection: { url: process.env.REDIS_URL },
    } as any);
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
  } catch {
    // Fallback to pg-boss (Postgres)
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
    } catch {
      log.warn('⚠️ No queue backend available (BullMQ/pg-boss not installed)', LogContext.SYSTEM);
      return null;
    }
  }
}
