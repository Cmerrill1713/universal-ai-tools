import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

/**
 * Security headers middleware
 * Implements best practices for HTTP security headers
 */

// Content Security Policy configuration
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
};

// Add looser CSP in development
if (process.env.NODE_ENV === 'development') {
  cspDirectives.scriptSrc.push("'unsafe-eval'");
  cspDirectives.connectSrc.push("ws://localhost:*", "http://localhost:*");
}

export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: cspDirectives,
  },
  
  // Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny',
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection (for older browsers)
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  
  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: false,
});

/**
 * Additional security headers not covered by helmet
 */
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  // Add additional security headers
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // CORS-related security headers
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  
  next();
};

/**
 * Request size limits to prevent DoS attacks
 */
export const requestSizeLimits = {
  json: '10mb',
  urlencoded: '10mb',
  raw: '10mb',
  text: '10mb',
};

/**
 * API versioning security middleware
 */
export const apiVersioningSecurity = (req: Request, res: Response, next: NextFunction) => {
  // Require API version for all /api/v* routes
  if (req.path.startsWith('/api/v')) {
    const versionMatch = req.path.match(/^\/api\/v(\d+)\//);
    if (!versionMatch) {
      return res.status(400).json({
        error: 'Invalid API version format',
        message: 'API version must be specified as /api/v{number}/',
      });
    }
    
    const version = parseInt(versionMatch[1], 10);
    if (version < 1 || version > 1) { // Currently only v1 is supported
      return res.status(400).json({
        error: 'Unsupported API version',
        message: 'Only API v1 is currently supported',
      });
    }
  }
  
  next();
};