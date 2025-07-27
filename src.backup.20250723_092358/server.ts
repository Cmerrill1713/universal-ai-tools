// Server initialization - logger will be available after imports

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { ToolRouter } from './routers/tools';
import { MemoryRouter } from './routers/memory';
import { ContextRouter } from './routers/context';
import { KnowledgeRouter } from './routers/knowledge';
import { OrchestrationRouter } from './routers/orchestration';
import widgetCreationRouter from './routers/widget-creation';
import { WidgetsRouter } from './routers/widgets';
import { DSPyWidgetsRouter } from './routers/dspy-widgets';
import naturalLanguageWidgetsRouter from './routers/natural-language-widgets';
import { SpeechRouter } from './routers/speech';
import { DocumentationRouter } from './routers/documentation';
import { BackupRouter } from './routers/backup';
import { HealthRouter } from './routers/health';
import createKnowledgeMonitoringRouter from './routers/knowledge-monitoring-lazy';
import AthenaToolsRouter from './routers/athena-tools';
import { AuthRouter } from './routers/auth';
import { SweetAthenaRouter } from './routers/sweet-athena';
import { SweetAthenaWebSocketService } from './services/sweet-athena-websocket';
import { DSPyToolsRouter } from './routers/dspy-tools';
import { MCPRouter } from './routers/mcp';
import { FileSystemRouter } from './routers/filesystem';
import PydanticAIRouter from './routers/pydantic-ai';
import { createMCPServerService } from './services/mcp-server-service';
import { LogContext, logger } from './utils/enhanced-logger';
import LoggingMiddleware from './middleware/logging-middleware';
import PrometheusMiddleware from './middleware/prometheus-middleware';
import DebugMiddleware from './middleware/debug-middleware';
import { apiVersioning } from './middleware/api-versioning';
import { JWTAuthService } from './middleware/auth-jwt';
import { getOllamaAssistant } from './services/ollama-assistant';
import { dspyService } from './services/dspy-service';
import { appConfig, config, configHealthCheck, initializeConfig } from './config/index';
import PerformanceMiddleware from './middleware/performance';
import { ProductionPerformanceMiddleware } from './middleware/performance-production';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

// Import constants
const GOOD_CONFIDENCE = 0.7;
// GraphQL will be loaded lazily to avoid startup blocking

// Initial imports completed

logger.info('📍 All imports completed successfully');

// Initialize configuration
initializeConfig();

logger.info('✅ [STARTUP] Completed: Configuration initialization', LogContext.SYSTEM);

logger.info('📍 Configuration initialized');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

logger.info('📍 Creating Express app');
const app = express();
const { port } = config.server;

logger.info('✅ [STARTUP] Completed: Express app setup', LogContext.SYSTEM);

logger.info('📍 Creating Supabase client');
// Supabase client
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey || ''
);

logger.info('✅ [STARTUP] Completed: Supabase client creation', LogContext.SYSTEM);

// Initialize JWT authentication service
const jwtAuthService = new JWTAuthService(supabase);
const authRouter = new AuthRouter();

logger.info('✅ [STARTUP] Completed: JWT authentication service initialization', LogContext.SYSTEM);

logger.info('📍 Supabase client and JWT auth service created successfully');
logger.debug('Supabase client created, moving to performance middleware...', LogContext.SYSTEM);

logger.info('📍 Initializing Redis service for performance middleware');

// Initialize Redis service early for performance middleware
let performanceMiddleware: any;
let redisService: any = null;

try {
  logger.info('🔄 [STARTUP] Attempting to initialize Redis service early...', LogContext.SYSTEM);
  const { getRedisService } = await import('./services/redis-service');
  redisService = getRedisService();
  await redisService.connect();

  const health = await redisService.healthCheck();
  if (health.healthy) {
    logger.info('✅ Redis service connected successfully (early init)', LogContext.CACHE, {
      latency: health.latency,
    });

    // Initialize Redis-based performance middleware
    logger.info('📍 Initializing Redis-based performance middleware');
    performanceMiddleware = new PerformanceMiddleware(supabase, {
      enableRequestTiming: true,
      enableMemoryMonitoring: true,
      enableCacheMetrics: true,
      enableDatabaseOptimization: true,
      slowRequestThreshold: 2000, // 2 seconds
      memoryThreshold: 1024, // 1GB
      requestTimeoutMs: 5000, // 5 seconds max as requested
    });

    logger.info('✅ Redis-based performance middleware initialized successfully');
  } else {
    throw new Error(`Redis health check failed: ${health.error}`);
  }
} catch (error) {
  logger.warn(
    '⚠️ Redis initialization failed, falling back to in-memory performance middleware',
    LogContext.CACHE,
    {
      error: error instanceof Error ? error.message : String(error),
    }
  );

  // Use production-ready performance middleware without Redis dependency
  logger.info('📍 Initializing production performance middleware');
  performanceMiddleware = new ProductionPerformanceMiddleware({
    slowRequestThreshold: 2000,
    requestTimeoutMs: 5000, // 5 second max timeout as requested
    enableRequestTiming: true,
    enableMemoryMonitoring: true,
    enableCaching: true,
    enableCompression: true,
    cacheSize: 1000,
    cacheTTL: 300000, // 5 minutes
  });
}

// Security and validation middleware
import { applySecurityMiddleware } from './middleware/security';
import { getRateLimitForEndpoint, securityConfig } from './config/security';
import { createHealthCheckService } from './services/health-check';
import { DatabaseMigrationService } from './services/database-migration';
import { createClient as createRedisClient } from 'redis';
import { securityHardeningService } from './services/security-hardening';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";
logger.info('✅ [STARTUP] Completed: Security middleware imports', LogContext.SYSTEM);

// Services will be lazily loaded after server starts
let securityMiddleware: ReturnType<typeof applySecurityMiddleware> | null = null;

logger.info('📍 Applying advanced security middleware');
logger.debug('About to apply security middleware...', LogContext.SECURITY);
// Apply comprehensive security middleware with timeout protection
try {
  securityMiddleware = applySecurityMiddleware(app);
  logger.info('✅ [STARTUP] Completed: Security middleware application', LogContext.SECURITY);
  logger.info('📍 Advanced security middleware enabled successfully');
} catch (error) {
  logger.error('❌ [STARTUP] Failed: Security middleware application', LogContext.SECURITY, {
    error: error instanceof Error ? error.message : String(error)
  });
  logger.warn(
    '📍 Failed to apply advanced security middleware, falling back to basic',
    LogContext.SECURITY,
    { error: error instanceof Error ? error.message : String(error) }
  );
  // Fallback to basic security
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
}

logger.info('🔄 [STARTUP] Starting: Middleware setup', LogContext.SYSTEM);

logger.info('📍 Setting up API versioning middleware');
// API versioning middleware (must be early in the stack)
app.use(apiVersioning.versionDetection());
app.use(apiVersioning.contentNegotiation());
app.use(apiVersioning.urlRewriter());
app.use(apiVersioning.compatibilityHandler());
logger.info('📍 API versioning middleware setup complete');

logger.info('📍 Setting up logging middleware');
// Enhanced logging middleware (must be early in the stack)
app.use(LoggingMiddleware.requestLogger());
app.use(LoggingMiddleware.securityLogger());
app.use(LoggingMiddleware.databaseLogger());
app.use(LoggingMiddleware.memoryLogger());
app.use(LoggingMiddleware.athenaConversationLogger());
logger.info('📍 Logging middleware setup complete');

logger.info('📍 Setting up Prometheus metrics middleware');
// Prometheus metrics middleware (re-enabled with lazy initialization)
app.use(PrometheusMiddleware.metricsCollector());
app.use(PrometheusMiddleware.athenaMetricsCollector());
app.use(PrometheusMiddleware.databaseMetricsCollector());
app.use(PrometheusMiddleware.memoryMetricsCollector());
app.use(PrometheusMiddleware.securityMetricsCollector());
app.use(PrometheusMiddleware.testMetricsCollector());
logger.info('📍 Prometheus metrics middleware setup complete (lazy initialization enabled)');

// Debug middleware (development only)
app.use(DebugMiddleware.debugSession());
app.use(DebugMiddleware.verboseLogging());
app.use(DebugMiddleware.athenaDebugger());
app.use(DebugMiddleware.performanceDebugger());
app.use(DebugMiddleware.testResultAggregator());

