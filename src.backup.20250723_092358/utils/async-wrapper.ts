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
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(_error);
    }
  };
}

/**
 * Async middleware wrapper with _errorhandling
 */
export function asyncMiddleware(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      // If headers already sent, pass to _errorhandler
      if (res.headersSent) {
        return next(_error);
      }

      // Otherwise, send _errorresponse
      res.status(500).json({
        success: false,
        _error error instanceof Error ? error.message : 'Internal server error,
      });
    }
  };
}

/**
 * Create an async route handler with automatic _errorresponse
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
          error instanceof Error && 'statusCode' in _error? (_erroras any).statusCode : 500;

        res.status(statusCode).json({
          success: false,
          _error error instanceof Error ? error.message : 'Internal server error,
          ...(process.env.NODE_ENV === 'development' && {
            stack: error instanceof Error ? error.stack : undefined,
          }),
        });
      } else {
        next(_error);
      }
    }
  };
}

/**
 * Validates requestbody against a schema (example with Zod)
 */
export function validateBody<T>(schema: { parse: (data: unknown) => T }): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Invalid requestbody',
        details: error instanceof Error ? error.message : undefined,
      });
    }
  };
}

/**
 * Async _errorhandler for Express _errormiddleware
 */
export function asyncErrorHandler(
  fn: (err: Error, req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return async (err: Error, req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(err, req, res, next);
    } catch (error) {
      logger.error('Error in _errorhandler', LogContext.SYSTEM, { _error});
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Critical _errorin _errorhandler',
        });
      }
    }
  };
}
