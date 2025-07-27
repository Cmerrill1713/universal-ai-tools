import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { LogContext, logger } from '../utils/enhanced-logger';
import { config } from '../config/environment';
import { appConfig } from '../config/index';
import { securityHardeningService } from '../services/security-hardening';
import { createHash } from 'crypto';

export interface SecurityOptions {
  enableCors?: boolean;
  enableHelmet?: boolean;
  enableRateLimit?: boolean;
  enableCSP?: boolean;
  enableCSRF?: boolean;
  enableIPWhitelisting?: boolean;
  corsOrigins?: string[];
  rateLimitWindow?: number;
  rateLimitMax?: number;
  ipWhitelist?: string[];
  ipBlacklist?: string[];
  requestSizeLimit?: string;
}

export interface RateLimitInfo {
  ip: string;
  requests: number;
  windowStart: number;
  blocked: boolean;
}

export class SecurityMiddleware {
  private rateLimitMap: Map<string, RateLimitInfo> = new Map();
  private blockedIPs: Set<string> = new Set();
  private whitelistedIPs: Set<string> = new Set();
  private csrfTokens: Map<string, { token: string; expires: number }> = new Map();
  private options: SecurityOptions;

  constructor(options: SecurityOptions = {}) {
    this.options = {
      enableCors: true,
      enableHelmet: true,
      enableRateLimit: true,
      enableCSP: true,
      enableCSRF: true,
      enableIPWhitelisting: false,
      corsOrigins: config.security.corsOrigins || [],
      rateLimitWindow: 900000, // 15 minutes
      rateLimitMax: 100, // 100 requests per window
      ipWhitelist: [],
      ipBlacklist: [],
      requestSizeLimit: '10mb',
      ...options,
    };

    // Initialize IP lists
    options.ipWhitelist?.forEach((ip) => this.whitelistedIPs.add(ip));
    options.ipBlacklist?.forEach((ip) => this.blockedIPs.add(ip));

    // Cleanup expired CSRF tokens periodically with error handling
    const cleanupInterval = setInterval(() => {
      try {
        this.cleanupCSRFTokens();
      } catch (error) {
        logger.error('Error cleaning up CSRF tokens', LogContext.SECURITY, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 3600000); // Every hour

    // Store interval reference for potential cleanup
    (this as: any).cleanupInterval = cleanupInterval;
  }

  /**
   * CORS middleware configuration
   */
  public getCorsMiddleware() {
    if (!this.options.enableCors) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list
        if (this.options.corsOrigins!.includes(origin)) {
          return callback(null, true);
        }

        // REMOVED: Localhost bypass for production security
        // All origins must be explicitly configured in CORS_ORIGINS

        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-Requested-With',
        'X-Forwarded-For',
        'User-Agent',
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Cache',
        'X-Response-Time',
      ],
    });
  }