logger.info('📍 Setting up performance middleware');
// Apply performance middleware immediately
app.use(performanceMiddleware.requestTimer());
app.use(performanceMiddleware.rateLimiter(900000, 1000)); // 15 minutes, 1000 requests
if (performanceMiddleware.cacheMiddleware) {
  app.use(performanceMiddleware.cacheMiddleware());
}
if (performanceMiddleware.compressionMiddleware) {
  app.use(performanceMiddleware.compressionMiddleware());
}
logger.info('✅ Performance middleware applied');

// Performance monitoring middleware - will be enabled after Redis initialization
// This section runs early, so middleware will be null initially
// The middleware will be applied dynamically in initializeServices()
logger.info('📍 Performance middleware will be enabled after Redis initialization');

// Static files will be served after API routes to prevent conflicts

// Extend Express Request interface to include custom properties
interface AuthenticatedRequest extends Request {
  aiService?: {
    id: string;
    name: string;
    capabilities: string[];
  };
  aiServiceId?: string;
}

// Enhanced authentication middleware supporting both JWT and API keys
const authenticateAI = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Check for JWT authentication first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwtAuthService.verifyAccessToken(token);

      if (payload) {
        // Verify user still exists and is active
        const { data: user, error } = await supabase
          .from('users')
          .select('id, email, role, is_active')
          .eq('id', payload.sub)
          .single();

        if (!error && user && user.is_active) {
          req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
          };
          return next();
        }
      }
    }

    // Fallback to API key authentication
    const apiKey = req.headers['x-api-key'] as string;
    const aiService = req.headers['x-ai-service'] as string;

    if (!apiKey) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'JWT token or API key required',
        supported: ['Bearer token', 'X-API-Key header'],
      });
    }

    if (!aiService && apiKey) {
      return res.status(401).json({
        error: 'Missing AI service header',
        required: ['X-AI-Service'],
        note: 'Required when using API key authentication',
      });
    }

    // Database authentication with timeout and retry
    let attempts = 0;
    const maxAttempts = 3;
    let keyData = null;

    while (attempts < maxAttempts && !keyData) {
      attempts++;

      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database timeout')), 3000);
        });

        const authPromise = supabase
          .from('ai_service_keys')
          .select('*, ai_services(*)')
          .eq('encrypted_key', apiKey)
          .single();

        const result = (await Promise.race([authPromise, timeoutPromise])) as any;

        if (result.error) {
          if (result.error.code === 'PGRST116') {
            // Row not found
            logger.warn('Invalid API key attempt', LogContext.SECURITY, {
              apiKeyPrefix: apiKey ? `${apiKey.substring(0, 8)  }...` : 'none',
              aiService,
              attempt: attempts,
            });
            return res.status(401).json({ error: 'Invalid API key' });
          }

          // Other database errors - retry
          if (attempts < maxAttempts) {
            logger.warn(
              `Database query failed, attempt ${attempts}/${maxAttempts}`,
              LogContext.SECURITY
            );
            await new Promise((resolve) => setTimeout(resolve, 100 * attempts)); // Exponential backoff
            continue;
          }

          throw result.error;
        }

        keyData = result.data;
      } catch (error) {
        if (attempts === maxAttempts) {
          logger.error('Authentication database query failed after retries', LogContext.SECURITY, {
            error
          });
          return res.status(503).json({
            error: 'Authentication service temporarily unavailable',
            retryAfter: 5,
          });
        }
      }
    }

    if (!keyData || !keyData.ai_services) {
      logger.error('API key found but no associated service', LogContext.SECURITY);
      return res.status(401).json({ error: 'Invalid API key configuration' });
    }

    // Verify service matches
    if (keyData.ai_services.service_name !== aiService) {
      logger.warn('Service name mismatch', LogContext.SECURITY, {
        expected: keyData.ai_services.service_name,
        provided: aiService,
      });
      return res.status(401).json({ error: 'Service mismatch' });
    }

    // Check if service is active
    if (!keyData.ai_services.is_active) {
      logger.warn('Inactive service attempted access', LogContext.SECURITY, {
        serviceId: keyData.service_id,
        serviceName: aiService,
      });
      return res.status(403).json({ error: 'Service is inactive' });
    }

    // Attach service info to request
    req.aiService = keyData.ai_services;
    req.aiServiceId = keyData.service_id;

    // Log tool execution (non-blocking)
    const logExecution = async () => {
      try {
        await supabase.from('ai_tool_executions').insert({
          service_id: keyData.service_id,
          tool_name: req.path,
          input_params: req.body,
          status: 'pending',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Failed to log tool execution', LogContext.SECURITY, { error });
      }
    };

    // Fire and forget
    logExecution();

    next();
  } catch (error) {
    logger.error('Authentication error', LogContext.SECURITY, {
      error: error instanceof Error ? error.message : error,
    });

    // No development fallback - authentication must succeed
    res.status(500).json({
      error: 'Authentication failed',
      requestId: req.headers['x-requestid'] || 'unknown',
    });
  }
};

// Remove old authentication middleware - replaced with secure version above
/*
const authenticateAI_full = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const aiService = req.headers['x-ai-service'] as string;
    
    // REMOVED: Development authentication bypass for production security
    // All requests must use proper authentication regardless of environment
    
    if (!apiKey || !aiService) {
      return res.status(401).json({ error: 'Missing authentication headers' });
    }

    // Verify API key in Supabase
    const { data: keyData, error } = await supabase
      .from('ai_service_keys')
      .select('*, ai_services(*)')
      .eq('encrypted_key', apiKey) // In production, this should be properly encrypted
      .single();

    if (error|| !keyData) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Attach service info to request
    req.aiService = keyData.ai_services;
    req.aiServiceId = keyData.service_id;
    
    // Log tool execution
    await supabase.from('ai_tool_executions').insert({
      service_id: keyData.service_id,
      tool_name: req.path,
      input_params: req.body,
      status: 'pending'
    });

    next();
  } catch (error) {
    logger.error('Authentication error', LogContext.SECURITY, { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    res.status(500).json({ error: 'Authentication failed' });
  }
};
*/

logger.info('📍 Initializing services for health checks');
// Initialize services for health checks
let healthCheckService: any;
let redisClient: any;
let migrationService: any;

logger.info('📍 Checking Redis configuration');
// Initialize Redis client if configured
if (config.cache?.redisUrl) {
  logger.info('📍 Creating Redis client');
  redisClient = createRedisClient({ url: config.cache.redisUrl });
  redisClient.on('error', (err: any) =>
    logger.error('Redis Client Error', LogContext.SYSTEM, { error: err?.message || err })
  );
  redisClient
    .connect()
    .catch((err: any) =>
      logger.error('Redis connection failed:', LogContext.SYSTEM, { error: err?.message || err })
    );
  logger.info('📍 Redis client created');
}
logger.info('📍 Redis initialization complete');

logger.info('📍 Creating migration service');
// Initialize migration service
migrationService = new DatabaseMigrationService(supabase);
logger.info('📍 Migration service created');

logger.info('📍 Creating health check service');
// Initialize Redis client for health checks (lazy - will be set later by initializeServices)
try {
  // This will be set properly during initializeServices()
  redisClient = null; // Will be updated when Redis connects
} catch (error) {
  logger.warn('Redis client not available for health checks', LogContext.CACHE);
}

// Initialize health check service
healthCheckService = createHealthCheckService(supabase, redisClient, migrationService);
logger.info('📍 Health check service created');

logger.info('📍 Setting up health check endpoints');
// Health check endpoints (unversioned)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Universal AI Tools Service',
    timestamp: new Date().toISOString(),
  });
});
logger.info('📍 Health check endpoints set up');

