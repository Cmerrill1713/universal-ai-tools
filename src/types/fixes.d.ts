
// Type fixes for production readiness
declare module '@/middleware/auth' {
  import type { RequestHandler } from 'express';
  export const validateApiKey: RequestHandler;
  export const authenticateRequest: RequestHandler;
}

// Add missing types
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      apiKey?: string;
    }
  }
}

export {};
