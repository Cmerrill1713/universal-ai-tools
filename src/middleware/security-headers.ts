import type { NextFunction, Request, Response } from 'express';

export function securityHeadersMiddleware() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // modern CSP is used
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  };
}

export default securityHeadersMiddleware;