// Comprehensive health check endpoint
app.get('/api/health/detailed', async (req, res) => {
  try {
    const health = await healthCheckService.checkHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed:', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Readiness probe
app.get('/api/health/ready', async (req, res) => {
  try {
    const ready = await healthCheckService.runReadinessCheck();
    res.status(ready ? 200 : 503).json({ ready });
  } catch {
    res.status(503).json({ ready: false });
  }
});

// Liveness probe
app.get('/api/health/live', async (req, res) => {
  try {
    const live = await healthCheckService.runLivenessCheck();
    res.status(live ? 200 : 503).json({ live });
  } catch {
    res.status(503).json({ live: false });
  }
});

logger.info('📍 Setting up API versioning endpoints');
// API versioning endpoints
app.use('/api', apiVersioning.versionRouter());
logger.info('📍 API versioning endpoints set up');

logger.info('📍 Setting up authentication routes');
// Authentication routes (public)
app.use('/api/auth', authRouter.getRouter());
app.use('/api/v1/auth', authRouter.getRouter());

logger.info('📍 Setting up API documentation endpoint');
// API Documentation (unversioned)
app.get('/api/docs', (req, res) => {
  res.json({
    version: '1.0.0',
    apiVersions: {
      current: 'v1',
      supported: ['v1'],
      documentation: 'https://docs.universal-ai-tools.com/api/versions',
    },
    endpoints: {
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        refresh: 'POST /api/v1/auth/refresh',
        logout: 'POST /api/v1/auth/logout',
        logoutAll: 'POST /api/v1/auth/logout-all',
        profile: 'GET /api/v1/auth/profile',
        sessions: 'GET /api/v1/auth/sessions',
        revokeSession: 'DELETE /api/v1/auth/sessions/:tokenId',
        securityInfo: 'GET /api/v1/auth/security-info',
        changePassword: 'POST /api/v1/auth/change-password',
        description:
          'JWT-based authentication with refresh tokens, session management, and security features',
      },
      tools: {
        execute: 'POST /api/v1/tools/execute',
        list: 'GET /api/v1/tools',
        create: 'POST /api/v1/tools',
        legacyFormat: 'Available at /api/tools/* (redirects to v1)',
      },
      memory: {
        store: 'POST /api/v1/memory',
        retrieve: 'GET /api/v1/memory',
        search: 'POST /api/v1/memory/search',
      },
      context: {
        save: 'POST /api/v1/context',
        get: 'GET /api/v1/context/:type/:key',
        update: 'PUT /api/v1/context/:type/:key',
      },
      knowledge: {
        add: 'POST /api/v1/knowledge',
        search: 'POST /api/v1/knowledge/search',
        verify: 'PUT /api/v1/knowledge/:id/verify',
      },
      orchestration: {
        orchestrate: 'POST /api/v1/orchestration/orchestrate',
        coordinate: 'POST /api/v1/orchestration/coordinate',
        knowledgeSearch: 'POST /api/v1/orchestration/knowledge/search',
        knowledgeExtract: 'POST /api/v1/orchestration/knowledge/extract',
        knowledgeEvolve: 'POST /api/v1/orchestration/knowledge/evolve',
        optimizePrompts: 'POST /api/v1/orchestration/optimize/prompts',
        status: 'GET /api/v1/orchestration/status',
      },
      dspyWidgets: {
        generate: 'POST /api/v1/dspy-widgets/generate',
        improve: 'POST /api/v1/dspy-widgets/improve',
        progress: 'GET /api/v1/dspy-widgets/progress/:widgetId',
        list: 'GET /api/v1/dspy-widgets',
        get: 'GET /api/v1/dspy-widgets/:widgetId',
        delete: 'DELETE /api/v1/dspy-widgets/:widgetId',
        activeGenerations: 'GET /api/v1/dspy-widgets/status/active',
        health: 'GET /api/v1/dspy-widgets/status/health',
        description: 'DSPy-powered intelligent widget generation for complex UI components',
      },
      ports: {
        status: 'GET /api/ports/status',
        report: 'GET /api/ports/report',
        healthCheck: 'POST /api/ports/health-check',
        resolveConflict: 'POST /api/ports/resolve-conflict',
      },
      performance: {
        metrics: 'GET /api/performance/metrics',
        report: 'GET /api/performance/report',
      },
      assistant: {
        chat: 'POST /api/assistant/chat',
        suggestTools: 'POST /api/assistant/suggest-tools',
        generateIntegration: 'POST /api/assistant/generate-integration',
        routeRequest: 'POST /api/assistant/route-request',
      },
      speech: {
        transcribe: 'POST /api/v1/speech/transcribe',
        synthesize: 'POST /api/v1/speech/synthesize',
        synthesizeKokoro: 'POST /api/v1/speech/synthesize/kokoro',
        voices: 'GET /api/v1/speech/voices',
        configureVoice: 'POST /api/v1/speech/configure-voice',
        history: 'GET /api/v1/speech/history/:conversation_id',
      },
      documentation: {
        searchSnippets: 'POST /api/v1/docs/search/snippets',
        supabaseFeatures: 'GET /api/v1/docs/supabase/features',
        integrationPatterns: 'GET /api/v1/docs/integration-patterns',
        categories: 'GET /api/v1/docs/categories',
        popularSnippets: 'GET /api/v1/docs/snippets/popular',
        quickstart: 'GET /api/v1/docs/quickstart/:feature',
      },
      backup: {
        create: 'POST /api/v1/backup/create',
        list: 'GET /api/v1/backup/list',
        details: 'GET /api/v1/backup/:backupId',
        restore: 'POST /api/v1/backup/restore',
        verify: 'POST /api/v1/backup/:backupId/verify',
        delete: 'DELETE /api/v1/backup/:backupId',
        status: 'GET /api/v1/backup/status/summary',
        cleanup: 'POST /api/v1/backup/cleanup',
        schedules: 'GET /api/v1/backup/schedules',
        estimate: 'POST /api/v1/backup/estimate',
      },
      graphql: {
        endpoint: 'POST /graphql',
        playground: 'GET /graphql (development only)',
        subscriptions: 'WebSocket /graphql/subscriptions',
        health: 'GET /graphql/health',
        introspection: 'Available in development mode',
        features: [
          'Temporal knowledge graph queries',
          'Agent coordination and management',
          'Memory search and retrieval',
          'Real-time subscriptions',
          'Performance optimization with DataLoader',
          'Type-safe GraphQL schema',
        ],
      },
      mcp: {
        agents: 'GET /api/v1/mcp/agents',
        agentDetails: 'GET /api/v1/mcp/agents/:agentId',
        storeKeys: 'POST /api/v1/mcp/agents/:agentId/keys',
        execute: 'POST /api/v1/mcp/agents/:agentId/execute',
        test: 'POST /api/v1/mcp/agents/:agentId/test',
        status: 'GET /api/v1/mcp/status',
        update: 'PUT /api/v1/mcp/agents/:agentId',
        delete: 'DELETE /api/v1/mcp/agents/:agentId',
        websocket: 'WebSocket /api/mcp/ws',
        description: 'Model Context Protocol for agent integration',
        features: [
          'Dynamic agent registration',
          'Secure key vault storage',
          'Real-time agent status monitoring',
          'WebSocket-based communication',
          'Encrypted credential management',
        ],
      },
      filesystem: {
        browse: 'POST /api/v1/filesystem/browse',
        read: 'POST /api/v1/filesystem/read',
        write: 'POST /api/v1/filesystem/write',
        execute: 'POST /api/v1/filesystem/execute',
        move: 'POST /api/v1/filesystem/move',
        copy: 'POST /api/v1/filesystem/copy',
        delete: 'POST /api/v1/filesystem/delete',
        search: 'POST /api/v1/filesystem/search',
        download: 'GET /api/v1/filesystem/download',
        info: 'GET /api/v1/filesystem/info',
        description: 'Secure file system operations',
        features: [
          'Path sanitization and validation',
          'Comprehensive security checks',
          'Rate limiting on all operations',
          'Audit logging',
          'File search with contentmatching',
          'Real-time file watching via WebSocket',
        ],
      },
      pydanticAI: {
        request: 'POST /api/v1/pydantic-ai/request',
        analyze: 'POST /api/v1/pydantic-ai/analyze',
        plan: 'POST /api/v1/pydantic-ai/plan',
        generateCode: 'POST /api/v1/pydantic-ai/generate-code',
        validate: 'POST /api/v1/pydantic-ai/validate',
        registerSchema: 'POST /api/v1/pydantic-ai/register-schema',
        structured: 'POST /api/v1/pydantic-ai/structured',
        stats: 'GET /api/v1/pydantic-ai/stats',
        clearCache: 'POST /api/v1/pydantic-ai/clear-cache',
        description: 'Type-safe AI interactions with structured validation',
        features: [
          'Pydantic-style model validation',
          'Structured response schemas',
          'Cognitive _analysiswith typed outputs',
          'Task planning with validation',
          'Code generation with type safety',
          'Custom schema registration',
          'Response caching for performance',
          'Integration with DSPy orchestration',
        ],
      },
    },
    authentication: {
      method: 'API Key',
      headers: {
        'X-API-Key': 'Your API key',
        'X-AI-Service': 'Your service identifier',
      },
    },
    webSocket: {
      portStatus: `ws://localhost:${port}/ws/port-status`,
      description: 'Real-time port status and health monitoring updates',
    },
  });
});
logger.info('📍 API documentation endpoint set up');

// CSRF token generation endpoint
app.get('/api/csrf-token', (req: Request, res) => {
  if (!securityMiddleware) {
    return res.status(503).json({ error: 'Security middleware not initialized' });
  }
  const sessionId = req.headers['x-session-id'] || req.ip;
  const token = securityMiddleware.generateCSRFToken(sessionId);
  res.json({ token });
});

logger.info('📍 Setting up security endpoints');

// Security endpoints
app.get('/api/security/status', authenticateAI, async (req, res) => {
  try {
    logger.info('Running security audit...', LogContext.SECURITY);
    const audit = await securityHardeningService.runSecurityAudit();

    res.json({
      score: audit.overallScore,
      vulnerabilities: audit.vulnerabilities.length,
      criticalIssues: audit.vulnerabilities.filter((v: any) => v.severity === 'critical').length,
      highIssues: audit.vulnerabilities.filter((v: any) => v.severity === 'high').length,
      moderateIssues: audit.vulnerabilities.filter((v: any) => v.severity === 'moderate').length,
      lowIssues: audit.vulnerabilities.filter((v: any) => v.severity === 'low').length,
      expiredKeys: audit.apiKeyStatus.filter((k: any) => k.needsRotation).length,
      missingHeaders: audit.securityHeaders.filter((h: any) => !h.present).length,
      recommendations: audit.recommendations,
      timestamp: audit.timestamp,
    });

    logger.info(`Security audit completed. Score: ${audit.overallScore}`, LogContext.SECURITY);
  } catch (error) {
    logger.error('Security status check failed:', LogContext.SECURITY, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ error: 'Failed to get security status' });
  }
});

app.post('/api/security/rotate-key', authenticateAI, async (req: Request, res) => {
  try {
    const { keyType } = req.body;
    if (!keyType) {
      return res.status(400).json({ error: 'keyType is required' });
    }

    // Validate keyType against allowed values
    const allowedKeyTypes = ['jwt_secret', 'encryption_key', 'api_keys', 'service_keys'];
    if (!allowedKeyTypes.includes(keyType)) {
      return res.status(400).json({
        error: 'Invalid keyType',
        allowedTypes: allowedKeyTypes,
      });
    }

    // Check authorization - in production, this should verify admin privileges
    const userRole = (req as any).user?.role;
    if (userRole !== 'admin' && userRole !== 'service_role') {
      logger.warn('Unauthorized key rotation attempt', LogContext.SECURITY, {
        keyType,
        userRole,
        userId: (req as any).user?.id,
      });
      return res.status(403).json({ error: 'Insufficient privileges for key rotation' });
    }

    logger.info('Rotating API key...', LogContext.SECURITY, { keyType });
    const newKey = await securityHardeningService.rotateApiKey(keyType);

    res.json({
      success: true,
      keyType,
      message: 'Key rotated successfully. Update your configuration.',
      keyPreview: `${newKey.substring(0, 8)}...`,
      keyLength: newKey.length,
    });

    logger.info('API key rotated successfully', LogContext.SECURITY, { keyType });
  } catch (error) {
    logger.error('Key rotation failed:', LogContext.SECURITY, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ error: 'Failed to rotate key' });
  }
});

