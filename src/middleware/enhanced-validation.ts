/**
 * Enhanced Request Validation Middleware (Fixed)
 * Standardized validation across all API endpoints using Zod
 */

import type { NextFunction, Request, Response } from 'express';
import { z, ZodError, ZodSchema, ZodType } from 'zod';

import { ApiValidationError } from './standardized-error-handler';
import { sanitizeString, validateEmail, validateIPAddress } from './validation-schemas';
import { log, LogContext } from '@/utils/logger';

/**
 * Enhanced validation middleware with better error handling and sanitization
 */
export function validateRequestBody<T>(schema: ZodSchema<T>, options: {
  sanitize?: boolean;
  allowPartial?: boolean;
  stripUnknown?: boolean;
} = {}) {
  const { sanitize = true, allowPartial = false, stripUnknown = true } = options;
  
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let data = req.body;
      
      // Apply sanitization if enabled
      if (sanitize && data && typeof data === 'object') {
        data = sanitizeRequestData(data);
      }
      
      // Configure schema based on options
      let validationSchema: ZodType<any> = schema;
      if (allowPartial && 'partial' in schema) {
        validationSchema = (schema as any).partial();
      }
      
      const result = validationSchema.safeParse(data);
      
      if (!result.success) {
        const validationError = new ApiValidationError(
          'Request body validation failed',
          formatZodErrors(result.error.errors)
        );
        return next(validationError);
      }
      
      // Store validated data
      req.body = result.data;
      (req as any).validatedBody = result.data;
      
      log.debug('Request body validation successful', LogContext.API, {
        path: req.path,
        method: req.method,
        validatedFields: Object.keys(result.data as object || {}),
      });
      
      next();
    } catch (error) {
      log.error('Request validation middleware error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method,
      });
      next(new ApiValidationError('Validation system error'));
    }
  };
}

/**
 * Enhanced query parameter validation
 */
export function validateQueryParams<T>(schema: ZodSchema<T>, options: {
  sanitize?: boolean;
  coerceTypes?: boolean;
} = {}) {
  const { sanitize = true, coerceTypes = true } = options;
  
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let data = req.query;
      
      // Apply type coercion for query parameters
      if (coerceTypes) {
        data = coerceQueryTypes(data);
      }
      
      // Apply sanitization
      if (sanitize && data && typeof data === 'object') {
        data = sanitizeRequestData(data);
      }
      
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const validationError = new ApiValidationError(
          'Query parameter validation failed',
          formatZodErrors(result.error.errors)
        );
        return next(validationError);
      }
      
      req.query = result.data as any;
      (req as any).validatedQuery = result.data;
      
      log.debug('Query parameter validation successful', LogContext.API, {
        path: req.path,
        method: req.method,
        validatedParams: Object.keys(result.data as object || {}),
      });
      
      next();
    } catch (error) {
      log.error('Query validation middleware error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method,
      });
      next(new ApiValidationError('Query validation system error'));
    }
  };
}

/**
 * Enhanced path parameter validation
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);
      
      if (!result.success) {
        const validationError = new ApiValidationError(
          'Path parameter validation failed',
          formatZodErrors(result.error.errors)
        );
        return next(validationError);
      }
      
      req.params = result.data as any;
      (req as any).validatedParams = result.data;
      
      log.debug('Path parameter validation successful', LogContext.API, {
        path: req.path,
        method: req.method,
        validatedParams: Object.keys(result.data as object || {}),
      });
      
      next();
    } catch (error) {
      log.error('Params validation middleware error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method,
      });
      next(new ApiValidationError('Parameter validation system error'));
    }
  };
}

/**
 * Combined validation middleware for body, query, and params
 */
export function validateRequest<TBody, TQuery, TParams>(schemas: {
  body?: ZodSchema<TBody>;
  query?: ZodSchema<TQuery>;
  params?: ZodSchema<TParams>;
}, options: {
  sanitize?: boolean;
  allowPartialBody?: boolean;
  coerceQueryTypes?: boolean;
} = {}) {
  const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];
  
  if (schemas.params) {
    middlewares.push(validateParams(schemas.params));
  }
  if (schemas.query) {
    middlewares.push(validateQueryParams(schemas.query, options));
  }
  if (schemas.body) {
    middlewares.push(validateRequestBody(schemas.body, options));
  }
  
  return middlewares;
}

