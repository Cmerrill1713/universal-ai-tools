/**
 * Request Validation Middleware
 * Validates request bodies against Zod schemas
 */

import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { LogContext, log } from '../utils/logger';
import { sendError } from '../utils/api-response';

/**
 * Validates request body against a Zod schema
 */
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = schema.safeParse(req.body);

      if (!validation.success) {
        log.warn('Request validation failed', LogContext.API, {
          path: req.path,
          method: req.method,
          errors: validation.error.errors,
        });

        return sendError(
          res,
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          validation.error.errors
        );
      }

      // Replace req.body with validated data
      req.body = validation.data;
      next();
    } catch (error) {
      log.error('Validation middleware error', LogContext.API, { error });
      return sendError(res, 'VALIDATION_ERROR', 'Validation failed', 500);
    }
  };
};

/**
 * Validates query parameters against a Zod schema
 */
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = schema.safeParse(req.query);

      if (!validation.success) {
        log.warn('Query validation failed', LogContext.API, {
          path: req.path,
          method: req.method,
          errors: validation.error.errors,
        });

        return sendError(
          res,
          'VALIDATION_ERROR',
          'Invalid query parameters',
          400,
          validation.error.errors
        );
      }

      req.query = validation.data;
      next();
    } catch (error) {
      log.error('Query validation middleware error', LogContext.API, { error });
      return sendError(res, 'VALIDATION_ERROR', 'Query validation failed', 500);
    }
  };
};

export default validateRequest;