// Additional security endpoints
app.get('/api/security/vulnerabilities', authenticateAI, async (req, res) => {
  try {
    logger.info('Scanning for vulnerabilities...', LogContext.SECURITY);
    const vulnerabilities = await securityHardeningService.scanDependencies();

    res.json({
      total: vulnerabilities.length,
      critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
      high: vulnerabilities.filter((v) => v.severity === 'high').length,
      moderate: vulnerabilities.filter((v) => v.severity === 'moderate').length,
      low: vulnerabilities.filter((v) => v.severity === 'low').length,
      vulnerabilities,
    });
  } catch (error) {
    logger.error('Vulnerability scan failed:', LogContext.SECURITY, {
      error: error instanceof Error ? error.message : error,
    });
    res.status(500).json({ error: 'Failed to scan vulnerabilities' });
  }
});

app.post('/api/security/fix-vulnerabilities', authenticateAI, async (req, res) => {
  try {
    const { dryRun = true } = req.body;

    // Check authorization
    const userRole = (req as any).user?.role;
    if (userRole !== 'admin' && userRole !== 'service_role') {
      return res.status(403).json({ error: 'Insufficient privileges for vulnerability fixes' });
    }

    logger.info('Attempting to fix vulnerabilities...', LogContext.SECURITY, { dryRun });
    const result = await securityHardeningService.fixVulnerabilities(dryRun);

    res.json({
      success: true,
      dryRun,
      fixed: result.fixed,
      failed: result.failed,
      message: dryRun
        ? 'Dry run completed. Review the changes before running without dryRun.'
        : 'Vulnerability fixes applied.',
    });
  } catch (error) {
    logger.error('Failed to fix vulnerabilities:', LogContext.SECURITY, {
      error: error instanceof Error ? error.message : error,
    });
    res.status(500).json({ error: 'Failed to fix vulnerabilities' });
  }
});

app.get('/api/security/common-issues', authenticateAI, async (req, res) => {
  try {
    logger.info('Checking for common security issues...', LogContext.SECURITY);
    const result = await securityHardeningService.checkCommonVulnerabilities();

    res.json({
      passed: result.passed,
      issuesFound: result.issues.length,
      issues: result.issues,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Common issues check failed:', LogContext.SECURITY, {
      error: error instanceof Error ? error.message : error,
    });
    res.status(500).json({ error: 'Failed to check common issues' });
  }
});

logger.info('📍 Setting up stats endpoint');
// Stats endpoint for dashboard
app.get('/api/stats', authenticateAI, async (req, res) => {
  try {
    // Get memory count
    const { count: memoryCount } = await supabase
      .from('ai_memories')
      .select('*', { count: 'exact', head: true });

    // Get agent count
    const { count: agentCount } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true });

    const stats = {
      activeAgents: agentCount || 0,
      messagestoday: Math.floor(Math.random() * 1000), // Placeholder
      totalMemories: memoryCount || 0,
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      typeBreakdown: {
        general: Math.floor((memoryCount || 0) * 0.4),
        code: Math.floor((memoryCount || 0) * 0.3),
        documentation: Math.floor((memoryCount || 0) * 0.2),
        personal: Math.floor((memoryCount || 0) * 0.1),
      },
    };

    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error fetching stats:', LogContext.API, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

logger.info('📍 Stats endpoint setup complete');

logger.info('📍 Setting up prometheus and health endpoints');
// Prometheus metrics endpoint
app.get('/metrics', PrometheusMiddleware.metricsEndpoint());

// Health check endpoint with Prometheus integration
app.get('/api/health', PrometheusMiddleware.healthCheckEndpoint());

// Original health check endpoint for compatibility
app.get('/health', (req, res) => {
  const healthCheck = configHealthCheck();
  res.json({
    status: healthCheck.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'universal-ai-tools',
    config: healthCheck.checks,
  });
});

// Configuration endpoint
app.get('/api/config', authenticateAI, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    config: appConfig,
    timestamp: new Date().toISOString(),
  });
});

// Configuration health check endpoint
app.get('/api/config/health', authenticateAI, async (req: AuthenticatedRequest, res: Response) => {
  const healthCheck = configHealthCheck();
  res.json({
    success: true,
    healthy: healthCheck.healthy,
    checks: healthCheck.checks,
    timestamp: new Date().toISOString(),
  });
});

// Performance metrics endpoint
app.get(
  '/api/performance/metrics',
  authenticateAI,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!performanceMiddleware) {
        return res.status(503).json({
          success: false,
          error: 'Performance monitoring not available',
        });
      }

      // Get metrics (works for both fallback and Redis modes)
      const metrics = await performanceMiddleware.getMetrics();

      res.json({
        success: true,
        mode:
          performanceMiddleware.constructor.name === 'FallbackPerformanceMiddleware'
            ? 'fallback'
            : performanceMiddleware.constructor.name === 'ProductionPerformanceMiddleware'
              ? 'production'
              : 'redis',
        metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching performance metrics:', LogContext.PERFORMANCE, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance metrics',
      });
    }
  }
);

