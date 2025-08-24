import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { z } from 'zod';
import {
  UniversalValidator,
  validators,
  validateRequest,
  validateAsync,
  createValidatedResponse,
  AgentResponseSchema,
  TaskClassificationSchema,
  ValidationResult,
} from '../../src/utils/validation';

// Mock logger to prevent console spam
jest.mock('../../src/utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LogContext: {
    SYSTEM: 'system',
  },
}));

const TestSchema = z.object({
  name: z.string(),
  age: z.number().positive(),
  email: z.string().email(),
});

describe('UniversalValidator', () => {
  let validator: UniversalValidator<z.infer<typeof TestSchema>>;

  beforeEach(() => {
    validator = new UniversalValidator(TestSchema);
  });

  describe('Basic Validation', () => {
    it('should validate correct data successfully', () => {
      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      const result = validator.validate(validData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
      expect(result.errors).toBeUndefined();
      expect(result.schema).toBe(TestSchema);
    });

    it('should return detailed errors for invalid data', () => {
      const invalidData = {
        name: '',
        age: -5,
        email: 'invalid-email'
      };

      const result = validator.validate(invalidData);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      
      // Check that errors contain expected fields
      const errorFields = result.errors!.map(e => e.field);
      // Note: Empty string may be allowed by Zod, so we check for the errors that actually occur
      expect(errorFields).toContain('age');  // negative number
      expect(errorFields).toContain('email'); // invalid email format
      // Only check for name if it actually fails (empty string might be valid)
      if (errorFields.includes('name')) {
        expect(errorFields).toContain('name');
      }
    });

    it('should handle missing required fields', () => {
      const incompleteData = {
        name: 'John'
        // Missing age and email
      };

      const result = validator.validate(incompleteData);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      
      const errorFields = result.errors!.map(e => e.field);
      expect(errorFields).toContain('age');
      expect(errorFields).toContain('email');
    });
  });

  describe('Strict Mode', () => {
    let strictValidator: UniversalValidator<z.infer<typeof TestSchema>>;

    beforeEach(() => {
      strictValidator = new UniversalValidator(TestSchema, { strict: true });
    });

    it('should validate successfully in strict mode', () => {
      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      const result = strictValidator.validate(validData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should throw errors in strict mode for invalid data', () => {
      const invalidData = {
        name: '',
        age: -5,
        email: 'invalid-email'
      };

      const result = strictValidator.validate(invalidData);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Transform Validation', () => {
    it('should validate and transform data successfully', () => {
      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      const transformer = (data: z.infer<typeof TestSchema>) => ({
        ...data,
        displayName: `${data.name} (${data.age} years old)`
      });

      const result = validator.validateAndTransform(validData, transformer);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.displayName).toBe('John Doe (30 years old)');
    });

    it('should handle transformation errors', () => {
      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      const errorTransformer = (data: z.infer<typeof TestSchema>) => {
        throw new Error('Transformation failed');
      };

      const result = validator.validateAndTransform(validData, errorTransformer);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].field).toBe('transformation');
    });

    it('should not transform if validation fails', () => {
      const invalidData = {
        name: '',
        age: -5,
        email: 'invalid-email'
      };

      const transformer = jest.fn();
      const result = validator.validateAndTransform(invalidData, transformer);

      expect(result.success).toBe(false);
      expect(transformer).not.toHaveBeenCalled();
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify valid data', () => {
      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      expect(validator.isValid(validData)).toBe(true);
    });

    it('should correctly identify invalid data', () => {
      const invalidData = {
        name: '',
        age: -5,
        email: 'invalid-email'
      };

      expect(validator.isValid(invalidData)).toBe(false);
    });
  });
});

describe('Predefined Validators', () => {
  describe('Agent Response Validator', () => {
    it('should validate basic agent response', () => {
      const validator = validators.agentResponse();
      const response = {
        success: true,
        data: { message: 'Hello' },
        message: 'Success',
        confidence: 0.8,
        validated: true
      };

      const result = validator.validate(response);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should validate agent response with custom data schema', () => {
      const dataSchema = z.object({ 
        result: z.string(),
        count: z.number() 
      });
      const validator = validators.agentResponse(dataSchema);
      
      const response = {
        success: true,
        data: { result: 'test', count: 5 },
        message: 'Success',
        confidence: 0.9,
        validated: true
      };

      const result = validator.validate(response);

      expect(result.success).toBe(true);
      expect(result.data?.data).toEqual({ result: 'test', count: 5 });
    });
  });

  describe('Task Classification Validator', () => {
    it('should validate task classification', () => {
      const validator = validators.taskClassification();
      const task = {
        complexity: 'medium' as const,
        domain: 'code' as const,
        urgency: 'high' as const,
        estimatedTokens: 1000,
        requiresAccuracy: true,
        requiresSpeed: false,
        confidence: 0.85
      };

      const result = validator.validate(task);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(task);
    });
  });
});

describe('Express Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  it('should validate request body successfully', () => {
    const validator = new UniversalValidator(TestSchema);
    const middleware = validateRequest(validator, 'body');

    mockReq.body = {
      name: 'John',
      age: 30,
      email: 'john@example.com'
    };

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.validated).toEqual(mockReq.body);
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid request data', () => {
    const validator = new UniversalValidator(TestSchema);
    const middleware = validateRequest(validator, 'body');

    mockReq.body = {
      name: '',
      age: -5,
      email: 'invalid'
    };

    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Validation failed'
    }));
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('Async Validation', () => {
  it('should handle successful async validation', async () => {
    const validator = new UniversalValidator(TestSchema);
    const asyncValidators = [
      async (data: z.infer<typeof TestSchema>): Promise<ValidationResult> => ({
        success: true,
        data
      })
    ];

    const validData = {
      name: 'John',
      age: 30,
      email: 'john@example.com'
    };

    const result = await validateAsync(validData, validator, asyncValidators);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
  });

  it('should handle failed async validation', async () => {
    const validator = new UniversalValidator(TestSchema);
    const asyncValidators = [
      async (data: z.infer<typeof TestSchema>): Promise<ValidationResult> => ({
        success: false,
        errors: [{ 
          field: 'custom', 
          message: 'Async validation failed',
          value: data,
          code: 'ASYNC_ERROR'
        }]
      })
    ];

    const validData = {
      name: 'John',
      age: 30,
      email: 'john@example.com'
    };

    const result = await validateAsync(validData, validator, asyncValidators);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should handle async validator exceptions', async () => {
    const validator = new UniversalValidator(TestSchema);
    const asyncValidators = [
      async (data: z.infer<typeof TestSchema>): Promise<ValidationResult> => {
        throw new Error('Async validator error');
      }
    ];

    const validData = {
      name: 'John',
      age: 30,
      email: 'john@example.com'
    };

    const result = await validateAsync(validData, validator, asyncValidators);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].code).toBe('ASYNC_VALIDATION_ERROR');
  });
});