  /**
   * Get Helmet middleware for security headers
   */
  public getHelmetMiddleware() {
    if (!this.options.enableHelmet) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return helmet({
      contentSecurityPolicy: this.options.enableCSP
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: [
                "'self'",
                // In production, use nonces or hashes for inline scripts
                // During development, we allow unsafe-inline but warn about it
                ...(config.server.isDevelopment ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
                // Note: Nonces are handled dynamically via res.locals.nonce
              ],
              styleSrc: [
                "'self'",
                // In production, use nonces or hashes for inline styles
                // During development, we allow unsafe-inline but warn about it
                ...(config.server.isDevelopment ? ["'unsafe-inline'"] : []),
                // Allow specific trusted CDNs
                'https://fonts.googleapis.com',
                // Note: Nonces are handled dynamically via res.locals.nonce
              ],
              imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
              fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
              connectSrc: [
                "'self'",
                config.database.supabaseUrl,
                'https://*.supabase.co',
                'wss://*.supabase.co',
                'https://api.openai.com',
                'https://api.anthropic.com',
                'https://api.groq.com',
                'https://generativelanguage.googleapis.com',
                // Only allow local connections in development
                ...(config.server.isDevelopment
                  ? [appConfig.localLLM.ollama.url, 'ws://localhost:*', 'http://localhost:*']
                  : []),
              ],
              mediaSrc: ["'self'", 'blob:'],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
              workerSrc: ["'self'", 'blob:'],
              ...(config.server.isProduction && { upgradeInsecureRequests: [] }),
            },
            reportOnly: false, // Enforce CSP in production
          }
        : false,
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    });
  }

  /**
   * Security headers middleware (legacy, use getHelmetMiddleware instead)
   * Also adds nonce generation for CSP
   */
  public securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Generate nonce for CSP if in production
      if (config.server.isProduction && this.options.enableCSP) {
        const nonce = createHash('sha256')
          .update(Date.now() + Math.random().toString())
          .digest('base64')
          .slice(0, 16);
        res.locals.nonce = nonce;
      }

      // Apply additional security headers
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('X-Download-Options', 'noopen');
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), interest-cohort=()'
      );

      // Apply Helmet middleware
      const helmetMiddleware = this.getHelmetMiddleware();
      helmetMiddleware(req, res, next);
    };
  }

  /**
   * Generate Content Security Policy
   * NOTE: This method is deprecated. CSP is now handled by Helmet middleware.
   * @deprecated Use getHelmetMiddleware() instead
   */
  private generateCSP(): string {
    logger.warn(
      'generateCSP() is deprecated. Use getHelmetMiddleware() for CSP configuration',
      LogContext.SECURITY
    );
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self'", // Removed unsafe-inline and unsafe-eval for security
      "style-src 'self'", // Removed unsafe-inline for security
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https:",
      "connect-src 'self' https://api.openai.com https://api.anthropic.com https://*.supabase.co wss://*.supabase.co",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      ...(config.server.isProduction ? ['upgrade-insecure-requests'] : []),
    ];

    return cspDirectives.join('; ');
  }

  /**
   * Get express-rate-limit middleware
   */
  public getExpressRateLimiter() {
    if (!this.options.enableRateLimit) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return rateLimit({
      windowMs: this.options.rateLimitWindow!,
      max: this.options.rateLimitMax!,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        const ip = this.getClientIP(req);
        logger.warn(`Rate limit exceeded for IP: ${ip}`, LogContext.SECURITY, {
          ip,
          endpoint: req.originalUrl,
          userAgent: req.headers['user-agent'],
        });

        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests from this IP',
          retryAfter: Math.ceil(this.options.rateLimitWindow! / 1000),
        });
      },
      skip: (req) => {
        const ip = this.getClientIP(req);
        return this.whitelistedIPs.has(ip);
      },
    });
  }

  /**
   * Enhanced rate limiting middleware with per-endpoint limits
   */
  public getEndpointRateLimiter(endpoint: string, max = 10, windowMs = 60000) {
    return rateLimit({
      windowMs,
      max,
      keyGenerator: (req) => `${this.getClientIP(req)}:${endpoint}`,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn(`Endpoint rate limit exceeded`, LogContext.SECURITY, {
          ip: this.getClientIP(req),
          endpoint,
          userAgent: req.headers['user-agent'],
        });

        res.status(429).json({
          error: 'Endpoint rate limit exceeded',
          message: `Too many requests to ${endpoint}`,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      },
    });
  }

  /**
   * Rate limiting middleware (legacy)
   */
  public rateLimit() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableRateLimit) {
        return next();
      }

      const ip = this.getClientIP(req);

      // Check if IP is blocked
      if (this.blockedIPs.has(ip)) {
        return res.status(429).json({
          error: 'IP blocked',
          message: 'Your IP has been temporarily blocked due to excessive requests',
          retryAfter: 3600, // 1 hour
        });
      }

      const now = Date.now();
      const windowStart = now - this.options.rateLimitWindow!;

      // Get or create rate limit info for this IP
      let rateLimitInfo = this.rateLimitMap.get(ip);

      if (!rateLimitInfo || rateLimitInfo.windowStart < windowStart) {
        rateLimitInfo = {
          ip,
          requests: 1,
          windowStart: now,
          blocked: false,
        };
        this.rateLimitMap.set(ip, rateLimitInfo);
      } else {
        rateLimitInfo.requests++;
      }

      // Check if limit exceeded
      if (rateLimitInfo.requests > this.options.rateLimitMax!) {
        rateLimitInfo.blocked = true;
        this.blockedIPs.add(ip);

        // Log rate limit violation
        logger.warn(`Rate limit exceeded for IP: ${ip}`, LogContext.SECURITY, {
          ip,
          requests: rateLimitInfo.requests,
          limit: this.options.rateLimitMax,
          endpoint: req.originalUrl,
          userAgent: req.headers['user-agent'],
        });

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests from this IP',
          retryAfter: Math.ceil(this.options.rateLimitWindow! / 1000),
          limit: this.options.rateLimitMax,
          requests: rateLimitInfo.requests,
        });
      }

      // Set rate limit headers
      const remaining = Math.max(0, this.options.rateLimitMax! - rateLimitInfo.requests);
      const resetTime = Math.ceil(
        (rateLimitInfo.windowStart + this.options.rateLimitWindow!) / 1000
      );

      res.set({
        'X-RateLimit-Limit': this.options.rateLimitMax!.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toString(),
      });

      next();
    };
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    )
      .split(',')[0]
      .trim();
  }

  /**
   * Input sanitization middleware
   */
  public sanitizeInput() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Sanitize query parameters
        if (req.query) {
          req.query = JSON.parse(securityHardeningService.sanitizeInput(JSON.stringify(req.query)));
        }

        // Sanitize body
        if (req.body) {
          req.body = JSON.parse(securityHardeningService.sanitizeInput(JSON.stringify(req.body)));
        }

        // Sanitize parameters
        if (req.params) {
          req.params = JSON.parse(
            securityHardeningService.sanitizeInput(JSON.stringify(req.params))
          );
        }

        // Sanitize headers
        const dangerousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
        dangerousHeaders.forEach((header) => {
          if (req.headers[header]) {
            delete req.headers[header];
          }
        });

        next();
      } catch (error) {
        logger.error('Input sanitization error', LogContext.SECURITY, {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(400).json({
          error: 'Invalid input',
          message: 'Request contains invalid or malicious content',
        });
      }
    };
  }

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    // Remove null bytes
    str = str.replace(/\0/g, '');

    // Remove control characters except tab, newline, carriage return
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Limit string length
    if (str.length > 10000) {
      str = str.substring(0, 10000);
    }

    return str;
  }

  /**
   * Request logging middleware
   */
  public requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const ip = this.getClientIP(req);

      // Log request
      logger.info('Incoming request', LogContext.HTTP, {
        method: req.method,
        url: req.originalUrl,
        ip,
        userAgent: req.headers['user-agent'],
        contentLength: req.headers['content.length'],
        timestamp: new Date().toISOString(),
      });

      // Log response
      const originalSend = res.send;
      res.send = function (data) {
        const duration = Date.now() - startTime;

        logger.info('Request completed', LogContext.HTTP, {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          ip,
          responseSize: data ? data.length : 0,
        });

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Cleanup expired rate limit entries
   */
  public cleanupRateLimits(): void {
    const now = Date.now();
    const cutoff = now - this.options.rateLimitWindow!;

    for (const [ip, info] of this.rateLimitMap.entries()) {
      if (info.windowStart < cutoff) {
        this.rateLimitMap.delete(ip);
        this.blockedIPs.delete(ip);
      }
    }
  }

  /**
   * Get rate limit statistics
   */
  public getRateLimitStats(): {
    totalIPs: number;
    blockedIPs: number;
    activeWindows: number;
  } {
    return {
      totalIPs: this.rateLimitMap.size,
      blockedIPs: this.blockedIPs.size,
      activeWindows: Array.from(this.rateLimitMap.values()).filter(
        (info) => info.windowStart > Date.now() - this.options.rateLimitWindow!
      ).length,
    };
  }

  /**
   * Manually block an IP
   */
  public blockIP(ip: string): void {
    this.blockedIPs.add(ip);
    logger.warn(`IP manually blocked: ${ip}`);
  }

  /**
   * Manually unblock an IP
   */
  public unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.rateLimitMap.delete(ip);
    logger.info(`IP unblocked: ${ip}`);
  }

  /**
   * CSRF protection middleware
   */
  public csrfProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableCSRF) {
        return next();
      }

      // Skip CSRF for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      const token = req.headers['x-csrf-token'] as string;
      const sessionId = (req.headers['x-session-id'] as string) || this.getClientIP(req);

      if (!token) {
        return res.status(403).json({
          error: 'CSRF token missing',
          message: 'Request requires CSRF token',
        });
      }

      const storedToken = this.csrfTokens.get(sessionId);
      if (!storedToken || storedToken.token !== token || storedToken.expires < Date.now()) {
        return res.status(403).json({
          error: 'Invalid CSRF token',
          message: 'CSRF token is invalid or expired',
        });
      }

      next();
    };
  }

  /**
   * Generate CSRF token
   */
  public generateCSRFToken(sessionId: string): string {
    const token = createHash('sha256')
      .update(sessionId + Date.now() + Math.random())
      .digest('hex');

    this.csrfTokens.set(sessionId, {
      token,
      expires: Date.now() + 3600000, // 1 hour
    });

    return token;
  }

  /**
   * IP-based access control
   */
  public ipAccessControl() {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = this.getClientIP(req);

      // Check blacklist first
      if (this.blockedIPs.has(ip)) {
        logger.warn(`Blocked IP attempted access: ${ip}`);
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP address is blocked',
        });
      }

      // Check whitelist if enabled
      if (this.options.enableIPWhitelisting && this.whitelistedIPs.size > 0) {
        if (!this.whitelistedIPs.has(ip)) {
          logger.warn(`Non-whitelisted IP attempted access: ${ip}`);
          return res.status(403).json({
            error: 'Access denied',
            message: 'Your IP address is not authorized',
          });
        }
      }

      next();
    };
  }

  /**
   * Request size limiting
   */
  public requestSizeLimit() {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.headers['content.length'];
      if (!contentLength) {
        return next();
      }

      const maxSize = this.parseSize(this.options.requestSizeLimit!);
      const size = parseInt(contentLength, 10);

      if (size > maxSize) {
        return res.status(413).json({
          error: 'Payload too large',
          message: `Request size ${size} exceeds limit of ${maxSize} bytes`,
        });
      }

      next();
    };
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(size: string): number {
    const units: { [key: string]: number } = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
    };

    const match = size.toLowerCase().match(/^(\d+)([a-z]+)$/);
    if (!match) {
      return parseInt(size, 10);
    }

    const [, num, unit] = match;
    return parseInt(num, 10) * (units[unit] || 1);
  }

  /**
   * Cleanup expired CSRF tokens
   */
  private cleanupCSRFTokens(): void {
    const now = Date.now();
    for (const [sessionId, token] of this.csrfTokens.entries()) {
      if (token.expires < now) {
        this.csrfTokens.delete(sessionId);
      }
    }
  }

  /**
   * Security audit logging
   */
  public securityAuditLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = this.getClientIP(req);
      const startTime = Date.now();

      // Log security-relevant requestdetails
      const securityLog = {
        timestamp: new Date().toISOString(),
        ip,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'],
        contentType: req.headers['content.type'],
        authentication: req.headers['authorization'] ? 'present' : 'none',
        apiKey: req.headers['x-api-key'] ? 'present' : 'none',
      };

      // Log response
      const originalSend = res.send;
      res.send = function (data) {
        const duration = Date.now() - startTime;

        // Log security events
        if (res.statusCode === 401 || res.statusCode === 403) {
          logger.warn('Security event: Authentication/Authorization failure', LogContext.SECURITY, {
            ...securityLog,
            statusCode: res.statusCode,
            duration,
          });
        } else if (res.statusCode === 429) {
          logger.warn('Security event: Rate limit exceeded', LogContext.SECURITY, {
            ...securityLog,
            statusCode: res.statusCode,
            duration,
          });
        } else if (res.statusCode >= 400) {
          logger.info('Security event: Client error, LogContext.SECURITY, {
            ...securityLog,
            statusCode: res.statusCode,
            duration,
          });
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }
}