// Performance report endpoint
app.get(
  '/api/performance/report',
  authenticateAI,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!performanceMiddleware) {
        return res.status(503).json({
          success: false,
          error: 'Performance monitoring not available',
        });
      }
      // Check if generatePerformanceReport exists (fallback might have simpler API)
      if (typeof performanceMiddleware.generatePerformanceReport === 'function') {
        const report = await performanceMiddleware.generatePerformanceReport();
        const format = (req.query.format as string) || 'text';

        if (format === 'json') {
          const metrics = await performanceMiddleware.getMetrics();
          res.json({
            success: true,
            mode:
              performanceMiddleware.constructor.name === 'FallbackPerformanceMiddleware'
                ? 'fallback'
                : performanceMiddleware.constructor.name === 'ProductionPerformanceMiddleware'
                  ? 'production'
                  : 'redis',
            report: {
              text: report,
              metrics,
            },
            timestamp: new Date().toISOString(),
          });
        } else {
          res.set('Content-Type', 'text/plain');
          res.send(report);
        }
      } else {
        // Fallback for simpler middleware without report generation
        const metrics = await performanceMiddleware.getMetrics();
        res.json({
          success: true,
          mode:
            performanceMiddleware.constructor.name === 'FallbackPerformanceMiddleware'
              ? 'fallback'
              : performanceMiddleware.constructor.name === 'ProductionPerformanceMiddleware'
                ? 'production'
                : 'redis',
          message: 'Detailed report not available in current mode',
          metrics,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error generating performance report:', LogContext.PERFORMANCE, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to generate performance report',
      });
    }
  }
);

// Port Management endpoints (disabled until port integration service is fixed)
app.get('/api/ports/status', async (req, res) => {
  try {
    const portService = (req.app as any).portIntegrationService;
    if (!portService) {
      return res.json({
        success: true,
        status: { message: 'Port integration service is not initialized' },
        timestamp: new Date().toISOString(),
      });
    }
    const status = portService.getPortSystemStatus();
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching port status:', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch port status',
    });
  }
});

app.get('/api/ports/report', async (req, res) => {
  try {
    const portService = (req.app as any).portIntegrationService;
    if (!portService) {
      return res.json({
        success: true,
        report: { message: 'Port integration service is not initialized' },
        timestamp: new Date().toISOString(),
      });
    }
    const report = await portService.generatePortManagementReport();
    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error generating port report:', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate port report',
    });
  }
});

app.post('/api/ports/health-check', async (req, res) => {
  try {
    const { service } = req.body;
    const portService = (req.app as any).portIntegrationService;
    if (!portService) {
      return res.json({
        success: false,
        error: 'Port integration service is not initialized',
      });
    }
    await portService.triggerHealthCheck(service);
    res.json({
      success: true,
      message: service ? `Health check triggered for ${service}` : 'Full health check triggered',
    });
  } catch (error) {
    logger.error('Error triggering health check:', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to trigger health check',
    });
  }
});

app.post('/api/ports/resolve-conflict', async (req, res) => {
  try {
    const { service, requestedPort } = req.body;
    if (!service || !requestedPort) {
      return res.status(400).json({
        success: false,
        error: 'Service name and requested port are required',
      });
    }

    const portService = (req.app as any).portIntegrationService;
    if (!portService) {
      return res.json({
        success: false,
        error: 'Port integration service is not initialized',
      });
    }
    const resolvedPort = await portService.resolveSpecificPortConflict(service, requestedPort);
    res.json({
      success: true,
      resolvedPort,
      message: `Port conflict resolved for ${service}: ${requestedPort} → ${resolvedPort}`,
    });
  } catch (error) {
    logger.error('Error resolving port conflict:', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to resolve port conflict',
    });
  }
});

// Ollama status endpoint
app.get('/api/ollama/status', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    if (response.ok) {
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      res.json({
        status: 'available',
        models: data.models?.map((m) => m.name) || [],
      });
    } else {
      res.json({ status: 'unavailable', error: 'Ollama not responding' });
    }
  } catch (error) {
    res.json({ status: 'unavailable', error: 'Cannot connect to Ollama' });
  }
});

// Ollama models endpoint (alias for compatibility)
app.get('/api/ollama/models', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    if (response.ok) {
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      res.json({
        status: 'available',
        models: data.models?.map((m) => m.name) || [],
      });
    } else {
      res.json({ status: 'unavailable', error: 'Ollama not responding' });
    }
  } catch (error) {
    res.json({ status: 'unavailable', error: 'Cannot connect to Ollama' });
  }
});

// Register AI Service endpoint (public)
app.post('/api/register', async (req, res) => {
  try {
    const schema = z.object({
      service_name: z.string(),
      service_type: z.enum(['claude', 'openai', 'gemini', 'cohere', 'custom']),
      capabilities: z.array(z.string()).optional(),
    });

    const data = schema.parse(req.body);

    // Create service
    const { data: service, error: serviceError } = await supabase
      .from('ai_services')
      .insert(data)
      .select()
      .single();

    if (serviceError) throw serviceError;

    // Generate API key
    const apiKey = jwt.sign(
      { service_id: service.id, service_name: service.service_name },
      config.security.jwtSecret
    );

    // Store encrypted key
    const { error: keyError } = await supabase.from('ai_service_keys').insert({
      service_id: service.id,
      key_name: 'default',
      encrypted_key: apiKey, // In production, encrypt this
      permissions: ['read', 'write', 'execute'],
    });

    if (keyError) throw keyError;

    res.json({
      service_id: service.id,
      service_name: service.service_name,
      api_key: apiKey,
      endpoints: {
        base_url: `http://localhost:${port}/api`,
        docs: `http://localhost:${port}/api/docs`,
      },
    });
  } catch (error) {
    logger.error('Registration error', LogContext.API, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(400).json({ error: 'Registration failed' });
  }
});

// Initialize Ollama Assistant
logger.info('📍 Creating Ollama Assistant');
const ollamaAssistant = getOllamaAssistant(supabase);
logger.info('📍 Ollama Assistant created successfully');

logger.info('📍 Setting up Ollama-powered endpoints');

// Ollama-powered endpoints (authentication required for security)
logger.info('📍 Registering /api/assistant/suggest-tools endpoint');
app.post(
  '/api/assistant/suggest-tools',
  authenticateAI,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { request} = req.body;

      // Get available tools
      const { data: tools } = await supabase
        .from('ai_custom_tools')
        .select('tool_name, description')
        .eq('is_active', true);

      const suggestions = await ollamaAssistant.suggestTools(request, tools || []);
      res.json(suggestions);
    } catch (error: Error | unknown) {
      logger.error('Tool suggestion error', LogContext.API, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to suggest tools' });
    }
  }
);

logger.info('📍 Registered /api/assistant/suggest-tools endpoint successfully');
logger.info('📍 Registering /api/assistant/generate-integration endpoint');
app.post(
  '/api/assistant/generate-integration',
  authenticateAI,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { language, framework, purpose } = req.body;
      const code = await ollamaAssistant.generateConnectionCode(language, framework, purpose);
      res.json({ code });
    } catch (error: Error | unknown) {
      logger.error('Integration generation error', LogContext.API, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to generate integration code' });
    }
  }
);

logger.info('📍 Registered /api/assistant/generate-integration endpoint successfully');

logger.info('📍 Registering /api/assistant/analyze-codebase endpoint');
app.post(
  '/api/assistant/analyze-codebase',
  authenticateAI,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { structure } = req.body;
      const _analysis= await ollamaAssistant.analyzeIntegrationPoints(structure);
      res.json({ _analysis});
    } catch (error: Error | unknown) {
      logger.error('Codebase analysis error', LogContext.API, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to analyze codebase' });
    }
  }
);

logger.info('📍 Registered /api/assistant/analyze-codebase endpoint successfully');
logger.info('📍 Registering /api/assistant/create-tool endpoint');
app.post(
  '/api/assistant/create-tool',
  authenticateAI,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, requirements } = req.body;
      const tool = await ollamaAssistant.createToolImplementation(name, description, requirements);

      // Optionally save the tool
      if (req.body.save) {
        const { data, error } = await supabase
          .from('ai_custom_tools')
          .insert(tool)
          .select()
          .single();

        if (error) throw error;
        res.json({ tool: data });
      } else {
        res.json({ tool });
      }
    } catch (error: Error | unknown) {
      logger.error('Tool creation error', LogContext.API, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to create tool' });
    }
  }
);

logger.info('📍 Registered /api/assistant/create-tool endpoint successfully');
logger.info('📍 Registering /api/assistant/route-request endpoint');

