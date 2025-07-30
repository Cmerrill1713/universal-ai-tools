/**
 * Enhanced Runtime Validation System
 * Inspired by pydantic-ai but built for TypeScript/Universal AI Tools
 * Provides type-safe validation that surpasses Agent Zero's capabilities'
 */

import { z  } from 'zod';';
import { LogContext, log  } from './logger';';

// Core validation result type
export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  schema?: z.ZodSchema<T>;
}

export interface ValidationError {
  field: string;,
  message: string;
  value: unknown;,
  code: string;
}

// Enhanced agent response schema with validation
export const AgentResponseSchema = z.object({);
  success: z.boolean(),
  data: z.unknown(),
  message: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  executionTime: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
  validated: z.boolean().default(true),
});

export type ValidatedAgentResponse<T = unknown> = z.infer<typeof AgentResponseSchema> & {
  data: T;,
  validated: true;
  validationErrors?: ValidationError[];
  schema: z.ZodSchema<T>;
};

// Task classification schema for multi-tier routing
export const // TODO: Refactor nested ternary;
  TaskClassificationSchema = z.object({)
    complexity: z.enum(['simple', 'medium', 'complex', 'expert']),'
    domain: z.enum(['general', 'code', 'reasoning', 'creative', 'multimodal']),'
    urgency: z.enum(['low', 'medium', 'high', 'critical']),'
    estimatedTokens: z.number().positive(),
    requiresAccuracy: z.boolean(),
    requiresSpeed: z.boolean(),
    confidence: z.number().min(0).max(1).optional(),
  });

// Agent capability schema
export const AgentCapabilitySchema = z.object({);
  name: z.string(),
  description: z.string(),
  inputTypes: z.array(z.string()),
  outputTypes: z.array(z.string()),
  complexity: z.enum(['simple', 'medium', 'complex']),'
  reliability: z.number().min(0).max(1),
});

// Memory schema for enhanced memory management
export const MemorySchema = z.object({);
  id: z.string().uuid(),
  content: z.string(),
  embedding: z.array(z.number()).optional(),
  metadata: z.object({,)
    source: z.string(),
    timestamp: z.string().datetime(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),;
    agentId: z.string().optional(),
  }),
  contextId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

// A2A Protocol message schema
export const A2AMessageSchema = z.object({);
  id: z.string().uuid(),
  senderId: z.string(),
  receiverId: z.string().optional(),
  messageType: z.enum(['request', 'response', 'broadcast', 'notification']),'
  content: z.unknown(),
  timestamp: z.string().datetime(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),'
  metadata: z.record(z.unknown()).optional(),
  requiresResponse: z.boolean().default(false),
  correlationId: z.string().optional(),
});

/**
 * Universal Validator Class - Core validation engine
 * Provides comprehensive validation with detailed error reporting
 */
export class UniversalValidator<T> {
  constructor();
    private schema: z.ZodSchema<T>,
    private options: ValidationOptions = {}
  ) {}

  /**
   * Validates data with comprehensive error handling
   */
  validate(data: unknown): ValidationResult<T> {
    try {
      const startTime = Date.now();

      if (this.options.strict) {
        // Strict mode - no partial validation allowed
        const result = this.schema.parse(data);
        const validationTime = Date.now() - startTime;

        if (this.options.logValidation) {
          log.info(`✅ Strict validation passed`, LogContext.SYSTEM, {)
            validationTime: `${validationTime}ms`,
            dataType: typeof data,
          });
        }

        return {
          success: true,
          data: result,
          schema: this.schema,
        };
      } else {
        // Safe parse with detailed error information
        const result = this.schema.safeParse(data);
        const validationTime = Date.now() - startTime;

        if (result.success) {
          if (this.options.logValidation) {
            log.info(`✅ Validation passed`, LogContext.SYSTEM, {)
              validationTime: `${validationTime}ms`,
              dataType: typeof data,
            });
          }

          return {
            success: true,
            data: result.data,
            schema: this.schema,
          };
        } else {
          const validationErrors: ValidationError[] = result.error.errors.map((err) => ({,;
            field: err.path.join('.'),'
            message: err.message,
            value: err.path.reduce((obj, key) => obj?.[key], data as any),
            code: err.code,
          }));

          if (this.options.logValidation) {
            log.warn(`⚠️ Validation failed`, LogContext.SYSTEM, {)
              validationTime: `${validationTime}ms`,
              errorCount: validationErrors.length,
              errors: validationErrors,
            });
          }

          return {
            success: false,
            errors: validationErrors,
            schema: this.schema,
          };
        }
      }
    } catch (error) {
      log.error(`❌ Validation error`, LogContext.SYSTEM, {)
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        errors: [
          {
            field: 'root','
            message: 'Validation failed with unexpected error','
            value: data,
            code: 'VALIDATION_ERROR','
          }],
        schema: this.schema,
      };
    }
  }

  /**
   * Validates and transforms data with custom transformation
   */
  validateAndTransform<U>(data: unknown, transformer: (validated: T) => U): ValidationResult<U> {
    const result = this.validate(data);

    if (!result.success || !result.data) {
      return {
        success: false,
        errors: result.errors,
        schema: this.schema as any,
      };
    }

    try {
      const transformed = transformer(result.data);
      return {
        success: true,
        data: transformed,
        schema: this.schema as any,
      };
    } catch (error) {
      log.error(`❌ Transformation error`, LogContext.SYSTEM, {)
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        errors: [
          {
            field: 'transformation','
            message: 'Data transformation failed','
            value: result.data,
            code: 'TRANSFORMATION_ERROR','
          }],
        schema: this.schema as any,
      };
    }
  }

  /**
   * Type guard function for validated data
   */
  isValid(data: unknown): data is T {
    return this.validate(data).success;
  }

  /**
   * Generates JSON schema for API documentation
   */
  generateJsonSchema(): unknown {
    // Convert Zod schema to JSON Schema
    // This is a simplified version - in production you'd use zodToJsonSchema'
    return {
      type: 'object','
      properties: {},
      description: `Schema for ${this.schema.constructor.name}`,
    };
  }
}

