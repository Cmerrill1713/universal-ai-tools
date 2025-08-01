/**
 * Authentication Middleware Tests
 */

import type { NextFunction, Request, Response } from 'express';
import { 
  _clearMockApiKeys, 
  _setMockApiKey, 
  authenticateRequest,
  rateLimitByApiKey,
  validateApiKey
} from './mocks/auth';
import jwt from 'jsonwebtoken';

// Mock Express objects
const mockRequest = (options: any = {}): Partial<Request> => ({
  headers: options.headers || {},
  body: options.body || {},
  query: options.query || {},
  ...options
});

const mockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.locals = {};
  return res;
};

const mockNext: NextFunction = jest.fn();

describe('Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    _clearMockApiKeys();
  });

  describe('validateApiKey', () => {
    it('should accept valid API key in header', async () => {
      const req = mockRequest({
        headers: {
          'x-api-key': 'valid-api-key',
          'x-ai-service': 'test-service'
        }
      });
      const res = mockResponse();

      // Set up mock API key
      _setMockApiKey('valid-api-key', {
        id: 'key-id',
        service_name: 'test-service',
        is_active: true,
        rate_limit: 100,
        permissions: ['read', 'write'],
        current_usage: 0
      });

      await validateApiKey(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.locals.apiKey).toBeDefined();
      expect(res.locals.apiKey.service_name).toBe('test-service');
    });

    it('should reject missing API key', async () => {
      const req = mockRequest({
        headers: {}
      });
      const res = mockResponse();

      await validateApiKey(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key is required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid API key', async () => {
      const req = mockRequest({
        headers: {
          'x-api-key': 'invalid-key',
          'x-ai-service': 'test-service'
        }
      });
      const res = mockResponse();

      // Don't set up any mock key - it should fail

      await validateApiKey(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        }
      });
    });

    it('should reject inactive API key', async () => {
      const req = mockRequest({
        headers: {
          'x-api-key': 'inactive-key',
          'x-ai-service': 'test-service'
        }
      });
      const res = mockResponse();

      // Set up inactive mock API key
      _setMockApiKey('inactive-key', {
        id: 'key-id',
        service_name: 'test-service',
        is_active: false,
        rate_limit: 100,
        permissions: [],
        current_usage: 0
      });

      await validateApiKey(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'API_KEY_INACTIVE',
          message: 'API key is inactive'
        }
      });
    });
  });

  describe('authenticateRequest', () => {
    it('should accept valid JWT token', async () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        'test-secret',
        { expiresIn: '1h' }
      );

      const req = mockRequest({
        headers: {
          'authorization': `Bearer ${token}`
        }
      });
      const res = mockResponse();

      await authenticateRequest(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.locals.user).toBeDefined();
      expect(res.locals.user.userId).toBe('user-123');
    });

    it('should reject missing authorization header', async () => {
      const req = mockRequest({ headers: {} });
      const res = mockResponse();

      await authenticateRequest(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token required'
        }
      });
    });

    it('should reject invalid JWT token', async () => {
      const req = mockRequest({
        headers: {
          'authorization': 'Bearer invalid-token'
        }
      });
      const res = mockResponse();

      await authenticateRequest(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    });

    it('should reject expired JWT token', async () => {
      const token = jwt.sign(
        { userId: 'user-123' },
        'test-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const req = mockRequest({
        headers: {
          'authorization': `Bearer ${token}`
        }
      });
      const res = mockResponse();

      await authenticateRequest(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    });
  });

  describe('rateLimitByApiKey', () => {
    it('should allow requests within rate limit', async () => {
      const req = mockRequest();
      const res = mockResponse();
      res.locals.apiKey = {
        id: 'key-123',
        rate_limit: 100,
        current_usage: 50
      };

      // Mock will automatically increment usage

      await rateLimitByApiKey(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.locals.apiKey.current_usage).toBe(51);
    });

    it('should reject requests exceeding rate limit', async () => {
      const req = mockRequest();
      const res = mockResponse();
      res.locals.apiKey = {
        id: 'key-123',
        rate_limit: 100,
        current_usage: 100
      };

      await rateLimitByApiKey(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'API rate limit exceeded'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should skip rate limiting if no API key', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await rateLimitByApiKey(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});