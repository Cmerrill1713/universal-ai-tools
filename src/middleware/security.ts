import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface SecurityOptions {
  enableCors?: boolean;
  enableHelmet?: boolean;
  enableRateLimit?: boolean;
  enableCSP?: boolean;
  corsOrigins?: string[];
  rateLimitWindow?: number;
  rateLimitMax?: number;
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
  private options: SecurityOptions;

  constructor(options: SecurityOptions = {}) {
    this.options = {
      enableCors: true,
      enableHelmet: true,
      enableRateLimit: true,
      enableCSP: true,
      corsOrigins: ['http://localhost:3000', 'http://localhost:8080'],
      rateLimitWindow: 900000, // 15 minutes
      rateLimitMax: 100, // 100 requests per window
      ...options,
    };
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

        // Allow localhost in development
        if (config.server.env === 'development' && origin.includes('localhost')) {
          return callback(null, true);
        }

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
   * Security headers middleware
   */
  public securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Security headers
      res.set({
        // Prevent XSS attacks
        'X-XSS-Protection': '1; mode=block',
        
        // Prevent clickjacking
        'X-Frame-Options': 'DENY',
        
        // Prevent MIME type sniffing
        'X-Content-Type-Options': 'nosniff',
        
        // Enable HSTS
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        
        // Referrer policy
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        
        // Feature policy
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        
        // DNS prefetch control
        'X-DNS-Prefetch-Control': 'off',
      });

      // Content Security Policy
      if (this.options.enableCSP) {
        res.set('Content-Security-Policy', this.generateCSP());
      }

      next();
    };
  }

  /**
   * Generate Content Security Policy
   */
  private generateCSP(): string {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.openai.com https://api.anthropic.com https://supabase.co",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ];

    return cspDirectives.join('; ');
  }

  /**
   * Rate limiting middleware
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
        logger.warn(`Rate limit exceeded for IP: ${ip}`, {
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
      const resetTime = Math.ceil((rateLimitInfo.windowStart + this.options.rateLimitWindow!) / 1000);
      
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
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }

  /**
   * Input sanitization middleware
   */
  public sanitizeInput() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Sanitize query parameters
        if (req.query) {
          req.query = this.sanitizeObject(req.query);
        }

        // Sanitize body
        if (req.body) {
          req.body = this.sanitizeObject(req.body);
        }

        // Sanitize parameters
        if (req.params) {
          req.params = this.sanitizeObject(req.params);
        }

        next();
      } catch (error) {
        logger.error('Input sanitization error:', error);
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
      return obj.map(item => this.sanitizeObject(item));
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
      logger.info('Incoming request', {
        method: req.method,
        url: req.originalUrl,
        ip,
        userAgent: req.headers['user-agent'],
        contentLength: req.headers['content-length'],
        timestamp: new Date().toISOString(),
      });

      // Log response
      const originalSend = res.send;
      res.send = function (data) {
        const duration = Date.now() - startTime;
        
        logger.info('Request completed', {
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
        info => info.windowStart > Date.now() - this.options.rateLimitWindow!
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
}

export default SecurityMiddleware;