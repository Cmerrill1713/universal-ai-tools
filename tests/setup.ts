// Test setup file
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'sqlite::memory:';

// Redis configuration for local testing
// Override Docker Redis host for local test execution
if (!process.env.DOCKER_ENV) {
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  process.env.REDIS_PASSWORD = '';
  process.env.REDIS_DB = '1'; // Use separate DB for tests
}

// Disable heavy services during testing
process.env.DISABLE_HEAVY_SERVICES = 'true';
process.env.SKIP_STARTUP_CONTEXT = 'true';
process.env.ENABLE_CONTEXT_MIDDLEWARE = 'false';
process.env.ENABLE_MLX = 'false';
process.env.ENABLE_VISION = 'false';

// Mock Redis for tests when actual Redis is not available
if (!process.env.DOCKER_ENV && !process.env.USE_REAL_REDIS) {
  jest.doMock('redis', () => ({
    createClient: () => ({
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      info: jest.fn().mockResolvedValue('redis_mode:standalone'),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      result: jest.fn().mockReturnThis(),
    })
  }));

  jest.doMock('ioredis', () => ({
    default: jest.fn().mockImplementation(() => ({
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      info: jest.fn().mockResolvedValue('redis_mode:standalone'),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
    }))
  }));
}

// Test timeout
jest.setTimeout(30000);
