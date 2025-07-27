import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error'; // Reduce log noise in tests

// Global test timeout
jest.setTimeout(60000);

// Mock external services if needed
jest.mock('../../src/services/supabase_service', () => ({
  SupabaseService: {
    getInstance: jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
      update: jest.fn().mockResolvedValue({ data: {}, error: null }),
      delete: jest.fn().mockResolvedValue({ data: {}, error: null }),
    }),
  },
}));

// Global setup
beforeAll(async () => {
  console.log('🧪 DSPy Test Suite Starting...');
  console.log(`Test Environment: ${process.env.NODE_ENV}`);
  console.log(`Log Level: ${process.env.LOG_LEVEL}`);
});

// Global teardown
afterAll(async () => {
  console.log('✅ DSPy Test Suite Completed');

  // Clean up any remaining resources
  const timers = setTimeout(() => {}, 0);
  for (let i = 0; i <= timers; i++) {
    clearTimeout(i);
    clearInterval(i);
  }
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toContainObject(received: unknown[], expected: object) {
    const pass = received.some((item) =>
      Object.keys(expected).every((key) => item[key] === expected[key])
    );

    if (pass) {
      return {
        message: () => `expected array not to contain object matching ${JSON.stringify(expected)}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected array to contain object matching ${JSON.stringify(expected)}`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toContainObject(expected: object): R;
    }
  }
}
