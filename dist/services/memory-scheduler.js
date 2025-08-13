import { log, LogContext } from '@/utils/logger';
import { memoryService } from './memory-service';
let timer = null;
export function startMemoryScheduler(intervalMs = 15 * 60 * 1000) {
    if (timer)
        return;
    log.info('🗂️ Memory scheduler started', LogContext.SYSTEM, { intervalMs });
    timer = setInterval(async () => {
        try {
            const userId = 'anonymous';
            await memoryService.summarizeRecent(userId, { window: 50 });
            await memoryService.cleanup(userId, 30, 0.3);
        }
        catch (error) {
            log.warn('⚠️ Memory scheduler iteration failed', LogContext.SYSTEM, {
                error: error.message,
            });
        }
    }, intervalMs);
}
export function stopMemoryScheduler() {
    if (timer)
        clearInterval(timer);
    timer = null;
}
//# sourceMappingURL=memory-scheduler.js.map