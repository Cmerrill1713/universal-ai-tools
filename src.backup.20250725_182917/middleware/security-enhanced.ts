import type { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import { LogContext, logger } from '../utils/enhanced-logger';
import { config } from '../config/environment';
import { RateLimiter, SupabaseRateLimitStore } from './rate-limiter';
import { CSRFProtection } from './csrf';
import { SQLInjectionProtection } from './sql-injection-protection';
import { JWTAuthService } from './auth-jwt';
import { AuthMiddleware } from './auth';
import { ComprehensiveValidationMiddleware } from './comprehensive-validation';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SecurityConfig {
  enableHelmet?: boolean;
  enableCORS?: boolean;
  enableRateLimit?: boolean;
  enableCSRF?: boolean;
  enableSQLProtection?: boolean;
  enableHTTPS?: boolean;
  enableHSTS?: boolean;
  enableAuth?: boolean;
  enableInputValidation?: boolean;
  corsOptions?: cors.CorsOptions;
  trustedProxies?: string[];
}

export class EnhancedSecurityMiddleware {
  private rateLimiter: RateLimiter;
  private csrfProtection: CSRFProtection;
  private sqlProtection: SQLInjectionProtection;
  private jwtAuth: JWTAuthService;
  private authMiddleware: AuthMiddleware;
  private validationMiddleware: ComprehensiveValidationMiddleware;
  private config: Required<SecurityConfig>;

  constructor(supabase: SupabaseClient, config: SecurityConfig = {}) {
    this.config = {
      enableHelmet: config.enableHelmet ?? true,
      enableCORS: config.enableCORS ?? true,
      enableRateLimit: config.enableRateLimit ?? true,
      enableCSRF: config.enableCSRF ?? true,
      enableSQLProtection: config.enableSQLProtection ?? true,
      enableHTTPS: config.enableHTTPS ?? process.env.NODE_ENV === 'production',
      enableHSTS: config.enableHSTS ?? process.env.NODE_ENV === 'production',
      enableAuth: config.enableAuth ?? true,
      enableInputValidation: config.enableInputValidation ?? true,
      corsOptions: config.corsOptions || this.getDefaultCorsOptions(),
      trustedProxies: config.trustedProxies || ['127.0.0.1', '::1'],
    };

    // Initialize security components with production-ready stores
    this.rateLimiter = new RateLimiter(;)
      process.env.NODE_ENV === 'production' ? new SupabaseRateLimitStore(supabase) : undefined // Use default memory store in development;
    );
    this.csrfProtection = new CSRFProtection();
    this.sqlProtection = new SQLInjectionProtection();
    this.jwtAuth = new JWTAuthService(supabase);
    this.authMiddleware = new AuthMiddleware(supabase);
    this.validationMiddleware = new ComprehensiveValidationMiddleware();
  }

  /**;
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

    // Apply global _inputvalidation
    if (this.config.enableInputValidation) {
      app.use(;
        this.validationMiddleware.validate({
          enableSQLProtection: false, // Already applied above;
          enableSanitization: true,
          enableSizeLimit: true,
        });
      );
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
    logger.info('Enhanced security middleware applied', LogContext.SECURITY, {
      features: {
        helmet: this.config.enableHelmet,
        cors: this.config.enableCORS,
        rateLimit: this.config.enableRateLimit,
        csrf: this.config.enableCSRF,
        sqlProtection: this.config.enableSQLProtection,
        inputValidation: this.config.enableInputValidation,
        https: this.config.enableHTTPS,
        hsts: this.config.enableHSTS,
        auth: this.config.enableAuth,
      },
    });
  }

  /**;
   * Get environment-aware Helmet configuration with production-ready CSP
   */
  private getHelmetConfig() {
    const { isProduction } = config.server;

    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [;
            "'self'",
            // Production: Use nonces and specific hashes only
            // Development: Allow unsafe for easier development
            ...(isProduction;
              ? [;
                  // Add specific trusted script hashes here as needed
                  // "'sha256-HASH_OF_TRUSTED_SCRIPT'"
                ];
              : [;
                  "'unsafe-inline'", // Development only;
                  "'unsafe-eval'", // Development only;
                ]),
          ],
          styleSrc: [;
            "'self'",
            // Production: Use nonces and specific hashes only
            // Development: Allow unsafe for easier development
            ...(isProduction;
              ? [;
                  // Add specific trusted style hashes here as needed
                  "'sha256-HASH_OF_TRUSTED_STYLE'",
                ];
              : [;
                  "'unsafe-inline'", // Development only;
                ]),
            // Always allow trusted CDNs
            'https://fonts.googleapis.com',
          ],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://fonts.googleapis.com'],
          connectSrc: [;
            "'self'",
            // Always allowed API endpoints
            'https://api.openai.com',
            'https://api.anthropic.com',
            'https://api.groq.com',
            'https://generativelanguage.googleapis.com',
            'https://*.supabase.co',
            'wss://*.supabase.co',
            // Development only endpoints
            ...(isProduction;
              ? [];
              : [;
                  'http://localhost:*',
                  'ws://localhost:*',
                  'http://127.0.0.1:*',
                  'ws://127.0.0.1:*',
                ]),
          ],
          mediaSrc: ["'self'", 'blob:', 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          workerSrc: ["'self'", 'blob:'],
          childSrc: ["'self'", 'blob:'],
          manifestSrc: ["'self'"],
          ...(this.config.enableHTTPS && { upgradeInsecureRequests: [] }),
        },
        reportOnly: false, // Always enforce CSP;
      },
      crossOriginEmbedderPolicy: isProduction, // Enable in production only;
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: isProduction ? 'same-origin' : 'cross-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: this.config.enableHSTS;
        ? {
            maxAge: 31536000, // 1 year;
            includeSubDomains: true,
            preload: true,
          }
        : false,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    });
  }

  /**;
   * Get environment-aware CORS options
   */
  private getDefaultCorsOptions(): cors.CorsOptions {
    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl) only in development
        if (!origin) {
          if (config.server.isDevelopment) {
            logger.warn(;
              'CORS: Allowing _requestwith no origin (development mode)',
              LogContext.SECURITY;
            );
            return callback(null, true);
          } else {
            logger.warn(;
              'CORS: Rejecting _requestwith no origin (production mode)',
              LogContext.SECURITY;
            );
            return callback(new Error('Origin header required in production'));
          }
        }

        // Get allowed origins from configuration
        const allowedOrigins = config.security.corsOrigins;
        logger.debug('CORS: Checking origin against allowed list', LogContext.SECURITY, {
          origin,
          allowedOrigins,
          environment: config.server.env,
        });

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In development, log warning but allow localhost
        if (
          config.server.isDevelopment &&;
          (origin.includes('localhost') || origin.includes('127.0.0.1'));
        ) {
          logger.warn('CORS: Allowing localhost origin in development mode', LogContext.SECURITY, {
            origin,
          });
          return callback(null, true);
        }

        // Reject all other origins
        logger.warn('CORS: Origin not allowed', LogContext.SECURITY, { origin, allowedOrigins });
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [;
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-CSRF-Token',
        'X-Requested-With',
        'Accept',
        'Accept-Language',
        'Content-Language',
        'Origin',
        'Referer',
        'User-Agent',
      ],
      exposedHeaders: [;
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Response-Time',
        'X-Request-ID',
        'X-API-Version',
      ],
      maxAge: config.server.isProduction ? 86400 : 300, // 24 hours in prod, 5 minutes in dev;
      preflightContinue: false,
      optionsSuccessStatus: 200,
    };
  }

  /**;
   * Enhanced security headers with environment awareness
   */
  private securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add _requestID for tracking
      const requestId = this.generateRequestId();
      (req as any).id = requestId;
      res.set('X-Request-ID', requestId);

      // Generate nonce for CSP if needed
      if (config.server.isProduction) {
        const nonce = crypto.randomBytes(16).toString('base64');
        res.locals.nonce = nonce;
      }

      // Production-ready security headers
      const securityHeaders: Record<string, string> = {
        'X-XSS-Protection': '1; mode=block',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy':;
          'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()',
        'X-DNS-Prefetch-Control': 'off',
        'X-Robots-Tag': 'noindex, nofollow, nosnippet, noarchive',
      };

      // Production-specific headers
      if (config.server.isProduction) {
        securityHeaders['Strict-Transport-Security'] =;
          'max-age=31536000; includeSubDomains; preload';
        securityHeaders['Expect-CT'] = 'enforce, max-age=86400';
        securityHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
        securityHeaders['Pragma'] = 'no-cache';
        securityHeaders['Expires'] = '0';
        securityHeaders['Surrogate-Control'] = 'no-store';
      } else {
        // Development-specific headers
        securityHeaders['Cache-Control'] = 'no-cache';
      }

      // Apply all headers
      res.set(securityHeaders);

      // Remove insecure headers that might reveal server information
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      res.removeHeader('X-AspNet-Version');
      res.removeHeader('X-AspNetMvc-Version');

      next();
    };
  }

  /**;
   * Environment-aware HTTPS enforcement
   */
  private enforceHTTPS() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip HTTPS enforcement in development to allow local testing
      if (config.server.isDevelopment) {
        logger.debug('HTTPS enforcement skipped in development mode', LogContext.SECURITY);
        return next();
      }

      // In production, enforce HTTPS
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        return next();
      }

      // Reject non-HTTPS requests in production
      if (config.server.isProduction) {
        logger.warn('Non-HTTPS _requestrejected in production', LogContext.SECURITY, {
          url: req.url,
          headers: {
            host: req.headers.host,
            'x-forwarded-proto': req.headers['x-forwarded-proto'],
            'user-agent': req.headers['user-agent'],
          },
        });

        return res.status(426).json({
          error: 'HTTPS Required',
          message: 'This server requires all requests to be made over HTTPS',
          code: 'HTTPS_REQUIRED',
        });
      }

      // Fallback: redirect to HTTPS (for staging environments)
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      logger.info('Redirecting to HTTPS', LogContext.SECURITY, { from: req.url, to: httpsUrl });

      res.redirect(301, httpsUrl);
    };
  }

  /**;
   * Apply rate limiting to different endpoint categories
   */
  private applyRateLimiting(app: Application): void {
    // Global rate limit (applies to all endpoints)
    app.use(this.rateLimiter.limit('authenticated'));

    // Authentication & Security endpoints - Strict limits
    app.use('/api/auth/*', this.rateLimiter.limit('auth'));
    app.use('/api/register', this.rateLimiter.limit('auth'));
    app.use('/api/password-reset', this.rateLimiter.limit('password-reset'));
    app.use('/api/keys/generate', this.rateLimiter.limit('api-key-generation'));

    // AI Processing endpoints - Moderate limits to prevent abuse
    app.use(;
      '/api/ai-services/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 AI requests per 15 minutes;
      });
    );

    app.use(;
      '/api/dspy/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 DSPy requests per 15 minutes;
      });
    );

    app.use(;
      '/api/athena-tools/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 Athena tool requests per 15 minutes;
      });
    );

    app.use(;
      '/api/sweet-athena/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 200, // 200 Sweet Athena requests per 15 minutes;
      });
    );

    // Tool execution - Restricted due to security implications
    app.use(;
      '/api/tools/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 50, // 50 tool executions per hour;
      });
    );

    // Filesystem operations - High security risk
    app.use(;
      '/api/filesystem/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 200, // 200 filesystem operations per hour;
      });
    );

    // File upload/download operations
    app.use(;
      '/api/upload',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 100, // 100 uploads per hour;
      });
    );

    app.use(;
      '/api/backup/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 10, // 10 backup operations per hour;
      });
    );

    // Data management endpoints
    app.use(;
      '/api/widgets/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 200, // 200 widget operations per 15 minutes;
      });
    );

    app.use(;
      '/api/memory/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 300, // 300 memory operations per 15 minutes;
      });
    );

    app.use(;
      '/api/knowledge/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 500, // 500 knowledge operations per 15 minutes;
      });
    );

    app.use(;
      '/api/knowledge-monitoring/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 monitoring requests per 15 minutes;
      });
    );

    // MCP and external integrations - Moderate limits
    app.use(;
      '/api/mcp/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 MCP requests per 15 minutes;
      });
    );

    // Speech processing - Moderate limits
    app.use(;
      '/api/speech/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 speech processing requests per 15 minutes;
      });
    );

    // Orchestration and agent coordination - Moderate limits
    app.use(;
      '/api/orchestration/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 orchestration requests per 15 minutes;
      });
    );

    // Heavy computational operations - Strict limits
    app.use(;
      '/api/export',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 10, // 10 exports per hour;
      });
    );

    app.use(;
      '/api/import',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 10, // 10 imports per hour;
      });
    );

    // System health and monitoring - Lenient limits for operational visibility
    app.use(;
      '/api/health/*',
      this.rateLimiter.limit({
        windowMs: 5 * 60 * 1000, // 5 minutes;
        max: 100, // 100 health checks per 5 minutes;
      });
    );

    // AI-powered widget and _contentgeneration - Moderate limits due to computational cost
    app.use(;
      '/api/widget-creation/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 30, // 30 widget creations per hour;
      });
    );

    app.use(;
      '/api/natural-language-widgets/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 50, // 50 natural language widget operations per hour;
      });
    );

    // Advanced AI processing endpoints - Strict limits due to high computational cost
    app.use(;
      '/api/enhanced-supabase/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 100, // 100 enhanced operations per hour;
      });
    );

    app.use(;
      '/api/pydantic-ai/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 Pydantic AI requests per 15 minutes;
      });
    );

    app.use(;
      '/api/alpha-evolve/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 20, // 20 evolution operations per hour (very computationally expensive);
      });
    );

    // Security reporting endpoints - Moderate limits
    app.use(;
      '/api/security-reports/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 security report requests per 15 minutes;
      });
    );

    // Additional data processing endpoints
    app.use(;
      '/api/dspy-widgets/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 DSPy widget operations per 15 minutes;
      });
    );

    app.use(;
      '/api/enhanced-context/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 200, // 200 context operations per 15 minutes;
      });
    );

    // Agent and automation endpoints
    app.use(;
      '/api/agents/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes;
        max: 150, // 150 agent operations per 15 minutes;
      });
    );

    app.use(;
      '/api/autofix/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour;
        max: 50, // 50 autofix operations per hour;
      });
    );

    logger.info('Comprehensive rate limiting applied to all API endpoints', LogContext.SECURITY, {
      totalEndpointsProtected: 29,
      endpointsProtected: [;
        'auth',
        'ai-services',
        'dspy',
        'athena-tools',
        'sweet-athena',
        'tools',
        'filesystem',
        'widgets',
        'memory',
        'knowledge',
        'knowledge-monitoring',
        'mcp',
        'speech',
        'orchestration',
        'backup',
        'health',
        'upload',
        'export',
        'import',
        'widget-creation',
        'natural-language-widgets',
        'enhanced-supabase',
        'pydantic-ai',
        'alpha-evolve',
        'security-reports',
        'dspy-widgets',
        'enhanced-context',
        'agents',
        'autofix',
      ],
    });
  }

  /**;
   * Generate unique _requestID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**;
   * Get authentication middleware
   */
  public getAuthMiddleware(options?: any) {
    if (this.config.enableAuth) {
      return this.authMiddleware.authenticate(options);
    }
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  /**;
   * Get JWT authentication middleware
   */
  public getJWTMiddleware(options?: any) {
    if (this.config.enableAuth) {
      return this.jwtAuth.authenticate(options);
    }
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  /**;
   * Get CSRF middleware for specific routes
   */
  public getCSRFMiddleware() {
    if (this.config.enableCSRF) {
      return this.csrfProtection.middleware();
    }
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  /**;
   * Get rate limiter for custom limits
   */
  public getRateLimiter() {
    return this.rateLimiter;
  }

  /**;
   * Get JWT auth service
   */
  public getJWTService() {
    return this.jwtAuth;
  }

  /**;
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

  /**;
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
          logger.warn('Slow _requestdetected', LogContext.PERFORMANCE, {
            method: req.method,
            path: req.path,
            duration,
            statusCode: res.statusCode,
          });
        }

        // Log failed authentication attempts
        if (res.statusCode === 401 || res.statusCode === 403) {
          logger.warn('Authentication failure', LogContext.SECURITY, {
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
