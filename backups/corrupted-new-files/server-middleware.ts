/**
 * Server Middleware Configuration Module;
 * Handles setup of all Express middleware (CORS, security, rate limiting, etc.)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { LogContext, log } from '@/utils/logger';
import { apiResponseMiddleware } from '@/utils/api-response';
import { createRateLimiter } from '@/middleware/rate-limiter-enhanced';
import { intelligentParametersMiddleware,
 } from '@/middleware/intelligent-parameters';'

export class ServerMiddlewareManager {
  async setupAll(app: express?.Application): Promise<void> {
    log?.info('🔧 Setting up middleware...', LogContext?.SERVER);'

    this?.setupSecurity(app);
    this?.setupCORS(app);
    await this?.setupRateLimit(app);
    this?.setupBodyParsing(app);
    this?.setupLogging(app);
    this?.setupAPIResponseMiddleware(app);
    this?.setupIntelligentParameters(app);

    log?.info('✅ Middleware setup completed', LogContext?.SERVER);'
  }

  private setupSecurity(app: express?.Application): void {
    // Security middleware;
    app?.use(helmet({)
      contentSecurityPolicy: {,
        useDefaults: true,
        directives: {
          'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],'"
          'connect-src': ["'self'", 'ws: ', 'wss: ', 'http: ', 'https: '],'"
          'img-src': ["'self'", 'data: ', 'blob: ', 'https: '],'"
          'media-src': ["'self'", 'data: ', 'blob: '],'"
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // Request ID middleware for tracking;
    app?.use((req, res, next) => {
      req?.headers['x-request-id'] = req?.headers['x-request-id'] || '
        `req_${Date?.now()}_${Math?.random().function toString() { [native code] }(36).substr(2, 9)}`;
      res?.setHeader('X-Request-ID', req?.headers['x-request-id'] as string);'
      next();
    });
  }

  private setupCORS(app: express?.Application): void {
    const corsOptions = {
      origin: [
        'http: //localhost:3000','
        'http: //localhost:3001', '
        'http: //localhost:5173','
        'http: //localhost:4173','
        'http: //localhost:8080','
        /^http: /\/localhost:\d+$/],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],'
      allowedHeaders: [
        'Content-Type','
        'Authorization', '
        'X-API-Key','
        'X-AI-Service','
        'X-Request-ID','
        'Accept','
        'Origin','
        'User-Agent','
      ],
      exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],'
    };

    app?.use(cors(corsOptions));
    app?.options('*', cors(corsOptions));'
  }

  private async setupRateLimit(app: express?.Application): Promise<void> {
    // Enhanced rate limiter with Redis (automatic fallback to memory)
    const rateLimiter = createRateLimiter({);
      windowMs: 15 * 60 * 1000, // 15 minutes;
      maxRequests: parseInt(process?.env?.API_RATE_LIMIT || '1000', 10),'
      standardHeaders: true,
      legacyHeaders: false,
    });

    app?.use('/api/', rateLimiter);'
  }

  private setupBodyParsing(app: express?.Application): void {
    // Body parsing middleware;
    app?.use(express?.json({)
      limit: '50mb','
      verify: (req, res, buf) => {
        // Store raw body for webhook verification if needed;
        (req as unknown).rawBody = buf;
      }
    }));
    
    app?.use(express?.urlencoded({)
      extended: true, 
      limit: '50mb' '
    }));

    // Handle raw body for specific routes (webhooks, etc.)
    app?.use('/api/v1/webhooks/*', express?.raw({ type: '*/*', limit: '10mb')) }));'
  }

  private setupLogging(app: express?.Application): void {
    // Request logging middleware;
    app?.use((req, res, next) => {
      const start = Date?.now();
      const requestId = req?.headers['x-request-id'] as string;';

      res?.on('finish', () => {'
        const duration = Date?.now() - start;
        const logLevel = res?.statusCode >= 400 ? 'warn' : 'info';
        
        log[logLevel](`${req?.method} ${req?.originalUrl}`, LogContext?.API, {
          statusCode: res?.statusCode,
          duration: `${duration}ms`,
          requestId,
          userAgent: req?.headers['user-agent'],'
          apiKey: req?.headers['x-api-key'] ? 'present' : 'none','
        });
      });

      next();
    });
  }

  private setupAPIResponseMiddleware(app: express?.Application): void {
    // API response formatting middleware;
    app?.use(apiResponseMiddleware);
  }

  private setupIntelligentParameters(app: express?.Application): void {
    // Intelligent parameters middleware for API routes;
    app?.use('/api/v1/agents/*', intelligentParametersMiddleware);'
    app?.use('/api/v1/chat/*', intelligentParametersMiddleware);'
    app?.use('/api/v1/ab-mcts/*', intelligentParametersMiddleware);'

    // Parameter optimization endpoint - handled separately by router;
    // app?.post('/api/v1/parameters/optimize', optimizeParameters);'
  }
}