import { log, LogContext } from '@/utils/logger';
import { startAgentWorker } from './agent-worker';
async function main() {
    const worker = await startAgentWorker();
    if (!worker) {
        log.warn('No job worker backend available. Install bullmq or pg-boss.', LogContext.SYSTEM);
        process.exit(1);
    }
    log.info('Agent worker started', LogContext.SYSTEM);
}
main().catch((err) => {
    log.error('Agent worker failed to start', LogContext.SYSTEM, {
        error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
});
//# sourceMappingURL=start-agent-worker.js.map