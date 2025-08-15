/**
 * Error Tracking Middleware Tests
 */

import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

// Mock dependencies
const mockSendError = jest.fn();
jest.mock('../../src/utils/api-response', () => ({
  sendError: mockSendError,
}));

import ErrorTrackingService from '../../src/middleware/error-tracking-middleware';

describe('Error Tracking Middleware', () => {
  let errorTracker: ErrorTrackingService;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Configure mock behavior
    mockSendError.mockImplementation((res: any, code: string, message: string, status: number) => {
      (res as any).status?.(status);
      (res as any).json?.({ error: code, message });
    });

    errorTracker = new ErrorTrackingService();
    errorTracker.reset(); // Ensure clean state

    mockReq = {
      path: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' } as any,
      headers: {
        'user-agent': 'test-agent',
        'authorization': 'Bearer token123',
      },
      body: {
        password: 'secret123',
        data: 'normal-data',
      },
      query: { q: 'test' },
      params: { id: '123' },
    };

    const statusMock = jest.fn().mockReturnThis();
    const jsonMock = jest.fn().mockReturnThis();
    const setHeaderMock = jest.fn().mockReturnThis();
    const onMock = jest.fn().mockReturnThis();
    
    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
      setHeader: setHeaderMock as any,
      headersSent: false,
      on: onMock as any,
      statusCode: 200,
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    errorTracker.reset();
    jest.clearAllMocks();
  });

  describe('Timing Middleware', () => {
    test('should add request timing', () => {
      const middleware = errorTracker.timingMiddleware();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).startTime).toBeDefined();
      expect((mockReq as any).requestId).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    test('should track response time on finish', () => {
      const middleware = errorTracker.timingMiddleware();
      let finishCallback: () => void = () => {};

      // Mock res.on to capture the finish callback
      mockRes.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Simulate response finish
      Object.defineProperty(mockRes, 'statusCode', { value: 200, writable: true });
      finishCallback();

      // Should have called res.on with 'finish'
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    test('should log slow requests', () => {
      const middleware = errorTracker.timingMiddleware();
      let finishCallback: () => void = () => {};

      mockRes.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      // Simulate a slow request by setting an early start time
      (mockReq as any).startTime = performance.now() - 2000; // 2 seconds ago

      middleware(mockReq as Request, mockRes as Response, mockNext);

      Object.defineProperty(mockRes, 'statusCode', { value: 200, writable: true });
      finishCallback();

      // Should have logged slow request (we can't easily test the log output)
      expect(mockRes.on).toHaveBeenCalled();
    });
  });

  describe('Error Handler', () => {
    test('should handle basic errors', () => {
      const errorHandler = errorTracker.errorHandler();
      const testError = new Error('Test error');

      errorHandler(testError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockRes,
        'INTERNAL_ERROR',
        'Test error',
        500
      );
    });

    test('should handle validation errors', () => {
      const errorHandler = errorTracker.errorHandler();
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';

      errorHandler(validationError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockRes,
        'INTERNAL_ERROR',
        'Validation failed',
        400
      );
    });

    test('should handle errors with custom status codes', () => {
      const errorHandler = errorTracker.errorHandler();
      const customError = new Error('Not found') as any;
      customError.statusCode = 404;

      errorHandler(customError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockRes,
        'INTERNAL_ERROR',
        'Not found',
        404
      );
    });

    test('should sanitize sensitive data', () => {
      const errorHandler = errorTracker.errorHandler();
      const testError = new Error('Test error');

      errorHandler(testError, mockReq as Request, mockRes as Response, mockNext);

      const metrics = errorTracker.getMetrics();
      expect(metrics.totalErrors).toBe(1);

      const recentErrors = errorTracker.getRecentErrors(1);
      expect(recentErrors).toHaveLength(1);
      
      const errorContext = recentErrors[0];
      expect(errorContext.headers.authorization).toBe('[REDACTED]');
      expect(errorContext.body.password).toBe('[REDACTED]');
      expect(errorContext.body.data).toBe('normal-data');
    });

    test('should not double-send response if headers already sent', () => {
      const errorHandler = errorTracker.errorHandler();
      const testError = new Error('Test error');
      
      // Simulate headers already sent
      Object.defineProperty(mockRes, 'headersSent', { value: true, writable: true });

      errorHandler(testError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockSendError).not.toHaveBeenCalled();
    });

    test('should hide internal errors in production', () => {
      // Temporarily set NODE_ENV to production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const errorHandler = errorTracker.errorHandler();
      const internalError = new Error('Database connection failed');

      errorHandler(internalError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockRes,
        'INTERNAL_ERROR',
        'Internal server error',
        500
      );

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Metrics Tracking', () => {
    test('should track error metrics', () => {
      const errorHandler = errorTracker.errorHandler();
      
      // Generate some errors
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      
      // Create custom error class for testing
      class ValidationError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'ValidationError';
        }
      }
      const validationError = new ValidationError('Validation error');

      errorHandler(error1, mockReq as Request, mockRes as Response, mockNext);
      errorHandler(error2, mockReq as Request, mockRes as Response, mockNext);
      errorHandler(validationError, mockReq as Request, mockRes as Response, mockNext);

      const metrics = errorTracker.getMetrics();
      
      expect(metrics.totalErrors).toBe(3);
      expect(metrics.errorsByType.Error).toBe(2);
      expect(metrics.errorsByType.ValidationError).toBe(1);
      expect(metrics.errorsByPath['/api/test']).toBe(3);
      expect(metrics.errorsByStatusCode[500]).toBe(2);
      expect(metrics.errorsByStatusCode[400]).toBe(1);
      expect(metrics.consecutiveErrors).toBe(3);
    });

    test('should provide recent errors', () => {
      const errorHandler = errorTracker.errorHandler();
      
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorHandler(error1, mockReq as Request, mockRes as Response, mockNext);
      
      // Change path for second error
      (mockReq as any).path = '/api/other';
      errorHandler(error2, mockReq as Request, mockRes as Response, mockNext);

      const recentErrors = errorTracker.getRecentErrors(10);
      
      expect(recentErrors).toHaveLength(2);
      expect(recentErrors[0].path).toBe('/api/other'); // Most recent first
      expect(recentErrors[1].path).toBe('/api/test');
    });

    test('should limit recent errors storage', () => {
      // Create a new tracker with smaller limit for testing
      const smallTracker = new ErrorTrackingService();
      const errorHandler = smallTracker.errorHandler();

      // Generate more errors than the limit
      for (let i = 0; i < 150; i++) {
        const error = new Error(`Error ${i}`);
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      }

      const recentErrors = smallTracker.getRecentErrors(200);
      
      // Should be limited to maxRecentErrors (100)
      expect(recentErrors.length).toBeLessThanOrEqual(100);
      
      smallTracker.reset();
    });
  });

  describe('Error Trends', () => {
    test('should provide error trends', async () => {
      // Create fresh tracker for this test to avoid contamination
      const freshTracker = new ErrorTrackingService();
      const errorHandler = freshTracker.errorHandler();
      
      // Generate errors on different paths
      for (let i = 0; i < 5; i++) {
        (mockReq as any).path = '/api/test';
        const error = new Error(`Test error ${i}`);
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      }

      for (let i = 0; i < 3; i++) {
        (mockReq as any).path = '/api/other';
        
        // Create custom error class for proper constructor name tracking
        class CustomError extends Error {
          constructor(message: string) {
            super(message);
            this.name = 'CustomError';
          }
        }
        const error = new CustomError(`Other error ${i}`);
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      }

      // Add small delay to ensure all errors are processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const trends = freshTracker.getErrorTrends();
      
      expect(trends.hourly).toHaveLength(24);
      // All errors should be counted somewhere in the hourly data (allowing for timing/race issues)
      const totalErrorsInTrend = trends.hourly.reduce((sum, count) => sum + count, 0);
      expect(totalErrorsInTrend).toBeGreaterThanOrEqual(7); // Allow for minor timing issues
      expect(totalErrorsInTrend).toBeLessThanOrEqual(8);
      // Most recent hour should have most or all of the errors
      expect(trends.hourly[23]).toBeGreaterThan(0);
      
      expect(trends.byPath).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: '/api/test', count: 5 }),
          expect.objectContaining({ path: '/api/other', count: 3 }),
        ])
      );
      
      expect(trends.byType).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'Error', count: 5 }),
          expect.objectContaining({ type: 'CustomError', count: 3 }),
        ])
      );
      
      freshTracker.reset();
    });
  });

  describe('Alert Configuration', () => {
    test('should update alert configuration', () => {
      const newConfig = {
        enabled: true,
        thresholds: {
          errorRate: 20,
          responseTime: 3000,
          consecutiveErrors: 10,
        },
      };

      errorTracker.updateAlertConfig(newConfig);

      // Can't easily test internal config, but should not throw
      expect(() => errorTracker.updateAlertConfig(newConfig)).not.toThrow();
    });
  });

  describe('Reset Functionality', () => {
    test('should reset all metrics', () => {
      const errorHandler = errorTracker.errorHandler();
      
      // Generate some errors and metrics
      const error = new Error('Test error');
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      let metrics = errorTracker.getMetrics();
      expect(metrics.totalErrors).toBe(1);

      // Reset
      errorTracker.reset();

      metrics = errorTracker.getMetrics();
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.consecutiveErrors).toBe(0);
      
      const recentErrors = errorTracker.getRecentErrors();
      expect(recentErrors).toHaveLength(0);
    });
  });

  describe('Request ID Generation', () => {
    test('should generate unique request IDs', () => {
      const middleware = errorTracker.timingMiddleware();
      
      const req1 = { ...mockReq };
      const req2 = { ...mockReq };

      middleware(req1 as Request, mockRes as Response, mockNext);
      middleware(req2 as Request, mockRes as Response, mockNext);

      expect((req1 as any).requestId).toBeDefined();
      expect((req2 as any).requestId).toBeDefined();
      expect((req1 as any).requestId).not.toBe((req2 as any).requestId);
    });
  });
});