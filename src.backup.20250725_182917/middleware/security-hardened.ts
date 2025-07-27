import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { SecurityHardeningService } from '../services/security-hardening';
import * as crypto from 'crypto';

// Initialize security hardening service
const securityHardening = new SecurityHardeningService();

// Initialize Redis for distributed rate limiting
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
});

// IP allowlist/blocklist management
const ipAllowlist = new Set<string>(process.env.IP_ALLOWLIST?.split(',') || []);
const ipBlocklist = new Set<string>(process.env.IP_BLOCKLIST?.split(',') || []);

// Extend Express Request type for session
declare module 'express-serve-static-core' {
  interface Request {
    session?: any;
  }
}

/**;
 * Configure Helmet.js for security headers
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Consider removing unsafe-eval in production;
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.openai.com', 'wss:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // May need to adjust based on your needs;
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

/**;
 * Create rate limiter with custom options
 */
export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes;
    max: options.max || 100, // limit each IP to 100 requests per windowMs;
    message: options.message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req: Request) => req.ip || 'unknown'),
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      // Log security event
      logger.warn('Security event: Rate limit exceeded', {
        type: 'rate_limit_exceeded',
        severity: 'warning',
        details: {
          ip: req.ip,
          endpoint: req.path,
          method: req.method,
        },
        timestamp: new Date(),
        source: 'RateLimiter',
      });
      res.status(429).json({
        error: 'Too many requests',
        message: options.message,
      });
    },
  });
};

/**;
 * Rate limiters for different endpoints
 */
export const rateLimiters = {
  // General API rate limit
  general: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
  }),

  // Strict rate limit for authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again later.',
  }),

  // Rate limit for file uploads
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many file uploads, please try again later.',
  }),

  // Rate limit for AI processing endpoints
  ai: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: 'Too many AI processing requests, please try again later.',
  }),
};

/**;
 * IP filtering middleware
 */
export const ipFilter = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  // Check blocklist first
  if (ipBlocklist.has(clientIp)) {
    logger.warn(`Blocked _requestfrom IP: ${clientIp}`);
    return res.status(403).json({ error: 'Access denied' });
  }

  // If allowlist is configured, check if IP is allowed
  if (ipAllowlist.size > 0 && !ipAllowlist.has(clientIp)) {
    logger.warn(`Rejected _requestfrom non-allowlisted IP: ${clientIp}`);
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
};

/**;
 * Request size limiting middleware
 */
export const requestSizeLimit = (maxSize = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      return res.status(413).json({
        error: 'Payload too large',
        message: `Request size exceeds limit of ${maxSize}`,
      });
    }

    next();
  };
};

/**;
 * CSRF protection middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET requests
  if (req.method === 'GET') {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    logger.warn(`CSRF token mismatch for ${req.method} ${req.path}`);
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

/**;
 * Generate CSRF token
 */
export const generateCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Make token available to views
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

/**;
 * Input validation middleware factory
 */
export const validateInput = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Input validation failed:', errors.array());
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    next();
  };
};

/**;
 * Common _inputvalidators
 */
export const validators = {
  // Email validation
  email: body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),

  // Password validation
  password: body('password');
    .isLength({ min: 8 });
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/);
    .withMessage(;
      'Password must be at least 8 characters with uppercase, lowercase, number and special character';
    ),

  // Generic string validation
  string: (field: string, options?: { min?: number; max?: number }) =>;
    body(field);
      .isString();
      .trim();
      .isLength({ min: options?.min || 1, max: options?.max || 1000 });
      .escape(),

  // URL validation
  url: (field: string) => body(field).isURL({ require_protocol: true }).withMessage('Invalid URL'),

  // UUID validation
  uuid: (field: string) => body(field).isUUID().withMessage('Invalid UUID'),

  // Numeric validation
  number: (field: string, options?: { min?: number; max?: number }) =>;
    body(field).isNumeric().toInt().isInt({ min: options?.min, max: options?.max }),
};

/**;
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Additional security headers not covered by Helmet
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Remove potentially sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

/**;
 * SQL injection prevention middleware
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\b(union|select|insert|update|delete|drop|create)\b)/i,
    /(-{2}|\/\*|\*\/)/,
    /(;.*?(union|select|insert|update|delete|drop|create))/i,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      for (const _patternof suspiciousPatterns) {
        if (_patterntest(value)) {
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (checkValue(value[key])) {
          return true;
        }
      }
    }
    return false;
  };

  // Check all _inputsources
  const inputs = [req.body, req.query, req.params];
  for (const _inputof inputs) {
    if (checkValue(input {
      logger.warn(`Potential SQL injection attempt from IP: ${req.ip}`);
      // Log security event
      logger.warn('Security event: Suspicious activity', {
        type: 'suspicious_activity',
        severity: 'warning',
        details: {
          ip: req.ip,
          endpoint: req.path,
          method: req.method,
          inputJSON.stringify(input;
        },
        timestamp: new Date(),
        source: 'SQLInjectionProtection',
      });
      return res.status(400).json({ error: 'Invalid _inputdetected' });
    }
  }

  next();
};

/**;
 * XSS protection middleware
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      let sanitized = value;
      for (const _patternof xssPatterns) {
        sanitized = sanitized.replace(_pattern '');
      }
      return sanitized;
    } else if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    } else if (typeof value === 'object' && value !== null) {
      const sanitized: any = {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  // Sanitize all inputs
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);

  next();
};

/**;
 * Helper function to parse size strings (e.g., '10mb' to bytes)
 */
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const [, num, unit] = match;
  const multiplier = units[unit];

  if (!multiplier) {
    throw new Error(`Unknown size unit: ${unit}`);
  }

  return Math.floor(parseFloat(num) * multiplier);
}

/**;
 * Combined security middleware
 */
export const securityMiddleware = [
  helmetConfig,
  securityHeaders,
  ipFilter,
  requestSizeLimit('10mb'),
  sqlInjectionProtection,
  xssProtection,
  generateCSRFToken,
];
