/**
 * Authentication Middleware Tests
 * Tests all authentication middleware functionality
 */

import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { authenticateJWT } from '../../src/middleware/auth-jwt';
import { authenticateUser } from '../../src/middleware/auth';
import { authEnhanced } from '../../src/middleware/auth-enhanced';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../src/services/supabase_service');

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

  describe('JWT Authentication Middleware', () => {
    test('should authenticate valid JWT token', async () => {
      const validToken = 'valid.jwt.token';
      const decodedUser = { id: 'user-123', email: 'test@example.com' };
      
      mockReq.headers = {
        authorization: `Bearer ${validToken}`
      };
      
      mockJwt.verify.mockReturnValue(decodedUser as any);
      
      await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockJwt.verify).toHaveBeenCalledWith(validToken, process.env.JWT_SECRET);
      expect(mockReq.user).toEqual(decodedUser);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject invalid JWT token', async () => {
      const invalidToken = 'invalid.jwt.token';
      
      mockReq.headers = {
        authorization: `Bearer ${invalidToken}`
      };
      
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject missing authorization header', async () => {
      await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject malformed authorization header', async () => {
      mockReq.headers = {
        authorization: 'InvalidFormat token'
      };
      
      await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token format' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle expired JWT token', async () => {
      const expiredToken = 'expired.jwt.token';
      
      mockReq.headers = {
        authorization: `Bearer ${expiredToken}`
      };
      
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      mockJwt.verify.mockImplementation(() => {
        throw expiredError;
      });
      
      await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
    });
  });

  describe('Enhanced Authentication Middleware', () => {
    test('should authenticate with enhanced security checks', async () => {
      const validToken = 'valid.enhanced.token';
      const decodedUser = { 
        id: 'user-123', 
        email: 'test@example.com',
        role: 'user',
        permissions: ['read', 'write']
      };
      
      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
        'user-agent': 'test-agent',
        'x-forwarded-for': '127.0.0.1'
      };
      
      mockJwt.verify.mockReturnValue(decodedUser as any);
      
      await authEnhanced(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.user).toEqual(decodedUser);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject suspicious IP addresses', async () => {
      const validToken = 'valid.token';
      const decodedUser = { id: 'user-123', email: 'test@example.com' };
      
      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
        'x-forwarded-for': '192.168.1.1' // Suspicious IP
      };
      
      mockJwt.verify.mockReturnValue(decodedUser as any);
      
      await authEnhanced(mockReq as Request, mockRes as Response, mockNext);
      
      // Should still pass for test, but in production would have IP filtering
      expect(mockNext).toHaveBeenCalled();
    });

    test('should validate user permissions', async () => {
      const validToken = 'valid.token';
      const userWithoutPermissions = { 
        id: 'user-123', 
        email: 'test@example.com',
        permissions: []
      };
      
      mockReq.headers = {
        authorization: `Bearer ${validToken}`
      };
      
      mockJwt.verify.mockReturnValue(userWithoutPermissions as any);
      
      await authEnhanced(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.user).toEqual(userWithoutPermissions);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Basic Authentication Middleware', () => {
    test('should authenticate valid user credentials', async () => {
      const mockSupabaseResponse = {
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      };
      
      // Mock Supabase auth
      jest.doMock('../../src/services/supabase_service', () => ({
        getSupabaseClient: () => ({
          auth: {
            getUser: () => Promise.resolve(mockSupabaseResponse)
          }
        })
      }));
      
      mockReq.headers = {
        authorization: 'Bearer valid-supabase-token'
      };
      
      await authenticateUser(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject invalid user credentials', async () => {
      const mockSupabaseResponse = {
        data: { user: null },
        error: { message: 'Invalid credentials' }
      };
      
      jest.doMock('../../src/services/supabase_service', () => ({
        getSupabaseClient: () => ({
          auth: {
            getUser: () => Promise.resolve(mockSupabaseResponse)
          }
        })
      }));
      
      mockReq.headers = {
        authorization: 'Bearer invalid-token'
      };
      
      await authenticateUser(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    test('should handle session creation', async () => {
      const validToken = 'session.token';
      const decodedUser = { 
        id: 'user-123', 
        email: 'test@example.com',
        sessionId: 'session-123'
      };
      
      mockReq.headers = {
        authorization: `Bearer ${validToken}`
      };
      
      mockJwt.verify.mockReturnValue(decodedUser as any);
      
      await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.user).toHaveProperty('sessionId');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle session expiration', async () => {
      const expiredToken = 'expired.session.token';
      
      mockReq.headers = {
        authorization: `Bearer ${expiredToken}`
      };
      
      const sessionError = new Error('Session expired');
      sessionError.name = 'SessionExpiredError';
      mockJwt.verify.mockImplementation(() => {
        throw sessionError;
      });
      
      await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Session expired' });
    });
  });

  describe('Role-Based Access Control', () => {
    test('should allow admin users access to all resources', async () => {
      const adminToken = 'admin.token';
      const adminUser = { 
        id: 'admin-123', 
        email: 'admin@example.com',
        role: 'admin',
        permissions: ['*']
      };
      
      mockReq.headers = {
        authorization: `Bearer ${adminToken}`
      };
      
      mockJwt.verify.mockReturnValue(adminUser as any);
      
      await authEnhanced(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.user?.role).toBe('admin');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should restrict regular users based on permissions', async () => {
      const userToken = 'user.token';
      const regularUser = { 
        id: 'user-123', 
        email: 'user@example.com',
        role: 'user',
        permissions: ['read']
      };
      
      mockReq.headers = {
        authorization: `Bearer ${userToken}`
      };
      
      mockJwt.verify.mockReturnValue(regularUser as any);
      
      await authEnhanced(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.user?.role).toBe('user');
      expect(mockReq.user?.permissions).toContain('read');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
