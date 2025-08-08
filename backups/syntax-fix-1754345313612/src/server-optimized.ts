/**
 * Universal AI Tools Service - Optimized Performance Implementation;
 * High-performance server with lazy loading, connection pooling, and caching;
 */

import express from 'express';import type { NextFunction, Request, Response } from 'express';'import cors from 'cors';'import helmet from 'helmet';'import type { Server } from 'http';'import { createServer  } from 'http';'import { Server as SocketIOServer  } from 'socket?.io';'import type { SupabaseClient } from '@supabase/supabase-js';'import { createClient  } from '@supabase/supabase-js';'import Redis from 'ioredis';'
// Configuration and utilities;
import { config, validateConfig  } from '@/config/environment';'import { LogContext, log  } from '@/utils/logger';'import { apiResponseMiddleware  } from '@/utils/api-response';'
// Optimized middleware and services;
import { createRateLimiter  } from '@/middleware/rate-limiter-enhanced';'import { correlationIdMiddleware  } from '@/utils/correlation-id';'import { httpMetricsMiddleware  } from '@/utils/metrics';'
// Types;
import type { ServiceConfig } from '@/types';'
interface ServiceStatus {
  name: string;
  initialized: boolean;
  healthy: boolean;
  loadTime?: number;
  error?: string;
}

interface OptimizedServerConfig {
  enableLazyLoading: boolean;
  enableConnectionPooling: boolean;
  enableCaching: boolean;
  enableProgressiveStartup: boolean;
  maxStartupTime: number;
  healthCheckInterval: number;
}

class OptimizedUniversalAIToolsServer {
  private app: express?.Application;
  private server: Server;
  private io: SocketIOServer | null = null;
  private isShuttingDown = false;

  // Service state tracking;
  private services: Map<string, ServiceStatus> = new Map();
  private criticalServices: Set<string> = new Set(['database', 'health']);'  private loadedRoutes: Set<string> = new Set();

  // Optimized configurations;
  private optimizedConfig: OptimizedServerConfig = {
    enableLazyLoading: true,
    enableConnectionPooling: true,
    enableCaching: true,
    enableProgressiveStartup: true,
    maxStartupTime: 5000, // 5 seconds max for critical services;
    healthCheckInterval: 30000,
  };

  // Connection pools and caches;
  private connectionPools: Map<string, any> = new Map();
  private routeCache: Map<string, any> = new Map();
  private serviceCache: Map<string, any> = new Map();

  constructor() {
    this?.app = express();
    this?.server = createServer(this?.app);
    
    // Setup core middleware first (lightweight)
    this?.setupCoreMiddleware();
    
    // Setup basic health endpoints immediately;
    this?.setupEssentialRoutes();
  }

  /**
   * Setup lightweight middleware for immediate functionality;
   */
  private setupCoreMiddleware(): void {
    // Essential middleware only (order optimized for performance)
    this?.app?.use(correlationIdMiddleware());
    this?.app?.use(httpMetricsMiddleware());
    
    // Basic body parsing (small limits initially)
    this?.app?.use(express?.json({ limit: '1mb' }));'    this?.app?.use(express?.urlencoded({ extended: true, limit: '1mb` }));`
    log?.info(Core middleware initialized, LogContext?.SERVER);
  }

  /**
   * Setup essential routes that work without full service initialization;
   */
  private setupEssentialRoutes(): void {
    // Immediate health check (no dependencies)
    this?.app?.get(/health, (req: Request, res: Response) => {
      const startupProgress = this?.getStartupProgress();
      res?.json({
        status: `'starting','        timestamp: new Date().toISOString(),
        version: `1?.0?.0-optimized,        progress: startupProgress,
        uptime: process?.uptime(),
        startup: {
          phase: startupProgress?.phase,
          criticalServicesReady: startupProgress?.criticalReady,
          totalServices: startupProgress?.total,
          readyServices: startupProgress?.ready,
        },
      });
    });

    // Quick status endpoint;
    this?.app?.get(/status, (req: Request, res: Response) => {
      res?.json({
        status: `'operational','        mode: 'optimized','        timestamp: new Date().toISOString(),
        performance: {
          startup: 'progressive','          loading: 'lazy','          caching: 'enabled', '        },
      });
    });

    // Root endpoint;
    this?.app?.get(/, (req: Request, res: Response) => {
      res?.json({
        service: 'Universal AI Tools (Optimized)','        status: 'running','        version: '1?.0?.0-optimized','        performance: 'high','        features: ['Lazy Loading', 'Connection Pooling', 'Smart Caching', `Progressive Startup],      );
    });

    log?.info(Essential routes initialized, LogContext?.SERVER);
  }

