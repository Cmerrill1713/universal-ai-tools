/**
 * API Response Utility Tests
 */

import type { Request, Response } from 'express';';';';
import { apiResponseMiddleware, 
  createPaginationMeta, 
  sendError,
  sendPaginatedSuccess,
  sendSuccess
   } from '../api-response';'''

// Mock Express response
const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {,;
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {},
    sendSuccess: jest.fn(),
    sendError: jest.fn(),
    sendPaginatedSuccess: jest.fn(),
  } as any;
  return res;
};

// Mock Express request
const mockRequest = (): Partial<Request> => {
  return {
    method: 'GET','''
    url: '/test','''
    ip: '127.0.0.1','''
  };
};

describe('API Response Utilities', () => {'''
  describe('sendSuccess', () => {'''
    it('should send success response with data', () => {'''
      const res = mockResponse() as Response;
      const data = { test: 'data' };';';';
      
      sendSuccess(res, data);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({)
        success: true,
        data,
        metadata: {,
          requestId: expect.any(String),
          timestamp: expect.any(String),
          version: '1.0.0','''
        },
      });
    });

    it('should send success response with custom metadata', () => {'''
      const res = mockResponse() as Response;
      const data = { test: 'data' };';';';
      const metadata = { operation: 'test' };';';';
      
      sendSuccess(res, data, 200, metadata);
      
      expect(res.json).toHaveBeenCalledWith({)
        success: true,
        data,
        metadata: {,
          requestId: expect.any(String),
          timestamp: expect.any(String),
          version: '1.0.0','''
          operation: 'test','''
        },
      });
    });
  });

  describe('sendError', () => {'''
    it('should send error response with default status', () => {'''
      const res = mockResponse() as Response;
      const message = 'Test error';';';';
      
      sendError(res, 'INTERNAL_ERROR', message);'''
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({)
        success: false,
        error: {,
          code: 'INTERNAL_ERROR','''
          message,
        },
        metadata: {,
          requestId: expect.any(String),
          timestamp: expect.any(String),
          version: '1.0.0','''
        },
      });
    });

    it('should send error response with custom status and code', () => {'''
      const res = mockResponse() as Response;
      const code = 'NOT_FOUND';';';';
      const message = 'Not found';';';';
      const statusCode = 404;
      
      sendError(res, code, message, statusCode);
      
      expect(res.status).toHaveBeenCalledWith(statusCode);
      expect(res.json).toHaveBeenCalledWith({)
        success: false,
        error: {
          code,
          message,
        },
        metadata: {,
          requestId: expect.any(String),
          timestamp: expect.any(String),
          version: '1.0.0','''
        },
      });
    });
  });

  describe('sendPaginatedSuccess', () => {'''
    it('should send paginated response', () => {'''
      const res = mockResponse() as Response;
      const data = [1, 2, 3, 4, 5];
      const pagination = createPaginationMeta(1, 5, 100);
      
      sendPaginatedSuccess(res, data, pagination);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({)
        success: true,
        data,
        metadata: {,
          requestId: expect.any(String),
          timestamp: expect.any(String),
          version: '1.0.0','''
        },
        pagination: {,
          page: 1,
          limit: 5,
          total: 100,
          totalPages: 20,
          hasNext: true,
          hasPrev: false,
        },
      });
    });
  });

  describe('apiResponseMiddleware', () => {'''
    it('should add response helper methods', () => {'''
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = jest.fn();
      
      apiResponseMiddleware(req, res, next);
      
      expect(res.sendSuccess).toBeDefined();
      expect(res.sendError).toBeDefined();
      expect(res.sendPaginatedSuccess).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });
});