app.post(
  '/api/assistant/route-request',
  authenticateAI,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { request, context } = req.body;

      // Use DSPy service for advanced orchestration
      const orchestrationResult = await dspyService.orchestrate({
        requestId: `route-${Date.now()}`,
        userRequest: request,
        userId: req.aiServiceId || 'unknown',
        orchestrationMode: 'adaptive',
        context: context || {},
        timestamp: new Date(),
      });

      res.json({
        success: orchestrationResult.success,
        routing: {
          mode: orchestrationResult.mode,
          agents: orchestrationResult.participatingAgents,
          confidence: orchestrationResult.confidence,
        },
        result: orchestrationResult.result,
        reasoning: orchestrationResult.reasoning,
      });
    } catch (error: Error | unknown) {
      logger.error('Request routing error', LogContext.API, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to route request' });
    }
  }
);

logger.info('📍 Registered /api/assistant/route-requestendpoint successfully');
logger.info('📍 Registering /api/assistant/chat endpoint');

// Chat endpoint for AI conversation
app.post(
  '/api/assistant/chat',
  authenticateAI,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { message, model, conversation_id } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Get recent conversation history
      const { data: recentHistory } = await supabase
        .from('ai_memories')
        .select('content created_at')
        .eq('memory_type', 'working')
        .contains('metadata', { conversation_id })
        .order('created_at', { ascending: false })
        .limit(10);

      // Build conversation context
      let contextPrompt = '';
      if (recentHistory && recentHistory.length > 0) {
        const conversationHistory = recentHistory
          .reverse()
          .map((memory) => memory.content)
          .join('\n');
        contextPrompt = `Previous conversation:\n${conversationHistory}\n\nCurrent message: ${message}`;
      } else {
        contextPrompt = message;
      }

      // Store the user message in memory
      await supabase.from('ai_memories').insert({
        memory_type: 'working',
        content: `User: ${message}`,
        service_id: req.aiServiceId,
        metadata: {
          conversation_id,
          model,
          timestamp: new Date().toISOString(),
        },
      });

      // Generate response using Ollama
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: model || 'llama3.2:3b',
          prompt: contextPrompt,
          stream: false,
          options: {
            temperature: GOOD_CONFIDENCE,
            top_p: 0.9,
            top_k: 40,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error ${response.status}`);
      }

      const data = (await response.json()) as { response: string };
      const assistantResponse = data.response;

      // Store the assistant response in memory
      await supabase.from('ai_memories').insert({
        memory_type: 'working',
        content: `Assistant: ${assistantResponse}`,
        service_id: req.aiServiceId,
        metadata: {
          conversation_id,
          model,
          timestamp: new Date().toISOString(),
        },
      });

      res.json({
        response: assistantResponse,
        model,
        conversation_id,
        timestamp: new Date().toISOString(),
      });
    } catch (error: Error | unknown) {
      logger.error('Chat error', LogContext.CONVERSATION, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to generate response' });
    }
  }
);

logger.info('📍 Registered /api/assistant/chat endpoint successfully');
logger.info('📍 Registering /api/assistant/conversation/:id endpoint');

// Get conversation history endpoint
app.get(
  '/api/assistant/conversation/:id',
  authenticateAI,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { limit = 50 } = req.query;

      const { data: history, error } = await supabase
        .from('ai_memories')
        .select('content created_at, metadata')
        .eq('memory_type', 'working')
        .contains('metadata', { conversation_id: id })
        .order('created_at', { ascending: true })
        .limit(parseInt(limit as string, 10));

      if (error) throw error;

      // Parse messages from stored content
      const messages =
        history?.map((memory) => {
          const isUser = memory.content.startsWith('User: ');
          return {
            id: memory.created_at,
            role: isUser ? 'user' : 'assistant',
            content: memory.content.replace(/^(User: |Assistant: )/, ''),
            timestamp: new Date(memory.created_at),
            model: memory.metadata?.model,
          };
        }) || [];

      res.json({ messages, conversation_id: id });
    } catch (error: Error | unknown) {
      logger.error('Conversation history error', LogContext.CONVERSATION, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to fetch conversation history' });
    }
  }
);

logger.info('📍 Registered /api/assistant/conversation/:id endpoint successfully');
logger.info('📍 Registering /api/agents endpoint');

// Agents endpoints
app.get('/api/agents', authenticateAI, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('created_by', req.aiServiceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, agents: agents || [] });
  } catch (error) {
    logger.error('Error fetching agents:', LogContext.API, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

logger.info('📍 Registered /api/agents GET endpoint successfully');
logger.info('📍 Registering /api/agents POST endpoint');

app.post('/api/agents', authenticateAI, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, capabilities, instructions, model } = req.body;

    const { data: agent, error } = await supabase
      .from('agents')
      .insert({
        name,
        description,
        capabilities: capabilities || [],
        instructions,
        model: model || 'llama3.2:3b',
        created_by: req.aiServiceId,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, agent });
  } catch (error) {
    logger.error('Error creating agent:', LogContext.API, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ success: false, error: 'Failed to create agent' });
  }
});

logger.info('📍 Registered /api/agents POST endpoint successfully');
logger.info('📍 Registering /api/agents PUT endpoint');

// Agent update endpoint with proper authentication and timeout protection
app.put('/api/agents/:id', authenticateAI, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, capabilities, instructions, model, is_active } = req.body;

    // Add timeout protection for the database operation
    const updatePromise = supabase
      .from('agents')
      .update({
        name,
        description,
        capabilities,
        instructions,
        model,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('created_by', req.aiServiceId)
      .select()
      .single();

    // Set a 5-second timeout for the database operation
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(TIME_500MS0)
    );

    const { data: agent, error } = (await Promise.race([updatePromise, timeoutPromise])) as any;

    if (error) throw error;

    res.json({ success: true, agent });
  } catch (error) {
    logger.error('Error updating agent:', LogContext.API, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      agentId: req.params.id,
      userId: req.aiServiceId,
    });

    if (error instanceof Error && error.message === 'Database operation timed out') {
      res.status(504).json({ success: false, error: 'Request timed out' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to update agent' });
    }
  }
});

logger.info('📍 Registered /api/agents PUT endpoint successfully');
logger.info('📍 Registering /api/agents DELETE endpoint');

app.delete('/api/agents/:id', authenticateAI, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id)
      .eq('created_by', req.aiServiceId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting agent:', LogContext.API, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ success: false, error: 'Failed to delete agent' });
  }
});

logger.info('📍 Registered /api/agents DELETE endpoint successfully');
logger.info('📍 Registering /api/agents/:id/execute endpoint');

// Lazy-loaded agent execution endpoint
app.post('/api/agents/:id/execute', authenticateAI, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { input, context } = req.body;

    // Get the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('created_by', req.aiServiceId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    // Lazy load OllamaService only when needed
    const { OllamaService } = await import('./services/ollama_service');
    const ollamaService = new OllamaService();

    // Execute the agent with Ollama service
    const prompt = `${agent.instructions}\n\nUser input: ${input}\n\nContext: ${context || 'None'}\n\nResponse:`;

    try {
      const response = await ollamaService.generate({
        model: agent.model || 'llama3.2:3b',
        prompt,
        options: {
          temperature: GOOD_CONFIDENCE,
        },
        stream: false,
      });

      // Log the execution
      await supabase.from('ai_agent_executions').insert({
        agent_id: id,
        input,
        output: response,
        context,
        model: agent.model,
        service_id: req.aiServiceId,
      });

      res.json({
        success: true,
        output: response,
        agent: agent.name,
        model: agent.model,
      });
    } catch (__ollamaError) {
      // Check if Ollama is running
      const health = await ollamaService.healthCheck();
      const isHealthy = health.status === 'healthy';
      if (!isHealthy) {
        logger.error('Ollama service is not available', LogContext.API);
        return res.status(503).json({
          success: false,
          error: 'AI service temporarily unavailable. Please ensure Ollama is running.',
        });
      }
      throw ollamaError;
    }
  } catch (error) {
    logger.error('Error executing agent:', LogContext.API, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ success: false, error: 'Failed to execute agent' });
  }
});

logger.info('📍 Registered /api/agents/:id/execute endpoint successfully');

// Error logging middleware (must be before routers but after other middleware)
app.use(LoggingMiddleware.errorLogger());

logger.info('📍 About to mount routers...');

// Mount routers with authentication and versioning
logger.info('📍 Mounting /api/v1/tools router...');
app.use('/api/v1/tools', authenticateAI, ToolRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/tools router');
logger.info('📍 Mounting /api/v1/memory router...');
app.use('/api/v1/memory', authenticateAI, MemoryRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/memory router');
logger.info('📍 Mounting /api/v1/context router...');
app.use('/api/v1/context', authenticateAI, ContextRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/context router');
logger.info('📍 Mounting /api/v1/knowledge router...');
app.use('/api/v1/knowledge', authenticateAI, KnowledgeRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/knowledge router');
logger.info('📍 Mounting /api/v1/orchestration router...');
app.use('/api/v1/orchestration', authenticateAI, OrchestrationRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/orchestration router');
logger.info('📍 Mounting /api/v1/widgets router...');
app.use('/api/v1/widgets', authenticateAI, WidgetsRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/widgets router');
logger.info('📍 Mounting /api/v1/dspy-widgets router...');
app.use('/api/v1/dspy-widgets', authenticateAI, DSPyWidgetsRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/dspy-widgets router');
logger.info('📍 Mounting /api/v1/speech router...');
app.use('/api/v1/speech', authenticateAI, SpeechRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/speech router');
logger.info('📍 Mounting /api/v1/docs router...');
app.use('/api/v1/docs', authenticateAI, DocumentationRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/docs router');
logger.info('📍 Mounting /api/v1/backup router...');
app.use('/api/v1/backup', authenticateAI, BackupRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/backup router');
logger.info('📍 Mounting /api/v1/knowledge-monitoring router...');
app.use('/api/v1/knowledge-monitoring', authenticateAI, createKnowledgeMonitoringRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/knowledge-monitoring router');
logger.info('📍 Mounting /api/v1/health router...');
app.use('/api/v1/health', HealthRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/health router');
logger.info('📍 Mounting /api/v1/athena-tools router...');
app.use('/api/v1/athena-tools', authenticateAI, AthenaToolsRouter);
logger.info('📍 Successfully mounted /api/v1/athena-tools router');
logger.info('📍 Mounting /api/v1/natural-language-widgets router...');
app.use('/api/v1/natural-language-widgets', authenticateAI, naturalLanguageWidgetsRouter);

// Sweet Athena avatar routes
app.use('/api/v1/sweet-athena', authenticateAI, SweetAthenaRouter());
logger.info('📍 Successfully mounted /api/v1/natural-language-widgets router');

// DSPy tools routes
logger.info('📍 Mounting /api/v1/dspy-tools router...');
app.use('/api/v1/dspy-tools', authenticateAI, DSPyToolsRouter);
logger.info('📍 Successfully mounted /api/v1/dspy-tools router');

// File system routes
logger.info('📍 Mounting /api/v1/filesystem router...');
app.use('/api/v1/filesystem', authenticateAI, FileSystemRouter(supabase));
logger.info('📍 Successfully mounted /api/v1/filesystem router');

// Pydantic AI routes
logger.info('📍 Mounting /api/v1/pydantic-ai router...');
app.use('/api/v1/pydantic-ai', authenticateAI, PydanticAIRouter);
logger.info('📍 Successfully mounted /api/v1/pydantic-ai router');

// MCP routes - needs to be initialized after server starts
app.use('/api/v1/mcp', authenticateAI, (req, res, next) => {
  if (!mcpServerService) {
    return res.status(503).json({
      success: false,
      error: 'MCP service not initialized yet',
    });
  }
  MCPRouter(supabase, mcpServerService)(req, res, next);
});
logger.info('📍 MCP routes registered (will initialize after server starts)');

// Legacy route support (redirects to v1)
// This ensures backward compatibility
app.use('/api/tools', authenticateAI, ToolRouter(supabase));
app.use('/api/memory', authenticateAI, MemoryRouter(supabase));
app.use('/api/context', authenticateAI, ContextRouter(supabase));
app.use('/api/knowledge', authenticateAI, KnowledgeRouter(supabase));
app.use('/api/orchestration', authenticateAI, OrchestrationRouter(supabase));
app.use('/api/widget-creation', authenticateAI, widgetCreationRouter);
app.use('/api/widgets', authenticateAI, WidgetsRouter(supabase));
app.use('/api/dspy-widgets', authenticateAI, DSPyWidgetsRouter(supabase));
app.use('/api/speech', authenticateAI, SpeechRouter(supabase));
app.use('/api/docs', authenticateAI, DocumentationRouter(supabase));
app.use('/api/backup', authenticateAI, BackupRouter(supabase));
app.use('/api/knowledge-monitoring', authenticateAI, createKnowledgeMonitoringRouter(supabase));
app.use('/api/health', HealthRouter(supabase));
app.use('/api/athena-tools', authenticateAI, AthenaToolsRouter);
app.use('/api/natural-language-widgets', authenticateAI, naturalLanguageWidgetsRouter);
app.use('/api/sweet-athena', authenticateAI, SweetAthenaRouter());
app.use('/api/dspy-tools', authenticateAI, DSPyToolsRouter);
app.use('/api/filesystem', authenticateAI, FileSystemRouter(supabase));
app.use('/api/pydantic-ai', authenticateAI, PydanticAIRouter);
app.use('/api/mcp', authenticateAI, (req, res, next) => {
  if (!mcpServerService) {
    return res.status(503).json({
      success: false,
      error: 'MCP service not initialized yet',
    });
  }
  MCPRouter(supabase, mcpServerService)(req, res, next);
});

// GraphQL server will be initialized after server starts

// Serve static files (Chat UI) - after API routes to prevent conflicts
app.use(express.static(path.join(__dirname, '../public')));

// Serve the chat UI at root
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// WebSocket support for real-time updates
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

logger.info('📍 Creating HTTP server...');
const server = createServer(app);
logger.info('📍 Creating WebSocket server...');
const wss = new WebSocketServer({ server });
logger.info('📍 WebSocket server created');

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Handle real-time subscriptions
      if (data.type === 'subscribe') {
        // Subscribe to Supabase real-time changes
        supabase
          .channel(`ai-${data.channel}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: data.table },
            (payload) => {
              ws.send(
                JSON.stringify({
                  type: 'update',
                  channel: data.channel,
                  payload,
                })
              );
            }
          )
          .subscribe();
      }
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  });
});

