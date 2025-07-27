/**
 * Async wrapper utility for Express route handlers
 * Properly handles async errors in Express middleware
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { LogContext, logger } from './enhanced-logger';

/**
 * Wraps an async route handler to properly catch and forward errors
 */
export function wrapAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Type-safe async handler with generic support
 */
export function asyncHandler<T = any>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>;
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Async middleware wrapper with error handling
 */
export function asyncMiddleware(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      // If headers already sent, pass to error handler
      if (res.headersSent) {
        return next(error);
      }

      // Otherwise, send error response
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };
}

/**
 * Create an async route handler with automatic error response
 */
export function createAsyncHandler<TBody = any, TQuery = any, TParams = any>(
  handler: (req: Request<TParams, any, TBody, TQuery>, res: Response) => Promise<void>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req as Request<TParams, any, TBody, TQuery>, res);
    } catch (error) {
      if (!res.headersSent) {
        const statusCode =
          error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500;

        res.status(statusCode).json({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          ...(process.env.NODE_ENV === 'development' && {
            stack: error instanceof Error ? error.stack : undefined,
          }),
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validates request body against a schema (example with Zod)
 */
export function validateBody<T>(schema: { parse: (data: unknown) => T }): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: error instanceof Error ? error.message : undefined,
      });
    }
  };
}

/**
 * Async error handler for Express error middleware
 */
export function asyncErrorHandler(
  fn: (err: Error, req: Request, res: Response, next: NextFunction) => Promise<void>;
) {
  return async (err: Error, req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(err, req, res, next);
    } catch (error) {
      logger.error('Error in error handler', LogContext.SYSTEM, { error });
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Critical error in error handler',
        });
      }
    }
  };
}
