import type { RequestHandler } from 'express';

// Lazy-load csurf to avoid optional dependency issues
export function createCsrfProtection(): RequestHandler | null {
  try {
     
    const csurf = require('csurf');
    const middleware: RequestHandler = csurf({ cookie: true });
    return middleware;
  } catch {
    return null;
  }
}



