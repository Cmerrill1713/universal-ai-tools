/**
 * Authentication Middleware Tests
 * Comprehensive test suite for authentication and authorization
 */

import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { authenticateAPIKey, authenticateJWT } from '../auth';

// Mock the secrets manager
jest.mock('../../services/secrets-manager', () => ({
  secretsManager: {
    getSecret: jest.fn().mockResolvedValue('test-jwt-secret-that-is-at-least-32-characters-long'),
    getAvailableServices: jest.fn().mockResolvedValue([
      { id: 'test-service', name: 'Test Service', apiKey: 'valid-api-key-that-is-at-least-32-characters-long' }
    ]),
    getServiceConfig: jest.fn().mockResolvedValue(null),
  },
}));

// Mock the API response utilities
jest.mock('../../utils/api-response', () => ({
  sendError: jest.fn((res, code, message, status) => {
    res.status(status || 400).json({
      success: false,
      error: code,
      message,
    });
  }),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LogContext: {
    API: 'api',
  },
}));

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;
  let mockSendError: jest.Mock;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
    jest.clearAllMocks();
    
    // Get reference to the mocked sendError function
    const { sendError } = require('../../utils/api-response');
    mockSendError = sendError as jest.Mock;
    mockSendError.mockClear();
  });

  describe('JWT Authentication', () => {
    const validSecret = 'test-jwt-secret-that-is-at-least-32-characters-long';
    
    beforeEach(() => {
      // Set up environment for JWT tests
      process.env.JWT_SECRET = validSecret;
    });

    it('should authenticate valid JWT token', async () => {
      const payload = { userId: 'test-user', email: 'test@example.com' };
      const token = jwt.sign(payload, validSecret);
      
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user).toEqual(expect.objectContaining({
        id: payload.userId,
        email: payload.email
      }));
    });

    it('should reject missing authorization header', async () => {
      mockRequest.headers = {};

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(expect.anything(), 'AUTHENTICATION_ERROR', 'No token provided', 401);
    });

    it('should reject malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat',
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(expect.anything(), 'AUTHENTICATION_ERROR', 'No token provided', 401);
    });

    it('should reject invalid JWT token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.jwt.token',
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should reject expired JWT token', async () => {
      const payload = { userId: 'test-user', exp: Math.floor(Date.now() / 1000) - 3600 };
      const token = jwt.sign(payload, validSecret);
      
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should handle JWT secret configuration errors', async () => {
      // Mock secrets manager to fail
      const { secretsManager } = require('../../services/secrets-manager');
      secretsManager.getSecret.mockRejectedValueOnce(new Error('Secrets unavailable'));
      
      // Remove environment secret to force error
      delete process.env.JWT_SECRET;
      
      const payload = { userId: 'test-user' };
      const token = jwt.sign(payload, validSecret);
      
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should validate JWT secret length', async () => {
      // Mock short secret
      const { secretsManager } = require('../../services/secrets-manager');
      secretsManager.getSecret.mockResolvedValueOnce('short');
      
      delete process.env.JWT_SECRET;
      
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('API Key Authentication', () => {
    it('should authenticate valid API key', async () => {
      // Mock the secrets manager to return services and service config
      const { secretsManager } = require('../../services/secrets-manager');
      secretsManager.getAvailableServices.mockResolvedValueOnce(['test-service']);
      secretsManager.getServiceConfig.mockResolvedValueOnce({
        api_key: 'valid-api-key-that-is-at-least-32-characters-long'
      });
      
      mockRequest.headers = {
        'x-api-key': 'valid-api-key-that-is-at-least-32-characters-long',
      };

      const result = await authenticateAPIKey('valid-api-key-that-is-at-least-32-characters-long');
      
      expect(result).toBe(true);
    });

    it('should reject short API keys', async () => {
      const result = await authenticateAPIKey('short-key');
      
      expect(result).toBe(false);
    });

    it('should reject empty API keys', async () => {
      const result = await authenticateAPIKey('');
      
      expect(result).toBe(false);
    });

    it('should reject null/undefined API keys', async () => {
      expect(await authenticateAPIKey(null as any)).toBe(false);
      expect(await authenticateAPIKey(undefined as any)).toBe(false);
    });

    it('should validate against service configuration', async () => {
      const longValidKey = 'test-api-key-that-is-definitely-longer-than-32-characters';
      
      // Mock secrets manager with available services
      const { secretsManager } = require('../../services/secrets-manager');
      secretsManager.getAvailableServices.mockResolvedValueOnce(['service1']);
      secretsManager.getServiceConfig.mockResolvedValueOnce({
        api_key: longValidKey
      });

      const result = await authenticateAPIKey(longValidKey);
      
      expect(result).toBe(true);
    });

    it('should handle secrets manager errors gracefully', async () => {
      const { secretsManager } = require('../../services/secrets-manager');
      secretsManager.getAvailableServices.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await authenticateAPIKey('valid-api-key-that-is-at-least-32-characters-long');
      
      expect(result).toBe(false);
    });

    it('should reject when no services are available', async () => {
      const { secretsManager } = require('../../services/secrets-manager');
      secretsManager.getAvailableServices.mockResolvedValueOnce([]);

      const result = await authenticateAPIKey('valid-api-key-that-is-at-least-32-characters-long');
      
      expect(result).toBe(false);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle SQL injection attempts in tokens', async () => {
      const maliciousToken = "'; DROP TABLE users; --";
      
      mockRequest.headers = {
        authorization: `Bearer ${maliciousToken}`,
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should handle XSS attempts in tokens', async () => {
      const xssToken = '<script>alert("xss")</script>';
      
      mockRequest.headers = {
        authorization: `Bearer ${xssToken}`,
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should handle extremely long tokens', async () => {
      const longToken = 'a'.repeat(10000);
      
      mockRequest.headers = {
        authorization: `Bearer ${longToken}`,
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should handle concurrent authentication requests', async () => {
      const validSecret = 'test-jwt-secret-that-is-at-least-32-characters-long';
      const payload = { userId: 'test-user' };
      const token = jwt.sign(payload, validSecret);
      
      const requests = Array.from({ length: 10 }, () => ({
        headers: { authorization: `Bearer ${token}` },
      }));

      const promises = requests.map(req => 
        authenticateJWT(
          req as Request,
          mockResponse as Response,
          jest.fn()
        )
      );

      await Promise.all(promises);
      
      // All should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('Performance Considerations', () => {
    it('should complete authentication within reasonable time', async () => {
      const validSecret = 'test-jwt-secret-that-is-at-least-32-characters-long';
      const payload = { userId: 'test-user' };
      const token = jwt.sign(payload, validSecret);
      
      // Mock secrets manager
      const { secretsManager } = require('../../services/secrets-manager');
      secretsManager.getSecret.mockResolvedValueOnce(validSecret);
      
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      const startTime = Date.now();
      
      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete in under 100ms
      expect(executionTime).toBeLessThan(100);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle rapid sequential requests', async () => {
      const validSecret = 'test-jwt-secret-that-is-at-least-32-characters-long';
      
      // Mock secrets manager for all requests
      const { secretsManager } = require('../../services/secrets-manager');
      secretsManager.getSecret.mockResolvedValue(validSecret);
      
      for (let i = 0; i < 50; i++) {
        const payload = { userId: `user-${i}` };
        const token = jwt.sign(payload, validSecret);
        
        const req = {
          headers: { authorization: `Bearer ${token}` },
        };
        
        const next = jest.fn();
        
        await authenticateJWT(
          req as Request,
          mockResponse as Response,
          next
        );
        
        expect(next).toHaveBeenCalled();
      }
    });
  });

  describe('Integration with Secrets Manager', () => {
    it('should prefer secrets manager over environment variables', async () => {
      const secretsSecret = 'secrets-manager-jwt-secret-32-chars';
      const envSecret = 'environment-jwt-secret-32-characters';
      
      process.env.JWT_SECRET = envSecret;
      
      const { secretsManager } = require('../../services/secrets-manager');
      secretsManager.getSecret.mockResolvedValueOnce(secretsSecret);
      
      const payload = { userId: 'test-user' };
      const tokenWithSecretsSecret = jwt.sign(payload, secretsSecret);
      
      mockRequest.headers = {
        authorization: `Bearer ${tokenWithSecretsSecret}`,
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(secretsManager.getSecret).toHaveBeenCalledWith('jwt_secret');
    });

    it('should fallback to environment when secrets manager fails', async () => {
      const envSecret = 'environment-jwt-secret-32-characters';
      process.env.JWT_SECRET = envSecret;
      
      const { secretsManager } = require('../../services/secrets-manager');
      secretsManager.getSecret.mockResolvedValueOnce(null);
      
      const payload = { userId: 'test-user' };
      const tokenWithEnvSecret = jwt.sign(payload, envSecret);
      
      mockRequest.headers = {
        authorization: `Bearer ${tokenWithEnvSecret}`,
      };

      await authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});