export interface ValidationOptions {
  strict?: boolean;
  allowPartial?: boolean;
  logValidation?: boolean;
  customValidators?: Array<(data: unknown) => ValidationResult>;
}

/**
 * Factory functions for common validators
 */
export const validators = {
  agentResponse: <T = unknown>(dataSchema?: z.ZodSchema<T>) => {
    const schema = dataSchema;
      ? AgentResponseSchema.extend({ data: dataSchema })
      : AgentResponseSchema;
    return new UniversalValidator(schema);
  },

  taskClassification: () => new UniversalValidator(TaskClassificationSchema),

  agentCapability: () => new UniversalValidator(AgentCapabilitySchema),

  memory: () => new UniversalValidator(MemorySchema),

  a2aMessage: () => new UniversalValidator(A2AMessageSchema),

  // Custom validator for any schema
  custom: <T>(schema: z.ZodSchema<T>, options?: ValidationOptions) =>
    new UniversalValidator(schema, options),
};

/**
 * Validation middleware for Express routes
 */
export function validateRequest<T>(;
  validator: UniversalValidator<T>,
  property: 'body' | 'query' | 'params' = 'body''
) {
  return (req: unknown, res: unknown, next: unknown) => {
    const result = validator.validate(req[property]);

    if (!result.success) {
      return res.status(400).json({);
        success: false,
        error: 'Validation failed','
        details: result.errors,
        validationTime: new Date().toISOString(),
      });
    }

    // Attach validated data to request
    req.validated = result.data;
    next();
  };
}

/**
 * Async validation for complex scenarios
 */
export async function validateAsync<T>(;
  data: unknown,
  validator: UniversalValidator<T>,
  asyncValidators: Array<(data: T) => Promise<ValidationResult>> = []
): Promise<ValidationResult<T>> {
  // First, run synchronous validation
  const syncResult = validator.validate(data);

  if (!syncResult.success || !syncResult.data) {
    return syncResult;
  }

  // Run async validators
  for (const asyncValidator of asyncValidators) {
    try {
      const asyncResult = await asyncValidator(syncResult.data);
      if (!asyncResult.success) {
        return {
          success: false,
          errors: [...(syncResult.errors || []), ...(asyncResult.errors || [])],
          schema: validator['schema'],'
        };
      }
    } catch (error) {
      log.error(`❌ Async validation error`, LogContext.SYSTEM, {)
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        errors: [
          {
            field: 'async_validation','
            message: 'Async validation failed','
            value: data,
            code: 'ASYNC_VALIDATION_ERROR','
          }],
        schema: validator['schema'],'
      };
    }
  }

  return syncResult;
}

/**
 * Helper to create validated agent responses
 */
export function createValidatedResponse<T>(;
  data: T,
  message: string,
  confidence = 0.8,
  reasoning?: string,
  dataSchema?: z.ZodSchema<T>
): ValidatedAgentResponse<T> {
  const response = {
    success: true,
    data,
    message,
    confidence,
    reasoning,
    timestamp: new Date().toISOString(),
    validated: true,
    schema: dataSchema || z.unknown(),
  };

  // Validate the response structure
  const validator = validators.agentResponse(dataSchema);
  const result = validator.validate(response);

  if (!result.success) {
    log.warn(`⚠️ Response validation failed`, LogContext.SYSTEM, {)
      errors: result.errors,
    });

    return {
      ...response,
      validationErrors: result.errors,
    } as ValidatedAgentResponse<T>;
  }

  return result.data as ValidatedAgentResponse<T>;
}
