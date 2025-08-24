/**
 * Validation Schemas Tests
 * Test suite for Zod validation schemas and middleware
 */

import type { Request, Response } from 'express';

import {
  agentRequestSchema,
  chatRequestSchema,
  flashAttentionConfigSchema,
  flashAttentionOptimizeSchema,
  sanitizeString,
  validateEmail,
  validateIPAddress,
  validateQueryParams,
  validateRequestBody,
} from '../validation-schemas';

describe('Validation Schemas', () => {
  describe('FlashAttention Optimization Schema', () => {
    it('should validate correct FlashAttention request', () => {
      const validData = {
        modelId: 'test-model',
        providerId: 'test-provider',
        inputTokens: [1, 2, 3, 4, 5],
        sequenceLength: 128,
        batchSize: 1,
        useCache: true,
        optimizationLevel: 'medium',
      };

      const result = flashAttentionOptimizeSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should apply default values', () => {
      const minimalData = {
        modelId: 'test-model',
        providerId: 'test-provider',
        inputTokens: [1, 2, 3],
        sequenceLength: 64,
      };

      const result = flashAttentionOptimizeSchema.parse(minimalData);
      expect(result.batchSize).toBe(1);
      expect(result.useCache).toBe(true);
      expect(result.optimizationLevel).toBe('medium');
    });

    it('should reject invalid model IDs', () => {
      const invalidData = {
        modelId: 'invalid@model!',
        providerId: 'test-provider',
        inputTokens: [1, 2, 3],
        sequenceLength: 64,
      };

      expect(() => flashAttentionOptimizeSchema.parse(invalidData))
        .toThrow();
    });

    it('should reject empty input tokens', () => {
      const invalidData = {
        modelId: 'test-model',
        providerId: 'test-provider',
        inputTokens: [],
        sequenceLength: 64,
      };

      expect(() => flashAttentionOptimizeSchema.parse(invalidData))
        .toThrow();
    });

    it('should reject sequence length out of bounds', () => {
      const invalidData = {
        modelId: 'test-model',
        providerId: 'test-provider',
        inputTokens: [1, 2, 3],
        sequenceLength: 50000, // Too large
      };

      expect(() => flashAttentionOptimizeSchema.parse(invalidData))
        .toThrow();
    });

    it('should reject invalid optimization levels', () => {
      const invalidData = {
        modelId: 'test-model',
        providerId: 'test-provider',
        inputTokens: [1, 2, 3],
        sequenceLength: 64,
        optimizationLevel: 'invalid-level',
      };

      expect(() => flashAttentionOptimizeSchema.parse(invalidData))
        .toThrow();
    });

    it('should reject too many input tokens', () => {
      const invalidData = {
        modelId: 'test-model',
        providerId: 'test-provider',
        inputTokens: Array.from({ length: 20000 }, (_, i) => i),
        sequenceLength: 64,
      };

      expect(() => flashAttentionOptimizeSchema.parse(invalidData))
        .toThrow();
    });

    it('should reject negative token values', () => {
      const invalidData = {
        modelId: 'test-model',
        providerId: 'test-provider',
        inputTokens: [1, -2, 3],
        sequenceLength: 64,
      };

      expect(() => flashAttentionOptimizeSchema.parse(invalidData))
        .toThrow();
    });
  });

  describe('FlashAttention Config Schema', () => {
    it('should validate complete config', () => {
      const validConfig = {
        enableGPU: true,
        enableCPU: false,
        batchSize: 4,
        blockSize: 128,
        enableMemoryOptimization: true,
        enableKernelFusion: false,
        fallbackToStandard: true,
        maxMemoryMB: 8192,
      };

      const result = flashAttentionConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should validate partial config', () => {
      const partialConfig = {
        enableGPU: false,
        batchSize: 2,
      };

      const result = flashAttentionConfigSchema.parse(partialConfig);
      expect(result.enableGPU).toBe(false);
      expect(result.batchSize).toBe(2);
    });

    it('should reject invalid batch size', () => {
      const invalidConfig = {
        batchSize: -1,
      };

      expect(() => flashAttentionConfigSchema.parse(invalidConfig))
        .toThrow();
    });

    it('should reject block size out of bounds', () => {
      const invalidConfig = {
        blockSize: 1000,
      };

      expect(() => flashAttentionConfigSchema.parse(invalidConfig))
        .toThrow();
    });
  });

  describe('Chat Request Schema', () => {
    it('should validate basic chat request', () => {
      const validRequest = {
        message: 'Hello, world!',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        stream: false,
      };

      const result = chatRequestSchema.parse(validRequest);
      expect(result).toEqual(validRequest);
    });

    it('should apply default stream value', () => {
      const minimalRequest = {
        message: 'Hello!',
      };

      const result = chatRequestSchema.parse(minimalRequest);
      expect(result.stream).toBe(false);
    });

    it('should reject empty messages', () => {
      const invalidRequest = {
        message: '',
      };

      expect(() => chatRequestSchema.parse(invalidRequest))
        .toThrow();
    });

    it('should reject very long messages', () => {
      const invalidRequest = {
        message: 'a'.repeat(60000),
      };

      expect(() => chatRequestSchema.parse(invalidRequest))
        .toThrow();
    });

    it('should reject invalid temperature values', () => {
      const invalidRequest = {
        message: 'Hello!',
        temperature: 5.0, // Too high
      };

      expect(() => chatRequestSchema.parse(invalidRequest))
        .toThrow();
    });
  });

  describe('Agent Request Schema', () => {
    it('should validate agent request', () => {
      const validRequest = {
        agentId: 'test-agent',
        instruction: 'Please help me with this task',
        context: { key: 'value' },
        priority: 'high',
        timeout: 30000,
      };

      const result = agentRequestSchema.parse(validRequest);
      expect(result).toEqual(validRequest);
    });

    it('should apply default priority', () => {
      const minimalRequest = {
        agentId: 'test-agent',
        instruction: 'Help me',
      };

      const result = agentRequestSchema.parse(minimalRequest);
      expect(result.priority).toBe('normal');
    });

    it('should reject invalid priority levels', () => {
      const invalidRequest = {
        agentId: 'test-agent',
        instruction: 'Help me',
        priority: 'extreme',
      };

      expect(() => agentRequestSchema.parse(invalidRequest))
        .toThrow();
    });

    it('should reject timeout out of bounds', () => {
      const invalidRequest = {
        agentId: 'test-agent',
        instruction: 'Help me',
        timeout: 500000, // Too long
      };

      expect(() => agentRequestSchema.parse(invalidRequest))
        .toThrow();
    });
  });

  describe('Validation Middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: jest.Mock;

    beforeEach(() => {
      mockRequest = {};
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      nextFunction = jest.fn();
    });

    describe('validateRequestBody', () => {
      it('should validate and pass valid data', () => {
        const middleware = validateRequestBody(chatRequestSchema);
        
        mockRequest.body = {
          message: 'Hello, world!',
        };

        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
        expect((mockRequest as any).validatedData).toBeDefined();
        expect((mockRequest as any).validatedData.message).toBe('Hello, world!');
        expect((mockRequest as any).validatedData.stream).toBe(false); // Default value
      });

      it('should reject invalid data with detailed errors', () => {
        const middleware = validateRequestBody(chatRequestSchema);
        
        mockRequest.body = {
          message: '', // Invalid - empty string
          temperature: 5.0, // Invalid - too high
        };

        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: 'VALIDATION_ERROR',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'message',
                message: expect.any(String),
              }),
              expect.objectContaining({
                field: 'temperature',
                message: expect.any(String),
              }),
            ]),
          })
        );
      });

      it('should handle schema parsing errors gracefully', () => {
        const middleware = validateRequestBody(chatRequestSchema);
        
        // Trigger an internal error by providing invalid schema
        mockRequest.body = undefined;

        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(400);
      });
    });

    describe('validateQueryParams', () => {
      it('should validate query parameters', () => {
        const middleware = validateQueryParams(flashAttentionConfigSchema);
        
        mockRequest.query = {
          enableGPU: 'true',
          batchSize: '2',
        };

        // Call the middleware function
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        // Verify the middleware called next and added validatedQuery
        expect(nextFunction).toHaveBeenCalled();
        expect((mockRequest as any).validatedQuery).toBeDefined();
        expect((mockRequest as any).validatedQuery.enableGPU).toBe(true);
        expect((mockRequest as any).validatedQuery.batchSize).toBe(2);
      });

      it('should reject invalid query parameters', () => {
        const middleware = validateQueryParams(flashAttentionConfigSchema);
        
        mockRequest.query = {
          batchSize: 'invalid-number',
        };

        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(400);
      });
    });
  });

  describe('Security Validation Functions', () => {
    describe('sanitizeString', () => {
      it('should remove HTML tags', () => {
        const input = '<script>alert("xss")</script>Hello';
        const result = sanitizeString(input);
        expect(result).toBe('scriptalert("xss")/scriptHello');
      });

      it('should remove javascript: protocols', () => {
        const input = 'javascript:alert("xss")';
        const result = sanitizeString(input);
        expect(result).toBe('alert("xss")');
      });

      it('should remove data: protocols', () => {
        const input = 'data:text/html,<script>alert("xss")</script>';
        const result = sanitizeString(input);
        expect(result).toBe('text/html,scriptalert("xss")/script');
      });

      it('should trim whitespace', () => {
        const input = '  hello world  ';
        const result = sanitizeString(input);
        expect(result).toBe('hello world');
      });

      it('should respect max length', () => {
        const input = 'a'.repeat(1000);
        const result = sanitizeString(input, 100);
        expect(result.length).toBe(100);
      });
    });

    describe('validateIPAddress', () => {
      it('should validate IPv4 addresses', () => {
        expect(validateIPAddress('192.168.1.1')).toBe(true);
        expect(validateIPAddress('10.0.0.1')).toBe(true);
        expect(validateIPAddress('127.0.0.1')).toBe(true);
      });

      it('should reject invalid IPv4 addresses', () => {
        expect(validateIPAddress('256.1.1.1')).toBe(false);
        expect(validateIPAddress('192.168.1')).toBe(false);
        expect(validateIPAddress('192.168.1.1.1')).toBe(false);
      });

      it('should validate IPv6 addresses', () => {
        expect(validateIPAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
      });

      it('should reject invalid IPv6 addresses', () => {
        expect(validateIPAddress('2001:0db8:85a3::8a2e:0370:7334:extra')).toBe(false);
      });

      it('should reject non-IP strings', () => {
        expect(validateIPAddress('not-an-ip')).toBe(false);
        expect(validateIPAddress('192.168.1.com')).toBe(false);
      });
    });

    describe('validateEmail', () => {
      it('should validate correct email addresses', () => {
        expect(validateEmail('test@example.com')).toBe(true);
        expect(validateEmail('user.name@domain.co.uk')).toBe(true);
        expect(validateEmail('test+tag@example.org')).toBe(true);
      });

      it('should reject invalid email addresses', () => {
        expect(validateEmail('invalid-email')).toBe(false);
        expect(validateEmail('@example.com')).toBe(false);
        expect(validateEmail('test@')).toBe(false);
        expect(validateEmail('test.example.com')).toBe(false);
      });

      it('should reject very long email addresses', () => {
        const longEmail = 'a'.repeat(250) + '@example.com';
        expect(validateEmail(longEmail)).toBe(false);
      });
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle null and undefined inputs', () => {
      expect(() => flashAttentionOptimizeSchema.parse(null))
        .toThrow();
      expect(() => flashAttentionOptimizeSchema.parse(undefined))
        .toThrow();
    });

    it('should handle deeply nested objects', () => {
      const deepObject = {
        agentId: 'test',
        instruction: 'help',
        context: {
          level1: {
            level2: {
              level3: {
                value: 'deep',
              },
            },
          },
        },
      };

      const result = agentRequestSchema.parse(deepObject);
      expect(result.context?.level1?.level2?.level3?.value).toBe('deep');
    });

    it('should reject malicious input attempts', () => {
      const maliciousData = {
        modelId: '../../../etc/passwd',
        providerId: 'test',
        inputTokens: [1, 2, 3],
        sequenceLength: 64,
      };

      expect(() => flashAttentionOptimizeSchema.parse(maliciousData))
        .toThrow();
    });

    it('should handle large arrays efficiently', () => {
      const largeButValidArray = Array.from({ length: 5000 }, (_, i) => i);
      
      const data = {
        modelId: 'test-model',
        providerId: 'test-provider',
        inputTokens: largeButValidArray,
        sequenceLength: 5000,
      };

      const result = flashAttentionOptimizeSchema.parse(data);
      expect(result.inputTokens.length).toBe(5000);
    });
  });
});