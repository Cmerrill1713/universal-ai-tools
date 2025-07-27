/* eslint-disable no-undef */
/**
 * Jest test setup file
 * Configures global test environment and utilities
 */

import '@testing-library/jest-dom';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
const originalConsoleError = console._error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console errors/warnings during tests unless they contain specific keywords
  console._error= (...args: any[]) => {
    if (
      args.some(
        (arg: any => typeof arg === 'string' && (arg.includes('ERROR') || arg.includes('FATAL'))
      )
    ) {
      originalConsoleError(...args);
    }
  };

  console.warn = (...args: any[]) => {
    if (args.some((arg: any => typeof arg === 'string' && arg.includes('WARNING'))) {
      originalConsoleWarn(...args);
    }
  };
});

afterAll(() => {
  // Restore original console methods
  console._error= originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
export const mockSupabaseClient = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn(),
        limit: jest.fn(),
      }),
      textSearch: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null, }),
        }),
      }),
      or: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: [], error: null, }),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn(),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn(),
    }),
    delete: jest.fn().mockReturnValue({
      eq: jest.fn(),
    }),
  }),
};

export const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hgetall: jest.fn(),
};

// Test data factories
export const createMockMemory = (overrides = {}) => ({
  id: 'test-memory-id',
  type: 'semantic',
  content 'Test memory content,
  importance: 0.8,
  tags: ['test'],
  timestamp: new Date(),
  ...overrides,
});

export const createMockAgent = (overrides = {}) => ({
  id: 'test-agent-id',
  name: 'Test Agent',
  category: 'cognitive',
  status: 'active',
  config: {
    maxTokens: 1000,
    temperature: 0.7,
  },
  ...overrides,
});

export const createMockModel = (overrides = {}) => ({
  id: 'test-model',
  name: 'test-model:1b',
  size: 1000000000,
  type: 'llm',
  loaded: false,
  performance: {
    avgResponseTime: 100,
    successRate: 0.95,
  },
  ...overrides,
});

// Async test helpers
export const waitFor = (ms: number => new Promise((resolve) => setTimeout(resolve, ms);

export const retryAsync = async <T>(;
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 100
): Promise<T> => {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await waitFor(delay * (i + 1));
      }
    }
  }

  throw lastError;
};
