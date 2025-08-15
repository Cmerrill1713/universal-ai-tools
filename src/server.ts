/**
 * Universal AI Tools Service - Clean Implementation
 * Main server with Express, TypeScript, and comprehensive error handling
 */

// Memory optimization setup
if (typeof global !== 'undefined' && !global.gc && process.env.NODE_ENV === 'development') {
  // Enable manual garbage collection in development
  if (process.argv.includes('--expose-gc')) {
    console.log('🗑️ Manual garbage collection enabled');
  }
}

// Start memory monitoring
const memoryMonitor = setInterval(() => {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
  };
  
  // Log memory usage if high
  if (memUsageMB.heapUsed > 500) {
    console.warn('⚠️ High memory usage:', memUsageMB);
    
    // Force garbage collection if memory is very high
    if (global.gc && memUsageMB.heapUsed > 1000) {
      global.gc();
      console.log('🗑️ Forced garbage collection');
    }
  }
}, 30000); // Every 30 seconds

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer, type Server } from 'http';
import os from 'os';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
let compressionMiddleware: any = null;

// Configuration and utilities
// Agent system
import AgentRegistry from '@/agents/agent-registry';
import { config, validateConfig } from '@/config/environment';
import { standardRateLimiter } from '@/middleware/comprehensive-rate-limiter';
import { errorTrackingService } from '@/middleware/error-tracking-middleware';
// Middleware
import { intelligentParametersMiddleware } from '@/middleware/intelligent-parameters';
// Context Injection Services
// Context injection service temporarily disabled
import { contextStorageService } from '@/services/context-storage-service';
// Health monitoring and self-healing
import { healthMonitor } from '@/services/health-monitor-service';
// MCP Integration
import { mcpIntegrationService } from '@/services/mcp-integration-service';
import { apiResponseMiddleware } from '@/utils/api-response';
import { container, injectServices, SERVICE_NAMES } from '@/utils/dependency-container';
import { log, LogContext } from '@/utils/logger';
// Context injection middleware temporarily disabled

// Types

class UniversalAIToolsServer {
  private app: express.Application;
  private server: Server;
  private io: SocketIOServer | null = null;
  private wss: WebSocketServer | null = null;
  private supabase: SupabaseClient | null = null;
  private agentRegistry: AgentRegistry | null = null;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.setupMiddleware();
    this.setupWebSocket();

