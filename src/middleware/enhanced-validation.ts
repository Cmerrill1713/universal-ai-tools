/**
 * Enhanced Request Validation Middleware (Security Fixed)
 * Standardized validation across all API endpoints using Zod
 */

import type { NextFunction, Request, Response } from 'express';
import type { z, ZodSchema, ZodType } from 'zod';

import { log, LogContext } from '@/utils/logger';

import { ApiValidationError } from './standardized-error-handler';
import { sanitizeString } from './validation-schemas';

// Security: Define allowed keys for dynamic object access
const ALLOWED_REQUEST_KEYS = new Set([
  'id', 'name', 'email', 'password', 'content', 'message', 'data',
  'title', 'description', 'type', 'status', 'priority', 'tags',
  'metadata', 'settings', 'config', 'preferences', 'filters',
  'search', 'query', 'sort', 'limit', 'offset', 'page'
]);

const ALLOWED_QUERY_KEYS = new Set([
  'page', 'limit', 'offset', 'sort', 'order', 'search', 'filter',
  'q', 'type', 'status', 'start', 'end', 'id', 'name'
]);

/**
 * Safely set object property with validation
 */
function safeSetProperty(obj: any, key: string, value: any): void {
  // Prevent prototype pollution
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    return;
  }
  
  // Use Object.defineProperty for safer assignment
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}

/**
 * Safely get object property with validation
 */
function safeGetProperty(obj: any, key: string): any {
  // Prevent prototype pollution
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    return undefined;
  }
  
  // Use hasOwnProperty for safety
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return obj[key];
  }
  
  return undefined;
}

/**
 * Enhanced validation middleware with better error handling and sanitization
 */
export function validateRequestBody<T>(schema: ZodSchema<T>, options: {
  sanitize?: boolean;
  allowPartial?: boolean;
  stripUnknown?: boolean;
} = {}) {
  const { sanitize = true, allowPartial = false } = options;
  
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
 * Security: Use allowlist approach for object keys
 */
function sanitizeRequestData(data: any): any {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeRequestData);
  }
  
  if (data && typeof data === 'object') {
    const sanitized = Object.create(null); // Create object without prototype
    
    for (const [key, value] of Object.entries(data)) {
      // Security: Only allow specific keys to prevent prototype pollution
      if (!ALLOWED_REQUEST_KEYS.has(key)) {
        log.warn('Blocked potentially unsafe object key', LogContext.API, { key });
        continue;
      }
      
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        log.warn('Blocked prototype pollution attempt', LogContext.API, { key });
        continue;
      }
      
      // Skip null/undefined values
      if (value == null) {
        safeSetProperty(sanitized, key, value);
        continue;
      }
      
      safeSetProperty(sanitized, key, sanitizeRequestData(value));
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Coerce query parameter types (strings to numbers, booleans, etc.)
 * Security: Use allowlist approach for query keys
 */
function coerceQueryTypes(query: any): any {
  if (!query || typeof query !== 'object') {return query;}
  
  const coerced = Object.create(null); // Create object without prototype
  
  for (const [key, value] of Object.entries(query)) {
    // Security: Only allow specific query keys
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      log.warn('Blocked potentially unsafe query key', LogContext.API, { key });
      continue;
    }
    
    // Prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      log.warn('Blocked prototype pollution attempt in query', LogContext.API, { key });
      continue;
    }
    
    if (typeof value === 'string') {
      // Try to coerce common types
      if (value === 'true') {
        safeSetProperty(coerced, key, true);
      } else if (value === 'false') {
        safeSetProperty(coerced, key, false);
      } else if (value === 'null') {
        safeSetProperty(coerced, key, null);
      } else if (value === 'undefined') {
        safeSetProperty(coerced, key, undefined);
      } else if (/^\d+$/.test(value)) {
        safeSetProperty(coerced, key, parseInt(value, 10));
      } else if (/^\d*\.\d+$/.test(value)) {
        safeSetProperty(coerced, key, parseFloat(value));
      } else {
        safeSetProperty(coerced, key, value);
      }
    } else {
      safeSetProperty(coerced, key, value);
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
 * Security: Prevent prototype pollution
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (!current || typeof current !== 'object') {return undefined;}
    
    // Security: Check for prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    
    current = safeGetProperty(current, key);
  }
  
  return current;
}

/**
 * Set nested value in object using dot notation
 * Security: Prevent prototype pollution
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  
  // Security: Prevent prototype pollution
  if (lastKey === '__proto__' || lastKey === 'constructor' || lastKey === 'prototype') {
    return;
  }
  
  let current = obj;
  for (const key of keys) {
    // Security: Prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return;
    }
    
    const currentValue = safeGetProperty(current, key);
    if (!currentValue || typeof currentValue !== 'object') {
      safeSetProperty(current, key, Object.create(null));
    }
    current = safeGetProperty(current, key);
  }
  
  safeSetProperty(current, lastKey, value);
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
