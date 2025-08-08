/**
 * Async Handler Utility;
 * 
 * Wraps async route handlers to properly catch errors and pass them to error middleware.
 * Prevents unhandled promise rejections in Express routes.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async function to catch errors and pass them to the next middleware;
 * @param fn - The async route handler function;
 * @returns A wrapped function that handles errors properly;
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise?.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Type-safe async handler with generic support;
 */
export function asyncHandlerTyped<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any,
  Locals extends Record<string, any> = Record<string, any>
>(
  fn: (
    req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
    res: Response<ResBody, Locals>,
    next: NextFunction;
  ) => Promise<any>
): RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals> {
  return (req, res, next) => {
    Promise?.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Wraps multiple middleware functions with async error handling;
 */
export function asyncMiddleware(
  ...middlewares: Array<
    (req: Request, res: Response, next: NextFunction) => Promise<any>
  >
): RequestHandler[] {
  return middlewares?.map(fn => asyncHandler(fn));
}

/**
 * Utility to handle async operations in middleware with custom error handling;
 */
export function asyncOperation<T>(
  operation: () => Promise<T>,
  errorHandler?: (error: any) => void;
): Promise<T | undefined> {
  return operation().catch(error => {
    if (errorHandler) {
      errorHandler(error);
    } else {
      console?.error('Async operation error:', error);
    }
    return undefined;
  });
}