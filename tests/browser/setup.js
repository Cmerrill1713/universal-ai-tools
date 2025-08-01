import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { logger } from '../../src/utils/logger';
beforeAll(async () => {
    logger.info('🚀 Setting up browser tests...');
    await waitForServices();
    logger.info('✅ Browser test setup complete');
});
afterAll(async () => {
    logger.info('🧹 Cleaning up browser tests...');
    await cleanup();
    logger.info('✅ Browser test cleanup complete');
});
beforeEach(async () => {
    logger.debug('🔄 Resetting test state...');
});
afterEach(async () => {
    logger.debug('🧹 Cleaning up test state...');
});
async function waitForServices() {
    const maxAttempts = 30;
    const delay = MILLISECONDS_IN_SECOND;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch('http://localhost:5173');
            if (response.ok) {
                logger.info('✅ UI service ready');
                break;
            }
        }
        catch (error) {
            if (i === maxAttempts - 1) {
                throw new Error('UI service not ready after 30 seconds');
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch('http://localhost:9999/health');
            if (response.ok) {
                logger.info('✅ API service ready');
                break;
            }
        }
        catch (error) {
            if (i === maxAttempts - 1) {
                throw new Error('API service not ready after 30 seconds');
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}
async function cleanup() {
    logger.debug('🧹 Performing global cleanup...');
}
//# sourceMappingURL=setup.js.map