// Initialize services including GraphQL
let sweetAthenaWebSocketService: SweetAthenaWebSocketService | null = null;
let mcpServerService: any = null;

async function initializeServices() {
  try {
    logger.info('🚀 Initializing Universal AI Tools Services...');

    // Check if Redis was already initialized during startup
    if (redisService) {
      logger.info('📦 Redis service already initialized during startup');

      // Update health check service with Redis client (type compatibility workaround)
      const redisClientForHealth = redisService.getClient() as any; // ioredis compatible with redis client interface
      healthCheckService = createHealthCheckService(
        supabase,
        redisClientForHealth,
        migrationService
      );

      // If we're using Redis-based performance middleware, apply additional features
      if (performanceMiddleware && performanceMiddleware.compressionMiddleware) {
        logger.info('📈 Applying Redis-specific performance features...');
        app.use(performanceMiddleware.compressionMiddleware());
        app.use(performanceMiddleware.databaseOptimizer());
        logger.info('✅ Redis-specific performance features applied');
      }
    } else {
      // If Redis wasn't initialized during startup, try again now
      logger.info('📦 Attempting Redis service initialization...');
      try {
        const { getRedisService } = await import('./services/redis-service');
        redisService = getRedisService();
        await redisService.connect();

        // Update health check service with Redis client (type compatibility workaround)
        const redisClientForHealth = redisService.getClient() as any; // ioredis compatible with redis client interface
        healthCheckService = createHealthCheckService(
          supabase,
          redisClientForHealth,
          migrationService
        );

        const health = await redisService.healthCheck();
        if (health.healthy) {
          logger.info('✅ Redis service connected successfully (late init)', LogContext.CACHE, {
            latency: health.latency,
          });
        } else {
          logger.warn('⚠️ Redis health check failed but continuing', LogContext.CACHE, {
            error: health.error
          });
        }
      } catch (error) {
        logger.warn('⚠️ Redis initialization failed, caching will be disabled', LogContext.CACHE, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Initialize Prometheus metrics collector with timeout protection
    logger.info('📊 Initializing Prometheus metrics collector...');
    try {
      const { metricsCollector } = await import('./utils/prometheus-metrics');
      const initialized = await metricsCollector.initialize(5000); // 5 second timeout
      if (initialized) {
        logger.info('✅ Prometheus metrics collector initialized successfully');
      } else {
        logger.warn(
          '⚠️  Prometheus metrics collector initialization failed, metrics will be disabled'
        );
      }
    } catch (error) {
      logger.warn(
        '⚠️  Prometheus metrics collector initialization timed out, continuing without metrics',
        LogContext.PERFORMANCE,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    // Initialize GraphQL server with lazy loading
    logger.info('📍 Initializing GraphQL server with lazy loading...');
    try {
      const { initializeGraphQL, addGraphQLHealthCheckLazy } = await import(
        './graphql/lazy-loader'
      );
      const graphqlInitialized = await initializeGraphQL(app);

      if (graphqlInitialized) {
        // Add health check if initialized successfully
        if (healthCheckService) {
          addGraphQLHealthCheckLazy(healthCheckService);
        }
        logger.info('✅ GraphQL server setup complete at /graphql');
        logger.info('📊 GraphQL Playground available at /graphql (development only)');
        logger.info('🔌 GraphQL WebSocket subscriptions available at /graphql/subscriptions');
      } else {
        logger.warn('⚠️  GraphQL server not available - continuing without GraphQL support');
      }
    } catch (error) {
      logger.error('Failed to setup GraphQL server:', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      logger.warn('⚠️  Continuing without GraphQL server');
    }

    // Initialize Sweet Athena WebSocket Service
    logger.info('💬 Initializing Sweet Athena WebSocket service...');
    try {
      sweetAthenaWebSocketService = new SweetAthenaWebSocketService({
        pingInterval: 30000,
        maxConnections: 1000,
        authTimeout: 10000,
        messageRateLimit: 60,
      });

      // Start the WebSocket service with the existing HTTP server
      await sweetAthenaWebSocketService.start(server);

      logger.info('✅ Sweet Athena WebSocket service initialized at /api/sweet-athena/ws');

      // Log WebSocket stats
      const wsStats = sweetAthenaWebSocketService.getStats();
      logger.info('📊 WebSocket Service Stats:', LogContext.SYSTEM, wsStats);
    } catch (error) {
      logger.error('Failed to initialize Sweet Athena WebSocket service:', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      logger.warn('⚠️  Continuing without Sweet Athena WebSocket support');
    }

    // Initialize MCP Server Service
    logger.info('🔌 Initializing MCP (Model Context Protocol) server...');
    try {
      mcpServerService = createMCPServerService(supabase);
      await mcpServerService.initialize(server);

      logger.info('✅ MCP server initialized at /api/mcp/ws');

      // Set up event listeners for MCP events
      mcpServerService.on('agent:registered', (agent: any) => {
        logger.info('MCP agent registered', LogContext.SYSTEM, {
          agentId: agent.id,
          name: agent.name,
        });
      });

      mcpServerService.on('agent:connected', (agent: any) => {
        logger.info('MCP agent connected', LogContext.SYSTEM, {
          agentId: agent.id,
          name: agent.name,
        });
      });

      mcpServerService.on('agent:disconnected', (agent: any) => {
        logger.info('MCP agent disconnected', LogContext.SYSTEM, {
          agentId: agent.id,
          name: agent.name,
        });
      });
    } catch (error) {
      logger.error('Failed to initialize MCP server:', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      logger.warn('⚠️  Continuing without MCP server support');
    }

    // Initialize port management system with timeout protection
    logger.info('🔌 Initializing port management system...');
    try {
      // Import and initialize with timeout
      const { PortIntegrationService } = await import('./services/port-integration-service');
      const portIntegrationService = new PortIntegrationService({
        enableAutoDiscovery: true,
        enableHealthMonitoring: false, // Disable health monitoring to prevent hangs
        enableWebSocketBroadcast: false,
        autoResolveConflicts: true,
      });

      // Initialize with a timeout
      const initTimeout = 10000; // 10 seconds max
      await Promise.race([
        portIntegrationService.initialize(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Port integration initialization timeout')),
            initTimeout
          )
        ),
      ]);

      // Log startup results
      const startupResults = portIntegrationService.getStartupResults();
      const systemStatus = portIntegrationService.getPortSystemStatus();

      logger.info('📊 Service Startup Summary:');
      logger.info(`  ✅ Services configured: ${systemStatus.smartPortManager.servicesConfigured}`);
      logger.info(
        `  🔍 Health monitoring: ${systemStatus.healthMonitor.monitoring ? 'Active' : 'Inactive'}`
      );
      logger.info(`  📡 WebSocket clients: ${systemStatus.webSocket.clients}`);
      logger.info(`  💯 Health score: ${systemStatus.healthMonitor.healthScore}/100`);

      // Store the service instance for API routes
      (app as any).portIntegrationService = portIntegrationService;
    } catch (error) {
      logger.warn(
        'Port integration service initialization failed or timed out',
        LogContext.SYSTEM,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      logger.info('Continuing without port management features');
    }

    // // Log any conflicts resolved
    // const conflicts = startupResults.filter(r => r.status === 'conflict_resolved');
    // if (conflicts.length > 0) {
    //   logger.info('🔧 Port conflicts resolved:');
    //   conflicts.forEach(conflict => {
    //     logger.info(`  ${conflict.service}: ${conflict.originalPort} → ${conflict.port}`);
    //   });
    // }

    // Start continuous learning service with lazy loading
    if (process.env.ENABLE_CONTINUOUS_LEARNING !== 'false') {
      try {
        const { getContinuousLearningService } = await import(
          './services/continuous-learning-service-lazy'
        );
        const continuousLearningService = getContinuousLearningService(supabase);

        // Start with timeout protection
        const { initializeWithTimeout } = await import('./utils/timeout-utils');
        await initializeWithTimeout(
          async () => continuousLearningService.start(),
          'ContinuousLearningService',
          15000,
          { critical: false }
        );

        logger.info('🧠 Continuous learning service started successfully');
      } catch (error) {
        logger.error('Failed to start continuous learning service:', LogContext.SYSTEM, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Non-critical service, continue
      }
    }

    logger.info('🎉 All services initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize services:', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Start server with service initialization
logger.info('🔄 [STARTUP] About to call server.listen()...', LogContext.SYSTEM);
logger.info(`🔧 About to start server on port ${port}...`);
logger.info(`📍 Current process: PID ${process.pid}`);
logger.info('🔄 [STARTUP] Calling server.listen() now...', LogContext.SYSTEM);
server.listen(port, async () => {
  logger.info('✅ [STARTUP] Server.listen() callback executed!', LogContext.SYSTEM);
  logger.info(`✅ Universal AI Tools Service running on port ${port}`);
  logger.info(`API docs available at http://localhost:${port}/api/docs`);
  logger.info(`Performance metrics available at http://localhost:${port}/api/performance/metrics`);
  logger.info(`Performance report available at http://localhost:${port}/api/performance/report`);
  logger.info(`Port management available at http://localhost:${port}/api/ports/status`);

  // Initialize services after server starts (with timeout protection)
  setTimeout(async () => {
    try {
      logger.info('🔧 Starting background service initialization...');
      await initializeServices();
      logger.info('✅ Background service initialization completed');
    } catch (error) {
      logger.error(
        'Service initialization failed, server will continue but with limited functionality',
        LogContext.SYSTEM,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }, 100); // Start after 100ms delay
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Shutdown port integration service
    // await portIntegrationService.shutdown();

    // Shutdown continuous learning service
    if (process.env.ENABLE_CONTINUOUS_LEARNING !== 'false') {
      try {
        const { getContinuousLearningService } = await import(
          './services/continuous-learning-service-lazy'
        );
        const continuousLearningService = getContinuousLearningService(supabase);
        await continuousLearningService.stop();
      } catch (error) {
        logger.error('Error stopping continuous learning service:', LogContext.SYSTEM, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Shutdown Sweet Athena WebSocket service
    if (sweetAthenaWebSocketService) {
      try {
        await sweetAthenaWebSocketService.stop();
        logger.info('Sweet Athena WebSocket service stopped');
      } catch (error) {
        logger.error('Error stopping Sweet Athena WebSocket service:', LogContext.SYSTEM, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Shutdown MCP server
    if (mcpServerService) {
      try {
        await mcpServerService.shutdown();
        logger.info('MCP server stopped');
      } catch (error) {
        logger.error('Error stopping MCP server:', LogContext.SYSTEM, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Shutdown DSPy service
    await dspyService.shutdown();

    // Close performance middleware
    if (performanceMiddleware) {
      await performanceMiddleware.close();
    }

    // Close Redis connection if exists
    if (redisClient) {
      await redisClient.quit();
    }

    // Shutdown enhanced logger
    await logger.shutdown();

    // Close WebSocket server
    wss.close();

    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit', LogContext.SYSTEM);
      process.exit(1);
    }, 30000);
  } catch (error) {
    logger.error('Error during graceful shutdown:', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', LogContext.SYSTEM, {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', LogContext.SYSTEM, { promise, reason });
  gracefulShutdown('unhandledRejection');
});

logger.info('📍 Server.ts file execution completed - waiting for server.listen callback...');
