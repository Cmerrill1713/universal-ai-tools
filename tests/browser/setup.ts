import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { logger } from '../../src/utils/logger';

// Browser test setup
beforeAll(async () => {
  logger.info('🚀 Setting up browser tests...');

  // Wait for services to be ready
  await waitForServices();

  logger.info('✅ Browser test setup complete');
});

afterAll(async () => {
  logger.info('🧹 Cleaning up browser tests...');

  // Clean up any remaining resources
  await cleanup();

  logger.info('✅ Browser test cleanup complete');
});

beforeEach(async () => {
  // Reset state before each test
  logger.debug('🔄 Resetting test state...');
});

afterEach(async () => {
  // Clean up after each test
  logger.debug('🧹 Cleaning up test state...');
});

async function waitForServices(): Promise<void> {
  const maxAttempts = 30;
  const delay = MILLISECONDS_IN_SECOND; // 1 second

  // Wait for UI service
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:5173');
      if (response.ok) {
        logger.info('✅ UI service ready');
        break;
      }
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw new Error('UI service not ready after 30 seconds');
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Wait for API service
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:9999/health');
      if (response.ok) {
        logger.info('✅ API service ready');
        break;
      }
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw new Error('API service not ready after 30 seconds');
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function cleanup(): Promise<void> {
  // Clean up any global resources
  logger.debug('🧹 Performing global cleanup...');
}