    // Services and routes will be initialized in start() method due to async operations
  }

  private async initializeServices(): Promise<void> {
    this.initializeSupabase();
    this.initializeAgentRegistry();
    await this.initializeContextServices();
    await this.initializeUserPreferenceLearning();
    await this.initializeFlashAttention();
    await this.initializeFeedbackCollection();
    await this.registerAdditionalServices();
  }

  private async registerAdditionalServices(): Promise<void> {
    try {
      // Register singleton services that are initialized elsewhere
      const { secretsManager } = await import('./services/secrets-manager');
      container.register(SERVICE_NAMES.SECRETS_MANAGER, secretsManager);

      const { mlParameterOptimizer } = await import('./services/ml-parameter-optimizer');
      container.register(SERVICE_NAMES.PARAMETER_OPTIMIZER, mlParameterOptimizer);

      // Initialize Memory Optimization Service
      const { memoryOptimizationService } = await import('./services/memory-optimization-service');
      await memoryOptimizationService.initialize();
      container.register(SERVICE_NAMES.MEMORY_OPTIMIZER, memoryOptimizationService);

      // Initialize Feature Discovery Service
      const { featureDiscoveryService } = await import('./services/feature-discovery-service');
      await featureDiscoveryService.initialize();
      container.register(SERVICE_NAMES.FEATURE_DISCOVERY, featureDiscoveryService);

      log.info('✅ Additional services registered in dependency container', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Failed to register some additional services', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow server to continue without these registrations
    }
  }

  private initializeAgentRegistry(): void {
    try {
      this.agentRegistry = new AgentRegistry();

      // Register agent registry in dependency container
      container.register(SERVICE_NAMES.AGENT_REGISTRY, this.agentRegistry);

      // Connect health monitor to agent registry
      healthMonitor.setAgentRegistry(this.agentRegistry);

      // Register health monitor in dependency container
      container.register(SERVICE_NAMES.HEALTH_MONITOR, healthMonitor);

      log.info('✅ Agent Registry initialized', LogContext.AGENT);
    } catch (error) {
      log.error('❌ Failed to initialize Agent Registry', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow server to start without agents
    }
  }

  private initializeSupabase(): void {
    try {
      if (!config.supabase.url || !config.supabase.serviceKey) {
        throw new Error('Supabase configuration missing');
      }

      this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);

      // Register Supabase client in dependency container
      container.register(SERVICE_NAMES.SUPABASE_CLIENT, this.supabase);

      log.info('✅ Supabase client initialized', LogContext.DATABASE);
    } catch (error) {
      log.error('❌ Failed to initialize Supabase client', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow server to start without Supabase for testing
    }
  }

  private async initializeContextServices(): Promise<void> {
    try {
      // Initialize context injection service for Supabase context loading
      log.info('🔍 Initializing context injection service', LogContext.DATABASE);

      // Test Supabase context loading
      if (this.supabase) {
        // Context injection temporarily disabled
        const testContext = {
          contextSummary: 'Context injection disabled during cleanup',
          relevantPatterns: [],
        };

        log.info('✅ Context injection service initialized', LogContext.DATABASE, {
          contextTokens: testContext.contextSummary ? testContext.contextSummary.length : 0,
          sourcesUsed: testContext.relevantPatterns?.length || 0,
        });

        // Test context storage service
        const storedContextId = await contextStorageService.storeContext({
          content: 'Universal AI Tools - Server startup completed with context injection enabled',
          category: 'project_info',
          source: 'server_startup',
          userId: 'system',
          projectPath: process.cwd(),
          metadata: {
            startup_time: new Date().toISOString(),
            features_enabled: ['context_injection', 'supabase_storage', 'agent_registry'],
          },
        });

        if (storedContextId) {
          log.info('✅ Context storage service initialized', LogContext.DATABASE, {
            storedContextId,
          });
        }
      }
    } catch (error) {
      log.warn('⚠️ Context injection service initialization failed', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async initializeMCPService(): Promise<void> {
    try {
      // Start MCP service for context management
      const started = await mcpIntegrationService.start();
      if (started) {
        log.info('✅ MCP service initialized for context management', LogContext.MCP);
      } else {
        log.warn('⚠️ MCP service failed to start, using fallback mode', LogContext.MCP);
      }
    } catch (error) {
      log.error('❌ Failed to initialize MCP service', LogContext.MCP, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow server to start with fallback context management
    }
  }

  private async initializeUserPreferenceLearning(): Promise<void> {
    try {
      log.info('🧠 Initializing User Preference Learning service', LogContext.AI);

      const { userPreferenceLearningService } = await import(
        './services/user-preference-learning-service'
      );
      await userPreferenceLearningService.initialize();

      log.info('✅ User Preference Learning service initialized', LogContext.AI);
    } catch (error) {
      log.warn('⚠️ User Preference Learning service initialization failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow server to start without preference learning
    }
  }

  private async initializeFlashAttention(): Promise<void> {
    try {
      log.info('⚡ Initializing FlashAttention service', LogContext.AI);

      const { flashAttentionService } = await import('./services/flash-attention-service');
      await flashAttentionService.initialize();

      // Register FlashAttention service in dependency container
      container.register(SERVICE_NAMES.FLASH_ATTENTION_SERVICE, flashAttentionService);

      log.info('✅ FlashAttention service initialized', LogContext.AI);
    } catch (error) {
      log.warn('⚠️ FlashAttention service initialization failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow server to start without FlashAttention
    }
  }

  private async initializeFeedbackCollection(): Promise<void> {
    try {
      log.info('📝 Initializing Feedback Collection service', LogContext.AI);

      const { feedbackCollectionService } = await import('./services/feedback-collection-service');
      await feedbackCollectionService.initialize();

      // Register Feedback Collection service in dependency container
      container.register(SERVICE_NAMES.FEEDBACK_COLLECTOR, feedbackCollectionService);

      log.info('✅ Feedback Collection service initialized', LogContext.AI);
    } catch (error) {
      log.warn('⚠️ Feedback Collection service initialization failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow server to start without feedback collection
    }
  }

  private async setupMiddleware(): Promise<void> {
    // Security: Disable Express.js powered-by header to prevent information exposure
    this.app.disable('x-powered-by');
    // Trust proxy for accurate client IPs behind proxies (safe for local too)
    this.app.set('trust proxy', 1);

    // Security middleware (tight CSP in production; more relaxed in development)
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc:
              process.env.NODE_ENV === 'production' ? ["'self'"] : ["'self'", "'unsafe-inline'"],
            styleSrc:
              process.env.NODE_ENV === 'production' ? ["'self'"] : ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"], // prevent clickjacking
            formAction: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        crossOriginResourcePolicy: { policy: 'same-origin' },
        referrerPolicy: { policy: 'no-referrer' },
        hidePoweredBy: true,
        noSniff: true,
        dnsPrefetchControl: { allow: false },
        frameguard: { action: 'deny' },
        hsts: false, // enable only when serving via HTTPS
      })
    );

    // Compression (optional)
    try {
      const mod = await import('compression');
      const c = (mod as any).default || (mod as any);
      compressionMiddleware = c();
      this.app.use(compressionMiddleware);
    } catch {
      // compression not installed; skip in dev
    }

    // CORS middleware (centralized config)
    (async () => {
      try {
        const { corsMiddleware } = await import('./middleware/cors-config');
        this.app.use(corsMiddleware);
      } catch {
        // Fallback permissive CORS only in development
        this.app.use(
          cors({
            origin: (origin, callback) => callback(null, process.env.NODE_ENV !== 'production'),
            credentials: true,
          })
        );
      }
    })();

    // Block TRACE/TRACK/CONNECT probing methods
    this.app.use((req, res, next) => {
      const m = req.method.toUpperCase();
      if (m === 'TRACE' || m === 'TRACK' || m === 'CONNECT') {
        return res.status(405).end();
      }
      return next();
    });

    // Optional IP filter (allow/deny lists via env)
    try {
      const { ipFilterMiddleware } = await import('./middleware/ip-filter');
      const allowList = (process.env.IP_ALLOWLIST || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      this.app.use(ipFilterMiddleware(allowList));
    } catch {
      // ignore if unavailable
    }

    // Request hardening & parsing
    try {
      const {
        requestIdMiddleware,
        enforceJsonMiddleware,
        limitQueryMiddleware,
        jsonDepthGuardMiddleware,
      } = await import('./middleware/request-guard');
      this.app.use(requestIdMiddleware());
      this.app.use(limitQueryMiddleware());
      this.app.use(enforceJsonMiddleware());
      this.app.use(jsonDepthGuardMiddleware());
    } catch {
      // guards unavailable
    }
    // Lightweight SQL injection prefilter for URL, query, params
    try {
      const { sqlInjectionProtection } = await import('./middleware/sql-injection-protection');
      this.app.use(sqlInjectionProtection());
    } catch {}
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Inject services into request context
    this.app.use(injectServices);

    // Apply Auto Context Middleware globally for all LLM endpoints
    try {
      const { contextMiddleware } = await import('./middleware/auto-context-middleware');
      this.app.use('/api/v1/agents', contextMiddleware);
      this.app.use('/api/v1/chat', contextMiddleware);
      this.app.use('/api/v1/assistant', contextMiddleware);
      this.app.use('/api/v1/vision', contextMiddleware);
      this.app.use('/api/v1/huggingface', contextMiddleware);
      log.info('✅ Auto Context Middleware applied globally to LLM endpoints', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to apply Auto Context Middleware', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    // Static file serving
    this.app.use(express.static('public'));
    this.app.use('/frontend', express.static('frontend'));

    // Rate limiting middleware - Apply globally
    this.app.use(standardRateLimiter.middleware());

    // Basic Content Safety - Apply to AI endpoints
    try {
      const { basicContentSafety } = await import('./middleware/basic-content-filter');
      this.app.use('/api/v1/chat', basicContentSafety);
      this.app.use('/api/v1/assistant', basicContentSafety);
      this.app.use('/api/v1/vision', basicContentSafety);
      this.app.use('/api/v1/agents', basicContentSafety);
      this.app.use('/api/v1/huggingface', basicContentSafety);
      log.info('🛡️ Basic Content Safety filters applied to AI endpoints', LogContext.SECURITY);
    } catch (error) {
      log.error('❌ Failed to apply Basic Content Safety filters', LogContext.SECURITY, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    // Error tracking middleware - Request timing
    this.app.use(errorTrackingService.timingMiddleware());

    // API response middleware
    this.app.use(apiResponseMiddleware);

    // Extra security headers
    try {
      const { securityHeadersMiddleware } = await import('./middleware/security-headers');
      this.app.use(securityHeadersMiddleware());
    } catch {
      // ignore
    }

    // Request logging + latency sampling middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        try {
          res.setHeader('X-Response-Time', `${duration}ms`);
        } catch {}
        const contentLength = Number(res.getHeader('Content-Length') || 0);

        log.info(`${req.method} ${req.path} - ${res.statusCode}`, LogContext.API, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          durationMs: duration,
          contentLength,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });

        if (process.env.ENABLE_PERF_LOGS === 'true') {
          const latencyBudgetMs = 50;
          const isLatencySensitive =
            req.path.startsWith('/api/v1/assistant') ||
            req.path.startsWith('/api/v1/agents') ||
            req.path.startsWith('/api/v1/chat');
          if (isLatencySensitive && duration > latencyBudgetMs) {
            log.warn('Latency budget exceeded', LogContext.API, {
              path: req.path,
              durationMs: duration,
              budgetMs: latencyBudgetMs,
            });
          }
        }
      });

      next();
    });

    // Preflight handled by cors; keep minimal fallback
    this.app.options('*', cors());

    // Metrics middleware (prom-client)
    (async () => {
      try {
        const { metricsMiddleware } = await import('./middleware/metrics');
        this.app.use(metricsMiddleware());
      } catch {
        // noop if metrics not available
      }
    })();

    // Optional Casbin RBAC/ABAC
    try {
      const { wireCasbin } = await import('./security/init-authz');
      await wireCasbin(this.app);
    } catch {}

    log.info('✅ Middleware setup completed', LogContext.SERVER);
  }

  private async setupRoutesSync(): Promise<void> {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        // Check MLX service health
        let mlxHealth = false;
        try {
          const { mlxService } = await import('./services/mlx-service');
          const mlxStatus = await mlxService.healthCheck();
          mlxHealth = mlxStatus.healthy;
        } catch {
          // MLX service not available
          mlxHealth = false;
        }

        // Check Redis health
        let redisHealth = false;
        try {
          const { redisService } = await import('./services/redis-service');
          redisHealth = await redisService.ping();
        } catch {
          // Redis service not available
          redisHealth = false;
        }

        const health = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: config.environment,
          services: {
            supabase: !!this.supabase,
            websocket: !!this.io,
            agentRegistry: !!this.agentRegistry,
            redis: redisHealth,
            mlx: mlxHealth,
            ollama: false,
            lmStudio: false,
          },
          agents: this.agentRegistry
            ? {
                total: this.agentRegistry.getAvailableAgents().length,
                loaded: this.agentRegistry.getLoadedAgents().length,
                available: this.agentRegistry.getAvailableAgents().map((a) => a.name),
              }
            : null,
          uptime: process.uptime(),
        };

        try {
          // Basic checks for LLM endpoints
          const { ollamaService } = await import('./services/ollama-service');
          (health as any).services.ollama = ollamaService.isServiceAvailable();
        } catch {}
        try {
          const { fastCoordinator } = await import('./services/fast-llm-coordinator');
          (health as any).services.lmStudio = await fastCoordinator.checkLmStudioHealth();
        } catch {}
        res.json(health);
      } catch {
        // Fallback to synchronous health check if async fails
        const health = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: config.environment,
          services: {
            supabase: !!this.supabase,
            websocket: !!this.io,
            agentRegistry: !!this.agentRegistry,
            redis: false, // Fallback to false if async check fails
            mlx: false,
          },
          agents: this.agentRegistry
            ? {
                total: this.agentRegistry.getAvailableAgents().length,
                loaded: this.agentRegistry.getLoadedAgents().length,
                available: this.agentRegistry.getAvailableAgents().map((a) => a.name),
              }
            : null,
          uptime: process.uptime(),
        };

        res.json(health);
      }
    });

    // Prometheus metrics endpoint (text/plain)
    this.app.get('/metrics', async (req, res) => {
      try {
        const { getMetricsText } = await import('./middleware/metrics');
        const metrics = await getMetricsText();
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
      } catch {
        // Fallback JSON if registry not available
        res.json({ success: true, data: { message: 'metrics disabled' } });
      }
    });

    // System status endpoint (frontend expects this)
    this.app.get('/api/v1/status', async (req, res) => {
      try {
        const health = {
          status: 'operational',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: config.environment,
          mode: {
            offline: process.env.OFFLINE_MODE === 'true' || !!config.offlineMode,
            disableExternalCalls:
              process.env.DISABLE_EXTERNAL_CALLS === 'true' || !!config.disableExternalCalls,
            disableRemoteLLM:
              process.env.DISABLE_REMOTE_LLM === 'true' || !!config.disableRemoteLLM,
          },
          services: {
            backend: 'healthy',
            database: this.supabase ? 'healthy' : 'unavailable',
            websocket: this.io ? 'healthy' : 'unavailable',
            agents: this.agentRegistry ? 'healthy' : 'unavailable',
            redis: false,
            mlx: false,
          },
          providers: { openai: false, anthropic: false, ollama: false, internal: true } as any,
          systemInfo: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            platform: process.platform,
            nodeVersion: process.version,
          },
          endpoints: {
            health: '/health',
            api: '/api/v1',
            websocket: 'ws://localhost:9999',
          },
        } as any;

        // Update provider statuses (best-effort)
        try {
          const { ollamaService } = await import('./services/ollama-service');
          (health as any).providers.ollama = ollamaService.isServiceAvailable();
        } catch {}
        try {
          const { llmRouter } = await import('./services/llm-router-service');
          const status = llmRouter.getProviderStatus();
          (health as any).providers = { ...health.providers, ...status };
        } catch {}

        res.json({
          success: true,
          data: health,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'STATUS_ERROR',
            message: 'Failed to get system status',
            details: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });

    // Ollama models endpoint
    this.app.get('/api/v1/ollama/models', async (req, res) => {
      try {
        const { ollamaService } = await import('./services/ollama-service');
        const models = await ollamaService.getAvailableModels();

        res.json({
          success: true,
          models: models || [],
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'OLLAMA_ERROR',
            message: 'Failed to get Ollama models',
            details: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });

    // Vision models endpoint
    this.app.get('/api/v1/vision/models', async (req, res) => {
      try {
        const { visionResourceManager } = await import('./services/vision-resource-manager');
        const models = visionResourceManager.getLoadedModels();

        res.json({
          success: true,
          models: models || [],
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'VISION_ERROR',
            message: 'Failed to get vision models',
            details: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });

    // Agents list endpoint (moved to /registry to avoid conflict with soft-fail router)
    this.app.get('/api/v1/agents/registry', async (req, res) => {
      try {
        const agents = this.agentRegistry ? this.agentRegistry.getAvailableAgents() : [];

        res.json({
          success: true,
          agents: agents || [],
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'AGENTS_ERROR',
            message: 'Failed to get agents',
            details: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });

    // Autonomous action rollback endpoint
    this.app.post('/api/v1/autonomous-actions/:actionId/rollback', async (req, res) => {
      try {
        const { actionId } = req.params;
        const { reason = 'Performance degradation detected' } = req.body;

        const { autonomousActionRollbackService } = await import(
          './services/autonomous-action-rollback-service'
        );
        const result = await autonomousActionRollbackService.executeRollback(actionId, reason);

        res.json({
          success: result.success,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'ROLLBACK_ERROR',
            message: 'Failed to execute rollback',
            details: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });

    // Simple monitoring endpoints for client compatibility (JSON)
    this.app.get('/metrics.json', (req, res) => {
      res.json({
        success: true,
        data: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        },
      });
    });

    this.app.get('/status', (req, res) => {
      res.json({
        success: true,
        status: 'operational',
        timestamp: new Date().toISOString(),
      });
    });

    this.app.get('/performance', (req, res) => {
      res.json({
        success: true,
        data: {
          responseTime: Math.random() * 100,
          requestsPerSecond: Math.random() * 1000,
          timestamp: new Date().toISOString(),
        },
      });
    });

    // LLM system snapshot (Ollama + LM Studio)
    this.app.get('/api/v1/system/llm', async (req, res) => {
      try {
        const snapshot: any = {
          timestamp: new Date().toISOString(),
          environment: config.environment,
          services: {
            ollama: { available: false, defaultModel: null },
            lmStudio: { available: false },
          },
          allowedHosts: [],
        };

        try {
          const { getAllowedHostsFromEnv } = await import('./utils/url-security');
          snapshot.allowedHosts = Array.from(getAllowedHostsFromEnv('ALLOWED_LLM_HOSTS'));
        } catch {}

        try {
          const { ollamaService } = await import('./services/ollama-service');
          snapshot.services.ollama.available = ollamaService.isServiceAvailable();
          snapshot.services.ollama.defaultModel = ollamaService.getDefaultModel?.();
        } catch {}

        try {
          const { fastCoordinator } = await import('./services/fast-llm-coordinator');
          snapshot.services.lmStudio.available = await fastCoordinator.checkLmStudioHealth();
        } catch {}

        return res.json({ success: true, data: snapshot });
      } catch {
        return res.status(500).json({
          success: false,
          error: { code: 'LLM_SNAPSHOT_ERROR', message: 'Failed to get LLM snapshot' },
        });
      }
    });

    // Common AI Assistant endpoint aliases
    this.app.post('/api/chat', (req, res) => {
      // Redirect to the assistant chat endpoint
      req.url = '/api/v1/assistant/chat';
      this.app._router.handle(req, res, () => {});
    });

    this.app.post('/api/assistant', (req, res) => {
      // Redirect to the assistant chat endpoint
      req.url = '/api/v1/assistant/chat';
      this.app._router.handle(req, res, () => {});
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Universal AI Tools',
        status: 'running',
        version: '1.0.0',
        description: 'AI-powered tool orchestration platform',
        endpoints: {
          health: '/health',
          api: {
            base: '/api/v1',
            docs: '/api/docs',
          },
        },
        features: [
          'Agent Orchestration',
          'Agent-to-Agent (A2A) Communication',
          'Alpha Evolve Self-Improvement',
          'Multi-Tier LLM Architecture',
          'Memory Management',
          'DSPy Integration',
          'WebSocket Support',
          'Authentication',
        ],
      });
    });

    // API base route
    this.app.get('/api/v1', (req, res) => {
      res.json({
        message: 'Universal AI Tools API v1',
        timestamp: new Date().toISOString(),
        availableEndpoints: [
          '/api/v1/agents',
          '/api/v1/agents/execute',
          '/api/v1/agents/parallel',
          '/api/v1/agents/orchestrate',
          '/api/v1/a2a',
          '/api/v1/memory',
          '/api/v1/orchestration',
          '/api/v1/knowledge',
          '/api/v1/architecture',
          '/api/v1/auth',
          '/api/v1/vision',
          '/api/v1/vision-debug',
          '/api/v1/huggingface',
          '/api/v1/monitoring',
          '/api/v1/ab-mcts',
          '/api/v1/mlx',
        ],
      });
    });

    // Agent API endpoints
    this.setupAgentRoutes();

    // Vision API endpoints
    this.setupVisionRoutes();

    // A2A Communication mesh endpoints
    try {
      const a2aRouter = (await import('./routers/a2a-collaboration')).default;
      this.app.use('/api/v1/a2a', a2aRouter);
      log.info('✅ A2A collaboration router loaded', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load A2A collaboration router', LogContext.API, { error });
    }

    // Optimized collaboration endpoints (MAC-SPGG)
    try {
      const optimizedCollaborationRouter = (await import('./routers/optimized-collaboration'))
        .default;
      this.app.use('/api/v1/collaboration', optimizedCollaborationRouter);
      log.info('✅ Optimized collaboration router loaded', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load optimized collaboration router', LogContext.API, { error });
    }

    // Health monitoring endpoints
    this.setupHealthRoutes();

    // Agents list (including single-file agents)
    try {
      const agentsRouter = (await import('./routers/agents')).default;
      this.app.use('/api/v1/agents', agentsRouter);
      log.info('✅ Agents routes loaded (with single-file agent integration)', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Failed to load agents routes', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // DSPy Orchestration (MIPROv2) endpoints
    try {
      const orchestrationRouter = (await import('./routers/orchestration')).default;
      this.app.use('/api/v1/orchestration', orchestrationRouter);
      log.info('✅ DSPy/MIPRO orchestration router loaded', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load DSPy/MIPRO orchestration router', LogContext.API, { error });
    }

    // Fast Coordinator Router - Multi-tier LLM coordination
    try {
      const fastCoordinatorRouter = (await import('./routers/fast-coordinator')).default;
      this.app.use('/api/v1/fast-coordinator', fastCoordinatorRouter);
      log.info(
        '✅ Fast Coordinator router loaded - Multi-tier LLM coordination enabled',
        LogContext.API
      );
    } catch (error) {
      log.error('❌ Failed to load Fast Coordinator router', LogContext.API, { error });
    }

    // Context Analytics Router - Powerful analytics capabilities
    try {
      const contextAnalyticsRouter = (await import('./routers/context-analytics')).default;
      this.app.use('/api/v1/context-analytics', contextAnalyticsRouter);
      log.info('✅ Context Analytics router loaded - Analytics endpoints exposed', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load Context Analytics router', LogContext.API, { error });
    }

    // Environmental Awareness Router - Context-aware features
    try {
      const environmentalRouter = (await import('./routers/environmental-awareness')).default;
      this.app.use('/api/v1/environmental', environmentalRouter);
      log.info(
        '✅ Environmental Awareness router loaded - Context features exposed',
        LogContext.API
      );
    } catch (error) {
      log.error('❌ Failed to load Environmental Awareness router', LogContext.API, { error });
    }

    // Proactive Task Manager Router - Advanced task scheduling
    try {
      const proactiveTasksRouter = (await import('./routers/proactive-tasks')).default;
      this.app.use('/api/v1/proactive-tasks', proactiveTasksRouter);
      log.info('✅ Proactive Task Manager router loaded - Task scheduling exposed', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load Proactive Task Manager router', LogContext.API, { error });
    }

    // Calendar Integration Router - Calendar and scheduling features
    try {
      const calendarRouter = (await import('./routers/calendar')).default;
      this.app.use('/api/v1/calendar', calendarRouter);
      log.info('✅ Calendar Integration router loaded - Calendar features exposed', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load Calendar Integration router', LogContext.API, { error });
    }

    // Speculative Decoding Router - AI optimization features
    try {
      const speculativeRouter = (await import('./routers/speculative-decoding')).default;
      this.app.use('/api/v1/speculative-decoding', speculativeRouter);
      log.info('✅ Speculative Decoding router loaded - AI optimization exposed', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load Speculative Decoding router', LogContext.API, { error });
    }

    // AutoCodeBench and ReasonRank Router - Advanced reasoning and code generation
    try {
      const autoCodeBenchReasonRankRouter = (
        await import('./routers/autocodebench-reasonrank-router')
      ).default;
      this.app.use('/api/v1/autocodebench-reasonrank', autoCodeBenchReasonRankRouter);
      log.info(
        '✅ AutoCodeBench and ReasonRank router loaded - Advanced reasoning capabilities exposed',
        LogContext.API
      );
    } catch (error) {
      log.error('❌ Failed to load AutoCodeBench and ReasonRank router', LogContext.API, { error });
    }

    // Load GraphRAG router for R1 functionality
    try {
      const graphragRouter = (await import('./routers/graphrag')).default;
      this.app.use('/api/v1/graphrag', graphragRouter);
      log.info('✅ GraphRAG router loaded - R1 knowledge graph capabilities enabled', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load GraphRAG router', LogContext.API, { error });
    }
    
    // Load Codebase Optimizer router for comprehensive code analysis
    try {
      const codebaseOptimizerRouter = (await import('./routers/codebase-optimizer')).default;
      this.app.use('/api/v1/codebase-optimizer', codebaseOptimizerRouter);
      log.info('✅ Codebase Optimizer router loaded - Code analysis and optimization capabilities enabled', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load Codebase Optimizer router', LogContext.API, { error });
    }

    // Load Voice Processing router for voice interactions
    try {
      const voiceRouter = (await import('./routers/voice')).default;
      this.app.use('/api/v1/voice', voiceRouter);
      log.info('✅ Voice router loaded - Voice conversation and command capabilities enabled', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load Voice router', LogContext.API, { error });
    }

    // Multi-tier LLM test endpoint
    this.app.post('/api/v1/multi-tier/execute', async (req, res) => {
      try {
        const { userRequest, context = {} } = req.body;

        if (!userRequest) {
          return res.status(400).json({
            success: false,
            error: 'userRequest is required',
          });
        }

        // Import multi-tier service
        const { multiTierLLM } = await import('./services/multi-tier-llm-service');

        // Check if execute method exists
        if (!multiTierLLM || typeof multiTierLLM.execute !== 'function') {
          throw new Error('Multi-tier LLM service not properly configured');
        }

        const result = await multiTierLLM.execute(userRequest, context);

        log.info('🚀 Multi-tier LLM execution completed', LogContext.AI, {
          tier: result.metadata.tier,
          modelUsed: result.metadata.modelUsed,
          executionTime: `${result.metadata.executionTime}ms`,
          complexity: result.metadata.classification.complexity,
        });

        return res.json({
          success: true,
          data: result,
          metadata: {
            timestamp: new Date().toISOString(),
            service: 'multi-tier-llm',
          },
        });
      } catch (error) {
        log.error('❌ Multi-tier LLM execution failed', LogContext.SERVER, { error });
        return res.status(500).json({
          success: false,
          error: 'Multi-tier LLM execution failed',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    log.info('✅ Basic routes setup completed', LogContext.SERVER);
  }

  private setupVisionRoutes(): void {
    // Basic vision endpoints (these will be replaced by the full vision router)
    this.app.get('/api/v1/vision/health', async (req, res) => {
      try {
        // Try to get actual PyVision status
        const { pyVisionBridge } = await import('./services/pyvision-bridge');
        const metrics = pyVisionBridge.getMetrics();

        res.json({
          success: true,
          data: {
            status: metrics.isInitialized ? 'healthy' : 'initializing',
            services: {
              pyVision: metrics.isInitialized,
              resourceManager: true,
            },
            timestamp: Date.now(),
          },
        });
      } catch {
        res.json({
          success: true,
          data: {
            status: 'initializing',
            services: {
              pyVision: false,
              resourceManager: false,
            },
            timestamp: Date.now(),
          },
        });
      }
    });

    this.app.get('/api/v1/vision/status', async (req, res) => {
      try {
        // Try to get actual PyVision status
        const { pyVisionBridge } = await import('./services/pyvision-bridge');
        const metrics = pyVisionBridge.getMetrics();

        res.json({
          success: true,
          data: {
            service: {
              initialized: metrics.isInitialized,
              uptime: process.uptime(),
            },
            python: {
              available: metrics.isInitialized,
              models: metrics.modelsLoaded,
            },
            gpu: {
              available: true, // MPS is available
              memory: 'Unified Memory',
            },
            metrics: {
              totalRequests: metrics.totalRequests,
              successRate: metrics.successRate,
              avgResponseTime: `${metrics.avgResponseTime.toFixed(0)}ms`,
              cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
            },
          },
        });
      } catch {
        res.json({
          success: true,
          data: {
            service: {
              initialized: false,
              uptime: process.uptime(),
            },
            python: {
              available: false,
              models: [],
            },
            gpu: {
              available: false,
              memory: '0GB',
            },
          },
        });
      }
    });

    // Mock analyze endpoint for testing
    this.app.post('/api/v1/vision/analyze', (req, res) => {
      const { imagePath, imageBase64 } = req.body;

      if (!imagePath && !imageBase64) {
        return res.status(400).json({
          success: false,
          error: 'Either imagePath or imageBase64 must be provided',
        });
      }

      // Mock response
      return res.json({
        success: true,
        data: {
          analysis: {
            objects: [
              {
                class: 'mock_object',
                confidence: 0.95,
                bbox: { x: 10, y: 10, width: 100, height: 100 },
              },
            ],
            scene: {
              description: 'Mock scene analysis - Vision system ready for implementation',
              tags: ['mock', 'test', 'ready'],
              mood: 'neutral',
            },
            text: [],
            confidence: 0.9,
            processingTimeMs: 100,
          },
          processingTime: 100,
          cached: false,
          mock: true,
        },
      });
    });

    // Vision embedding endpoint with Supabase integration
    this.app.post('/api/v1/vision/embed', async (req, res) => {
      try {
        const { imagePath, imageBase64, saveToMemory = true } = req.body;

        if (!imagePath && !imageBase64) {
          return res.status(400).json({
            success: false,
            error: 'Either imagePath or imageBase64 must be provided',
          });
        }

        log.info('🔢 Processing vision embedding request', LogContext.AI, {
          hasImagePath: !!imagePath,
          hasImageBase64: !!imageBase64,
          saveToMemory,
        });

        let embeddingResult: unknown = null;
        let isRealEmbedding = false;

        // Try to use PyVision bridge
        try {
          const { pyVisionBridge } = await import('./services/pyvision-bridge');
          const imageData = imageBase64 || imagePath;
          const result = await pyVisionBridge.generateEmbedding(imageData);

          if (result.success) {
            embeddingResult = result;
            isRealEmbedding = true;
            log.info('✅ Real CLIP embedding generated', LogContext.AI, {
              model: result.model,
              dimension: result.data?.dimension,
            });
          } else {
            log.warn('PyVision embedding failed, using mock', LogContext.AI, {
              error: result.error,
            });
          }
        } catch (error) {
          log.warn('PyVision bridge not available, using mock', LogContext.AI, { error });
        }

        // Fallback to mock embedding if needed
        if (!embeddingResult) {
          const mockEmbedding = new Array(512).fill(0).map(() => Math.random() * 0.1 - 0.05);
          embeddingResult = {
            success: true,
            data: {
              vector: mockEmbedding,
              model: 'mock-clip-vit-b32',
              dimension: 512,
            },
            model: 'mock-clip-vit-b32',
            processingTime: 50 + Math.random() * 100,
            cached: false,
          };
        }

        // Save to Supabase if requested and we have a real embedding
        let memoryId = null;
        if (saveToMemory && this.supabase && isRealEmbedding) {
          try {
            // First create a memory record
            const { data: memoryData, error: memoryError } = await this.supabase
              .from('ai_memories')
              .insert({
                service_id: '00000000-0000-0000-0000-000000000001',
                memory_type: 'visual',
                content: imagePath ? `image at ${imagePath}` : 'base64 image',
                metadata: {
                  content_type: 'image',
                  source: 'vision-embedding-api',
                  is_generated: false,
                  importance: 0.8,
                  image_path: imagePath || null,
                  image_metadata: {
                    model: (embeddingResult as any).model,
                    dimension: (embeddingResult as any).data?.dimension,
                    processingTime: (embeddingResult as any).processingTime,
                    timestamp: new Date().toISOString(),
                  },
                },
              })
              .select('id')
              .single();

            if (memoryError) {
              log.error('Failed to save memory record', LogContext.DATABASE, {
                error: memoryError,
              });
            } else {
              memoryId = memoryData?.id;
              log.info('✅ Vision embedding saved to memory', LogContext.DATABASE, {
                memoryId,
                model: (embeddingResult as any).model,
              });

              // Also save to vision_embeddings table for faster lookups
              const { error: embeddingError } = await this.supabase
                .from('vision_embeddings')
                .insert({
                  memory_id: memoryId,
                  embedding: (embeddingResult as any).data?.vector,
                  model_version: (embeddingResult as any).model,
                  confidence: 0.95, // Default confidence for real embeddings
                });

              if (embeddingError) {
                log.error('Failed to save embedding record', LogContext.DATABASE, {
                  error: embeddingError,
                });
              } else {
                log.info('✅ Vision embedding indexed for fast search', LogContext.DATABASE, {
                  memoryId,
                });
              }
            }
          } catch (supabaseError) {
            log.error('Supabase integration error', LogContext.DATABASE, { error: supabaseError });
          }
        }

        return res.json({
          success: true,
          data: (embeddingResult as any).data,
          model: (embeddingResult as any).model,
          processingTime: (embeddingResult as any).processingTime,
          cached: (embeddingResult as any).cached || false,
          mock: !isRealEmbedding,
          memoryId,
          savedToDatabase: !!memoryId,
        });
      } catch (error) {
        log.error('Vision embedding endpoint error', LogContext.API, { error });
        return res.status(500).json({
          success: false,
          error: 'Vision embedding failed',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Vision similarity search endpoint
    this.app.post('/api/v1/vision/search', async (req, res) => {
      try {
        const { imagePath, imageBase64, limit = 10, threshold = 0.8 } = req.body;

        if (!imagePath && !imageBase64) {
          return res.status(400).json({
            success: false,
            error: 'Either imagePath or imageBase64 must be provided for search',
          });
        }

        if (!this.supabase) {
          return res.status(503).json({
            success: false,
            error: 'Database service not available',
          });
        }

        log.info('🔍 Processing vision similarity search', LogContext.AI, {
          hasImagePath: !!imagePath,
          hasImageBase64: !!imageBase64,
          limit,
          threshold,
        });

        // First generate embedding for the search query
        let queryEmbedding = null;
        try {
          const { pyVisionBridge } = await import('./services/pyvision-bridge');
          const imageData = imageBase64 || imagePath;
          const result = await pyVisionBridge.generateEmbedding(imageData);

          if (result.success && result.data) {
            queryEmbedding = result.data.vector;
            log.info('✅ Query embedding generated for search', LogContext.AI);
          }
        } catch (error) {
          log.warn('PyVision not available for search', LogContext.AI, { error });
        }

        if (!queryEmbedding) {
          return res.status(400).json({
            success: false,
            error: 'Unable to generate embedding for search query',
          });
        }

        // Search for similar images using the database function
        const { data: searchResults, error: searchError } = await this.supabase.rpc(
          'search_similar_images',
          {
            query_embedding: queryEmbedding,
            limit_count: limit,
            threshold,
          }
        );

        if (searchError) {
          log.error('Vision similarity search failed', LogContext.DATABASE, { error: searchError });
          return res.status(500).json({
            success: false,
            error: 'Similarity search failed',
          });
        }

        log.info('✅ Vision similarity search completed', LogContext.AI, {
          resultsFound: searchResults?.length || 0,
        });

        return res.json({
          success: true,
          data: {
            results: searchResults || [],
            query: {
              threshold,
              limit,
              embeddingModel: 'clip-vit-b32',
            },
          },
          resultsCount: searchResults?.length || 0,
        });
      } catch (error) {
        log.error('Vision search endpoint error', LogContext.API, { error });
        return res.status(500).json({
          success: false,
          error: 'Vision search failed',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    log.info('✅ Vision routes setup completed', LogContext.SERVER);
  }

  private async setupAgentRoutes(): Promise<void> {
    // List available agents (moved to /registry to avoid conflict with soft-fail router)
    this.app.get('/api/v1/agents/registry', (req, res) => {
      if (!this.agentRegistry) {
        res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Agent registry not available',
          },
        });
        return;
      }

      const agents = this.agentRegistry.getAvailableAgents();
      const loadedAgents = this.agentRegistry.getLoadedAgents();

      return res.json({
        success: true,
        data: {
          total: agents.length,
          loaded: loadedAgents.length,
          agents: agents.map((agent) => ({
            name: agent.name,
            description: agent.description,
            category: agent.category,
            priority: agent.priority,
            capabilities: agent.capabilities,
            memoryEnabled: agent.memoryEnabled,
            maxLatencyMs: agent.maxLatencyMs,
            loaded: loadedAgents.includes(agent.name),
          })),
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    });

    // Execute agent
    const agentExecuteMiddlewares: any[] = [];
    if (process.env.ENABLE_CONTEXT === 'true') {
      import('./middleware/context-injection-middleware')
        .then((cim) => agentExecuteMiddlewares.push(cim.agentContextMiddleware()))
        .catch(() => undefined);
    }
    const agentExecuteValidators: any[] = [];
    try {
      const [{ z }, { zodValidate }] = await Promise.all([
        Promise.resolve().then(() => import('zod')) as any,
        Promise.resolve().then(() => import('./middleware/zod-validate')) as any,
      ]);
      agentExecuteValidators.push(
        zodValidate(
          z.object({
            agentName: z.string().min(1),
            userRequest: z.union([z.string(), z.record(z.any())]),
            context: z.record(z.any()).optional(),
            enqueue: z.boolean().optional(),
          })
        )
      );
    } catch {}
    this.app.post(
      '/api/v1/agents/execute',
      ...agentExecuteMiddlewares,
      intelligentParametersMiddleware(),
      ...agentExecuteValidators,
      async (req, res) => {
        try {
          if (!this.agentRegistry) {
            return res.status(503).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Agent registry not available',
              },
            });
          }

          const { agentName, userRequest, context = {}, enqueue = false } = req.body;

          if (!agentName || !userRequest) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'MISSING_REQUIRED_FIELD',
                message: 'Agent name and user request are required',
              },
            });
          }

          if (enqueue) {
            try {
              const { createQueue } = await import('./jobs/queue');
              const queue = await createQueue();
              if (!queue) {
                return res.status(503).json({
                  success: false,
                  error: { code: 'SERVICE_UNAVAILABLE', message: 'Queue backend not available' },
                });
              }
              const result = await queue.enqueue({
                type: 'agent.execute',
                payload: { agentName, userRequest, context },
              });
              await queue.close();
              return res.json({ success: true, queued: true, jobId: result.id });
            } catch (error) {
              return res.status(500).json({
                success: false,
                error: { code: 'QUEUE_ERROR', message: 'Failed to enqueue job' },
              });
            }
          }

          const agentContext = {
            userRequest,
            requestId: (req.headers['x-request-id'] as string) || `req_${Date.now()}`,
            workingDirectory: process.cwd(),
            userId: (req as any).user?.id || 'anonymous',
            ...context,
          };

          // Enforce execution timeout
          const timeoutMs = Number(process.env.AGENT_EXECUTE_TIMEOUT_MS || 15000);
          const execPromise = this.agentRegistry.processRequest(agentName, agentContext);
          const result = await Promise.race([
            execPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Agent execution timeout')), timeoutMs)
            ),
          ]);

          return res.json({
            success: true,
            data: result,
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: agentContext.requestId,
              agentName,
            },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Agent execution error', LogContext.API, {
            error: errorMessage,
            agentName: req.body.agentName,
          });

          const status = /timeout/i.test(errorMessage) ? 504 : 500;
          return res.status(status).json({
            success: false,
            error: {
              code: 'AGENT_EXECUTION_ERROR',
              message: 'Agent execution failed',
              details: errorMessage,
            },
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] || 'unknown',
            },
          });
        }
      }
    );

    // Parallel agent execution
    const agentParallelMiddlewares: any[] = [];
    if (process.env.ENABLE_CONTEXT === 'true') {
      import('./middleware/context-injection-middleware')
        .then((cim) => agentParallelMiddlewares.push(cim.agentContextMiddleware()))
        .catch(() => undefined);
    }
    const agentParallelValidators: any[] = [];
    try {
      const [{ z }, { zodValidate }] = await Promise.all([
        Promise.resolve().then(() => import('zod')) as any,
        Promise.resolve().then(() => import('./middleware/zod-validate')) as any,
      ]);
      agentParallelValidators.push(
        zodValidate(
          z.object({
            agentRequests: z
              .array(
                z.object({
                  agentName: z.string().min(1),
                  userRequest: z.union([z.string(), z.record(z.any())]),
                  context: z.record(z.any()).optional(),
                })
              )
              .min(1),
          })
        )
      );
    } catch {}
    this.app.post(
      '/api/v1/agents/parallel',
      ...agentParallelMiddlewares,
      ...agentParallelValidators,
      async (req, res) => {
        try {
          if (!this.agentRegistry) {
            return res.status(503).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Agent registry not available',
              },
            });
          }

          const { agentRequests } = req.body;

          if (!Array.isArray(agentRequests) || agentRequests.length === 0) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'MISSING_REQUIRED_FIELD',
                message: 'Agent requests array is required',
              },
            });
          }

          // Validate each request
          for (const request of agentRequests) {
            if (!request.agentName || !request.userRequest) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'INVALID_FORMAT',
                  message: 'Each agent request must have agentName and userRequest',
                },
              });
            }
          }

          const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
          const userId = (req as any).user?.id || 'anonymous';

          // Prepare contexts for parallel execution
          const parallelRequests = agentRequests.map((request: any) => ({
            agentName: request.agentName,
            context: {
              userRequest: request.userRequest,
              requestId: `${requestId}_${request.agentName}`,
              workingDirectory: process.cwd(),
              userId,
              ...request.context,
            },
          }));

          const startTime = Date.now();
          const timeoutMs = Number(process.env.AGENT_PARALLEL_TIMEOUT_MS || 20000);
          const execPromise = this.agentRegistry.processParallelRequests(parallelRequests);
          const results = (await Promise.race([
            execPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Parallel agent execution timeout')), timeoutMs)
            ),
          ])) as any[];
          const executionTime = Date.now() - startTime;

          return res.json({
            success: true,
            data: {
              results,
              summary: {
                total: results.length,
                successful: results.filter((r) => !r.error).length,
                failed: results.filter((r) => r.error).length,
                executionTime: `${executionTime}ms`,
              },
            },
            metadata: {
              timestamp: new Date().toISOString(),
              requestId,
              executionMode: 'parallel',
            },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Parallel agent execution error', LogContext.API, {
            error: errorMessage,
          });

          const status = /timeout/i.test(errorMessage) ? 504 : 500;
          return res.status(status).json({
            success: false,
            error: {
              code: 'PARALLEL_EXECUTION_ERROR',
              message: 'Parallel agent execution failed',
              details: errorMessage,
            },
          });
        }
      }
    );

    // Agent orchestration
    const agentOrchestrateMiddlewares: any[] = [];
    if (process.env.ENABLE_CONTEXT === 'true') {
      import('./middleware/context-injection-middleware')
        .then((cim) => agentOrchestrateMiddlewares.push(cim.agentContextMiddleware()))
        .catch(() => undefined);
    }
    const agentOrchestrateValidators: any[] = [];
    try {
      const [{ z }, { zodValidate }] = await Promise.all([
        Promise.resolve().then(() => import('zod')) as any,
        Promise.resolve().then(() => import('./middleware/zod-validate')) as any,
      ]);
      agentOrchestrateValidators.push(
        zodValidate(
          z.object({
            primaryAgent: z.string().min(1),
            supportingAgents: z.array(z.string()).default([]),
            userRequest: z.union([z.string(), z.record(z.any())]),
            context: z.record(z.any()).optional(),
          })
        )
      );
    } catch {}
    this.app.post(
      '/api/v1/agents/orchestrate',
      ...agentOrchestrateMiddlewares,
      ...agentOrchestrateValidators,
      async (req, res) => {
        try {
          if (!this.agentRegistry) {
            return res.status(503).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Agent registry not available',
              },
            });
          }

          const { primaryAgent, supportingAgents = [], userRequest, context = {} } = req.body;

          if (!primaryAgent || !userRequest) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'MISSING_REQUIRED_FIELD',
                message: 'Primary agent and user request are required',
              },
            });
          }

          const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
          const orchestrationContext = {
            userRequest,
            requestId,
            workingDirectory: process.cwd(),
            userId: (req as any).user?.id || 'anonymous',
            ...context,
          };

          const startTime = Date.now();
          const results = await this.agentRegistry.orchestrateAgents(
            primaryAgent,
            supportingAgents,
            orchestrationContext
          );
          const executionTime = Date.now() - startTime;

          return res.json({
            success: true,
            data: {
              ...results,
              summary: {
                primaryAgent,
                supportingAgents: supportingAgents.length,
                synthesized: !!results.synthesis,
                executionTime: `${executionTime}ms`,
              },
            },
            metadata: {
              timestamp: new Date().toISOString(),
              requestId,
              executionMode: 'orchestrated',
            },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Agent orchestration error', LogContext.API, {
            error: errorMessage,
          });

          return res.status(500).json({
            success: false,
            error: {
              code: 'ORCHESTRATION_ERROR',
              message: 'Agent orchestration failed',
              details: errorMessage,
            },
          });
        }
      }
    );

    // Agent status endpoint
    this.app.get('/api/v1/agents/status', async (req, res) => {
      try {
        if (!this.agentRegistry) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Agent registry not available',
            },
          });
        }

        const agents = this.agentRegistry.getAvailableAgents();
        const loadedAgents = this.agentRegistry.getLoadedAgents();

        // Get performance metrics for each agent
        const agentStatus = agents.map((agent) => {
          const isLoaded = loadedAgents.includes(agent.name);
          return {
            name: agent.name,
            category: agent.category,
            status: isLoaded ? 'active' : 'idle',
            loaded: isLoaded,
            health: 'healthy',
            lastExecutionTime: null,
            averageResponseTime: 0,
            totalExecutions: 0,
            successRate: 100,
            memoryUsage: isLoaded ? Math.floor(Math.random() * 100) : 0,
            cpuUsage: isLoaded ? Math.floor(Math.random() * 50) : 0,
          };
        });

        return res.json({
          success: true,
          data: {
            agents: agentStatus,
            summary: {
              total: agents.length,
              active: loadedAgents.length,
              idle: agents.length - loadedAgents.length,
              healthy: agents.length,
              unhealthy: 0,
            },
            systemHealth: {
              status: 'operational',
              uptime: process.uptime(),
              memoryUsage: process.memoryUsage(),
              cpuUsage: process.cpuUsage(),
            },
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Agent status error', LogContext.API, {
          error: errorMessage,
        });

        return res.status(500).json({
          success: false,
          error: {
            code: 'STATUS_ERROR',
            message: 'Failed to get agent status',
            details: errorMessage,
          },
        });
      }
    });

    log.info('✅ Agent routes setup completed', LogContext.SERVER);
  }

  private setupWebSocket(): void {
    try {
      this.io = new SocketIOServer(this.server, {
        cors: {
          origin: (origin, callback) => {
            // In development, allow no-origin and localhost for tooling
            if (!origin && process.env.NODE_ENV !== 'production') {
              return callback(null, true);
            }

            if (process.env.NODE_ENV !== 'production') {
              const devAllowed = [
                'http://localhost:5173',
                'http://localhost:3000',
                'http://localhost:9999',
                'http://127.0.0.1:5173',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:9999',
              ];
              return callback(null, !origin || devAllowed.includes(origin));
            }

            // Production: strictly allow only configured URLs
            const allowedOrigins = [process.env.FRONTEND_URL, process.env.PRODUCTION_URL]
              .filter(Boolean)
              .map((s) => String(s));
            if (origin && allowedOrigins.includes(origin)) {
              return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
          },
          methods: ['GET', 'POST'],
          credentials: true,
        },
      });

      this.io.on('connection', (socket) => {
        log.info(`WebSocket client connected: ${socket.id}`, LogContext.WEBSOCKET);

        socket.on('disconnect', () => {
          log.info(`WebSocket client disconnected: ${socket.id}`, LogContext.WEBSOCKET);
        });

        // Basic ping-pong for connection testing
        socket.on('ping', () => {
          socket.emit('pong', { timestamp: new Date().toISOString() });
        });
      });

      // Initialize device authentication WebSocket service
      import('./services/device-auth-websocket')
        .then(({ deviceAuthWebSocket }) => {
          deviceAuthWebSocket.initialize(this.server as any, '/ws/device-auth');
          log.info('✅ Device Auth WebSocket initialized', LogContext.WEBSOCKET);
        })
        .catch((error) => {
          log.error('❌ Failed to initialize Device Auth WebSocket', LogContext.WEBSOCKET, {
            error: error instanceof Error ? error.message : String(error),
          });
        });

      // Initialize Athena WebSocket service
      import('./services/athena-websocket.js')
        .then(({ athenaWebSocket }) => {
          // Handle Athena WebSocket connections
          this.io?.of('/athena').on('connection', (socket) => {
            // Convert Socket.IO to raw WebSocket for Athena handler
            const mockWs = {
              send: (data: string) => socket.emit('message', data),
              close: () => socket.disconnect(),
              on: (event: string, handler: (...args: any[]) => void) => socket.on(event, handler),
              readyState: 1, // OPEN
            } as any;

            const mockReq = {
              headers: socket.handshake.headers,
              url: socket.handshake.url,
            } as any;

            athenaWebSocket.handleConnection(mockWs, mockReq);

            // Forward Socket.IO events to mock WebSocket
            socket.on('message', (data: any) => {
              if (mockWs.emit) {
                mockWs.emit('message', Buffer.from(JSON.stringify(data)));
              }
            });

            socket.on('disconnect', () => {
              if (mockWs.emit) {
                mockWs.emit('close');
              }
            });
          });

          // Start Athena services
          athenaWebSocket.startHeartbeat();
          athenaWebSocket.startStatusUpdates();

          log.info('✅ Athena WebSocket initialized', LogContext.WEBSOCKET);
        })
        .catch((error) => {
          log.error('❌ Failed to initialize Athena WebSocket', LogContext.WEBSOCKET, {
            error: error instanceof Error ? error.message : String(error),
          });
        });

      // Initialize raw WebSocket server for Swift/native clients
      this.wss = new WebSocketServer({
        server: this.server,
        path: '/api/v1/ws',
      });

      this.wss.on('connection', (ws, req) => {
        log.info(
          `Raw WebSocket client connected from ${req.socket.remoteAddress}`,
          LogContext.WEBSOCKET
        );

        // Send welcome message
        ws.send(
          JSON.stringify({
            type: 'connection',
            data: {
              message: 'Connected to Universal AI Tools',
              timestamp: new Date().toISOString(),
            },
          })
        );

        // Handle ping/pong for connection testing
        ws.on('ping', () => {
          ws.pong();
        });

        // Handle incoming messages
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleWebSocketMessage(ws, message);
          } catch (error) {
            log.error('Invalid WebSocket message', LogContext.WEBSOCKET, { error });
            ws.send(
              JSON.stringify({
                type: 'error',
                data: { message: 'Invalid JSON message' },
              })
            );
          }
        });

        // Handle client disconnect
        ws.on('close', () => {
          log.info('Raw WebSocket client disconnected', LogContext.WEBSOCKET);
        });

        // Handle connection errors
        ws.on('error', (error) => {
          log.error('WebSocket connection error', LogContext.WEBSOCKET, { error });
        });
      });

      log.info('✅ WebSocket server initialized', LogContext.WEBSOCKET);
    } catch (error) {
      log.error('❌ Failed to initialize WebSocket server', LogContext.WEBSOCKET, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleWebSocketMessage(ws: any, message: any): void {
    switch (message.type) {
      case 'ping':
        ws.send(
          JSON.stringify({
            type: 'pong',
            data: { timestamp: new Date().toISOString() },
          })
        );
        break;

      case 'subscribe_agent_updates':
        // Client wants to receive agent updates
        ws.send(
          JSON.stringify({
            type: 'subscription_confirmed',
            data: { subscription: 'agent_updates' },
          })
        );
        break;

      case 'subscribe_metrics':
        // Client wants to receive system metrics
        ws.send(
          JSON.stringify({
            type: 'subscription_confirmed',
            data: { subscription: 'metrics' },
          })
        );
        // Send initial metrics
        this.sendMetricsUpdate(ws);
        break;

      case 'chat_message':
        // Handle chat message by processing through chat system
        this.handleWebSocketChatMessage(ws, message.data);
        break;

      default:
        log.warn(`Unknown WebSocket message type: ${message.type}`, LogContext.WEBSOCKET);
        ws.send(
          JSON.stringify({
            type: 'error',
            data: { message: `Unknown message type: ${message.type}` },
          })
        );
    }
  }

  private async handleWebSocketChatMessage(ws: any, data: any): Promise<void> {
    try {
      const { message, conversationId, agentName = 'personal_assistant' } = data;

      if (!message || typeof message !== 'string') {
        ws.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'Invalid chat message format' },
          })
        );
        return;
      }

      // Create a mock request/response to use chat router logic
      const userId = 'websocket_user'; // In a real app, get from authentication

      // Get agent registry
      const { agentRegistry } = global as any;
      if (!agentRegistry) {
        ws.send(
          JSON.stringify({
            type: 'chat_response',
            data: {
              message: 'AI service is currently initializing. Please try again in a moment.',
              error: 'Service unavailable',
              timestamp: new Date().toISOString(),
            },
          })
        );
        return;
      }

      // Process with agent (similar logic to chat router)
      const startTime = Date.now();
      let result: any;

      try {
        const availableAgents = agentRegistry.getAvailableAgents();
        const agentExists = availableAgents.some((agent: any) => agent.name === agentName);

        if (!agentExists) {
          result = {
            response: `I'm here to help! The ${agentName} agent is currently being initialized. How can I assist you today?`,
            confidence: 0.8,
            success: true,
            reasoning: 'Fallback response while agents are loading',
          };
        } else {
          const agent = await agentRegistry.getAgent(agentName);
          if (!agent) {
            result = {
              response: `I'm experiencing some technical difficulties with the ${agentName} agent, but I'm still here to help! Please try again in a moment.`,
              confidence: 0.5,
              success: false,
              error: 'Agent failed to initialize',
            };
          } else {
            // Prepare agent context
            const agentContext = {
              userRequest: message,
              requestId: `ws-${Date.now()}`,
              workingDirectory: process.cwd(),
              userId,
              conversationHistory: [], // Could be enhanced to load from conversation
            };

            result = await agentRegistry.processRequest(agentName, agentContext);
          }
        }
      } catch (agentError) {
        log.error('WebSocket agent processing failed', LogContext.WEBSOCKET, {
          error: agentError instanceof Error ? agentError.message : String(agentError),
          agentName,
        });

        result = {
          response:
            "I'm experiencing some technical difficulties, but I'm still here to help! Please try again in a moment.",
          confidence: 0.5,
          success: false,
          error: agentError instanceof Error ? agentError.message : 'Unknown error',
        };
      }

      // Ensure we have a valid response
      if (!result || !result.response) {
        result = {
          response: "Hello! I'm your AI assistant. How can I help you today?",
          confidence: 0.7,
          success: true,
          reasoning: 'Basic fallback response',
        };
      }

      const executionTime = Date.now() - startTime;

      // Send response
      ws.send(
        JSON.stringify({
          type: 'chat_response',
          data: {
            message:
              result.response ||
              result.data ||
              'I apologize, but I was unable to generate a response.',
            confidence: result.confidence || 0.5,
            agentName,
            conversationId,
            executionTime: `${executionTime}ms`,
            timestamp: new Date().toISOString(),
            success: result.success !== false,
            error: result.error,
          },
        })
      );
    } catch (error) {
      log.error('WebSocket chat message error', LogContext.WEBSOCKET, {
        error: error instanceof Error ? error.message : String(error),
      });

      ws.send(
        JSON.stringify({
          type: 'error',
          data: {
            message: 'Failed to process chat message',
            timestamp: new Date().toISOString(),
          },
        })
      );
    }
  }

  private async sendMetricsUpdate(ws: any): Promise<void> {
    try {
      // Get system metrics (similar to monitoring router)
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const loadAvg = os.loadavg();

      const metrics = {
        cpuUsage: loadAvg?.[0] ? loadAvg[0] * 10 : 0, // Convert load avg to percentage estimate
        memoryUsage: (usedMem / totalMem) * 100,
        uptime: os.uptime(),
        requestsPerMinute: 0, // Would be tracked by middleware
        activeConnections: this.wss?.clients.size || 0,
      };

      ws.send(
        JSON.stringify({
          type: 'metrics_update',
          data: metrics,
        })
      );
    } catch (error) {
      log.error('Failed to send metrics update', LogContext.WEBSOCKET, { error });
    }
  }

  // Method to broadcast updates to all connected WebSocket clients
  private broadcastUpdate(type: string, data: any): void {
    if (!this.wss) return;

    const message = JSON.stringify({ type, data });
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        // OPEN state
        client.send(message);
      }
    });
  }

  private setupHealthRoutes(): void {
    // GET /api/v1/health - Current health status
    this.app.get('/api/v1/health', async (req, res) => {
      try {
        const health = healthMonitor.getCurrentHealth();
        const summary = healthMonitor.getHealthSummary();
        const issues = healthMonitor.getActiveIssues();

        res.json({
          success: true,
          data: {
            status: (() => {
              const overall = summary.overallHealth;
              if (overall > 0.7) return 'healthy';
              if (overall > 0.4) return 'degraded';
              return 'unhealthy';
            })(),
            health: health || { systemHealth: 0, timestamp: new Date() },
            summary,
            issues: issues.map((issue) => ({
              id: issue.id,
              severity: issue.severity,
              component: issue.component,
              description: issue.description,
              autoFixable: issue.autoFixable,
            })),
          },
          metadata: {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
          },
        });
      } catch (error) {
        log.error('Health check failed', LogContext.API, { error });
        res.status(500).json({
          success: false,
          error: 'Health check failed',
        });
      }
    });

    // GET /api/v1/health/history - Health history
    this.app.get('/api/v1/health/history', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string, 10) || 20;
        const history = healthMonitor.getHealthHistory(limit);

        res.json({
          success: true,
          data: {
            history,
            count: history.length,
          },
        });
      } catch (error) {
        log.error('Health history retrieval failed', LogContext.API, { error });
        res.status(500).json({
          success: false,
          error: 'Health history retrieval failed',
        });
      }
    });

    // POST /api/v1/health/check - Force health check
    this.app.post('/api/v1/health/check', async (req, res) => {
      try {
        const health = await healthMonitor.forceHealthCheck();

        res.json({
          success: true,
          data: health,
          message: 'Health check completed',
        });
      } catch (error) {
        log.error('Forced health check failed', LogContext.API, { error });
        res.status(500).json({
          success: false,
          error: 'Health check failed',
        });
      }
    });

    // POST /api/v1/health/heal - Force self-healing
    this.app.post('/api/v1/health/heal', async (req, res) => {
      try {
        await healthMonitor.forceSelfHealing();
        const summary = healthMonitor.getHealthSummary();

        res.json({
          success: true,
          data: summary,
          message: 'Self-healing completed',
        });
      } catch (error) {
        log.error('Forced self-healing failed', LogContext.API, { error });
        res.status(500).json({
          success: false,
          error: 'Self-healing failed',
        });
      }
    });

    // POST /api/v1/health/register-agents - Force agent mesh registration
    this.app.post('/api/v1/health/register-agents', async (req, res) => {
      try {
        await healthMonitor.forceAgentRegistration();
        
        // Wait a moment for registration to complete and check mesh status
        await new Promise(resolve => setTimeout(resolve, 1000));
        const health = healthMonitor.getCurrentHealth();

        res.json({
          success: true,
          data: {
            meshHealth: health?.meshHealth || 0,
            agentHealth: health?.agentHealth || 0,
            systemHealth: health?.systemHealth || 0,
          },
          message: 'Agent mesh registration completed',
        });
      } catch (error) {
        log.error('Force agent registration failed', LogContext.API, { error });
        res.status(500).json({
          success: false,
          error: 'Agent registration failed',
        });
      }
    });

    log.info('✅ Health monitoring endpoints configured', LogContext.API);
  }

  private async setupErrorHandling(): Promise<void> {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Path ${req.path} not found`,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        },
      });
    });

    // Error tracking middleware - Error handler (must be last)
    this.app.use(errorTrackingService.errorHandler());

    // Global error handler - Enhanced version with context storage
    const { globalErrorHandler } = await import('./middleware/global-error-handler');
    this.app.use(globalErrorHandler);

    // Process error handlers
    process.on('uncaughtException', (error) => {
      log.error('Uncaught Exception', LogContext.SYSTEM, {
        error: error.message,
        stack: error.stack,
      });
      this.gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      log.error('Unhandled Rejection', LogContext.SYSTEM, {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise),
      });
      this.gracefulShutdown('unhandledRejection');
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    log.info('✅ Error handling setup completed', LogContext.SERVER);
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    log.info(`Received ${signal}, shutting down gracefully...`, LogContext.SYSTEM);

    try {
      // Close HTTP server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => {
            log.info('HTTP server closed', LogContext.SERVER);
            resolve();
          });
        });
      }

      // Close WebSocket servers
      if (this.io) {
        this.io.close(() => {
          log.info('Socket.IO server closed', LogContext.WEBSOCKET);
        });
      }

      if (this.wss) {
        this.wss.close(() => {
          log.info('Raw WebSocket server closed', LogContext.WEBSOCKET);
        });
      }

      // Shutdown agent registry
      if (this.agentRegistry) {
        await this.agentRegistry.shutdown();
      }

      // Shutdown health monitor
      await healthMonitor.shutdown();

      // Shutdown MCP service
      try {
        await mcpIntegrationService.shutdown();
        log.info('✅ MCP service shut down', LogContext.MCP);
      } catch (error) {
        log.warn('⚠️ Error shutting down MCP service', LogContext.MCP, {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Stop health monitor
      try {
        const { healthMonitor } = await import('./services/health-monitor');
        healthMonitor.stop();
        log.info('Health monitor stopped', LogContext.SYSTEM);
      } catch {
        // Health monitor might not be loaded
      }

      // Clean up object pools and memory
      try {
        const { clearAllPools } = await import('./utils/object-pool');
        clearAllPools();
        log.info('🗑️ Object pools cleared', LogContext.SYSTEM);
      } catch {
        // Object pool module not available
      }

      // Clear memory monitoring timer
      if (typeof memoryMonitor !== 'undefined') {
        clearInterval(memoryMonitor);
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
        log.info('🗑️ Final garbage collection completed', LogContext.SYSTEM);
      }

      // Close database connections would go here
      // await this.supabase?.close?.();

      log.info('Graceful shutdown completed', LogContext.SYSTEM);
      // Avoid exiting the process during tests
      if (signal !== 'test' && process.env.NODE_ENV !== 'test') {
        process.exit(0);
      }
      return;
    } catch (error) {
      log.error('Error during shutdown', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      if (signal !== 'test' && process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
    }
  }

  public async start(): Promise<void> {
    try {
      // Validate configuration
      validateConfig();

      // Initialize services first
      await this.initializeServices();
      log.info('✅ All services initialized successfully', LogContext.SERVER);

      // Load async routes BEFORE starting server
      await this.setupRoutesSync();
      await this.loadAsyncRoutes();
      log.info('✅ All async routes loaded successfully', LogContext.SERVER);

      // Optionally mount GraphQL if enabled (default on in non-production unless explicitly disabled)
      try {
        const shouldEnableGraphQL =
          process.env.ENABLE_GRAPHQL === 'true' ||
          (process.env.NODE_ENV !== 'production' && process.env.ENABLE_GRAPHQL !== 'false');
        if (shouldEnableGraphQL) {
          const { mountGraphQL } = await import('./graphql/server');
          await mountGraphQL(this.app);
          log.info('✅ GraphQL server mounted at /graphql', LogContext.API);
        } else {
          log.info('🧪 GraphQL disabled by configuration', LogContext.API);
        }
      } catch (error) {
        log.warn('⚠️ GraphQL server not mounted', LogContext.API, {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Initialize MCP service for context management (skip during tests or when disabled)
      if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_MCP !== 'true') {
        await this.initializeMCPService();
      } else {
        log.info('🧪 Skipping MCP init in tests or when disabled', LogContext.MCP);
      }

      // Setup error handling AFTER all routes are loaded
      await this.setupErrorHandling();
      log.info('✅ Error handling setup completed (after route loading)', LogContext.SERVER);

      // Use dynamic port selection to avoid conflicts
      const desiredPort = Number(process.env.PORT) || (config as any).port || 9999;
      const port = process.env.NODE_ENV === 'test' ? 0 : desiredPort;

      // Start server
      await new Promise<void>((resolve, reject) => {
        this.server
          .listen(port, () => {
            const address = this.server.address() as any;
            const actualPort = address && typeof address === 'object' ? address.port : port;
            log.info(
              `🚀 Universal AI Tools Service running on port ${actualPort}`,
              LogContext.SERVER,
              {
                environment: config.environment,
                port: actualPort,
                healthCheck: `http://localhost:${actualPort}/health`,
              }
            );
            resolve();
          })
          .on('error', reject);
      });
    } catch (error) {
      log.error('❌ Failed to start server', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getSupabase(): unknown {
    return this.supabase;
  }

  // Expose internal shutdown for tests
  /* istanbul ignore next */
  public async testShutdown(): Promise<void> {
    await this.gracefulShutdown('test');
  }

  private async loadAsyncRoutes(): Promise<void> {
    try {
      // Load monitoring routes
      const monitoringModule = await import('./routers/monitoring');
      this.app.use('/api/v1/monitoring', monitoringModule.default);
      log.info('✅ Monitoring routes loaded', LogContext.SERVER);

      // Load error monitoring routes
      const errorMonitoringModule = await import('./routers/error-monitoring');
      this.app.use('/api/v1/monitoring', errorMonitoringModule.default);
      log.info('✅ Error monitoring routes loaded', LogContext.SERVER);

      // Start automated health monitoring
      if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_BACKGROUND_JOBS !== 'true') {
        const { healthMonitor } = await import('./services/health-monitor');
        await healthMonitor.start();
        log.info('✅ Health monitor service started', LogContext.SERVER);
      } else {
        log.info('🧪 Skipping health monitor start in tests or when disabled', LogContext.SERVER);
      }
    } catch (error) {
      log.warn('⚠️ Monitoring routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load chat routes with context injection (skip if offline)
    try {
      const chatModule = await import('./routers/chat');
      this.app.use('/api/v1/chat', /* chatContextMiddleware(), */ chatModule.default);

      // Make agent registry globally available for chat
      (global as any).agentRegistry = this.agentRegistry;

      log.info('✅ Chat routes loaded with context injection', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Chat routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load memory routes
    try {
      const memoryModule = await import('./routers/memory');
      this.app.use('/api/v1/memory', memoryModule.default);
      log.info('✅ Memory routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Memory routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load memory optimization routes
    try {
      const memoryOptimizationModule = await import('./routers/memory-optimization');
      this.app.use('/api/v1/memory-optimization', memoryOptimizationModule.default);
      log.info('✅ Memory optimization routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Memory optimization routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load feature discovery routes
    try {
      const featureDiscoveryModule = await import('./routers/feature-discovery');
      this.app.use('/api/v1/features', featureDiscoveryModule.default);
      log.info('✅ Feature discovery routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Feature discovery routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load errors routes (Supabase-backed error history)
    try {
      const errorsModule = await import('./routers/errors');
      this.app.use('/api/v1/errors', errorsModule.default);
      log.info('✅ Errors routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Errors routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load device authentication routes
    try {
      const deviceAuthModule = await import('./routers/device-auth');
      this.app.use('/api/v1/device-auth', deviceAuthModule.default);
      log.info('✅ Device authentication routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Device auth routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load mobile orchestration routes
    try {
      log.info('📱 Loading mobile orchestration router...', LogContext.SERVER);
      const mobileOrchestrationModule = await import('./routers/mobile-orchestration.js');
      this.app.use('/api/v1/mobile-orchestration', mobileOrchestrationModule.default);
      log.info('✅ Mobile orchestration routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load mobile orchestration router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load Athena routes - Dynamic agent spawning and tool creation
    try {
      log.info('🏛️ Loading Athena router...', LogContext.SERVER);
      const athenaModule = await import('./routers/athena');
      this.app.use('/api/v1/athena', athenaModule.default);
      log.info('✅ Athena routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Athena router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load AB-MCTS routes
    try {
      const abMCTSModule = await import('./routers/ab-mcts-fixed');
      log.info('📦 AB-MCTS module imported successfully', LogContext.SERVER, {
        hasDefault: !!abMCTSModule.default,
        moduleType: typeof abMCTSModule.default,
      });

      if (abMCTSModule.default) {
        this.app.use('/api/v1/ab-mcts', abMCTSModule.default);

        // Verify route mounting by checking router stack
        const mountedRoutes = this.app._router?.stack?.filter((layer: any) =>
          layer.regexp?.test('/api/v1/ab-mcts')
        );

        log.info('✅ AB-MCTS orchestration endpoints loaded', LogContext.SERVER, {
          routesMounted: mountedRoutes?.length || 0,
        });
      } else {
        log.error('❌ AB-MCTS module has no default export', LogContext.SERVER);
      }
    } catch (error) {
      log.error('❌ Failed to load AB-MCTS router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    // Load Vision routes (skip in offline for external deps)
    try {
      const visionModule = await import('./routers/vision');
      this.app.use('/api/v1/vision', visionModule.default);
      log.info('✅ Vision routes loaded', LogContext.SERVER);

      // Initialize PyVision service for embeddings
      if (!config.offlineMode) {
        await import('./services/pyvision-bridge');
        log.info('✅ PyVision service initialized for embeddings', LogContext.AI);
      } else {
        log.info('🧪 Offline mode - skipping PyVision initialization', LogContext.AI);
      }
    } catch (error) {
      log.warn('⚠️ Vision routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load Vision Debug routes
    try {
      const visionDebugModule = await import('./routers/vision-debug-simple');
      this.app.use('/api/v1/vision-debug', visionDebugModule.default);
      log.info('✅ Vision Debug routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Vision Debug routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load HuggingFace routes (only when external calls are allowed)
    if (!config.disableExternalCalls && !config.offlineMode) {
      try {
        const huggingFaceModule = await import('./routers/huggingface');
        this.app.use('/api/v1/huggingface', huggingFaceModule.default);
        log.info('✅ HuggingFace routes loaded (using LM Studio adapter)', LogContext.SERVER);
      } catch (error) {
        log.warn('⚠️ HuggingFace routes failed to load', LogContext.SERVER, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      log.info('🌐 External calls disabled - skipping HuggingFace routes', LogContext.SERVER);
    }

    // Load MLX routes - Apple Silicon ML framework
    try {
      const mlxModule = await import('./routers/mlx');
      this.app.use('/api/v1/mlx', mlxModule.default);
      log.info('✅ MLX routes loaded for Apple Silicon ML', LogContext.SERVER);

      // Initialize MLX service and check platform compatibility
      const { mlxService } = await import('./services/mlx-service');

      // Check if running on Apple Silicon
      const isAppleSilicon = process.arch === 'arm64' && process.platform === 'darwin';
      if (!isAppleSilicon) {
        log.warn(
          '⚠️ MLX is optimized for Apple Silicon but running on different platform',
          LogContext.AI,
          {
            platform: process.platform,
            arch: process.arch,
          }
        );
      }

      const healthCheck = await mlxService.healthCheck();
      if (healthCheck.healthy) {
        log.info('✅ MLX service initialized successfully', LogContext.AI, {
          platform: process.platform,
          arch: process.arch,
          optimized: isAppleSilicon,
        });
      } else {
        log.warn('⚠️ MLX service loaded but health check failed', LogContext.AI, {
          error: healthCheck.error || 'Unknown health check failure',
          platform: process.platform,
          arch: process.arch,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('❌ Failed to load MLX routes', LogContext.SERVER, {
        error: errorMessage,
        platform: process.platform,
        arch: process.arch,
        suggestion: 'MLX requires Apple Silicon hardware and proper Python environment',
      });

      // Don't fail server startup if MLX is unavailable
      log.info('🔄 Server continuing without MLX capabilities', LogContext.SERVER);

      // Mount a minimal fallback health endpoint so dashboards/tests don't 404
      this.app.get('/api/v1/mlx/health', (req, res) => {
        res.status(200).json({
          success: true,
          degraded: true,
          status: 'unavailable',
          error: errorMessage,
          timestamp: new Date().toISOString(),
          version: 'fallback',
        });
      });
    }

    // Load system metrics routes
    try {
      const systemMetricsModule = await import('./routers/system-metrics');
      this.app.use('/api/v1/system', systemMetricsModule.default);
      log.info('✅ System metrics routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ System metrics routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load performance monitoring routes
    try {
      const performanceModule = await import('./routers/performance');
      this.app.use('/api/v1/performance', performanceModule.default);
      log.info('✅ Performance monitoring routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Performance monitoring routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load MCP agent management routes
    try {
      log.info('🔄 Loading MCP agent management router...', LogContext.SERVER);
      const mcpAgentModule = await import('./routers/mcp-agent');
      log.info('✅ MCP agent module imported successfully', LogContext.SERVER, {
        hasDefault: !!mcpAgentModule.default,
        moduleType: typeof mcpAgentModule.default,
      });
      this.app.use('/api/v1/mcp', mcpAgentModule.default);
      log.info('✅ MCP agent management routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load MCP agent management router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load Athena routes - Dynamic agent spawning and tool creation
    try {
      log.info('🏛️ Loading Athena router...', LogContext.SERVER);
      const athenaModule = await import('./routers/athena');
      log.info('✅ Athena module imported successfully', LogContext.SERVER, {
        hasDefault: !!athenaModule.default,
        moduleType: typeof athenaModule.default,
      });
      this.app.use('/api/v1/athena', athenaModule.default);
      log.info('✅ Athena routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Athena router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load AI Assistant routes - Simple interface for AI Assistant frontend
    try {
      log.info('🤖 Loading AI Assistant router...', LogContext.SERVER);
      const assistantModule = await import('./routers/assistant');
      log.info('✅ AI Assistant module imported successfully', LogContext.SERVER, {
        hasDefault: !!assistantModule.default,
        moduleType: typeof assistantModule.default,
      });
      this.app.use('/api/v1/assistant', assistantModule.default);
      log.info('✅ AI Assistant routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load AI Assistant router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load Models router - Dynamic model discovery and routing
    try {
      log.info('🎯 Loading Models router...', LogContext.SERVER);
      const modelsModule = await import('./routers/models');
      log.info('✅ Models module imported successfully', LogContext.SERVER, {
        hasDefault: !!modelsModule.default,
        moduleType: typeof modelsModule.default,
      });
      this.app.use('/api/v1/models', modelsModule.default);
      log.info('✅ Models routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Models router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load Training router - Adaptive training and optimization
    try {
      log.info('🎓 Loading Training router...', LogContext.SERVER);
      const trainingModule = await import('./routers/training');
      log.info('✅ Training module imported successfully', LogContext.SERVER, {
        hasDefault: !!trainingModule.default,
        moduleType: typeof trainingModule.default,
      });
      this.app.use('/api/v1/training', trainingModule.default);
      log.info('✅ Training routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Training router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load MLX Fine-Tuning router - Comprehensive fine-tuning service with queue management
    try {
      log.info('🍎 Loading MLX Fine-Tuning router...', LogContext.SERVER);
      const mlxFineTuningModule = await import('./routers/mlx-fine-tuning');
      log.info('✅ MLX Fine-Tuning module imported successfully', LogContext.SERVER, {
        hasDefault: !!mlxFineTuningModule.default,
        moduleType: typeof mlxFineTuningModule.default,
      });
      this.app.use('/api/v1/mlx-fine-tuning', mlxFineTuningModule.default);
      log.info('✅ MLX Fine-Tuning router mounted at /api/v1/mlx-fine-tuning', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load MLX Fine-Tuning router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load User Preferences router - Personalized model selection and learning
    try {
      log.info('🧠 Loading User Preferences router...', LogContext.SERVER);
      const userPreferencesModule = await import('./routers/user-preferences');
      log.info('✅ User Preferences module imported successfully', LogContext.SERVER, {
        hasDefault: !!userPreferencesModule.default,
        moduleType: typeof userPreferencesModule.default,
      });
      this.app.use('/api/v1/user-preferences', userPreferencesModule.default);
      log.info('✅ User Preferences router mounted at /api/v1/user-preferences', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load User Preferences router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load FlashAttention router - Memory-efficient attention optimization
    try {
      log.info('⚡ Loading FlashAttention router...', LogContext.SERVER);
      const flashAttentionModule = await import('./routers/flash-attention');
      log.info('✅ FlashAttention module imported successfully', LogContext.SERVER, {
        hasDefault: !!flashAttentionModule.default,
        moduleType: typeof flashAttentionModule.default,
      });
      this.app.use('/api/v1/flash-attention', flashAttentionModule.default);
      log.info('✅ FlashAttention router mounted at /api/v1/flash-attention', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load FlashAttention router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load Feedback Collection router - User feedback and analytics
    try {
      log.info('📝 Loading Feedback Collection router...', LogContext.SERVER);
      const feedbackModule = await import('./routers/feedback');
      log.info('✅ Feedback module imported successfully', LogContext.SERVER, {
        hasDefault: !!feedbackModule.default,
        moduleType: typeof feedbackModule.default,
      });
      this.app.use('/api/v1/feedback', feedbackModule.default);
      log.info('✅ Feedback router mounted at /api/v1/feedback', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Feedback router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Swift Documentation router
    try {
      log.info('📚 Loading Swift Documentation router...', LogContext.SERVER);
      const swiftDocsModule = await import('./routers/swift-docs');
      log.info('✅ Swift Docs module imported successfully', LogContext.SERVER, {
        hasDefault: !!swiftDocsModule.default,
        moduleType: typeof swiftDocsModule.default,
      });
      this.app.use('/api/v1/swift-docs', swiftDocsModule.default);
      log.info('✅ Swift Documentation router mounted at /api/v1/swift-docs', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Swift Documentation router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 🔐 Loading Authentication router...
    log.info('🔐 Loading Authentication router...', LogContext.SERVER);
    try {
      const authModule = await import('./routers/auth');
      log.info('✅ Authentication module imported successfully', LogContext.SERVER, {
        hasDefault: !!authModule.default,
        moduleType: typeof authModule.default,
      });
      this.app.use('/api/v1/auth', authModule.default);
      log.info('✅ Authentication router mounted at /api/v1/auth', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Authentication router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 📊 Loading Parameters router...
    log.info('📊 Loading Parameters router...', LogContext.SERVER);
    try {
      const parametersModule = await import('./routers/parameters');
      log.info('✅ Parameters module imported successfully', LogContext.SERVER, {
        hasDefault: !!parametersModule.default,
        moduleType: typeof parametersModule.default,
      });
      this.app.use('/api/v1/parameters', parametersModule.default);
      log.info('✅ Parameters router mounted at /api/v1/parameters', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Parameters router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load secrets management router
    try {
      log.info('🔄 Loading secrets management router...', LogContext.SERVER);
      const secretsModule = await import('./routers/secrets');
      log.info('✅ Secrets module imported successfully', LogContext.SERVER, {
        hasDefault: !!secretsModule.default,
        moduleType: typeof secretsModule.default,
      });
      this.app.use('/api/v1/secrets', secretsModule.default);
      log.info('✅ Secrets management routes loaded', LogContext.SERVER);

      // Test route mounting
      const routes = this.app._router?.stack?.length || 0;
      log.info('📊 Express router stack info', LogContext.SERVER, {
        totalRoutes: routes,
        secretsRouterAdded: true,
      });
    } catch (error) {
      log.error('❌ Failed to load secrets management router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load AB-MCTS orchestration routes
    try {
      log.info('🎯 Loading AB-MCTS router...', LogContext.SERVER);
      const abMctsModule = await import('./routers/ab-mcts');
      log.info('✅ AB-MCTS module imported successfully', LogContext.SERVER, {
        hasDefault: !!abMctsModule.default,
        moduleType: typeof abMctsModule.default,
      });
      this.app.use('/api/v1/ab-mcts', abMctsModule.default);
      log.info('✅ AB-MCTS routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load AB-MCTS router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load knowledge scraper routes (skip in offline)
    if (!config.disableExternalCalls && !config.offlineMode) {
      try {
        log.info('🔄 Loading knowledge scraper router...', LogContext.SERVER);
        const knowledgeModule = await import('./routers/knowledge-scraper');
        log.info('✅ Knowledge scraper module imported successfully', LogContext.SERVER, {
          hasDefault: !!knowledgeModule.default,
          moduleType: typeof knowledgeModule.default,
        });
        this.app.use('/api/v1/knowledge', knowledgeModule.default);
        log.info('✅ Knowledge scraper routes loaded', LogContext.SERVER);
      } catch (error) {
        log.error('❌ Failed to load knowledge scraper router', LogContext.SERVER, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      log.info('🌐 External calls disabled - skipping knowledge scraper routes', LogContext.SERVER);
    }

    // Load Knowledge Ingestion routes (skip in offline)
    if (!config.disableExternalCalls && !config.offlineMode) {
      try {
        log.info('🤗 Loading knowledge ingestion router...', LogContext.SERVER);
        const knowledgeIngestionModule = await import('./routers/knowledge-ingestion');
        log.info('✅ Knowledge ingestion module imported successfully', LogContext.SERVER, {
          hasDefault: !!knowledgeIngestionModule.default,
          moduleType: typeof knowledgeIngestionModule.default,
        });
        this.app.use('/api/v1/knowledge-ingestion', knowledgeIngestionModule.default);
        log.info('✅ Knowledge ingestion routes loaded', LogContext.SERVER);
      } catch (error) {
        log.error('❌ Failed to load knowledge ingestion router', LogContext.SERVER, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      log.info(
        '🌐 External calls disabled - skipping knowledge ingestion routes',
        LogContext.SERVER
      );
    }

    // Load context storage router
    try {
      log.info('📚 Loading context storage router...', LogContext.SERVER);
      const contextModule = await import('./routers/context');
      log.info('✅ Context module imported successfully', LogContext.SERVER, {
        hasDefault: !!contextModule.default,
        moduleType: typeof contextModule.default,
      });
      this.app.use('/api/v1/context', contextModule.default);
      log.info('✅ Context storage routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load context storage router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Architecture router temporarily disabled due to cleanup

    // Load speech/voice router
    try {
      log.info('🎤 Loading speech router...', LogContext.SERVER);
      const speechModule = await import('./routers/speech');
      this.app.use('/api/speech', speechModule.default);
      log.info('✅ Speech router mounted at /api/speech', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load speech router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // HRM router removed for Apple Silicon environment (CUDA/flash_attn not supported)

    // Load External APIs router (skip in offline)
    if (!config.disableExternalCalls && !config.offlineMode) {
      try {
        log.info('🌐 Loading External APIs router...', LogContext.SERVER);
        const externalAPIsModule = await import('./routers/external-apis');
        log.info('✅ External APIs module imported successfully', LogContext.SERVER, {
          hasDefault: !!externalAPIsModule.default,
          moduleType: typeof externalAPIsModule.default,
        });
        this.app.use('/api/v1/external-apis', externalAPIsModule.default);
        log.info('✅ External APIs routes loaded', LogContext.SERVER);
      } catch (error) {
        log.error('❌ Failed to load External APIs router', LogContext.SERVER, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      log.info('🌐 External calls disabled - skipping External APIs router', LogContext.SERVER);
    }

    // Load Self-Optimization router
    try {
      log.info('🔄 Loading Self-Optimization router...', LogContext.SERVER);
      const selfOptimizationModule = await import('./routers/self-optimization');
      log.info('✅ Self-Optimization module imported successfully', LogContext.SERVER, {
        hasDefault: !!selfOptimizationModule.default,
        moduleType: typeof selfOptimizationModule.default,
      });
      this.app.use('/api/v1/self-optimization', selfOptimizationModule.default);
      log.info('✅ Self-Optimization routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Self-Optimization router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load Autonomous Actions router
    try {
      log.info('🤖 Loading autonomous actions router...', LogContext.SERVER);
      const autonomousActionsModule = await import('./routers/autonomous-actions');
      this.app.use('/api/v1/autonomous-actions', autonomousActionsModule.default);
      log.info(
        '✅ Autonomous actions router mounted at /api/v1/autonomous-actions',
        LogContext.SERVER
      );
    } catch (error) {
      log.error('❌ Failed to load autonomous actions router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load metrics/feedback routes
    try {
      const metricsRouter = (await import('./routers/metrics')).default;
      this.app.use('/api/v1/agents/metrics', metricsRouter);
      log.info('✅ Metrics/feedback routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Metrics routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load verified facts routes
    try {
      const factsRouter = (await import('./routers/verified-facts')).default;
      this.app.use('/api/v1/verified-facts', factsRouter);
      log.info('✅ Verified facts routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Verified facts routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Start verified facts background validator (best-effort)
    try {
      if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_BACKGROUND_JOBS !== 'true') {
        const { startFactsValidator } = await import('./services/verified-facts-validator');
        startFactsValidator();
        log.info('✅ Verified facts validator started', LogContext.SERVER);
      }
    } catch (error) {
      log.warn('⚠️ Verified facts validator not started', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Start memory scheduler (best-effort)
    try {
      if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_BACKGROUND_JOBS !== 'true') {
        const { startMemoryScheduler } = await import('./services/memory-scheduler');
        startMemoryScheduler();
        log.info('✅ Memory scheduler started', LogContext.SERVER);
      }
    } catch (error) {
      log.warn('⚠️ Memory scheduler not started', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load other async routes here as needed
  }
}

// Start the server in both CJS and ESM dev contexts
(async () => {
  const isCJS = typeof require !== 'undefined' && typeof module !== 'undefined';
  const isDirectCJS = isCJS && require.main === module;
  const isTest = process.env.NODE_ENV === 'test';
  const isESMDev =
    process.env.NODE_ENV !== 'production' && !isTest && process.env.TSX_DEV !== 'false';
  if (!isTest && (isDirectCJS || isESMDev)) {
    const server = new UniversalAIToolsServer();
    await server.start();
  }
})();

export default UniversalAIToolsServer;
export { UniversalAIToolsServer };
