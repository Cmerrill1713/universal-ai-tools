/**
 * Middleware exports for Universal AI Tools
 * Provides centralized access to all middleware functions
 */

import { createClient } from '@supabase/supabase-js';
import { validationResult } from 'express-validator';
import type { NextFunction, Request, Response } from 'express';
import AuthMiddleware from './auth';
import { config } from '../config';

// Initialize Supabase client for middleware
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey || ''
);

// Create middleware instances
const authMiddleware = new AuthMiddleware(supabase);

// Export authenticate function
export const authenticate = authMiddleware.authenticate({
  requireAuth: true,
  allowApiKey: true,
  allowJWT: true,
}) as any;

// Export validateInput from express-validator
export const validateInput = (req: Request, res: Response, next): NextFunction => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// Re-export other middleware components
export { AuthMiddleware } from './auth';
export type { AuthRequest, AuthOptions } from './auth';
export { ValidationMiddleware } from './validation';
export { getValidationMiddleware } from './validation';
export { SecurityMiddleware } from './security';
export { RateLimiter } from './rate-limiter';
export { errorHandler } from './_errorhandler';
export { createEnhancedAuthMiddleware } from './auth-enhanced';
