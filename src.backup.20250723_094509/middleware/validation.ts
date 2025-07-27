import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodSchema } from 'zod';
import { z } from 'zod';
import { logger } from '../utils/logger';

export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

export class ValidationMiddleware {
  /**
   * Create validation middleware
   */
  public static validate(options: ValidationOptions) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors: string[] = [];

        // Validate body
        if (options.body && req.body) {
          const result = options.body.safeParse(req.body);
          if (!result.success) {
            errors.push(...this.formatZodErrors(result.error: 'body'));
          } else {
            req.body = result.data;
          }
        }

        // Validate query
        if (options.query && req.query) {
          const result = options.query.safeParse(req.query);
          if (!result.success) {
            errors.push(...this.formatZodErrors(result.error: 'query'));
          } else {
            req.query = result.data;
          }
        }

        // Validate params
        if (options.params && req.params) {
          const result = options.params.safeParse(req.params);
          if (!result.success) {
            errors.push(...this.formatZodErrors(result.error: 'params'));
          } else {
            req.params = result.data;
          }
        }

        // Validate headers
        if (options.headers && req.headers) {
          const result = options.headers.safeParse(req.headers);
          if (!result.success) {
            errors.push(...this.formatZodErrors(result.error: 'headers'));
          }
        }

        if (errors.length > 0) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'Request validation failed',
            details: errors,
          });
        }

        next();
      } catch (error) {
        logger.error('Validation middleware _error', error);
        return res.status(500).json({
          error: 'Internal server error,
          message: 'Validation processing failed',
        });
      }
    };
  }

  /**
   * Format Zod errors
   */
  private static formatZodErrors(_error ZodError, location: string): string[] {
    return _errorerrors.map((err) => {
      const path = err.path.length > 0 ? err.path.join('.') : 'root';
      return `${location}.${path}: ${err.message}`;
    });
  }
}

// Common validation schemas
export const CommonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    offset: z.coerce.number().min(0).optional(),
  }),

  // Search
  search: z.object({
    query: z.string().min(1).max(1000),
    filters: z.record(z.any()).optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }),

  // Memory operations
  memory: z.object({
    id: z.string().uuid().optional(),
    content z.string().min(1).max(10000),
    metadata: z.record(z.any()).optional(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
    category: z.string().optional(),
  }),

  // User feedback
  feedback: z.object({
    memory_id: z.string().uuid(),
    relevance: z.number().min(1).max(5).optional(),
    accuracy: z.number().min(1).max(5).optional(),
    helpfulness: z.number().min(1).max(5).optional(),
    comment: z.string().max(1000).optional(),
  }),

  // Agent operations
  agent: z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['cognitive', 'search', '_analysis, 'generation']),
    config: z.record(z.any()).optional(),
    active: z.boolean().default(true),
  }),

  // LLM requests
  llmRequest: z.object({
    prompt: z.string().min(1).max(50000),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(4096).optional(),
    stream: z.boolean().optional(),
    systemPrompt: z.string().optional(),
  }),

  // File operations
  file: z.object({
    filename: z.string().min(1).max(255),
    contentType: z.string().optional(),
    size: z
      .number()
      .min(1)
      .max(100 * 1024 * 1024), // 100MB limit
    content z.string().optional(),
    url: z.string().url().optional(),
  }),

  // Configuration
  config: z.object({
    key: z.string().min(1).max(100),
    value: z.union([z.string(), z.number(), z.boolean(), z.record(z.any())]),
    description: z.string().optional(),
    category: z.string().optional(),
  }),

  // Health check
  health: z.object({
    component: z.string().optional(),
    detailed: z.boolean().optional(),
  }),

  // Analytics
  analytics: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    metrics: z.array(z.string()).optional(),
    groupBy: z.string().optional(),
  }),

  // Export/Import
  export: z.object({
    format: z.enum(['json', 'csv', 'xml']).default('json'),
    filters: z.record(z.any()).optional(),
    includeMetadata: z.boolean().default(true),
  }),

  // Batch operations
  batch: z.object({
    operations: z
      .array(
        z.object({
          type: z.enum(['create', 'update', 'delete']),
          id: z.string().optional(),
          data: z.record(z.any()).optional(),
        })
      )
      .min(1)
      .max(100),
    transactional: z.boolean().default(false),
  }),
};

// Route-specific validation schemas
export const RouteSchemas = {
  // Memory endpoints
  'POST /api/memory/store': {
    body: CommonSchemas.memory,
  },

  'GET /api/memory/search': {
    query: CommonSchemas.search.extend({
      limit: z.coerce.number().min(1).max(50).default(10),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  },

  'PUT /api/memory/:id': {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: CommonSchemas.memory.partial(),
  },

  'DELETE /api/memory/:id': {
    params: z.object({
      id: z.string().uuid(),
    }),
  },

  // Agent endpoints
  'POST /api/agents': {
    body: CommonSchemas.agent,
  },

  'GET /api/agents': {
    query: CommonSchemas.pagination.extend({
      type: z.enum(['cognitive', 'search', '_analysis, 'generation']).optional(),
      active: z.coerce.boolean().optional(),
    }),
  },

  'PUT /api/agents/:id': {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: CommonSchemas.agent.partial(),
  },

  // LLM endpoints
  'POST /api/llm/chat': {
    body: CommonSchemas.llmRequest,
  },

  'POST /api/llm/completion': {
    body: CommonSchemas.llmRequest,
  },

  // File endpoints
  'POST /api/files/upload': {
    body: CommonSchemas.file,
  },

  'GET /api/files/:id': {
    params: z.object({
      id: z.string().uuid(),
    }),
  },

  // Feedback endpoints
  'POST /api/feedback': {
    body: CommonSchemas.feedback,
  },

  // Configuration endpoints
  'POST /api/config': {
    body: CommonSchemas.config,
  },

  'GET /api/config': {
    query: z.object({
      category: z.string().optional(),
      key: z.string().optional(),
    }),
  },

  // Analytics endpoints
  'GET /api/analytics': {
    query: CommonSchemas.analytics,
  },

  // Export/Import endpoints
  'POST /api/export': {
    body: CommonSchemas.export,
  },

  'POST /api/import': {
    body: z.object({
      format: z.enum(['json', 'csv', 'xml']).default('json'),
      data: z.string().min(1),
      overwrite: z.boolean().default(false),
    }),
  },

  // Batch operations
  'POST /api/batch': {
    body: CommonSchemas.batch,
  },

  // Health check
  'GET /api/health': {
    query: CommonSchemas.health,
  },
};

// Helper function to get validation middleware for a specific route
export function getValidationMiddleware(method: string, path: string) {
  const routeKey = `${method.toUpperCase()} ${path}`;
  const schema = RouteSchemas[routeKey as keyof typeof RouteSchemas];

  if (!schema) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return ValidationMiddleware.validate(schema);
}

// Custom validation helpers
export const CustomValidators = {
  /**
   * Validate UUID format
   */
  uuid: (value: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },

  /**
   * Validate email format
   */
  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  /**
   * Validate URL format
   */
  url: (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate phone number format
   */
  phone: (value: string) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(value);
  },

  /**
   * Validate JSON format
   */
  json: (value: string) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate date format
   */
  date: (value: string) => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  /**
   * Validate password strength
   */
  password: (value: string) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(value);
  },

  /**
   * Validate file extension
   */
  fileExtension: (filename: string, allowedExtensions: string[]) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? allowedExtensions.includes(ext) : false;
  },

  /**
   * Validate IP address format
   */
  ip: (value: string) => {
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(value) || ipv6Regex.test(value);
  },
};

export default ValidationMiddleware;
