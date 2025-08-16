import { log,LogContext } from '@/utils/logger';

import { memoryService } from './memory-service';

let timer: NodeJS.Timeout | null = null;

export function startMemoryScheduler(intervalMs = 30 * 60 * 1000): void {
  if (timer) return;
  log.info('🗂️ Memory scheduler started', LogContext.SYSTEM, { intervalMs });
  timer = setInterval(async () => {
    try {
      const userId = 'anonymous';
      // Reduced window size and less aggressive cleanup to reduce memory pressure
      await memoryService.summarizeRecent(userId, { window: 25 });
      await memoryService.cleanup(userId, 15, 0.2);
    } catch (error) {
      log.warn('⚠️ Memory scheduler iteration failed', LogContext.SYSTEM, {
        error: (error as Error).message,
      });
    }
  }, intervalMs);
}

export function stopMemoryScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