export default SecurityMiddleware;

/**
 * Pre-configured security middleware instance (lazy initialization)
 */
let _securityMiddleware: SecurityMiddleware | null = null;

export function getSecurityMiddleware(): SecurityMiddleware {
  if (!_securityMiddleware) {
    _securityMiddleware = new SecurityMiddleware();
  }
  return _securityMiddleware;
}

// For backward compatibility
export const securityMiddleware = {
  get ipAccessControl() {
    return getSecurityMiddleware().ipAccessControl.bind(getSecurityMiddleware());
  },
  get requestSizeLimit() {
    return getSecurityMiddleware().requestSizeLimit.bind(getSecurityMiddleware());
  },
  get getHelmetMiddleware() {
    return getSecurityMiddleware().getHelmetMiddleware.bind(getSecurityMiddleware());
  },
  get getCorsMiddleware() {
    return getSecurityMiddleware().getCorsMiddleware.bind(getSecurityMiddleware());
  },
  get getExpressRateLimiter() {
    return getSecurityMiddleware().getExpressRateLimiter.bind(getSecurityMiddleware());
  },
  get sanitizeInput() {
    return getSecurityMiddleware().sanitizeInput.bind(getSecurityMiddleware());
  },
  get csrfProtection() {
    return getSecurityMiddleware().csrfProtection.bind(getSecurityMiddleware());
  },
  get securityAuditLogger() {
    return getSecurityMiddleware().securityAuditLogger.bind(getSecurityMiddleware());
  },
};

/**
 * Convenience function to apply all security middleware
 */
export function applySecurityMiddleware(app: any) {
  // Use the lazy-initialized singleton instance
  const security = getSecurityMiddleware();

  // Apply in order with timeout protection
  try {
    app.use(security.ipAccessControl());
    app.use(security.requestSizeLimit());
    app.use(security.getHelmetMiddleware());
    app.use(security.getCorsMiddleware());
    app.use(security.getExpressRateLimiter());
    app.use(security.sanitizeInput());
    app.use(security.csrfProtection());
    app.use(security.securityAuditLogger());

    logger.info('Security middleware applied successfully');
  } catch (error) {
    logger.error('Failed to apply security middleware', LogContext.SECURITY, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  return security;
}
