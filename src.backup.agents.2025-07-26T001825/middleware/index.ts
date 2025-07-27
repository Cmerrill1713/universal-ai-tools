/**
 * Middleware exports for Universal A.I Tools* Provides centralized access to all middleware functions*/

import { create.Client } from '@supabase/supabase-js';
import { validation.Result } from 'express-validator';
import type { Next.Function, Request, Response } from 'express';
import Auth.Middleware from './auth';
import { config } from './config'// Initialize Supabase client for middleware;
const supabase = create.Client();
  configdatabasesupabase.Url;
  configdatabasesupabaseService.Key || '')// Create middleware instances;
const auth.Middleware = new Auth.Middleware(supabase)// Export authenticate function;
export const authenticate = auth.Middlewareauthenticate({
  require.Auth: true;
  allowApi.Key: true;
  allowJW.T: true}) as any// Export validate.Input from express-validator;
export const validate.Input = (req: Request, res: Response, next: Next.Function) => {
  const errors = validation.Result(req);
  if (!errorsis.Empty()) {
    return resstatus(400)json({
      error instanceof Error ? errormessage : String(error) 'Validation failed';
      details: errorsarray()})};
  next()}// Re-export other middleware components;
export { Auth.Middleware } from './auth';
export type { Auth.Request, Auth.Options } from './auth';
export { Validation.Middleware } from './validation';
export { getValidation.Middleware } from './validation';
export { Security.Middleware } from './security';
export { Rate.Limiter } from './rate-limiter';
export { error.Handler } from './errorhandler';
export { createEnhancedAuth.Middleware } from './auth-enhanced';