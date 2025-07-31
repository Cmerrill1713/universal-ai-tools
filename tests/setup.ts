// Test setup file
import { config } from 'dotenv';
import { jest } from '@jest/globals';

// Load test environment variables
config({ path: '.env.test' });

// Add globals
declare global {
  // Node.js globals
  const console: Console;
  const process: NodeJS.Process;
  const global: typeof globalThis;
  const Buffer: typeof Buffer;
  const __dirname: string;
  const __filename: string;
  const fetch: typeof fetch;
  const setImmediate: typeof setImmediate;
  const clearImmediate: typeof clearImmediate;
  const setTimeout: typeof setTimeout;
  const setInterval: typeof setInterval;
  const clearTimeout: typeof clearTimeout;
  const clearInterval: typeof clearInterval;
  const require: NodeRequire;
  
  // Jest globals
  const jest: typeof jest;
  const expect: typeof expect;
  const describe: typeof describe;
  const it: typeof it;
  const test: typeof test;
  const beforeAll: typeof beforeAll;
  const afterAll: typeof afterAll;
  const beforeEach: typeof beforeEach;
  const afterEach: typeof afterEach;
  
  // Add fetch polyfill for Node.js
  const fetch: (input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<Response>;
}

// Polyfill fetch if not available
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const { default: fetch } = await import('node-fetch');
    return fetch(...args) as any;
  };
}

// Mock console methods to reduce noise in tests
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for async operations
jest.setTimeout(30000);

// Add custom matchers if needed
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
});
