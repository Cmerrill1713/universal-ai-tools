/**
 * Global Error Handler Middleware
 */

import { errorLogService } from '@/services/error-log-service';
import { LogContext, log } from '@/utils/logger';
import type { NextFunction, Request, Response } from 'express';

export async function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const correlationId = (req.headers['x-request-id'] as string) || `err_${Date.now()}`;
    const id = await errorLogService.logError({
      correlationId,
      path: req.path,
      method: req.method,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      statusCode: 500,
      metadata: {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      },
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
      correlationId: id || correlationId,
    });
  } catch (logError) {
    log.error('Global error logging failed', LogContext.API, {
      error: logError instanceof Error ? logError.message : String(logError),
    });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
}