/**
 * Content-Type validation middleware
 */
export function validateContentType(...allowedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.get('Content-Type');
    const expectedTypes = allowedTypes.join(', ');
    
    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      const error = new ApiValidationError(
        'Unsupported content type. Expected one of: ' + expectedTypes,
        { received: contentType, expected: allowedTypes }
      );
      return next(error);
    }
    
    next();
  };
}

/**
 * Request size validation middleware
 */
export function validateRequestSize(maxSizeBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    
    if (contentLength > maxSizeBytes) {
      const error = new ApiValidationError(
        'Request too large. Maximum size: ' + maxSizeBytes + ' bytes',
        { received: contentLength, maximum: maxSizeBytes }
      );
      return next(error);
    }
    
    next();
  };
}

/**
 * Custom field validation
 */
export function validateCustomField<T>(
  fieldPath: string,
  validator: (value: any) => T | Promise<T>,
  options: { required?: boolean; errorMessage?: string } = {}
) {
  const { required = true, errorMessage = 'Invalid ' + fieldPath } = options;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    let value: any;
    try {
      value = getNestedValue(req.body, fieldPath);
      
      if (value === undefined && required) {
        return next(new ApiValidationError(fieldPath + ' is required'));
      }
      
      if (value !== undefined) {
        const validatedValue = await validator(value);
        setNestedValue(req.body, fieldPath, validatedValue);
      }
      
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : errorMessage;
      next(new ApiValidationError(message, { field: fieldPath, value }));
    }
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sanitize request data to prevent XSS and injection attacks
 */
function sanitizeRequestData(data: any): any {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeRequestData);
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip null/undefined values
      if (value == null) {
        sanitized[key] = value;
        continue;
      }
      
      sanitized[key] = sanitizeRequestData(value);
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Coerce query parameter types (strings to numbers, booleans, etc.)
 */
function coerceQueryTypes(query: any): any {
  if (!query || typeof query !== 'object') return query;
  
  const coerced: any = {};
  
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      // Try to coerce common types
      if (value === 'true') {
        coerced[key] = true;
      } else if (value === 'false') {
        coerced[key] = false;
      } else if (value === 'null') {
        coerced[key] = null;
      } else if (value === 'undefined') {
        coerced[key] = undefined;
      } else if (/^\d+$/.test(value)) {
        coerced[key] = parseInt(value, 10);
      } else if (/^\d*\.\d+$/.test(value)) {
        coerced[key] = parseFloat(value);
      } else {
        coerced[key] = value;
      }
    } else {
      coerced[key] = value;
    }
  }
  
  return coerced;
}

/**
 * Format Zod errors for better readability
 */
function formatZodErrors(errors: z.ZodIssue[]): Array<{
  field: string;
  message: string;
  code: string;
  received?: any;
  expected?: string;
}> {
  return errors.map(error => ({
    field: error.path.join('.') || 'root',
    message: error.message,
    code: error.code,
    received: (error as any).received,
    expected: getExpectedValue(error),
  }));
}

/**
 * Get expected value description from Zod error
 */
function getExpectedValue(error: z.ZodIssue): string | undefined {
  switch (error.code) {
    case 'invalid_type':
      return (error as any).expected;
    case 'invalid_string':
      return 'valid string';
    case 'invalid_enum_value':
      return 'one of: ' + ((error as any).options || []).join(', ');
    case 'too_small':
      return 'minimum ' + (error as any).minimum;
    case 'too_big':
      return 'maximum ' + (error as any).maximum;
    default:
      return undefined;
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested value in object using dot notation
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

// ============================================================================
// Common Validation Schemas Exports (for convenience)
// ============================================================================

export * from './validation-schemas';

export default {
  validateRequestBody,
  validateQueryParams,
  validateParams,
  validateRequest,
  validateContentType,
  validateRequestSize,
  validateCustomField
};
