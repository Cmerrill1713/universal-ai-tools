import { Request, Response, NextFunction, Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from '../utils/logger';
import { config } from '../config';
import { RateLimiter } from './rate-limiter';
import { CSRFProtection } from './csrf';
import { SQLInjectionProtection } from './sql-injection-protection';
import { JWTAuthService } from './auth-jwt';
import { AuthMiddleware } from './auth';
import { SupabaseClient } from '@supabase/supabase-js';

export interface SecurityConfig {
  enableHelmet?: boolean;
  enableCORS?: boolean;
  enableRateLimit?: boolean;
  enableCSRF?: boolean;
  enableSQLProtection?: boolean;
  enableHTTPS?: boolean;
  enableHSTS?: boolean;
  enableAuth?: boolean;
  corsOptions?: cors.CorsOptions;
  trustedProxies?: string[];
}

export class EnhancedSecurityMiddleware {
  private rateLimiter: RateLimiter;
  private csrfProtection: CSRFProtection;
  private sqlProtection: SQLInjectionProtection;
  private jwtAuth: JWTAuthService;
  private authMiddleware: AuthMiddleware;
  private config: Required<SecurityConfig>;

  constructor(supabase: SupabaseClient, config: SecurityConfig = {}) {
    this.config = {
      enableHelmet: config.enableHelmet ?? true,
      enableCORS: config.enableCORS ?? true,
      enableRateLimit: config.enableRateLimit ?? true,
      enableCSRF: config.enableCSRF ?? true,
      enableSQLProtection: config.enableSQLProtection ?? true,
      enableHTTPS: config.enableHTTPS ?? (process.env.NODE_ENV === 'production'),
      enableHSTS: config.enableHSTS ?? (process.env.NODE_ENV === 'production'),
      enableAuth: config.enableAuth ?? true,
      corsOptions: config.corsOptions || this.getDefaultCorsOptions(),
      trustedProxies: config.trustedProxies || ['127.0.0.1', '::1'],
    };

    // Initialize security components
    this.rateLimiter = new RateLimiter();
    this.csrfProtection = new CSRFProtection();
    this.sqlProtection = new SQLInjectionProtection();
    this.jwtAuth = new JWTAuthService(supabase);
    this.authMiddleware = new AuthMiddleware(supabase);
  }

  /**
   * Apply all security middleware to Express app
   */
  public applyTo(app: Application): void {
    // Trust proxies
    app.set('trust proxy', this.config.trustedProxies);

    // Apply security headers with Helmet
    if (this.config.enableHelmet) {
      app.use(this.getHelmetConfig());
    }

    // Apply CORS
    if (this.config.enableCORS) {
      app.use(cors(this.config.corsOptions));
    }

    // Apply custom security headers
    app.use(this.securityHeaders());

    // Apply HTTPS enforcement
    if (this.config.enableHTTPS) {
      app.use(this.enforceHTTPS());
    }

    // Apply SQL injection protection
    if (this.config.enableSQLProtection) {
      app.use(this.sqlProtection.middleware());
    }

    // Apply rate limiting
    if (this.config.enableRateLimit) {
      this.applyRateLimiting(app);
    }

    // Apply CSRF protection
    if (this.config.enableCSRF) {
      app.use(this.csrfProtection.injectToken());
    }

    // Log security middleware applied
    logger.info('Enhanced security middleware applied', {
      features: {
        helmet: this.config.enableHelmet,
        cors: this.config.enableCORS,
        rateLimit: this.config.enableRateLimit,
        csrf: this.config.enableCSRF,
        sqlProtection: this.config.enableSQLProtection,
        https: this.config.enableHTTPS,
        hsts: this.config.enableHSTS,
        auth: this.config.enableAuth,
      },
    });
  }

  /**
   * Get Helmet configuration
   */
  private getHelmetConfig() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Adjust based on your needs
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: [
            "'self'",
            'https://api.openai.com',
            'https://api.anthropic.com',
            'https://supabase.co',
            'wss://*.supabase.co',
          ],
          mediaSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: this.config.enableHTTPS ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: this.config.enableHSTS ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      } : false,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    });
  }

  /**
   * Get default CORS options
   */
  private getDefaultCorsOptions(): cors.CorsOptions {
    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl)
        if (!origin) return callback(null, true);

        // Check allowed origins
        const allowedOrigins = config.security.corsOrigins;
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Allow localhost in development
        if (config.server.isDevelopment && origin.includes('localhost')) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-CSRF-Token',
        'X-Requested-With',
        'Accept',
        'Accept-Language',
        'Content-Language',
        'Origin',
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Response-Time',
        'X-Request-ID',
      ],
      maxAge: 86400, // 24 hours
    };
  }

  /**
   * Custom security headers
   */
  private securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add request ID for tracking
      const requestId = this.generateRequestId();
      (req as any).id = requestId;
      res.set('X-Request-ID', requestId);

      // Additional security headers
      res.set({
        'X-XSS-Protection': '1; mode=block',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Expect-CT': 'enforce, max-age=86400',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      });

      // Remove insecure headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      next();
    };
  }

  /**
   * Enforce HTTPS in production
   */
  private enforceHTTPS() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip in development
      if (config.server.isDevelopment) {
        return next();
      }

      // Check if request is secure
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        return next();
      }

      // Redirect to HTTPS
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      logger.info('Redirecting to HTTPS', { from: req.url, to: httpsUrl });
      
      res.redirect(301, httpsUrl);
    };
  }

  /**
   * Apply rate limiting to different endpoint categories
   */
  private applyRateLimiting(app: Application): void {
    // Global rate limit
    app.use(this.rateLimiter.limit('authenticated'));

    // Strict limits for auth endpoints
    app.use('/api/auth/*', this.rateLimiter.limit('auth'));
    app.use('/api/register', this.rateLimiter.limit('auth'));
    app.use('/api/password-reset', this.rateLimiter.limit('password-reset'));

    // API key generation limit
    app.use('/api/keys/generate', this.rateLimiter.limit('api-key-generation'));

    // File upload limits
    app.use('/api/upload', this.rateLimiter.limit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 100, // 100 uploads per hour
    }));

    // Heavy operation limits
    app.use('/api/export', this.rateLimiter.limit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 exports per hour
    }));

    app.use('/api/import', this.rateLimiter.limit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 imports per hour
    }));
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get authentication middleware
   */
  public getAuthMiddleware(options?: any) {
    if (this.config.enableAuth) {
      return this.authMiddleware.authenticate(options);
    }
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  /**
   * Get JWT authentication middleware
   */
  public getJWTMiddleware(options?: any) {
    if (this.config.enableAuth) {
      return this.jwtAuth.authenticate(options);
    }
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  /**
   * Get CSRF middleware for specific routes
   */
  public getCSRFMiddleware() {
    if (this.config.enableCSRF) {
      return this.csrfProtection.middleware();
    }
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  /**
   * Get rate limiter for custom limits
   */
  public getRateLimiter() {
    return this.rateLimiter;
  }

  /**
   * Get JWT auth service
   */
  public getJWTService() {
    return this.jwtAuth;
  }

  /**
   * Security status endpoint handler
   */
  public getSecurityStatus() {
    return async (req: Request, res: Response) => {
      const rateLimitStats = await this.rateLimiter.getStats();
      const sqlProtectionStats = this.sqlProtection.getStats();

      res.json({
        status: 'operational',
        features: {
          helmet: this.config.enableHelmet,
          cors: this.config.enableCORS,
          rateLimit: this.config.enableRateLimit,
          csrf: this.config.enableCSRF,
          sqlProtection: this.config.enableSQLProtection,
          https: this.config.enableHTTPS,
          hsts: this.config.enableHSTS,
          auth: this.config.enableAuth,
        },
        stats: {
          rateLimit: rateLimitStats,
          sqlProtection: sqlProtectionStats,
        },
        timestamp: new Date().toISOString(),
      });
    };
  }

  /**
   * Apply security patches for known vulnerabilities
   */
  public applySecurityPatches(app: Application): void {
    // Prevent HTTP Parameter Pollution
    app.use((req: Request, res: Response, next: NextFunction) => {
      for (const key in req.query) {
        if (Array.isArray(req.query[key])) {
          req.query[key] = (req.query[key] as string[])[0];
        }
      }
      next();
    });

    // Prevent clickjacking with additional headers
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      next();
    });

    // Add security monitoring
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        
        // Log slow requests
        if (duration > 5000) {
          logger.warn('Slow request detected', {
            method: req.method,
            path: req.path,
            duration,
            statusCode: res.statusCode,
          });
        }
        
        // Log failed authentication attempts
        if (res.statusCode === 401 || res.statusCode === 403) {
          logger.warn('Authentication failure', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        }
      });
      
      next();
    });
  }
}

export default EnhancedSecurityMiddleware;