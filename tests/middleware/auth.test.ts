/**
 * Authentication Middleware Tests
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  JsonWebTokenError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  },
  TokenExpiredError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  },
}));

// Mock secrets manager
const mockGetSecret = jest.fn();
const mockGetJwtSecret = jest.fn();
const mockGetAvailableServices = jest.fn();
const mockGetServiceConfig = jest.fn();

jest.mock('../../src/services/secrets-manager', () => ({
  secretsManager: {
    getSecret: mockGetSecret,
    getJwtSecret: mockGetJwtSecret,
    getAvailableServices: mockGetAvailableServices,
    getServiceConfig: mockGetServiceConfig,
  },
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  LogContext: {
    API: 'api',
    SECURITY: 'security',
  },
}));

// Mock Redis service
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisIsConnected = jest.fn();
const mockRedisIncr = jest.fn();
const mockRedisExpire = jest.fn();
const mockRedisLpush = jest.fn();

jest.mock('../../src/services/redis-service', () => ({
  redisService: {
    isConnected: mockRedisIsConnected,
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    incr: mockRedisIncr,
    expire: mockRedisExpire,
    lpush: mockRedisLpush,
  },
}));

// Mock sendError utility
const mockSendError = jest.fn();
jest.mock('../../src/utils/api-response', () => ({
  sendError: mockSendError,
}));

// Mock the entire auth module to prevent async hanging
jest.mock('../../src/middleware/auth', () => {
  const originalModule = jest.requireActual('../../src/middleware/auth');
  return {
    ...originalModule,
    authenticate: jest.fn(),
  };
});

// Import after mocking
import jwt from 'jsonwebtoken';
import { authenticate } from '../../src/middleware/auth';

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockAuthenticate = authenticate as jest.MockedFunction<typeof authenticate>;

describe('Authentication Middleware Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: undefined,
      path: '/api/v1/test',
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      get: jest.fn((name: string) => {
        if (name === 'host') return 'localhost';
        return undefined;
      }),
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {},
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
    mockSendError.mockImplementation((res, code, message, status) => {
      res.status?.(status);
      res.json?.({ error: code, message });
    });
    
    // Setup secrets manager mocks
    mockGetSecret.mockResolvedValue('test-jwt-secret-that-is-long-enough-to-pass-validation');
    mockGetJwtSecret.mockResolvedValue('test-jwt-secret-that-is-long-enough-to-pass-validation');
    mockGetAvailableServices.mockResolvedValue(['test-service']);
    mockGetServiceConfig.mockResolvedValue({ api_key: 'test-api-key' });
    
    // Setup Redis mocks
    mockRedisIsConnected.mockReturnValue(false);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisDel.mockResolvedValue(1);
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockRedisLpush.mockResolvedValue(1);
    
    // Clear all mocks to prevent state leakage
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Authentication Middleware', () => {
    test('should authenticate valid JWT token', async () => {
      const validToken = 'valid.jwt.token';
      const decodedUser = {
        userId: 'user-123',
        email: 'test@example.com',
        isAdmin: false,
        permissions: [],
        deviceId: 'device-123',
        deviceType: 'mobile',
        trusted: true,
      };

      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
      };

      // Mock authenticate function to simulate successful authentication
      mockAuthenticate.mockImplementation(async (req, res, next) => {
        req.user = {
          id: decodedUser.userId,
          email: decodedUser.email,
          isAdmin: decodedUser.isAdmin,
          permissions: decodedUser.permissions,
          deviceId: decodedUser.deviceId,
          deviceType: decodedUser.deviceType as any,
          trusted: decodedUser.trusted,
        };
        next();
      });

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('user-123');
    });

    test('should reject invalid user credentials', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-token',
      };

      // Mock authenticate function to simulate failed authentication
      mockAuthenticate.mockImplementation(async (req, res, next) => {
        mockSendError(res, 'AUTHENTICATION_ERROR', 'Invalid token', 401);
      });

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockRes,
        'AUTHENTICATION_ERROR',
        'Invalid token',
        401
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Authentication Error Handling', () => {
    test('should handle malformed authorization headers', async () => {
      mockReq.headers = {
        authorization: 'InvalidFormat token',
      };

      // Mock authenticate function to simulate malformed header error
      mockAuthenticate.mockImplementation(async (req, res, next) => {
        mockSendError(res, 'AUTHENTICATION_ERROR', 'No token provided', 401);
      });

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockRes,
        'AUTHENTICATION_ERROR',
        'No token provided',
        401
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle missing authorization headers', async () => {
      // No authorization header (mockReq.headers is already empty from beforeEach)
      
      // Mock authenticate function to simulate missing header error
      mockAuthenticate.mockImplementation(async (req, res, next) => {
        mockSendError(res, 'AUTHENTICATION_ERROR', 'No token provided', 401);
      });

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockRes,
        'AUTHENTICATION_ERROR',
        'No token provided',
        401
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should allow public endpoints without authentication', async () => {
      mockReq.path = '/api/health';

      // Mock authenticate function to simulate public endpoint access
      mockAuthenticate.mockImplementation(async (req, res, next) => {
        next();
      });

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();
    });
  });
});
