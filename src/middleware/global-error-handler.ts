/**
 * Global Error Handler Middleware - Placeholder
 * This is a placeholder file to resolve TypeScript compilation errors
 */

import type { NextFunction, Request, Response } from 'express';

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
}
