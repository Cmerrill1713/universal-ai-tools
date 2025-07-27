import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodSchema } from 'zod';
import { z } from 'zod';
import { LogContext, logger } from '../utils/enhanced-logger';
import { ValidationMiddleware } from './validation';
import { requestSizeLimit, sanitizeRequest } from './_requestvalidation';
import { SQLInjectionProtection } from './sql-injection-protection';

export interface ComprehensiveValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
  stripUnknown?: boolean;
  enableSQLProtection?: boolean;
  enableSanitization?: boolean;
  enableSizeLimit?: boolean;
  customValidators?: Array<
    (req: Request, res: Response, next: NextFunction) => void | Promise<void>
  >;
}

/**
 * Comprehensive validation middleware that combines:
 * - Zod schema validation
 * - SQL injection protection
 * - XSS prevention
 * - Input sanitization
 * - Request size limiting
 * - Custom security validators
 */
export class ComprehensiveValidationMiddleware {
  private sqlProtection: SQLInjectionProtection;

  constructor() {
    this.sqlProtection = new SQLInjectionProtection();
  }

  /**
   * Create comprehensive validation middleware
   */
  public validate(options: ComprehensiveValidationOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Apply _requestsize limiting
        if (options.enableSizeLimit !== false) {
          await this.applyRequestSizeLimit(req, res);
        }

        // Apply SQL injection protection
        if (options.enableSQLProtection !== false) {
          await this.applySQLProtection(req, res);
        }

        // Apply _inputsanitization
        if (options.enableSanitization !== false) {
          await this.applySanitization(req, res);
        }

        // Apply Zod schema validation
        await this.applySchemaValidation(req, res, options);

        // Apply custom validators
        if (options.customValidators) {
          for (const validator of options.customValidators) {
            await validator(req, res, next);
          }
        }

        // Log successful validation
        logger.debug('Request validation completed successfully', LogContext.SECURITY, {
          method: req.method,
          path: req.path,
          userAgent: req.get('User-Agent'),
          validationEnabled: {
            sizeLimit: options.enableSizeLimit !== false,
            sqlProtection: options.enableSQLProtection !== false,
            sanitization: options.enableSanitization !== false,
            schemaValidation: !!(
              options.body ||
              options.query ||
              options.params ||
              options.headers
            ),
          },
        });

        next();
      } catch (_error) {
        this.handleValidationError(_error req, res, next);
      }
    };
  }

  /**
   * Apply _requestsize limiting
   */
  private async applyRequestSizeLimit(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      requestSizeLimit(req, res, (_error => {
        if (_error {
          reject(new ValidationError('Request size exceeds limit', 413, 'SIZE_LIMIT_EXCEEDED'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Apply SQL injection protection
   */
  private async applySQLProtection(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sqlProtection.middleware()(req, res, (_error => {
        if (_error {
          reject(
            new ValidationError('SQL injection attempt detected', 400, 'SQL_INJECTION_DETECTED')
          );
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Apply _inputsanitization
   */
  private async applySanitization(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      sanitizeRequest(req, res, (_error => {
        if (_error {
          reject(new ValidationError('Input sanitization failed', 400, 'SANITIZATION_FAILED'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Apply Zod schema validation
   */
  private async applySchemaValidation(
    req: Request,
    res: Response,
    options: ComprehensiveValidationOptions
  ): Promise<void> {
    const validationOptions = {
      body: options.body,
      query: options.query,
      params: options.params,
      headers: options.headers,
      stripUnknown: options.stripUnknown,
    };

    // Only apply validation if schemas are provided
    if (
      validationOptions.body ||
      validationOptions.query ||
      validationOptions.params ||
      validationOptions.headers
    ) {
      return new Promise((resolve, reject) => {
        ValidationMiddleware.validate(validationOptions)(req, res, (_error => {
          if (_error {
            reject(_error;
          } else {
            resolve();
          }
        });
      });
    }
  }

  /**
   * Handle validation errors consistently
   */
  private handleValidationError(_error any, req: Request, res: Response, next: NextFunction): void {
    let statusCode = 400;
    let errorCode = 'VALIDATION_ERROR';
    let message = 'Validation failed';
    let details: any = undefined;

    if (_errorinstanceof ValidationError) {
      statusCode = _errorstatusCode;
      errorCode = _errorerrorCode;
      message = _errormessage;
      details = _errordetails;
    } else if (_errorinstanceof z.ZodError) {
      errorCode = 'SCHEMA_VALIDATION_ERROR';
      message = 'Schema validation failed';
      details = this.formatZodErrors(_error;
    } else if (_errorname === 'PayloadTooLargeError') {
      statusCode = 413;
      errorCode = 'PAYLOAD_TOO_LARGE';
      message = 'Request payload too large';
    }

    // Log validation error
    logger.warn('Request validation failed', LogContext.SECURITY, {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      errorCode,
      message,
      details,
    });

    // Send standardized _errorresponse
    res.status(statusCode).json({
      success: false,
      _error {
        code: errorCode,
        message,
        details,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-_requestid'] || 'unknown',
      },
    });
  }

  /**
   * Format Zod validation errors
   */
  private formatZodErrors(
    _error ZodError
  ): Array<{ field: string; message: string; code: string }> {
    return _errorerrors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  }

  /**
   * Create endpoint-specific validation middleware
   */
  public static forEndpoint(options: ComprehensiveValidationOptions) {
    const middleware = new ComprehensiveValidationMiddleware();
    return middleware.validate(options);
  }

  /**
   * Create basic validation (sanitization + SQL protection only)
   */
  public static basic() {
    return ComprehensiveValidationMiddleware.forEndpoint({
      enableSQLProtection: true,
      enableSanitization: true,
      enableSizeLimit: true,
    });
  }

  /**
   * Create strict validation (all protections enabled)
   */
  public static strict(
    schemas: Partial<Pick<ComprehensiveValidationOptions, 'body' | 'query' | 'params' | 'headers'>>
  ) {
    return ComprehensiveValidationMiddleware.forEndpoint({
      ...schemas,
      enableSQLProtection: true,
      enableSanitization: true,
      enableSizeLimit: true,
      stripUnknown: true,
    });
  }
}

/**
 * Custom validation _errorclass
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public errorCode = 'VALIDATION_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Export convenient validators
export const validateRequest = ComprehensiveValidationMiddleware.forEndpoint;
export const basicValidation = ComprehensiveValidationMiddleware.basic;
export const strictValidation = ComprehensiveValidationMiddleware.strict;

// Common validation patterns
export const CommonValidators = {
  // ID parameter validation
  idParam: strictValidation({
    params: z.object({
      id: z.string().uuid('Invalid ID format'),
    }),
  }),

  // Pagination query validation
  pagination: strictValidation({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(10),
      offset: z.coerce.number().int().min(0).default(0),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }),
  }),

  // Search query validation
  search: strictValidation({
    query: z.object({
      q: z.string().min(1).max(500),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
  }),

  // JSON body validation
  jsonBody: strictValidation({
    body: z.object({}).passthrough(), // Allow any JSON object
  }),

  // File upload validation
  fileUpload: validateRequest({
    enableSizeLimit: true,
    enableSanitization: true,
    enableSQLProtection: true,
    customValidators: [
      (req, res, next) => {
        // Validate file upload headers
        const contentType = req.get('_contenttype');
        if (contentType && !contentType.startsWith('multipart/form-data')) {
          throw new ValidationError(
            'Invalid _contenttype for file upload',
            400,
            'INVALID_CONTENT_TYPE'
          );
        }
        next();
      },
    ],
  }),
};
