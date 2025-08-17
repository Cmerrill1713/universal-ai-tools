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
          'max-age=63072000; includeSubDomains; preload' // 2 years for better security
        );
      }
      
      // Security headers for all environments
      res.setHeader('X-DNS-Prefetch-Control', 'off');
      res.setHeader('X-Download-Options', 'noopen');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
      
      // Content Security Policy - Enhanced for better security
      const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' wss: https: ws://localhost:* ws://127.0.0.1:*",
        "media-src 'self' blob: data:",
        "object-src 'none'", // Block all object/embed/applet
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "worker-src 'self' blob:",
        "manifest-src 'self'"
      ];
      
      if (isProduction) {
        // Stricter CSP in production
        cspDirectives[1] = "script-src 'self' https://cdn.jsdelivr.net"; // Remove unsafe directives
        cspDirectives[2] = "style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net";
        cspDirectives[5] = "connect-src 'self' wss: https:"; // Remove localhost in production
        cspDirectives.push('upgrade-insecure-requests');
        cspDirectives.push('block-all-mixed-content');
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
      
      // Permissions-Policy (comprehensive security restrictions)
      const permissionsPolicies = [
        'camera=()',
        'microphone=(self)', // Allow microphone for voice features
        'geolocation=()',
        'payment=(), usb=(), serial=(), bluetooth=()',
        'magnetometer=(), gyroscope=(), accelerometer=()',
        'ambient-light-sensor=(), autoplay=(), encrypted-media=(), fullscreen=(self)',
        'midi=(), sync-xhr=(), wake-lock=(), screen-wake-lock=()',
        'web-share=(), xr-spatial-tracking=(), publickey-credentials-get=(self)'
      ];
      
      res.setHeader('Permissions-Policy', permissionsPolicies.join(', '));
      
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
