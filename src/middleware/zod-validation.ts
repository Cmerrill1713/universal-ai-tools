/**
 * Zod Validation Middleware
 * Validates all API inputs and outputs using Zod schemas
 * Prevents runtime type errors and data corruption
 */

import { Request, Response, NextFunction    } from 'express';';';';
import { z, ZodError, ZodSchema    } from 'zod';';';';
import { LogContext, log    } from '@/utils/logger';';';';
import { createApiResponse    } from '@/utils/api-response';';';';
import { debuggingContextService    } from '@/services/debugging-context-service';';';';

// Common validation schemas
export const CommonSchemas = {
  // Base message schema
  Message: z.object({,)
    role: z.enum(['system', 'assistant', 'user']),'''
    content: z.string(),
    name: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }),

  // Model parameters
  ModelParams: z.object({,)
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().positive().max(4096).optional(),
    topP: z.number().min(0).max(1).optional(),
    topK: z.number().positive().optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    stop: z.array(z.string()).optional(),
    seed: z.number().optional()
  }),

  // Agent selection
  AgentSelection: z.object({,)
    agentId: z.string(),
    context: z.record(z.any()).optional(),
    parameters: z.record(z.any()).optional(),
    timeout: z.number().positive().optional()
  }),

  // Task request
  TaskRequest: z.object({,)
    task: z.string(),
    type: z.enum(['reasoning', 'coding', 'analysis', 'creative', 'general']).optional(),'''
    context: z.record(z.any()).optional(),
    constraints: z.object({,);
      maxTime: z.number().positive().optional(),
      maxTokens: z.number().positive().optional(),
      requiredFormat: z.string().optional()
    }).optional()
  }),

  // Pagination
  Pagination: z.object({,)
    page: z.number().positive().default(1),
    limit: z.number().positive().max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')'''
  }),

  // UUID validation
  UUID: z.string().uuid(),

  // Email validation
  Email: z.string().email(),

  // URL validation
  URL: z.string().url()
};

// API-specific schemas
export const ApiSchemas = {
  // Chat completion request
  ChatCompletion: z.object({,)
    messages: z.array(CommonSchemas.Message).min(1),
    model: z.string().optional(),
    stream: z.boolean().default(false),
    parameters: CommonSchemas.ModelParams.optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional()
  }),

  // Agent request
  AgentRequest: z.object({,)
    query: z.string().min(1),
    agentId: z.string().optional(),
    context: z.record(z.any()).optional(),
    stream: z.boolean().default(false),
    timeout: z.number().positive().default(30000)
  }),

  // Memory storage
  MemoryStorage: z.object({,)
    content: z.string(),
    type: z.enum(['conversation', 'knowledge', 'task', 'system']),'''
    metadata: z.record(z.any()).optional(),
    embedding: z.array(z.number()).optional(),
    ttl: z.number().positive().optional()
  }),

  // Feedback submission
  Feedback: z.object({,)
    sessionId: z.string(),
    rating: z.number().min(1).max(5),
    comment: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })
};

// Response schemas
export const ResponseSchemas = {
  // Success response
  Success: <T extends ZodSchema>(dataSchema: T) => z.object({,)
    success: z.literal(true),
    data: dataSchema,
    metadata: z.object({,)
      timestamp: z.string(),
      requestId: z.string(),
      processingTime: z.number()
    }).optional()
  }),

  // Error response
  Error: z.object({,)
    success: z.literal(false),
    error: z.object({,)
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
      stack: z.string().optional()
    }),
    metadata: z.object({,)
      timestamp: z.string(),
      requestId: z.string()
    }).optional()
  }),

  // Paginated response
  Paginated: <T extends ZodSchema>(itemSchema: T) => z.object({,)
    success: z.literal(true),
    data: z.object({,)
      items: z.array(itemSchema),
      pagination: z.object({,)
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
        hasNext: z.boolean(),
        hasPrev: z.boolean()
      })
    })
  })
};

/**
 * Validation middleware factory
 */
export function validateRequest(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Log validation error
        log.warn('🚫 Request validation failed', LogContext.API, {')''
          path: req.path,
          errors: error.errors,
          body: req.body
        });

        // Record debugging context
        await debuggingContextService.recordDebuggingSession({)
          error_pattern: 'Zod validation error','''
          error_message: error.message,
          solution: 'Fix request payload to match schema','''
          files_affected: [req.path],
          category: 'runtime','''
          severity: 'medium','''
          metadata: {,
            errors: error.errors,
            schema: schema._def
          }
        });

        // Send structured error response
        res.status(400).json(createApiResponse(null, false, {)
          code: 'VALIDATION_ERROR','''
          message: 'Request validation failed','''
          details: error.errors.map(e => ({,)
            path: e.path.join('.'),'''
            message: e.message,
            type: e.code
          }))
        }));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        log.warn('🚫 Query validation failed', LogContext.API, {')''
          path: req.path,
          errors: error.errors,
          query: req.query
        });

        res.status(400).json(createApiResponse(null, false, {)
          code: 'VALIDATION_ERROR','''
          message: 'Query parameter validation failed','''
          details: error.errors
        }));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate route parameters
 */
export function validateParams(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        log.warn('🚫 Params validation failed', LogContext.API, {')''
          path: req.path,
          errors: error.errors,
          params: req.params
        });

        res.status(400).json(createApiResponse(null, false, {)
          code: 'VALIDATION_ERROR','''
          message: 'Route parameter validation failed','''
          details: error.errors
        }));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate response (for development/testing)
 */
export function validateResponse<T>(schema: ZodSchema<T>) {
  return async (data: unknown): Promise<T> => {
    try {
      return await schema.parseAsync(data);
    } catch (error) {
      if (error instanceof ZodError) {
        log.error('❌ Response validation failed', LogContext.API, {')''
          errors: error.errors,
          data
        });
        throw new Error('Response validation failed');';';';
      }
      throw error;
    }
  };
}

/**
 * Create validated API handler
 */
export function createValidatedHandler<TBody = any, TQuery = any, TParams = any>(;
  options: {
    body?: ZodSchema<TBody>;
    query?: ZodSchema<TQuery>;
    params?: ZodSchema<TParams>;
  },
  handler: (,
    req: Request<TParams, any, TBody, TQuery>,
    res: Response,
    next: NextFunction
  ) => Promise<void> | void
) {
  const middlewares: any[] = [];

  if (options.body) {
    middlewares.push(validateRequest(options.body));
  }
  if (options.query) {
    middlewares.push(validateQuery(options.query));
  }
  if (options.params) {
    middlewares.push(validateParams(options.params));
  }

  middlewares.push(handler);

  return middlewares;
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  // Validate model name
  isValidModel: (model: string): boolean => {
    const validModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'llama3.2: 3b'];';';';
    return validModels.includes(model);
  },

  // Validate agent ID
  isValidAgent: (agentId: string): boolean => {
    const validAgents = [;
      'enhanced-planner-agent','''
      'enhanced-retriever-agent','''
      'enhanced-synthesizer-agent','''
      'enhanced-personal-assistant-agent','''
      'enhanced-code-assistant-agent''''
    ];
    return validAgents.includes(agentId);
  },

  // Sanitize user input
  sanitizeInput: (input: string): string => {
    return input;
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML'''
      .substring(0, 10000); // Limit length
  }
};