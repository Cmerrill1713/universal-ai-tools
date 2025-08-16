import type { NextFunction, Request, Response } from 'express';

import { log, LogContext } from '../utils/logger';

/**
 * Enhanced security headers middleware for production
 * Implements HSTS, CSP, X-Frame-Options, and other critical security headers
 */
export function securityHeadersMiddleware() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return (_req: Request, res: Response, next: NextFunction) => {
    try {
      // HSTS - HTTP Strict Transport Security (production only)
      if (isProduction) {
        res.setHeader(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains; preload'
        );
      }
      
      // Content Security Policy
      const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' wss: https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ];
      
      if (isProduction) {
        // Stricter CSP in production
        cspDirectives[1] = "script-src 'self'"; // Remove unsafe-inline and unsafe-eval
        cspDirectives.push('upgrade-insecure-requests');
      }
      
      res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
      
      // X-Frame-Options - Clickjacking protection
      res.setHeader('X-Frame-Options', 'DENY');
      
      // X-Content-Type-Options - MIME type sniffing protection
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // X-XSS-Protection - Legacy XSS protection (disabled with CSP)
      res.setHeader('X-XSS-Protection', '0');
      
      // Referrer-Policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Permissions-Policy (expanded)
      res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
      );
      
      // Additional security headers
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      
      // Remove potentially dangerous headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      log.debug('Security headers applied', LogContext.SECURITY, {
        production: isProduction
      });
      
      next();
    } catch (error) {
      log.error('Error applying security headers', LogContext.SECURITY, { error });
      // Continue even if headers fail to apply
      next();
    }
  };
}

export default securityHeadersMiddleware;