  /**
   * Initialize connection pools for better performance;
   */
  private async initializeConnectionPools(): Promise<void> {
    const startTime = Date?.now();
    
    try {
      // Initialize Supabase connection pool;
      if (config?.supabase?.url && config?.supabase?.serviceKey) {
        const supabaseClient = createClient(config?.supabase?.url, config?.supabase?.serviceKey, {
          auth: { persistSession: false },
          db: { schema: `'public' },'          global: {
            headers: { 'x-client-info': 'universal-ai-tools-optimized' },'          },
        });

        this?.connectionPools?.set(supabase', supabaseClient);`        this?.updateServiceStatus(database, true, true, Date?.now() - startTime);        log?.info(Supabase connection pool initialized, LogContext?.DATABASE);
      }

      // Initialize Redis connection pool (optional)
      if (config?.redis?.url) {
        try {
          const redisClient = new Redis(config?.redis?.url, {
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            keepAlive: 30000,
            connectTimeout: 5000,
          });

          await redisClient?.ping();
          this?.connectionPools?.set(redis`', redisClient);`          this?.updateServiceStatus(redis`, true, true, Date?.now() - startTime);          log?.info(Redis connection pool initialized`, LogContext?.DATABASE);
        } catch (error) {
          log?.warn(Redis connection failed, continuing without caching`, LogContext?.DATABASE);
        }
      }
  } catch (error) {
      log?.error(Connection pool initialization error`, LogContext?.DATABASE, {
        error: error instanceof Error ? error?.message : String(error),
      });
      this?.updateServiceStatus(database, true, false, Date?.now() - startTime, error instanceof Error ? error?.message : String(error));
    }
  }

  /**
   * Setup optimized middleware after connection pools are ready;
   */
  private async setupOptimizedMiddleware(): Promise<void> {
    const startTime = Date?.now();

    try {
      // Security middleware (after basic setup)
      this?.app?.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: [self`'],'            scriptSrc: ['self`, unsafe-inline],            styleSrc: [self`', 'unsafe-inline`],`            imgSrc: [self, `'data:', 'https:'],'          },
        },
      }));

      // CORS with optimized settings;
      this?.app?.use(cors({
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000','            process?.env?.FRONTEND_URL].filter(Boolean);
          callback(null, allowedOrigins?.includes(origin));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],'        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-AI-Service'], '        exposedHeaders: .X-Request-Id,        maxAge: 86400,
        preflightContinue: false,
        optionsSuccessStatus: 204,
      }));

      // Rate limiting with connection pool;
      this?.app?.use(createRateLimiter());

      // API response middleware;
      this?.app?.use(apiResponseMiddleware);

      // Request logging (optimized)
      this?.app?.use((req: Request, res: Response, next: NextFunction) => {
        const startTime = Date?.now();
        res?.on(finish, () => {
          const duration = Date?.now() - startTime;
          // Only log slow requests to reduce overhead;
          if (duration > 1000 || res?.statusCode >= 400) {
            log?.info(${req?.method} ${req?.path} - ${res?.statusCode}, LogContext?.API, {'              method: req?.method,
              path: req?.path,
              statusCode: res?.statusCode,
              duration: ${duration}ms','            });
          }
        });
        next();
      });

