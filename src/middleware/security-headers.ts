import { randomBytes, randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

import { log, LogContext } from '../utils/logger';

/**
 * Enhanced security configuration
 */
interface SecurityConfig {
  enableNonce: boolean;
  cspReportUri?: string;
  trustedDomains: string[];
  enableStrictMode: boolean;
}

const getSecurityConfig = (): SecurityConfig => ({
  enableNonce: process.env.CSP_ENABLE_NONCE === 'true',
  cspReportUri: process.env.CSP_REPORT_URI,
  trustedDomains: (process.env.CSP_TRUSTED_DOMAINS || '').split(',').filter(Boolean),
  enableStrictMode: process.env.NODE_ENV === 'production'
});

/**
 * Enhanced security headers middleware for production
 * Implements HSTS, CSP with nonce support, X-Frame-Options, and other critical security headers
 * Compliant with OWASP Security Headers recommendations
 */
export function securityHeadersMiddleware() {
  const isProduction = process.env.NODE_ENV === 'production';
  const config = getSecurityConfig();
  
  return (req: Request, res: Response, next: NextFunction) => {
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
      
      // Generate nonce for inline scripts if enabled
      const nonce = config.enableNonce ? randomBytes(16).toString('base64') : null;
      if (nonce) {
        res.locals.cspNonce = nonce;
      }
      
      // Content Security Policy - Enhanced with nonce support
      const buildCSP = (): string => {
        const nonceStr = nonce ? `'nonce-${nonce}'` : '';
        const unsafeInline = !config.enableStrictMode ? "'unsafe-inline'" : '';
        const unsafeEval = !config.enableStrictMode ? "'unsafe-eval'" : '';
        
        const trustedDomains = config.trustedDomains.length > 0 
          ? ` ${config.trustedDomains.join(' ')}` 
          : '';
        
        const cspDirectives = [
          "default-src 'self'",
          `script-src 'self' ${nonceStr} ${unsafeInline} ${unsafeEval} https://cdn.jsdelivr.net${!isProduction ? ' https://unpkg.com' : ''}${trustedDomains}`.trim().replace(/\s+/g, ' '),
          `style-src 'self' ${nonceStr} ${unsafeInline} https://fonts.googleapis.com https://cdn.jsdelivr.net${trustedDomains}`.trim().replace(/\s+/g, ' '),
          `font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net${trustedDomains}`.trim().replace(/\s+/g, ' '),
          "img-src 'self' data: https: blob:",
          `connect-src 'self' wss: https:${!isProduction ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
          "media-src 'self' blob: data:",
          "object-src 'none'", // Critical: Block all object/embed/applet
          "frame-ancestors 'none'", // Critical: Prevent clickjacking
          "base-uri 'self'", // Prevent base tag injection
          "form-action 'self'", // Restrict form submissions
          "worker-src 'self' blob:",
          "manifest-src 'self'",
          "child-src 'none'", // Modern replacement for frame-src
        ];
        
        if (isProduction) {
          cspDirectives.push('upgrade-insecure-requests');
          cspDirectives.push('block-all-mixed-content');
        }
        
        // Add CSP violation reporting if configured
        if (config.cspReportUri) {
          cspDirectives.push(`report-uri ${config.cspReportUri}`);
        }
        
        return cspDirectives.filter(Boolean).join('; ');
      };
      
      const cspHeader = buildCSP();
      res.setHeader('Content-Security-Policy', cspHeader);
      
      // Add CSP report-only header for testing new policies in production
      if (process.env.CSP_REPORT_ONLY_POLICY) {
        res.setHeader('Content-Security-Policy-Report-Only', process.env.CSP_REPORT_ONLY_POLICY);
      }
      
      // X-Frame-Options - Clickjacking protection
      res.setHeader('X-Frame-Options', 'DENY');
      
      // X-Content-Type-Options - MIME type sniffing protection
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // X-XSS-Protection - Legacy XSS protection (disabled with CSP)
      res.setHeader('X-XSS-Protection', '0');
      
      // Referrer-Policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Permissions-Policy (comprehensive security restrictions)
      // Following principle of least privilege
      const permissionsPolicies = [
        'camera=()', // Completely disabled
        'microphone=(self)', // Allow for voice features only from same origin
        'geolocation=()', // Completely disabled
        'payment=(), usb=(), serial=(), bluetooth=()', // Hardware access disabled
        'magnetometer=(), gyroscope=(), accelerometer=()', // Motion sensors disabled
        'ambient-light-sensor=(), autoplay=(), encrypted-media=()', // Media controls
        'fullscreen=(self)', // Allow fullscreen from same origin only
        'midi=(), sync-xhr=(), wake-lock=(), screen-wake-lock=()', // Legacy/performance features
        'web-share=(), xr-spatial-tracking=()', // Modern web APIs
        'publickey-credentials-get=(self)', // WebAuthn allowed from same origin
        'clipboard-read=(), clipboard-write=(self)', // Clipboard access control
        'display-capture=(), document-domain=()' // Additional security controls
      ];
      
      res.setHeader('Permissions-Policy', permissionsPolicies.join(', '));
      
      // Additional security headers
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      
      // Remove potentially dangerous headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      // Security monitoring and logging
      const securityMetrics = {
        production: isProduction,
        nonceEnabled: !!nonce,
        cspReportingEnabled: !!config.cspReportUri,
        trustedDomainsCount: config.trustedDomains.length,
        userAgent: req.get('User-Agent')?.substring(0, 100),
        origin: req.get('Origin'),
        referer: req.get('Referer')
      };
      
      log.debug('🛡️ Security headers applied', LogContext.SECURITY, securityMetrics);
      
      next();
    } catch (error) {
      log.error('Error applying security headers', LogContext.SECURITY, { error });
      // Continue even if headers fail to apply
      next();
    }
  };
}

/**
 * JWT-specific security headers for authentication endpoints
 */
export function jwtSecurityHeaders(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Enhanced security for JWT endpoints
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      
      // XSS protection
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Strict referrer policy for auth endpoints
      res.setHeader('Referrer-Policy', 'no-referrer');
      
      // Cross-origin policies
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      
      // Content type enforcement
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        const contentType = req.get('Content-Type');
        if (contentType && !contentType.includes('application/json')) {
          log.warn('🚨 Non-JSON content type on JWT endpoint', LogContext.SECURITY, {
            contentType,
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent')?.substring(0, 50)
          });
        }
      }
      
      // Add request tracking for security monitoring
      res.setHeader('X-Request-ID', req.headers['x-request-id'] || randomUUID());
      
      // JWT-specific CSP for auth endpoints
      const authCsp = [
        "default-src 'none'",
        "script-src 'none'", 
        "style-src 'none'",
        "img-src 'none'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'"
      ].join('; ');
      
      res.setHeader('Content-Security-Policy', authCsp);
      
      log.info('🔐 JWT security headers applied', LogContext.SECURITY, {
        path: req.path,
        method: req.method,
        hasAuth: !!req.headers.authorization
      });
      
      next();
    } catch (error) {
      log.error('Failed to apply JWT security headers', LogContext.SECURITY, {
        error: error instanceof Error ? error.message : String(error),
        path: req.path
      });
      next();
    }
  };
}

/**
 * Rate limiting headers for authentication endpoints
 */
export function authRateLimitHeaders(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add rate limiting information headers
    res.setHeader('X-Auth-Rate-Limit', '10');
    res.setHeader('X-Auth-Rate-Window', '900'); // 15 minutes
    
    // Add security advisory header
    res.setHeader('X-Security-Advisory', 'Authentication endpoints are rate-limited and monitored');
    
    // Add timing information for security analysis
    res.setHeader('X-Security-Timestamp', new Date().toISOString());
    
    next();
  };
}

/**
 * Security monitoring headers for all requests
 */
export function securityMonitoringHeaders(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    
    // Add request tracking
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Security-Framework', 'universal-ai-tools-v1.2');
    
    // Add timing for performance monitoring
    const startTime = Date.now();
    
    // Override res.end to add response time
    const originalEnd = res.end.bind(res);
    res.end = function(chunk?: any, encodingOrCb?: BufferEncoding | (() => void), cb?: (() => void)) {
      const responseTime = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      
      // Log security-relevant metrics
      log.info('🛡️ Security monitoring', LogContext.SECURITY, {
        requestId,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        hasAuth: !!req.headers.authorization,
        userAgent: req.get('User-Agent')?.substring(0, 100),
        ip: req.ip || req.connection.remoteAddress
      });
      
      // Handle different overload signatures
      if (typeof encodingOrCb === 'function') {
        return originalEnd(chunk, encodingOrCb);
      } else if (encodingOrCb && cb) {
        return originalEnd(chunk, encodingOrCb, cb);
      } else if (chunk && !encodingOrCb && !cb) {
        return originalEnd(chunk);
      } else {
        return originalEnd(chunk, encodingOrCb as BufferEncoding, cb);
      }
    };
    
    next();
  };
}

export default securityHeadersMiddleware;
