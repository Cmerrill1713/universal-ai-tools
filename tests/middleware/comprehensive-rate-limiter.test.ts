/**
 * Comprehensive Rate Limiter Tests
 */

import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

// Mock dependencies
const mockSendError = jest.fn();
jest.mock('../../src/utils/api-response', () => ({
  sendError: mockSendError,
}));

import { ComprehensiveRateLimiter, createStandardRateLimiter } from '../../src/middleware/comprehensive-rate-limiter';

describe('Comprehensive Rate Limiter', () => {
  let limiter: ComprehensiveRateLimiter;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Configure mock behavior
    mockSendError.mockImplementation((res, code, message, status) => {
      res.status?.(status);
      res.json?.({ error: code, message });
    });

    limiter = new ComprehensiveRateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 5,
    });

    mockReq = {
      path: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      headers: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    limiter.shutdown();
    jest.clearAllMocks();
  });

  describe('Basic Rate Limiting', () => {
    test('should allow requests within limit', async () => {
      const middleware = limiter.middleware();

      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockSendError).not.toHaveBeenCalled();
    });

    test('should block requests exceeding limit', async () => {
      const middleware = limiter.middleware();

      // Make 6 requests (1 over limit)
      for (let i = 0; i < 6; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockSendError).toHaveBeenCalledTimes(1);
      expect(mockSendError).toHaveBeenCalledWith(
        mockRes,
        'RATE_LIMIT_EXCEEDED',
        expect.stringContaining('Rate limit exceeded'),
        429
      );
    });

    test('should set rate limit headers', async () => {
      const middleware = limiter.middleware();

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    test('should set Retry-After header when limit exceeded', async () => {
      const middleware = limiter.middleware();

      // Exceed the limit
      for (let i = 0; i < 6; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });
  });

  describe('Key Generation', () => {
    test('should use user ID for authenticated users', async () => {
      const middleware = limiter.middleware();
      
      // Add user to request
      (mockReq as any).user = { id: 'user-123' };

      // Make requests as authenticated user
      for (let i = 0; i < 5; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // Next request should be blocked (6th request)
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockSendError).toHaveBeenCalledTimes(1);
    });

    test('should use IP address for unauthenticated users', async () => {
      const middleware = limiter.middleware();
      
      // Different IP should have separate limit
      mockReq.ip = '192.168.1.1';
      
      for (let i = 0; i < 5; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockSendError).not.toHaveBeenCalled();
    });
  });

  describe('Rule Matching', () => {
    test('should apply specific rules to matching paths', async () => {
      limiter.addRule({
        path: '/api/auth',
        config: {
          windowMs: 60000,
          maxRequests: 2, // Stricter limit
        },
      });

      const middleware = limiter.middleware();
      mockReq.path = '/api/auth/login';

      // Should be limited to 2 requests
      for (let i = 0; i < 3; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockSendError).toHaveBeenCalledTimes(1);
    });

    test('should apply method-specific rules', async () => {
      // Create a new limiter with fresh state for this test
      const methodLimiter = new ComprehensiveRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      methodLimiter.addRule({
        path: '/api/test',
        method: 'POST',
        config: {
          windowMs: 60000,
          maxRequests: 1,
        },
      });

      const middleware = methodLimiter.middleware();

      // GET requests should use global config (5 requests) - use different path to avoid conflicts
      mockReq.method = 'GET';
      mockReq.path = '/api/other';
      for (let i = 0; i < 5; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // POST requests should be limited to 1 - use different IP to avoid conflict
      mockReq.method = 'POST';
      mockReq.path = '/api/test';
      mockReq.ip = '192.168.1.1';
      jest.clearAllMocks();
      
      for (let i = 0; i < 2; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockSendError).toHaveBeenCalledTimes(1);

      methodLimiter.shutdown();
    });

    test('should support regex path matching', async () => {
      limiter.addRule({
        path: /^\/api\/v\d+\/auth/,
        config: {
          windowMs: 60000,
          maxRequests: 1,
        },
      });

      const middleware = limiter.middleware();
      mockReq.path = '/api/v1/auth/token';

      for (let i = 0; i < 2; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockSendError).toHaveBeenCalledTimes(1);
    });
  });

  describe('Skip Conditions', () => {
    test('should skip rate limiting when skipIf returns true', async () => {
      const customLimiter = new ComprehensiveRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        skipIf: (req) => req.path === '/api/health',
      });

      const middleware = customLimiter.middleware();
      mockReq.path = '/api/health';

      // Should not be rate limited regardless of request count
      for (let i = 0; i < 10; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(10);
      expect(mockSendError).not.toHaveBeenCalled();

      customLimiter.shutdown();
    });
  });

  describe('Progressive Penalties', () => {
    test('should apply progressive penalties for repeated violations', async () => {
      const middleware = limiter.middleware();

      // Exceed limit multiple times to trigger penalties
      for (let i = 0; i < 8; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // Should have applied progressive penalties
      expect(mockSendError).toHaveBeenCalledTimes(3); // 6th, 7th, 8th requests
    });
  });

  describe('Window Reset', () => {
    test('should reset limits after window expires', async () => {
      const shortLimiter = new ComprehensiveRateLimiter({
        windowMs: 100, // Very short window for testing
        maxRequests: 2,
      });

      const middleware = shortLimiter.middleware();

      // Use up limit
      for (let i = 0; i < 3; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(2);
      jest.clearAllMocks();

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should allow requests again
      for (let i = 0; i < 2; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockSendError).not.toHaveBeenCalled();

      shortLimiter.shutdown();
    });
  });

  describe('Standard Rate Limiter Configuration', () => {
    test('should create standard rate limiter with predefined rules', () => {
      const standardLimiter = createStandardRateLimiter();
      const stats = standardLimiter.getStats();

      expect(stats.totalRules).toBeGreaterThan(0);
      expect(stats.activeClients).toBe(0);

      standardLimiter.shutdown();
    });
  });

  describe('Utility Methods', () => {
    test('should provide statistics', () => {
      const stats = limiter.getStats();

      expect(stats).toHaveProperty('activeClients');
      expect(stats).toHaveProperty('totalRules');
      expect(stats).toHaveProperty('memoryUsage');
    });

    test('should reset specific client', async () => {
      const middleware = limiter.middleware();
      
      // Use up some requests
      for (let i = 0; i < 3; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // Reset this client
      const key = `ip:${mockReq.ip}`;
      const wasReset = limiter.reset(key);

      expect(wasReset).toBe(true);

      // Should allow full limit again
      jest.clearAllMocks();
      for (let i = 0; i < 5; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
    });

    test('should reset all clients', async () => {
      const middleware = limiter.middleware();
      
      // Use up requests
      for (let i = 0; i < 6; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      limiter.resetAll();

      // Should allow requests again
      jest.clearAllMocks();
      for (let i = 0; i < 5; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling', () => {
    test('should continue without rate limiting on error', async () => {
      // Create a limiter with a config that could cause errors
      const faultyLimiter = new ComprehensiveRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyGenerator: () => {
          throw new Error('Key generation error');
        },
      });

      const middleware = faultyLimiter.middleware();

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should continue despite error
      expect(mockNext).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();

      faultyLimiter.shutdown();
    });
  });
});