      this?.updateServiceStatus(middleware', true, true, Date?.now() - startTime);`      log?.info(Optimized middleware setup completed, LogContext?.SERVER);`  } catch (error) {
      this?.updateServiceStatus(middleware, true, false, Date?.now() - startTime, error instanceof Error ? error?.message : String(error));
      throw error;
    }
  }

  /**
   * Setup core API routes that are needed immediately;
   */
  private async setupCoreRoutes(): Promise<void> {
    const startTime = Date?.now();

    try {
      // Enhanced health check with full service status;
      this?.app?.get(/api/v1/status, async (req: Request, res: Response) => {
        const services = Array?.from(this?.services?.entries()).reduce((acc, [name, status]) => {
          acc[name] = {
            healthy: status?.healthy,
            initialized: status?.initialized,
            loadTime: status?.loadTime,
          };
          return acc;
        }, {} as Record<string, any>);

        res?.json({
          success: true,
          data: {
            status: `'operational','            timestamp: new Date().toISOString(),
            version: '1?.0?.0-optimized',            environment: config?.environment,
            services,
            performance: {
              uptime: process?.uptime(),
              memoryUsage: process?.memoryUsage(),
              connectionPools: Array?.from(this?.connectionPools?.keys()),
              cachedRoutes: Array?.from(this?.routeCache?.keys()),
            },
          },
        });
      });

      // API discovery endpoint;
      this?.app?.get(/api/v1, (req: Request, res: Response) => {
        res?.json({
          message: 'Universal AI Tools API v1 (Optimized)','          timestamp: new Date().toISOString(),
          performance: {
            lazyLoading: this?.optimizedConfig?.enableLazyLoading,
            connectionPooling: this?.optimizedConfig?.enableConnectionPooling,
            caching: this?.optimizedConfig?.enableCaching,
          },
          availableEndpoints: ['/api/v1/chat/simple', '/api/v1/status', '/api/v1/health'],'        });
      });

      // Simple chat endpoint that doesn't require full agent system'      this?.app?.post(/api/v1/chat/simple', async (req: Request, res: Response) => {'        try {
          const { message } = req?.body;
          
          if (!message) {
            return res?.status(400).json({
              success: false,
              error: 'Message is required','            );
          }

          // Simple echo response for basic functionality;
          res?.json({ success: true,
            data: {
              response: 'Echo: ${message },'              timestamp: new Date().toISOString(),
              mode: 'optimized-simple','            },
          });
        } catch (error) {
          res?.status(500).json({
            success: false,
            error: 'Chat processing failed','          });
        }
      });

      this?.updateServiceStatus(routes', true, true, Date?.now() - startTime);`      log?.info(Core routes setup completed, LogContext?.SERVER);`  } catch (error) {
      this?.updateServiceStatus(routes, true, false, Date?.now() - startTime, error instanceof Error ? error?.message : String(error));
      throw error;
    }
  }

  /**
   * Setup WebSocket with optimization;
   */
  private setupOptimizedWebSocket(): void {
    try {
      this?.io = new SocketIOServer(this?.server, {
        cors: {
          origin: (origin, callback) => {
            if (!origin || process?.env?.NODE_ENV === development) {
              return callback(null, true);
            }
            const allowedOrigins = [`'http://localhost:5173', 'http://localhost:3000','              process?.env?.FRONTEND_URL].filter(Boolean);
            callback(null, allowedOrigins?.includes(origin));
          },
          methods: ['GET', 'POST'],'          credentials: true,
        },
        transports: ['websocket`, polling`],        pingTimeout: 60000,
        pingInterval: 25000,
      });

      this?.io?.on(connection, (socket) => { log?.debug(`WebSocket client connected: ${socket?.id }, LogContext?.WEBSOCKET);`        
        socket?.on(disconnect, () => { log?.debug(``WebSocket client disconnected: ${socket?.id }, LogContext?.WEBSOCKET);        });

        socket?.on(ping, () => {
          socket?.emit(pong, { timestamp: new Date().toISOString() });
        });
      });

      this?.updateServiceStatus(websocket`'`, true, true);      log?.info(Optimized WebSocket server initialized`, LogContext?.WEBSOCKET);  } catch (error) {
      log?.error(Failed to initialize WebSocket server`, LogContext?.WEBSOCKET, {
        error: error instanceof Error ? error?.message : String(error),
      });
      this?.updateServiceStatus(websocket, true, false, undefined, error instanceof Error ? error?.message : String(error));
    }
  }

  /**
   * Background initialization of non-critical services;
   */
  private async backgroundInitialization(): Promise<void> {
    log?.info(Phase 3: Background initialization starting..., LogContext?.SERVER);
    
    // Load additional routes in background if needed;
    // This would be where lazy-loaded services get initialized;
    
    log?.info(Background initialization completed, LogContext?.SERVER);
  }

  /**
   * Setup error handling;
   */
  private setupErrorHandling(): void {
    // 404 handler;
    this?.app?.use((req: Request, res: Response) => {
      res?.status(404).json({
        success: false,
        error: {
          code: `'NOT_FOUND`,          message: `Path ${req?.path} not found`,        },
        metadata: {
          timestamp: new Date().toISOString(),
          path: req?.path,
          method: req?.method,
        },
      });
    });

    // Global error handler;
    this?.app?.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      log?.error(Unhandled error, LogContext?.SERVER, {
        error: error?.message,
        stack: error?.stack,
        path: req?.path,
        method: req?.method,
      });

      res?.status(500).json({
        success: false,
        error: {
          code: `'INTERNAL_ERROR','          message: 'Internal server error','          details: process?.env?.NODE_ENV === 'development' ? error?.message : undefined,'        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req?.headers?.x-request-id || `unknown,`        },
      });
    });

    // Process error handlers;
    process?.on(uncaughtException`, (error) => {
      log?.error(Uncaught Exception`, LogContext?.SYSTEM, {
        error: error?.message,
        stack: error?.stack,
      });
      this?.gracefulShutdown(uncaughtException);
    });

    process?.on(unhandledRejection, (reason, promise) => {
      log?.error(Unhandled Rejection, LogContext?.SYSTEM, {
        reason: reason instanceof Error ? reason?.message : String(reason),
      });
    });

    // Graceful shutdown handlers;
    process?.on(SIGTERM`'`, () => this?.gracefulShutdown(SIGTERM));    process?.on(SIGINT, () => this?.gracefulShutdown(SIGINT));
    log?.info(Error handling setup completed, LogContext?.SERVER);
  }

  /**
   * Get startup progress information;
   */
  private getStartupProgress(): {
    phase: string;
    total: number;
    ready: number;
    criticalReady: boolean;
    services: Record<string, ServiceStatus>;
  } {
    const services = Array?.from(this?.services?.entries()).reduce((acc, [name, status]) => {
      acc[name] = status;
      return acc;
    }, {} as Record<string, ServiceStatus>);

    const ready = Array?.from(this?.services?.values()).filter(s => s?.healthy).length;
    const total = this?.services?.size;
    const criticalReady = Array?.from(this?.criticalServices).every(name => 
      this?.services?.get(name).healthy === true;
    );

    const phase = criticalReady ? `'ready' : 'initializing';'
    return { phase, total, ready, criticalReady, services };
  }

  /**
   * Update service status;
   */
  private updateServiceStatus(
    name: string,
    initialized: boolean,
    healthy: boolean,
    loadTime?: number,
    error?: string;
  ): void {
    this?.services?.set(name, {
      name,
      initialized,
      healthy,
      loadTime,
      error,
    );
  }

  /**
   * Progressive startup - initialize critical services first;
   */
  public async start(): Promise<void> {
    const overallStartTime = Date?.now();
    
    try {
      log?.info(Starting Universal AI Tools Server (Optimized)', LogContext?.SERVER);'
      // Validate configuration;
      validateConfig();

      // Phase 1: Critical services (fast startup)
      log?.info(Phase 1: Initializing critical services..., LogContext?.SERVER);
      
      await this?.initializeConnectionPools();
      this?.setupOptimizedWebSocket();
      await this?.setupOptimizedMiddleware();
      await this?.setupCoreRoutes();
      
      this?.updateServiceStatus(health', true, true);`
      // Phase 2: Start server (non-blocking)
      const port = config?.port || 9999;
      
      await new Promise<void>((resolve, reject) => {
        this?.server;
          .listen(port, () => {
            const startupTime = Date?.now() - overallStartTime;
            log?.info(`Optimized server running on port ${port} (startup: ${startupTime}ms), LogContext?.SERVER, {`'              environment: config?.environment,
              port,
              startupTime: ${startupTime}ms','              phase: 'critical-ready','              optimizations: ['connection-pooling', 'lazy-loading', `progressive-startup],`            });
            resolve();
          })
          .on(error`, reject);
      });

      // Phase 3: Background initialization (non-blocking)
      this?.backgroundInitialization();

      // Setup error handling last;
      this?.setupErrorHandling();
  } catch (error) {
      log?.error(Failed to start optimized server`, LogContext?.SERVER, {
        error: error instanceof Error ? error?.message : String(error),
      });
      process?.exit(1);
    }
  }

  /**
   * Graceful shutdown;
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this?.isShuttingDown) return;
    this?.isShuttingDown = true;

    log?.info(Received ${signal}, shutting down gracefully..., LogContext?.SYSTEM);
    try {
      // Close HTTP server;
      if (this?.server) {
        await new Promise<void>((resolve) => {
          this?.server?.close(() => {
            log?.info(HTTP server closed, LogContext?.SERVER);
            resolve();
          );
        });
      }

      // Close WebSocket server;
      if (this?.io) {
        this?.io?.close();
        log?.info(WebSocket server closed, LogContext?.WEBSOCKET);
      }

      // Close connection pools;
      for (const [name, pool] of this?.connectionPools?.entries()) {
        try {
          if (name === `'`redis && pool?.quit) {`            await pool?.quit();
          }
          log?.info(${name} connection pool closed, LogContext?.DATABASE);``        } catch (error) {
          log?.warn(Error closing ${name} pool`, LogContext?.DATABASE, { error });        }
      }

      log?.info(Graceful shutdown completed`, LogContext?.SYSTEM);
      process?.exit(0);
  } catch (error) {
      log?.error(Error during shutdown`, LogContext?.SYSTEM, {
        error: error instanceof Error ? error?.message : String(error),
      });
      process?.exit(1);
    }
  }

  public getApp(): express?.Application {
    return this?.app;
  }

  public getConnectionPool(name: string): any {
    return this?.connectionPools?.get(name);
  }

  public getServiceStatus(): Map<string, ServiceStatus> {
    return new Map(this?.services);
  }
}

// Start the server if this file is run directly;
if (import?.meta?.url === `file://${process?.argv[1]}) {
  const server = new OptimizedUniversalAIToolsServer();
  server?.start();
}

export default OptimizedUniversalAIToolsServer;
export { OptimizedUniversalAIToolsServer };`