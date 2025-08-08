/**
 * Authentication Middleware Tests
 * Tests all authentication middleware functionality
 */

import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../src/middleware/auth';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../src/services/supabase-client');
jest.mock('../../src/services/secrets-manager');
jest.mock('../../src/utils/api-response');

const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('Authentication Middleware Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: undefined,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {},
    };
    mockNext = jest.fn();
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
        trusted: true
      };

      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
      };

      // Mock JWT verification
      mockJwt.verify.mockReturnValue(decodedUser as any);

      // Mock secrets manager
      const mockSecretsManager = require('../../src/services/secrets-manager');
      mockSecretsManager.secretsManager = {
        getSecret: jest.fn().mockResolvedValue('test-jwt-secret')
      };

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });

    test('should reject invalid user credentials', async () => {
      const mockSupabaseResponse = {
        data: { user: null },
        error: { message: 'Invalid credentials' },
      };

      jest.doMock('../../src/services/supabase-client', () => ({
        getSupabaseClient: () => ({
          auth: {
            getUser: () => Promise.resolve(mockSupabaseResponse),
          },
        }),
      }));

      mockReq.headers = {
        authorization: 'Bearer invalid-token',
      };

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Authentication Error Handling', () => {
    test('should handle malformed authorization headers', async () => {
      mockReq.headers = {
        authorization: 'InvalidFormat token',
      };

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle missing authorization headers', async () => {
      // No authorization header
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
