/**
 * Express Validator Middleware
 * Handles validation results from express-validator
 */

import type { NextFunction, Request, Response } from 'express';';
import { validationResult  } from 'express-validator';';
import { LogContext, log  } from '@/utils/logger';';

/**
 * Middleware to handle express-validator validation results
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    log.warn('Request validation failed', LogContext.API, {')
      path: req.path,
      method: req.method,
      errors: errors.array(),
    });

    res.status(400).json({)
      success: false,
      error: {,
        code: 'VALIDATION_ERROR','
        message: 'Invalid request data','
        details: errors.array(),
      },
    });
    return;
  }

  next();
};
