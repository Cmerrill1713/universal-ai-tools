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
jest.mock('../../src/services/secrets-manager', () => ({
  secretsManager: {
    getSecret: mockGetSecret,
  },
}));

// Mock sendError utility
const mockSendError = jest.fn();
jest.mock('../../src/utils/api-response', () => ({
  sendError: mockSendError,
}));

// Import after mocking
import jwt from 'jsonwebtoken';
import { authenticate } from '../../src/middleware/auth';

const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('Authentication Middleware Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: undefined,
      path: '/api/v1/test',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {},
    };
    mockNext = jest.fn();
    mockSendError.mockImplementation((res, code, message, status) => {
      res.status?.(status);
      res.json?.({ error: code, message });
    });
    mockGetSecret.mockResolvedValue('test-jwt-secret');
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

      // Mock JWT verification
      mockJwt.verify.mockReturnValue(decodedUser as any);

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('user-123');
    });

    test('should reject invalid user credentials', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-token',
      };

      // Mock JWT verification to throw JsonWebTokenError
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
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
      // No authorization header
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

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();
    });
  });
});
