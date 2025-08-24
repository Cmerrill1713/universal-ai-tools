/**
 * Tests for Standardized Validation and Error Handling System
 */

import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { 
  validateContentType,
  validateParams,
  validateQueryParams, 
  validateRequestBody, 
  validateRequestSize 
} from '../enhanced-validation';
import { 
  ApiNotFoundError,
  ApiValidationError,
  asyncErrorHandler,
  standardizedErrorHandler} from '../standardized-error-handler';
import { chatRequestSchema, idParamSchema } from '../validation-schemas';

// Mock Express objects
const createMockRequest = (overrides: Partial<Request> = {}): Request => ({
  body: {},
  query: {},
  params: {},
  path: '/test',
  method: 'POST',
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
  get: jest.fn().mockReturnValue('application/json'),
  ...overrides,
} as any);

const createMockResponse = (): Response => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    headersSent: false,
  };
  return res as any;
};

const createMockNext = (): jest.MockedFunction<NextFunction> => jest.fn();

describe('Enhanced Validation System', () => {
  describe('validateRequestBody', () => {
    it('should validate valid request body', () => {
      const req = createMockRequest({
        body: {
          message: 'Hello world',
          model: 'gpt-4'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequestBody(chatRequestSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(); // No error
      expect(req.body.message).toBe('Hello world');
      expect(req.body.model).toBe('gpt-4');
    });

    it('should reject invalid request body', () => {
      const req = createMockRequest({
        body: {
          message: '', // Invalid - too short
          temperature: 5 // Invalid - too high
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequestBody(chatRequestSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiValidationError));
      const [error] = next.mock.calls[0] as unknown as [ApiValidationError];
      expect(error.message).toBe('Request body validation failed');
      expect(error.details).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'message' }),
        expect.objectContaining({ field: 'temperature' })
      ]));
    });

    it('should sanitize request data', () => {
      const req = createMockRequest({
        body: {
          message: '<script>alert("xss")</script>Hello',
          model: 'gpt-4'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequestBody(chatRequestSchema, { sanitize: true });
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body.message).not.toContain('<script>');
      expect(req.body.message).toContain('Hello');
    });
  });

  describe('validateQueryParams', () => {
    it('should validate and coerce query parameters', () => {
      const req = createMockRequest({
        query: {
          page: '1',
          limit: '20',
          active: 'true'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const querySchema = z.object({
        page: z.number().int().min(1),
        limit: z.number().int().min(1).max(100),
        active: z.boolean()
      });

      const middleware = validateQueryParams(querySchema, { coerceTypes: true });
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.query.page).toBe(1); // Coerced to number
      expect(req.query.limit).toBe(20); // Coerced to number
      expect(req.query.active).toBe(true); // Coerced to boolean
    });
  });

  describe('validateParams', () => {
    it('should validate path parameters', () => {
      const req = createMockRequest({
        params: { id: 'valid-id-123' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateParams(idParamSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.params.id).toBe('valid-id-123');
    });

    it('should reject invalid path parameters', () => {
      const req = createMockRequest({
        params: { id: 'invalid id with spaces!' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateParams(idParamSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiValidationError));
    });
  });

  describe('validateContentType', () => {
    it('should accept valid content type', () => {
      const req = createMockRequest();
      req.get = jest.fn().mockReturnValue('application/json; charset=utf-8');
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateContentType('application/json');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject invalid content type', () => {
      const req = createMockRequest();
      req.get = jest.fn().mockReturnValue('text/plain');
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateContentType('application/json');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiValidationError));
      const [error] = next.mock.calls[0] as unknown as [ApiValidationError];
      expect(error.message).toContain('Unsupported content type');
    });
  });

  describe('validateRequestSize', () => {
    it('should accept request under size limit', () => {
      const req = createMockRequest();
      req.get = jest.fn().mockReturnValue('1000'); // 1000 bytes
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequestSize(2000); // 2000 byte limit
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject request over size limit', () => {
      const req = createMockRequest();
      req.get = jest.fn().mockReturnValue('3000'); // 3000 bytes
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequestSize(2000); // 2000 byte limit
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiValidationError));
      const [error] = next.mock.calls[0] as unknown as [ApiValidationError];
      expect(error.message).toContain('Request too large');
    });
  });
});

describe('Standardized Error Handler', () => {
  describe('asyncErrorHandler', () => {
    it('should handle successful async functions', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const handler = asyncErrorHandler(async (req, res, _next) => {
        res.json({ success: true });
      });

      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch and pass errors to next', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const testError = new Error('Test error');
      const handler = asyncErrorHandler(async (req, res, next) => {
        throw testError;
      });

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(testError);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('API Error Classes', () => {
    it('should create properly typed validation errors', () => {
      const error = new ApiValidationError('Test validation error', { field: 'test' });
      
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Test validation error');
      expect(error.details).toEqual({ field: 'test' });
    });

    it('should create not found errors with resource names', () => {
      const error = new ApiNotFoundError('User');
      
      expect(error.name).toBe('NotFoundError');
      expect(error.message).toBe('User not found');
    });
  });

  describe('standardizedErrorHandler', () => {
    it('should handle validation errors properly', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const validationError = new ApiValidationError('Test error', { field: 'test' });
      
      // Mock sendError to avoid actual implementation
      jest.mock('@/utils/api-response', () => ({
        sendError: jest.fn()
      }));

      standardizedErrorHandler(validationError, req, res, next);

      // Should not call next since error is handled
      expect(next).not.toHaveBeenCalled();
    });

    it('should not process if response already sent', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.headersSent = true;
      const next = createMockNext();

      const error = new Error('Test error');
      
      standardizedErrorHandler(error, req, res, next);

      // Should pass to next if headers already sent
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete validation pipeline', () => {
    const req = createMockRequest({
      body: {
        message: 'Test message',
        temperature: 0.7
      },
      params: { id: 'test-id' },
      query: { page: '1' }
    });
    const res = createMockResponse();
    const next = createMockNext();

    // Simulate middleware chain
    const paramValidation = validateParams(idParamSchema);
    const queryValidation = validateQueryParams(z.object({ page: z.number() }), { coerceTypes: true });
    const bodyValidation = validateRequestBody(chatRequestSchema);

    paramValidation(req, res, (error) => {
      if (error) {return next(error);}
      
      queryValidation(req, res, (error) => {
        if (error) {return next(error);}
        
        bodyValidation(req, res, next);
      });
    });

    expect(next).toHaveBeenCalledWith(); // No errors
    expect(req.params.id).toBe('test-id');
    expect(req.query.page).toBe(1); // Coerced
    expect(req.body.message).toBe('Test message');
  });
});