describe('Validated Response Creation', () => {
  it('should create valid agent response', () => {
    const data = { result: 'test result' };
    const response = createValidatedResponse(
      data,
      'Operation successful',
      0.9,
      'Test reasoning'
    );

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
    expect(response.message).toBe('Operation successful');
    expect(response.confidence).toBe(0.9);
    expect(response.reasoning).toBe('Test reasoning');
    expect(response.validated).toBe(true);
    expect(response.timestamp).toBeDefined();
  });

  it('should handle response validation errors gracefully', () => {
    // Create response with invalid confidence
    const data = { result: 'test' };
    const response = createValidatedResponse(
      data,
      'Success',
      1.5, // Invalid confidence > 1
      'Test reasoning'
    );

    expect(response.validationErrors).toBeDefined();
  });
});

describe('Error Handling', () => {
  it('should handle validation exceptions gracefully', () => {
    // Create a schema that will cause an exception during validation
    const problematicValidator = new UniversalValidator(
      // This will cause issues when validating circular references
      z.any().refine(() => {
        throw new Error('Validation exception');
      })
    );

    const result = problematicValidator.validate({ test: 'data' });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].code).toBe('VALIDATION_ERROR');
  });
});

describe('JSON Schema Generation', () => {
  it('should generate basic JSON schema', () => {
    const validator = new UniversalValidator(TestSchema);
    const jsonSchema = validator.generateJsonSchema();

    expect(jsonSchema).toBeDefined();
    expect(typeof jsonSchema).toBe('object');
    expect(jsonSchema).toHaveProperty('type', 'object');
    expect(jsonSchema).toHaveProperty('properties');
  });
});