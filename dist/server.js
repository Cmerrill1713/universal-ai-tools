import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import os from 'os';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
let compressionMiddleware = null;
import AgentRegistry from '@/agents/agent-registry';
import { config, validateConfig } from '@/config/environment';
import { standardRateLimiter } from '@/middleware/comprehensive-rate-limiter';
import { errorTrackingService } from '@/middleware/error-tracking-middleware';
import { intelligentParametersMiddleware } from '@/middleware/intelligent-parameters';
import { contextStorageService } from '@/services/context-storage-service';
import { healthMonitor } from '@/services/health-monitor-service';
import { mcpIntegrationService } from '@/services/mcp-integration-service';
import { apiResponseMiddleware } from '@/utils/api-response';
import { container, injectServices, SERVICE_NAMES } from '@/utils/dependency-container';
import { log, LogContext } from '@/utils/logger';
class UniversalAIToolsServer {
    app;
    server;
    io = null;
    wss = null;
    supabase = null;
    agentRegistry = null;
    isShuttingDown = false;
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.setupMiddleware();
        this.setupWebSocket();
    }
    async initializeServices() {
        this.initializeSupabase();
        this.initializeAgentRegistry();
        await this.initializeContextServices();
        await this.initializeUserPreferenceLearning();
        await this.initializeFlashAttention();
        await this.initializeFeedbackCollection();
        await this.registerAdditionalServices();
    }
    async registerAdditionalServices() {
        try {
            const { secretsManager } = await import('./services/secrets-manager');
            container.register(SERVICE_NAMES.SECRETS_MANAGER, secretsManager);
            const { mlParameterOptimizer } = await import('./services/ml-parameter-optimizer');
            container.register(SERVICE_NAMES.PARAMETER_OPTIMIZER, mlParameterOptimizer);
            log.info('✅ Additional services registered in dependency container', LogContext.SERVER);
        }
        catch (error) {
            log.warn('⚠️ Failed to register some additional services', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    initializeAgentRegistry() {
        try {
            this.agentRegistry = new AgentRegistry();
            container.register(SERVICE_NAMES.AGENT_REGISTRY, this.agentRegistry);
            healthMonitor.setAgentRegistry(this.agentRegistry);
            container.register(SERVICE_NAMES.HEALTH_MONITOR, healthMonitor);
            log.info('✅ Agent Registry initialized', LogContext.AGENT);
        }
        catch (error) {
            log.error('❌ Failed to initialize Agent Registry', LogContext.AGENT, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    initializeSupabase() {
        try {
            if (!config.supabase.url || !config.supabase.serviceKey) {
                throw new Error('Supabase configuration missing');
            }
            this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
            container.register(SERVICE_NAMES.SUPABASE_CLIENT, this.supabase);
            log.info('✅ Supabase client initialized', LogContext.DATABASE);
        }
        catch (error) {
            log.error('❌ Failed to initialize Supabase client', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async initializeContextServices() {
        try {
            log.info('🔍 Initializing context injection service', LogContext.DATABASE);
            if (this.supabase) {
                const testContext = {
                    contextSummary: 'Context injection disabled during cleanup',
                    relevantPatterns: [],
                };
                log.info('✅ Context injection service initialized', LogContext.DATABASE, {
                    contextTokens: testContext.contextSummary ? testContext.contextSummary.length : 0,
                    sourcesUsed: testContext.relevantPatterns?.length || 0,
                });
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
        }
        catch (error) {
            log.warn('⚠️ Context injection service initialization failed', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async initializeMCPService() {
        try {
            const started = await mcpIntegrationService.start();
            if (started) {
                log.info('✅ MCP service initialized for context management', LogContext.MCP);
            }
            else {
                log.warn('⚠️ MCP service failed to start, using fallback mode', LogContext.MCP);
            }
        }
        catch (error) {
            log.error('❌ Failed to initialize MCP service', LogContext.MCP, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async initializeUserPreferenceLearning() {
        try {
            log.info('🧠 Initializing User Preference Learning service', LogContext.AI);
            const { userPreferenceLearningService } = await import('./services/user-preference-learning-service');
            await userPreferenceLearningService.initialize();
            log.info('✅ User Preference Learning service initialized', LogContext.AI);
        }
        catch (error) {
            log.warn('⚠️ User Preference Learning service initialization failed', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async initializeFlashAttention() {
        try {
            log.info('⚡ Initializing FlashAttention service', LogContext.AI);
            const { flashAttentionService } = await import('./services/flash-attention-service');
            await flashAttentionService.initialize();
            container.register(SERVICE_NAMES.FLASH_ATTENTION_SERVICE, flashAttentionService);
            log.info('✅ FlashAttention service initialized', LogContext.AI);
        }
        catch (error) {
            log.warn('⚠️ FlashAttention service initialization failed', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async initializeFeedbackCollection() {
        try {
            log.info('📝 Initializing Feedback Collection service', LogContext.AI);
            const { feedbackCollectionService } = await import('./services/feedback-collection-service');
            await feedbackCollectionService.initialize();
            container.register(SERVICE_NAMES.FEEDBACK_COLLECTOR, feedbackCollectionService);
            log.info('✅ Feedback Collection service initialized', LogContext.AI);
        }
        catch (error) {
            log.warn('⚠️ Feedback Collection service initialization failed', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async setupMiddleware() {
        this.app.disable('x-powered-by');
        this.app.set('trust proxy', 1);
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: process.env.NODE_ENV === 'production' ? ["'self'"] : ["'self'", "'unsafe-inline'"],
                    styleSrc: process.env.NODE_ENV === 'production' ? ["'self'"] : ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'"],
                    frameAncestors: ["'none'"],
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
            hsts: false,
        }));
        try {
            const mod = await import('compression');
            const c = mod.default || mod;
            compressionMiddleware = c();
            this.app.use(compressionMiddleware);
        }
        catch {
        }
        (async () => {
            try {
                const { corsMiddleware } = await import('./middleware/cors-config');
                this.app.use(corsMiddleware);
            }
            catch {
                this.app.use(cors({
                    origin: (origin, callback) => callback(null, process.env.NODE_ENV !== 'production'),
                    credentials: true,
                }));
            }
        })();
        this.app.use((req, res, next) => {
            const m = req.method.toUpperCase();
            if (m === 'TRACE' || m === 'TRACK' || m === 'CONNECT') {
                return res.status(405).end();
            }
            return next();
        });
        try {
            const { ipFilterMiddleware } = await import('./middleware/ip-filter');
            const allowList = (process.env.IP_ALLOWLIST || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            this.app.use(ipFilterMiddleware(allowList));
        }
        catch {
        }
        try {
            const { requestIdMiddleware, enforceJsonMiddleware, limitQueryMiddleware, jsonDepthGuardMiddleware, } = await import('./middleware/request-guard');
            this.app.use(requestIdMiddleware());
            this.app.use(limitQueryMiddleware());
            this.app.use(enforceJsonMiddleware());
            this.app.use(jsonDepthGuardMiddleware());
        }
        catch {
        }
        try {
            const { sqlInjectionProtection } = await import('./middleware/sql-injection-protection');
            this.app.use(sqlInjectionProtection());
        }
        catch { }
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use(injectServices);
        try {
            const { contextMiddleware } = await import('./middleware/auto-context-middleware');
            this.app.use('/api/v1/agents', contextMiddleware);
            this.app.use('/api/v1/chat', contextMiddleware);
            this.app.use('/api/v1/assistant', contextMiddleware);
            this.app.use('/api/v1/vision', contextMiddleware);
            this.app.use('/api/v1/huggingface', contextMiddleware);
            log.info('✅ Auto Context Middleware applied globally to LLM endpoints', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to apply Auto Context Middleware', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
        this.app.use(express.static('public'));
        this.app.use(standardRateLimiter.middleware());
        this.app.use(errorTrackingService.timingMiddleware());
        this.app.use(apiResponseMiddleware);
        try {
            const { securityHeadersMiddleware } = await import('./middleware/security-headers');
            this.app.use(securityHeadersMiddleware());
        }
        catch {
        }
        this.app.use((req, res, next) => {
            const startTime = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                try {
                    res.setHeader('X-Response-Time', `${duration}ms`);
                }
                catch { }
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
                    const isLatencySensitive = req.path.startsWith('/api/v1/assistant') ||
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
        this.app.options('*', cors());
        (async () => {
            try {
                const { metricsMiddleware } = await import('./middleware/metrics');
                this.app.use(metricsMiddleware());
            }
            catch {
            }
        })();
        try {
            const { wireCasbin } = await import('./security/init-authz');
            await wireCasbin(this.app);
        }
        catch { }
        log.info('✅ Middleware setup completed', LogContext.SERVER);
    }
    async setupRoutesSync() {
        this.app.get('/health', async (req, res) => {
            try {
                let mlxHealth = false;
                try {
                    const { mlxService } = await import('./services/mlx-service');
                    const mlxStatus = await mlxService.healthCheck();
                    mlxHealth = mlxStatus.healthy;
                }
                catch (error) {
                    mlxHealth = false;
                }
                let redisHealth = false;
                try {
                    const { redisService } = await import('./services/redis-service');
                    redisHealth = await redisService.ping();
                }
                catch (error) {
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
                    const { ollamaService } = await import('./services/ollama-service');
                    health.services.ollama = ollamaService.isServiceAvailable();
                }
                catch { }
                try {
                    const { fastCoordinator } = await import('./services/fast-llm-coordinator');
                    health.services.lmStudio = await fastCoordinator.checkLmStudioHealth();
                }
                catch { }
                res.json(health);
            }
            catch (error) {
                const health = {
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    environment: config.environment,
                    services: {
                        supabase: !!this.supabase,
                        websocket: !!this.io,
                        agentRegistry: !!this.agentRegistry,
                        redis: false,
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
        this.app.get('/metrics', async (req, res) => {
            try {
                const { getMetricsText } = await import('./middleware/metrics');
                const metrics = await getMetricsText();
                res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
                res.send(metrics);
            }
            catch (error) {
                res.json({ success: true, data: { message: 'metrics disabled' } });
            }
        });
        this.app.get('/api/v1/status', async (req, res) => {
            try {
                const health = {
                    status: 'operational',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    environment: config.environment,
                    mode: {
                        offline: process.env.OFFLINE_MODE === 'true' || !!config.offlineMode,
                        disableExternalCalls: process.env.DISABLE_EXTERNAL_CALLS === 'true' || !!config.disableExternalCalls,
                        disableRemoteLLM: process.env.DISABLE_REMOTE_LLM === 'true' || !!config.disableRemoteLLM,
                    },
                    services: {
                        backend: 'healthy',
                        database: this.supabase ? 'healthy' : 'unavailable',
                        websocket: this.io ? 'healthy' : 'unavailable',
                        agents: this.agentRegistry ? 'healthy' : 'unavailable',
                        redis: false,
                        mlx: false,
                    },
                    providers: { openai: false, anthropic: false, ollama: false, internal: true },
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
                };
                try {
                    const { ollamaService } = await import('./services/ollama-service');
                    health.providers.ollama = ollamaService.isServiceAvailable();
                }
                catch { }
                try {
                    const { llmRouter } = await import('./services/llm-router-service');
                    const status = llmRouter.getProviderStatus();
                    health.providers = { ...health.providers, ...status };
                }
                catch { }
                res.json({
                    success: true,
                    data: health,
                    metadata: {
                        timestamp: new Date().toISOString(),
                        requestId: req.headers['x-request-id'] || 'unknown',
                    },
                });
            }
            catch (error) {
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
        this.app.get('/api/v1/ollama/models', async (req, res) => {
            try {
                const { ollamaService } = await import('./services/ollama-service');
                const models = await ollamaService.getAvailableModels();
                res.json({
                    success: true,
                    models: models || [],
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
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
        this.app.get('/api/v1/vision/models', async (req, res) => {
            try {
                const { visionResourceManager } = await import('./services/vision-resource-manager');
                const models = visionResourceManager.getLoadedModels();
                res.json({
                    success: true,
                    models: models || [],
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
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
        this.app.get('/api/v1/agents/registry', async (req, res) => {
            try {
                const agents = this.agentRegistry ? this.agentRegistry.getAvailableAgents() : [];
                res.json({
                    success: true,
                    agents: agents || [],
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
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
        this.app.post('/api/v1/autonomous-actions/:actionId/rollback', async (req, res) => {
            try {
                const { actionId } = req.params;
                const { reason = 'Performance degradation detected' } = req.body;
                const { autonomousActionRollbackService } = await import('./services/autonomous-action-rollback-service');
                const result = await autonomousActionRollbackService.executeRollback(actionId, reason);
                res.json({
                    success: result.success,
                    data: result,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
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
        this.app.get('/api/v1/system/llm', async (req, res) => {
            try {
                const snapshot = {
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
                }
                catch { }
                try {
                    const { ollamaService } = await import('./services/ollama-service');
                    snapshot.services.ollama.available = ollamaService.isServiceAvailable();
                    snapshot.services.ollama.defaultModel = ollamaService.getDefaultModel?.();
                }
                catch { }
                try {
                    const { fastCoordinator } = await import('./services/fast-llm-coordinator');
                    snapshot.services.lmStudio.available = await fastCoordinator.checkLmStudioHealth();
                }
                catch { }
                return res.json({ success: true, data: snapshot });
            }
            catch (error) {
                return res.status(500).json({
                    success: false,
                    error: { code: 'LLM_SNAPSHOT_ERROR', message: 'Failed to get LLM snapshot' },
                });
            }
        });
        this.app.post('/api/chat', (req, res) => {
            req.url = '/api/v1/assistant/chat';
            this.app._router.handle(req, res, () => { });
        });
        this.app.post('/api/assistant', (req, res) => {
            req.url = '/api/v1/assistant/chat';
            this.app._router.handle(req, res, () => { });
        });
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
        this.setupAgentRoutes();
        this.setupVisionRoutes();
        try {
            const a2aRouter = (await import('./routers/a2a-collaboration')).default;
            this.app.use('/api/v1/a2a', a2aRouter);
            log.info('✅ A2A collaboration router loaded', LogContext.API);
        }
        catch (error) {
            log.error('❌ Failed to load A2A collaboration router', LogContext.API, { error });
        }
        try {
            const optimizedCollaborationRouter = (await import('./routers/optimized-collaboration'))
                .default;
            this.app.use('/api/v1/collaboration', optimizedCollaborationRouter);
            log.info('✅ Optimized collaboration router loaded', LogContext.API);
        }
        catch (error) {
            log.error('❌ Failed to load optimized collaboration router', LogContext.API, { error });
        }
        this.setupHealthRoutes();
        try {
            const agentsRouter = (await import('./routers/agents.js')).default;
            this.app.use('/api/v1/agents', agentsRouter);
            log.info('✅ Agents routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.warn('⚠️ Failed to load agents routes', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const orchestrationRouter = (await import('./routers/orchestration')).default;
            this.app.use('/api/v1/orchestration', orchestrationRouter);
            log.info('✅ DSPy/MIPRO orchestration router loaded', LogContext.API);
        }
        catch (error) {
            log.error('❌ Failed to load DSPy/MIPRO orchestration router', LogContext.API, { error });
        }
        try {
            const fastCoordinatorRouter = (await import('./routers/fast-coordinator')).default;
            this.app.use('/api/v1/fast-coordinator', fastCoordinatorRouter);
            log.info('✅ Fast Coordinator router loaded - Multi-tier LLM coordination enabled', LogContext.API);
        }
        catch (error) {
            log.error('❌ Failed to load Fast Coordinator router', LogContext.API, { error });
        }
        try {
            const contextAnalyticsRouter = (await import('./routers/context-analytics')).default;
            this.app.use('/api/v1/context-analytics', contextAnalyticsRouter);
            log.info('✅ Context Analytics router loaded - Analytics endpoints exposed', LogContext.API);
        }
        catch (error) {
            log.error('❌ Failed to load Context Analytics router', LogContext.API, { error });
        }
        try {
            const environmentalRouter = (await import('./routers/environmental-awareness')).default;
            this.app.use('/api/v1/environmental', environmentalRouter);
            log.info('✅ Environmental Awareness router loaded - Context features exposed', LogContext.API);
        }
        catch (error) {
            log.error('❌ Failed to load Environmental Awareness router', LogContext.API, { error });
        }
        try {
            const proactiveTasksRouter = (await import('./routers/proactive-tasks')).default;
            this.app.use('/api/v1/proactive-tasks', proactiveTasksRouter);
            log.info('✅ Proactive Task Manager router loaded - Task scheduling exposed', LogContext.API);
        }
        catch (error) {
            log.error('❌ Failed to load Proactive Task Manager router', LogContext.API, { error });
        }
        try {
            const calendarRouter = (await import('./routers/calendar')).default;
            this.app.use('/api/v1/calendar', calendarRouter);
            log.info('✅ Calendar Integration router loaded - Calendar features exposed', LogContext.API);
        }
        catch (error) {
            log.error('❌ Failed to load Calendar Integration router', LogContext.API, { error });
        }
        try {
            const speculativeRouter = (await import('./routers/speculative-decoding')).default;
            this.app.use('/api/v1/speculative-decoding', speculativeRouter);
            log.info('✅ Speculative Decoding router loaded - AI optimization exposed', LogContext.API);
        }
        catch (error) {
            log.error('❌ Failed to load Speculative Decoding router', LogContext.API, { error });
        }
        this.app.post('/api/v1/multi-tier/execute', async (req, res) => {
            try {
                const { userRequest, context = {} } = req.body;
                if (!userRequest) {
                    return res.status(400).json({
                        success: false,
                        error: 'userRequest is required',
                    });
                }
                const { multiTierLLM } = await import('./services/multi-tier-llm-service');
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
            }
            catch (error) {
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
    setupVisionRoutes() {
        this.app.get('/api/v1/vision/health', async (req, res) => {
            try {
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
            }
            catch (error) {
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
                            available: true,
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
            }
            catch (error) {
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
        this.app.post('/api/v1/vision/analyze', (req, res) => {
            const { imagePath, imageBase64 } = req.body;
            if (!imagePath && !imageBase64) {
                return res.status(400).json({
                    success: false,
                    error: 'Either imagePath or imageBase64 must be provided',
                });
            }
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
                let embeddingResult = null;
                let isRealEmbedding = false;
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
                    }
                    else {
                        log.warn('PyVision embedding failed, using mock', LogContext.AI, {
                            error: result.error,
                        });
                    }
                }
                catch (error) {
                    log.warn('PyVision bridge not available, using mock', LogContext.AI, { error });
                }
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
                let memoryId = null;
                if (saveToMemory && this.supabase && isRealEmbedding) {
                    try {
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
                                    model: embeddingResult.model,
                                    dimension: embeddingResult.data?.dimension,
                                    processingTime: embeddingResult.processingTime,
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
                        }
                        else {
                            memoryId = memoryData?.id;
                            log.info('✅ Vision embedding saved to memory', LogContext.DATABASE, {
                                memoryId,
                                model: embeddingResult.model,
                            });
                            const { error: embeddingError } = await this.supabase
                                .from('vision_embeddings')
                                .insert({
                                memory_id: memoryId,
                                embedding: embeddingResult.data?.vector,
                                model_version: embeddingResult.model,
                                confidence: 0.95,
                            });
                            if (embeddingError) {
                                log.error('Failed to save embedding record', LogContext.DATABASE, {
                                    error: embeddingError,
                                });
                            }
                            else {
                                log.info('✅ Vision embedding indexed for fast search', LogContext.DATABASE, {
                                    memoryId,
                                });
                            }
                        }
                    }
                    catch (supabaseError) {
                        log.error('Supabase integration error', LogContext.DATABASE, { error: supabaseError });
                    }
                }
                return res.json({
                    success: true,
                    data: embeddingResult.data,
                    model: embeddingResult.model,
                    processingTime: embeddingResult.processingTime,
                    cached: embeddingResult.cached || false,
                    mock: !isRealEmbedding,
                    memoryId,
                    savedToDatabase: !!memoryId,
                });
            }
            catch (error) {
                log.error('Vision embedding endpoint error', LogContext.API, { error });
                return res.status(500).json({
                    success: false,
                    error: 'Vision embedding failed',
                    details: error instanceof Error ? error.message : String(error),
                });
            }
        });
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
                let queryEmbedding = null;
                try {
                    const { pyVisionBridge } = await import('./services/pyvision-bridge');
                    const imageData = imageBase64 || imagePath;
                    const result = await pyVisionBridge.generateEmbedding(imageData);
                    if (result.success && result.data) {
                        queryEmbedding = result.data.vector;
                        log.info('✅ Query embedding generated for search', LogContext.AI);
                    }
                }
                catch (error) {
                    log.warn('PyVision not available for search', LogContext.AI, { error });
                }
                if (!queryEmbedding) {
                    return res.status(400).json({
                        success: false,
                        error: 'Unable to generate embedding for search query',
                    });
                }
                const { data: searchResults, error: searchError } = await this.supabase.rpc('search_similar_images', {
                    query_embedding: queryEmbedding,
                    limit_count: limit,
                    threshold,
                });
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
            }
            catch (error) {
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
    async setupAgentRoutes() {
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
        const agentExecuteMiddlewares = [];
        if (process.env.ENABLE_CONTEXT === 'true') {
            import('./middleware/context-injection-middleware')
                .then((cim) => agentExecuteMiddlewares.push(cim.agentContextMiddleware()))
                .catch(() => undefined);
        }
        const agentExecuteValidators = [];
        try {
            const [{ z }, { zodValidate }] = await Promise.all([
                Promise.resolve().then(() => import('zod')),
                Promise.resolve().then(() => import('./middleware/zod-validate')),
            ]);
            agentExecuteValidators.push(zodValidate(z.object({
                agentName: z.string().min(1),
                userRequest: z.union([z.string(), z.record(z.any())]),
                context: z.record(z.any()).optional(),
                enqueue: z.boolean().optional(),
            })));
        }
        catch { }
        this.app.post('/api/v1/agents/execute', ...agentExecuteMiddlewares, intelligentParametersMiddleware(), ...agentExecuteValidators, async (req, res) => {
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
                    }
                    catch (e) {
                        return res.status(500).json({
                            success: false,
                            error: { code: 'QUEUE_ERROR', message: 'Failed to enqueue job' },
                        });
                    }
                }
                const agentContext = {
                    userRequest,
                    requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
                    workingDirectory: process.cwd(),
                    userId: req.user?.id || 'anonymous',
                    ...context,
                };
                const timeoutMs = Number(process.env.AGENT_EXECUTE_TIMEOUT_MS || 15000);
                const execPromise = this.agentRegistry.processRequest(agentName, agentContext);
                const result = await Promise.race([
                    execPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Agent execution timeout')), timeoutMs)),
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
            }
            catch (error) {
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
        });
        const agentParallelMiddlewares = [];
        if (process.env.ENABLE_CONTEXT === 'true') {
            import('./middleware/context-injection-middleware')
                .then((cim) => agentParallelMiddlewares.push(cim.agentContextMiddleware()))
                .catch(() => undefined);
        }
        const agentParallelValidators = [];
        try {
            const [{ z }, { zodValidate }] = await Promise.all([
                Promise.resolve().then(() => import('zod')),
                Promise.resolve().then(() => import('./middleware/zod-validate')),
            ]);
            agentParallelValidators.push(zodValidate(z.object({
                agentRequests: z
                    .array(z.object({
                    agentName: z.string().min(1),
                    userRequest: z.union([z.string(), z.record(z.any())]),
                    context: z.record(z.any()).optional(),
                }))
                    .min(1),
            })));
        }
        catch { }
        this.app.post('/api/v1/agents/parallel', ...agentParallelMiddlewares, ...agentParallelValidators, async (req, res) => {
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
                const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
                const userId = req.user?.id || 'anonymous';
                const parallelRequests = agentRequests.map((request) => ({
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
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Parallel agent execution timeout')), timeoutMs)),
                ]));
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
            }
            catch (error) {
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
        });
        const agentOrchestrateMiddlewares = [];
        if (process.env.ENABLE_CONTEXT === 'true') {
            import('./middleware/context-injection-middleware')
                .then((cim) => agentOrchestrateMiddlewares.push(cim.agentContextMiddleware()))
                .catch(() => undefined);
        }
        const agentOrchestrateValidators = [];
        try {
            const [{ z }, { zodValidate }] = await Promise.all([
                Promise.resolve().then(() => import('zod')),
                Promise.resolve().then(() => import('./middleware/zod-validate')),
            ]);
            agentOrchestrateValidators.push(zodValidate(z.object({
                primaryAgent: z.string().min(1),
                supportingAgents: z.array(z.string()).default([]),
                userRequest: z.union([z.string(), z.record(z.any())]),
                context: z.record(z.any()).optional(),
            })));
        }
        catch { }
        this.app.post('/api/v1/agents/orchestrate', ...agentOrchestrateMiddlewares, ...agentOrchestrateValidators, async (req, res) => {
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
                const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
                const orchestrationContext = {
                    userRequest,
                    requestId,
                    workingDirectory: process.cwd(),
                    userId: req.user?.id || 'anonymous',
                    ...context,
                };
                const startTime = Date.now();
                const results = await this.agentRegistry.orchestrateAgents(primaryAgent, supportingAgents, orchestrationContext);
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
            }
            catch (error) {
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
        });
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
            }
            catch (error) {
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
    setupWebSocket() {
        try {
            this.io = new SocketIOServer(this.server, {
                cors: {
                    origin: (origin, callback) => {
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
                socket.on('ping', () => {
                    socket.emit('pong', { timestamp: new Date().toISOString() });
                });
            });
            import('./services/device-auth-websocket')
                .then(({ deviceAuthWebSocket }) => {
                deviceAuthWebSocket.initialize(this.server, '/ws/device-auth');
                log.info('✅ Device Auth WebSocket initialized', LogContext.WEBSOCKET);
            })
                .catch((error) => {
                log.error('❌ Failed to initialize Device Auth WebSocket', LogContext.WEBSOCKET, {
                    error: error instanceof Error ? error.message : String(error),
                });
            });
            import('./services/athena-websocket.js')
                .then(({ athenaWebSocket }) => {
                this.io?.of('/athena').on('connection', (socket) => {
                    const mockWs = {
                        send: (data) => socket.emit('message', data),
                        close: () => socket.disconnect(),
                        on: (event, handler) => socket.on(event, handler),
                        readyState: 1,
                    };
                    const mockReq = {
                        headers: socket.handshake.headers,
                        url: socket.handshake.url,
                    };
                    athenaWebSocket.handleConnection(mockWs, mockReq);
                    socket.on('message', (data) => {
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
                athenaWebSocket.startHeartbeat();
                athenaWebSocket.startStatusUpdates();
                log.info('✅ Athena WebSocket initialized', LogContext.WEBSOCKET);
            })
                .catch((error) => {
                log.error('❌ Failed to initialize Athena WebSocket', LogContext.WEBSOCKET, {
                    error: error instanceof Error ? error.message : String(error),
                });
            });
            this.wss = new WebSocketServer({
                server: this.server,
                path: '/api/v1/ws'
            });
            this.wss.on('connection', (ws, req) => {
                log.info(`Raw WebSocket client connected from ${req.socket.remoteAddress}`, LogContext.WEBSOCKET);
                ws.send(JSON.stringify({
                    type: 'connection',
                    data: {
                        message: 'Connected to Universal AI Tools',
                        timestamp: new Date().toISOString()
                    }
                }));
                ws.on('ping', () => {
                    ws.pong();
                });
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleWebSocketMessage(ws, message);
                    }
                    catch (error) {
                        log.error('Invalid WebSocket message', LogContext.WEBSOCKET, { error });
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Invalid JSON message' }
                        }));
                    }
                });
                ws.on('close', () => {
                    log.info('Raw WebSocket client disconnected', LogContext.WEBSOCKET);
                });
                ws.on('error', (error) => {
                    log.error('WebSocket connection error', LogContext.WEBSOCKET, { error });
                });
            });
            log.info('✅ WebSocket server initialized', LogContext.WEBSOCKET);
        }
        catch (error) {
            log.error('❌ Failed to initialize WebSocket server', LogContext.WEBSOCKET, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    handleWebSocketMessage(ws, message) {
        switch (message.type) {
            case 'ping':
                ws.send(JSON.stringify({
                    type: 'pong',
                    data: { timestamp: new Date().toISOString() }
                }));
                break;
            case 'subscribe_agent_updates':
                ws.send(JSON.stringify({
                    type: 'subscription_confirmed',
                    data: { subscription: 'agent_updates' }
                }));
                break;
            case 'subscribe_metrics':
                ws.send(JSON.stringify({
                    type: 'subscription_confirmed',
                    data: { subscription: 'metrics' }
                }));
                this.sendMetricsUpdate(ws);
                break;
            case 'chat_message':
                this.handleWebSocketChatMessage(ws, message.data);
                break;
            default:
                log.warn(`Unknown WebSocket message type: ${message.type}`, LogContext.WEBSOCKET);
                ws.send(JSON.stringify({
                    type: 'error',
                    data: { message: `Unknown message type: ${message.type}` }
                }));
        }
    }
    async handleWebSocketChatMessage(ws, data) {
        try {
            const { message, conversationId, agentName = 'personal_assistant' } = data;
            if (!message || typeof message !== 'string') {
                ws.send(JSON.stringify({
                    type: 'error',
                    data: { message: 'Invalid chat message format' }
                }));
                return;
            }
            const userId = 'websocket_user';
            const { agentRegistry } = global;
            if (!agentRegistry) {
                ws.send(JSON.stringify({
                    type: 'chat_response',
                    data: {
                        message: 'AI service is currently initializing. Please try again in a moment.',
                        error: 'Service unavailable',
                        timestamp: new Date().toISOString()
                    }
                }));
                return;
            }
            const startTime = Date.now();
            let result;
            try {
                const availableAgents = agentRegistry.getAvailableAgents();
                const agentExists = availableAgents.some((agent) => agent.name === agentName);
                if (!agentExists) {
                    result = {
                        response: `I'm here to help! The ${agentName} agent is currently being initialized. How can I assist you today?`,
                        confidence: 0.8,
                        success: true,
                        reasoning: 'Fallback response while agents are loading',
                    };
                }
                else {
                    const agent = await agentRegistry.getAgent(agentName);
                    if (!agent) {
                        result = {
                            response: `I'm experiencing some technical difficulties with the ${agentName} agent, but I'm still here to help! Please try again in a moment.`,
                            confidence: 0.5,
                            success: false,
                            error: 'Agent failed to initialize',
                        };
                    }
                    else {
                        const agentContext = {
                            userRequest: message,
                            requestId: `ws-${Date.now()}`,
                            workingDirectory: process.cwd(),
                            userId,
                            conversationHistory: [],
                        };
                        result = await agentRegistry.processRequest(agentName, agentContext);
                    }
                }
            }
            catch (agentError) {
                log.error('WebSocket agent processing failed', LogContext.WEBSOCKET, {
                    error: agentError instanceof Error ? agentError.message : String(agentError),
                    agentName,
                });
                result = {
                    response: "I'm experiencing some technical difficulties, but I'm still here to help! Please try again in a moment.",
                    confidence: 0.5,
                    success: false,
                    error: agentError instanceof Error ? agentError.message : 'Unknown error',
                };
            }
            if (!result || !result.response) {
                result = {
                    response: "Hello! I'm your AI assistant. How can I help you today?",
                    confidence: 0.7,
                    success: true,
                    reasoning: 'Basic fallback response',
                };
            }
            const executionTime = Date.now() - startTime;
            ws.send(JSON.stringify({
                type: 'chat_response',
                data: {
                    message: result.response || result.data || 'I apologize, but I was unable to generate a response.',
                    confidence: result.confidence || 0.5,
                    agentName,
                    conversationId,
                    executionTime: `${executionTime}ms`,
                    timestamp: new Date().toISOString(),
                    success: result.success !== false,
                    error: result.error,
                }
            }));
        }
        catch (error) {
            log.error('WebSocket chat message error', LogContext.WEBSOCKET, {
                error: error instanceof Error ? error.message : String(error),
            });
            ws.send(JSON.stringify({
                type: 'error',
                data: {
                    message: 'Failed to process chat message',
                    timestamp: new Date().toISOString()
                }
            }));
        }
    }
    async sendMetricsUpdate(ws) {
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const loadAvg = os.loadavg();
            const metrics = {
                cpuUsage: loadAvg?.[0] ? loadAvg[0] * 10 : 0,
                memoryUsage: (usedMem / totalMem) * 100,
                uptime: os.uptime(),
                requestsPerMinute: 0,
                activeConnections: this.wss?.clients.size || 0
            };
            ws.send(JSON.stringify({
                type: 'metrics_update',
                data: metrics
            }));
        }
        catch (error) {
            log.error('Failed to send metrics update', LogContext.WEBSOCKET, { error });
        }
    }
    broadcastUpdate(type, data) {
        if (!this.wss)
            return;
        const message = JSON.stringify({ type, data });
        this.wss.clients.forEach((client) => {
            if (client.readyState === 1) {
                client.send(message);
            }
        });
    }
    setupHealthRoutes() {
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
                            if (overall > 0.7)
                                return 'healthy';
                            if (overall > 0.4)
                                return 'degraded';
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
            }
            catch (error) {
                log.error('Health check failed', LogContext.API, { error });
                res.status(500).json({
                    success: false,
                    error: 'Health check failed',
                });
            }
        });
        this.app.get('/api/v1/health/history', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit, 10) || 20;
                const history = healthMonitor.getHealthHistory(limit);
                res.json({
                    success: true,
                    data: {
                        history,
                        count: history.length,
                    },
                });
            }
            catch (error) {
                log.error('Health history retrieval failed', LogContext.API, { error });
                res.status(500).json({
                    success: false,
                    error: 'Health history retrieval failed',
                });
            }
        });
        this.app.post('/api/v1/health/check', async (req, res) => {
            try {
                const health = await healthMonitor.forceHealthCheck();
                res.json({
                    success: true,
                    data: health,
                    message: 'Health check completed',
                });
            }
            catch (error) {
                log.error('Forced health check failed', LogContext.API, { error });
                res.status(500).json({
                    success: false,
                    error: 'Health check failed',
                });
            }
        });
        this.app.post('/api/v1/health/heal', async (req, res) => {
            try {
                await healthMonitor.forceSelfHealing();
                const summary = healthMonitor.getHealthSummary();
                res.json({
                    success: true,
                    data: summary,
                    message: 'Self-healing completed',
                });
            }
            catch (error) {
                log.error('Forced self-healing failed', LogContext.API, { error });
                res.status(500).json({
                    success: false,
                    error: 'Self-healing failed',
                });
            }
        });
        log.info('✅ Health monitoring endpoints configured', LogContext.API);
    }
    async setupErrorHandling() {
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
        this.app.use(errorTrackingService.errorHandler());
        const { globalErrorHandler } = await import('./middleware/global-error-handler');
        this.app.use(globalErrorHandler);
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
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        log.info('✅ Error handling setup completed', LogContext.SERVER);
    }
    async gracefulShutdown(signal) {
        if (this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        log.info(`Received ${signal}, shutting down gracefully...`, LogContext.SYSTEM);
        try {
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(() => {
                        log.info('HTTP server closed', LogContext.SERVER);
                        resolve();
                    });
                });
            }
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
            if (this.agentRegistry) {
                await this.agentRegistry.shutdown();
            }
            await healthMonitor.shutdown();
            try {
                await mcpIntegrationService.shutdown();
                log.info('✅ MCP service shut down', LogContext.MCP);
            }
            catch (error) {
                log.warn('⚠️ Error shutting down MCP service', LogContext.MCP, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
            try {
                const { healthMonitor } = await import('./services/health-monitor');
                healthMonitor.stop();
                log.info('Health monitor stopped', LogContext.SYSTEM);
            }
            catch (error) {
            }
            log.info('Graceful shutdown completed', LogContext.SYSTEM);
            if (signal !== 'test' && process.env.NODE_ENV !== 'test') {
                process.exit(0);
            }
            return;
        }
        catch (error) {
            log.error('Error during shutdown', LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
            if (signal !== 'test' && process.env.NODE_ENV !== 'test') {
                process.exit(1);
            }
        }
    }
    async start() {
        try {
            validateConfig();
            await this.initializeServices();
            log.info('✅ All services initialized successfully', LogContext.SERVER);
            await this.setupRoutesSync();
            await this.loadAsyncRoutes();
            log.info('✅ All async routes loaded successfully', LogContext.SERVER);
            try {
                const shouldEnableGraphQL = process.env.ENABLE_GRAPHQL === 'true' ||
                    (process.env.NODE_ENV !== 'production' && process.env.ENABLE_GRAPHQL !== 'false');
                if (shouldEnableGraphQL) {
                    const { mountGraphQL } = await import('./graphql/server');
                    await mountGraphQL(this.app);
                    log.info('✅ GraphQL server mounted at /graphql', LogContext.API);
                }
                else {
                    log.info('🧪 GraphQL disabled by configuration', LogContext.API);
                }
            }
            catch (error) {
                log.warn('⚠️ GraphQL server not mounted', LogContext.API, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
            if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_MCP !== 'true') {
                await this.initializeMCPService();
            }
            else {
                log.info('🧪 Skipping MCP init in tests or when disabled', LogContext.MCP);
            }
            await this.setupErrorHandling();
            log.info('✅ Error handling setup completed (after route loading)', LogContext.SERVER);
            const desiredPort = Number(process.env.PORT) || config.port || 9999;
            const port = process.env.NODE_ENV === 'test' ? 0 : desiredPort;
            await new Promise((resolve, reject) => {
                this.server
                    .listen(port, () => {
                    const address = this.server.address();
                    const actualPort = address && typeof address === 'object' ? address.port : port;
                    log.info(`🚀 Universal AI Tools Service running on port ${actualPort}`, LogContext.SERVER, {
                        environment: config.environment,
                        port: actualPort,
                        healthCheck: `http://localhost:${actualPort}/health`,
                    });
                    resolve();
                })
                    .on('error', reject);
            });
        }
        catch (error) {
            log.error('❌ Failed to start server', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
            process.exit(1);
        }
    }
    getApp() {
        return this.app;
    }
    getSupabase() {
        return this.supabase;
    }
    async testShutdown() {
        await this.gracefulShutdown('test');
    }
    async loadAsyncRoutes() {
        try {
            const monitoringModule = await import('./routers/monitoring');
            this.app.use('/api/v1/monitoring', monitoringModule.default);
            log.info('✅ Monitoring routes loaded', LogContext.SERVER);
            const errorMonitoringModule = await import('./routers/error-monitoring');
            this.app.use('/api/v1/monitoring', errorMonitoringModule.default);
            log.info('✅ Error monitoring routes loaded', LogContext.SERVER);
            if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_BACKGROUND_JOBS !== 'true') {
                const { healthMonitor } = await import('./services/health-monitor');
                await healthMonitor.start();
                log.info('✅ Health monitor service started', LogContext.SERVER);
            }
            else {
                log.info('🧪 Skipping health monitor start in tests or when disabled', LogContext.SERVER);
            }
        }
        catch (error) {
            log.warn('⚠️ Monitoring routes failed to load', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const chatModule = await import('./routers/chat');
            this.app.use('/api/v1/chat', chatModule.default);
            global.agentRegistry = this.agentRegistry;
            log.info('✅ Chat routes loaded with context injection', LogContext.SERVER);
        }
        catch (error) {
            log.warn('⚠️ Chat routes failed to load', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const memoryModule = await import('./routers/memory');
            this.app.use('/api/v1/memory', memoryModule.default);
            log.info('✅ Memory routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.warn('⚠️ Memory routes failed to load', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const errorsModule = await import('./routers/errors');
            this.app.use('/api/v1/errors', errorsModule.default);
            log.info('✅ Errors routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.warn('⚠️ Errors routes failed to load', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const deviceAuthModule = await import('./routers/device-auth');
            this.app.use('/api/v1/device-auth', deviceAuthModule.default);
            log.info('✅ Device authentication routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.warn('⚠️ Device auth routes failed to load', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('📱 Loading mobile orchestration router...', LogContext.SERVER);
            const mobileOrchestrationModule = await import('./routers/mobile-orchestration.js');
            this.app.use('/api/v1/mobile-orchestration', mobileOrchestrationModule.default);
            log.info('✅ Mobile orchestration routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load mobile orchestration router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🏛️ Loading Athena router...', LogContext.SERVER);
            const athenaModule = await import('./routers/athena');
            this.app.use('/api/v1/athena', athenaModule.default);
            log.info('✅ Athena routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load Athena router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const abMCTSModule = await import('./routers/ab-mcts-fixed');
            log.info('📦 AB-MCTS module imported successfully', LogContext.SERVER, {
                hasDefault: !!abMCTSModule.default,
                moduleType: typeof abMCTSModule.default,
            });
            if (abMCTSModule.default) {
                this.app.use('/api/v1/ab-mcts', abMCTSModule.default);
                const mountedRoutes = this.app._router?.stack?.filter((layer) => layer.regexp?.test('/api/v1/ab-mcts'));
                log.info('✅ AB-MCTS orchestration endpoints loaded', LogContext.SERVER, {
                    routesMounted: mountedRoutes?.length || 0,
                });
            }
            else {
                log.error('❌ AB-MCTS module has no default export', LogContext.SERVER);
            }
        }
        catch (error) {
            log.error('❌ Failed to load AB-MCTS router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
        try {
            const visionModule = await import('./routers/vision');
            this.app.use('/api/v1/vision', visionModule.default);
            log.info('✅ Vision routes loaded', LogContext.SERVER);
            if (!config.offlineMode) {
                await import('./services/pyvision-bridge');
                log.info('✅ PyVision service initialized for embeddings', LogContext.AI);
            }
            else {
                log.info('🧪 Offline mode - skipping PyVision initialization', LogContext.AI);
            }
        }
        catch (error) {
            log.warn('⚠️ Vision routes failed to load', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const visionDebugModule = await import('./routers/vision-debug-simple');
            this.app.use('/api/v1/vision-debug', visionDebugModule.default);
            log.info('✅ Vision Debug routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.warn('⚠️ Vision Debug routes failed to load', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        if (!config.disableExternalCalls && !config.offlineMode) {
            try {
                const huggingFaceModule = await import('./routers/huggingface');
                this.app.use('/api/v1/huggingface', huggingFaceModule.default);
                log.info('✅ HuggingFace routes loaded (using LM Studio adapter)', LogContext.SERVER);
            }
            catch (error) {
                log.warn('⚠️ HuggingFace routes failed to load', LogContext.SERVER, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        else {
            log.info('🌐 External calls disabled - skipping HuggingFace routes', LogContext.SERVER);
        }
        try {
            const mlxModule = await import('./routers/mlx');
            this.app.use('/api/v1/mlx', mlxModule.default);
            log.info('✅ MLX routes loaded for Apple Silicon ML', LogContext.SERVER);
            const { mlxService } = await import('./services/mlx-service');
            const isAppleSilicon = process.arch === 'arm64' && process.platform === 'darwin';
            if (!isAppleSilicon) {
                log.warn('⚠️ MLX is optimized for Apple Silicon but running on different platform', LogContext.AI, {
                    platform: process.platform,
                    arch: process.arch,
                });
            }
            const healthCheck = await mlxService.healthCheck();
            if (healthCheck.healthy) {
                log.info('✅ MLX service initialized successfully', LogContext.AI, {
                    platform: process.platform,
                    arch: process.arch,
                    optimized: isAppleSilicon,
                });
            }
            else {
                log.warn('⚠️ MLX service loaded but health check failed', LogContext.AI, {
                    error: healthCheck.error || 'Unknown health check failure',
                    platform: process.platform,
                    arch: process.arch,
                });
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error('❌ Failed to load MLX routes', LogContext.SERVER, {
                error: errorMessage,
                platform: process.platform,
                arch: process.arch,
                suggestion: 'MLX requires Apple Silicon hardware and proper Python environment',
            });
            log.info('🔄 Server continuing without MLX capabilities', LogContext.SERVER);
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
        try {
            const systemMetricsModule = await import('./routers/system-metrics');
            this.app.use('/api/v1/system', systemMetricsModule.default);
            log.info('✅ System metrics routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.warn('⚠️ System metrics routes failed to load', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🔄 Loading MCP agent management router...', LogContext.SERVER);
            const mcpAgentModule = await import('./routers/mcp-agent');
            log.info('✅ MCP agent module imported successfully', LogContext.SERVER, {
                hasDefault: !!mcpAgentModule.default,
                moduleType: typeof mcpAgentModule.default,
            });
            this.app.use('/api/v1/mcp', mcpAgentModule.default);
            log.info('✅ MCP agent management routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load MCP agent management router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🏛️ Loading Athena router...', LogContext.SERVER);
            const athenaModule = await import('./routers/athena');
            log.info('✅ Athena module imported successfully', LogContext.SERVER, {
                hasDefault: !!athenaModule.default,
                moduleType: typeof athenaModule.default,
            });
            this.app.use('/api/v1/athena', athenaModule.default);
            log.info('✅ Athena routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load Athena router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🤖 Loading AI Assistant router...', LogContext.SERVER);
            const assistantModule = await import('./routers/assistant');
            log.info('✅ AI Assistant module imported successfully', LogContext.SERVER, {
                hasDefault: !!assistantModule.default,
                moduleType: typeof assistantModule.default,
            });
            this.app.use('/api/v1/assistant', assistantModule.default);
            log.info('✅ AI Assistant routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load AI Assistant router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🎯 Loading Models router...', LogContext.SERVER);
            const modelsModule = await import('./routers/models');
            log.info('✅ Models module imported successfully', LogContext.SERVER, {
                hasDefault: !!modelsModule.default,
                moduleType: typeof modelsModule.default,
            });
            this.app.use('/api/v1/models', modelsModule.default);
            log.info('✅ Models routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load Models router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🎓 Loading Training router...', LogContext.SERVER);
            const trainingModule = await import('./routers/training');
            log.info('✅ Training module imported successfully', LogContext.SERVER, {
                hasDefault: !!trainingModule.default,
                moduleType: typeof trainingModule.default,
            });
            this.app.use('/api/v1/training', trainingModule.default);
            log.info('✅ Training routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load Training router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🍎 Loading MLX Fine-Tuning router...', LogContext.SERVER);
            const mlxFineTuningModule = await import('./routers/mlx-fine-tuning');
            log.info('✅ MLX Fine-Tuning module imported successfully', LogContext.SERVER, {
                hasDefault: !!mlxFineTuningModule.default,
                moduleType: typeof mlxFineTuningModule.default,
            });
            this.app.use('/api/v1/mlx-fine-tuning', mlxFineTuningModule.default);
            log.info('✅ MLX Fine-Tuning router mounted at /api/v1/mlx-fine-tuning', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load MLX Fine-Tuning router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🧠 Loading User Preferences router...', LogContext.SERVER);
            const userPreferencesModule = await import('./routers/user-preferences');
            log.info('✅ User Preferences module imported successfully', LogContext.SERVER, {
                hasDefault: !!userPreferencesModule.default,
                moduleType: typeof userPreferencesModule.default,
            });
            this.app.use('/api/v1/user-preferences', userPreferencesModule.default);
            log.info('✅ User Preferences router mounted at /api/v1/user-preferences', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load User Preferences router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('⚡ Loading FlashAttention router...', LogContext.SERVER);
            const flashAttentionModule = await import('./routers/flash-attention');
            log.info('✅ FlashAttention module imported successfully', LogContext.SERVER, {
                hasDefault: !!flashAttentionModule.default,
                moduleType: typeof flashAttentionModule.default,
            });
            this.app.use('/api/v1/flash-attention', flashAttentionModule.default);
            log.info('✅ FlashAttention router mounted at /api/v1/flash-attention', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load FlashAttention router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('📝 Loading Feedback Collection router...', LogContext.SERVER);
            const feedbackModule = await import('./routers/feedback');
            log.info('✅ Feedback module imported successfully', LogContext.SERVER, {
                hasDefault: !!feedbackModule.default,
                moduleType: typeof feedbackModule.default,
            });
            this.app.use('/api/v1/feedback', feedbackModule.default);
            log.info('✅ Feedback router mounted at /api/v1/feedback', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load Feedback router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        log.info('🔐 Loading Authentication router...', LogContext.SERVER);
        try {
            const authModule = await import('./routers/auth');
            log.info('✅ Authentication module imported successfully', LogContext.SERVER, {
                hasDefault: !!authModule.default,
                moduleType: typeof authModule.default,
            });
            this.app.use('/api/v1/auth', authModule.default);
            log.info('✅ Authentication router mounted at /api/v1/auth', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load Authentication router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        log.info('📊 Loading Parameters router...', LogContext.SERVER);
        try {
            const parametersModule = await import('./routers/parameters');
            log.info('✅ Parameters module imported successfully', LogContext.SERVER, {
                hasDefault: !!parametersModule.default,
                moduleType: typeof parametersModule.default,
            });
            this.app.use('/api/v1/parameters', parametersModule.default);
            log.info('✅ Parameters router mounted at /api/v1/parameters', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load Parameters router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🔄 Loading secrets management router...', LogContext.SERVER);
            const secretsModule = await import('./routers/secrets');
            log.info('✅ Secrets module imported successfully', LogContext.SERVER, {
                hasDefault: !!secretsModule.default,
                moduleType: typeof secretsModule.default,
            });
            this.app.use('/api/v1/secrets', secretsModule.default);
            log.info('✅ Secrets management routes loaded', LogContext.SERVER);
            const routes = this.app._router?.stack?.length || 0;
            log.info('📊 Express router stack info', LogContext.SERVER, {
                totalRoutes: routes,
                secretsRouterAdded: true,
            });
        }
        catch (error) {
            log.error('❌ Failed to load secrets management router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🎯 Loading AB-MCTS router...', LogContext.SERVER);
            const abMctsModule = await import('./routers/ab-mcts');
            log.info('✅ AB-MCTS module imported successfully', LogContext.SERVER, {
                hasDefault: !!abMctsModule.default,
                moduleType: typeof abMctsModule.default,
            });
            this.app.use('/api/v1/ab-mcts', abMctsModule.default);
            log.info('✅ AB-MCTS routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load AB-MCTS router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
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
            }
            catch (error) {
                log.error('❌ Failed to load knowledge scraper router', LogContext.SERVER, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        else {
            log.info('🌐 External calls disabled - skipping knowledge scraper routes', LogContext.SERVER);
        }
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
            }
            catch (error) {
                log.error('❌ Failed to load knowledge ingestion router', LogContext.SERVER, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        else {
            log.info('🌐 External calls disabled - skipping knowledge ingestion routes', LogContext.SERVER);
        }
        try {
            log.info('📚 Loading context storage router...', LogContext.SERVER);
            const contextModule = await import('./routers/context');
            log.info('✅ Context module imported successfully', LogContext.SERVER, {
                hasDefault: !!contextModule.default,
                moduleType: typeof contextModule.default,
            });
            this.app.use('/api/v1/context', contextModule.default);
            log.info('✅ Context storage routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load context storage router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🎤 Loading speech router...', LogContext.SERVER);
            const speechModule = await import('./routers/speech');
            this.app.use('/api/speech', speechModule.default);
            log.info('✅ Speech router mounted at /api/speech', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load speech router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
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
            }
            catch (error) {
                log.error('❌ Failed to load External APIs router', LogContext.SERVER, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        else {
            log.info('🌐 External calls disabled - skipping External APIs router', LogContext.SERVER);
        }
        try {
            log.info('🔄 Loading Self-Optimization router...', LogContext.SERVER);
            const selfOptimizationModule = await import('./routers/self-optimization');
            log.info('✅ Self-Optimization module imported successfully', LogContext.SERVER, {
                hasDefault: !!selfOptimizationModule.default,
                moduleType: typeof selfOptimizationModule.default,
            });
            this.app.use('/api/v1/self-optimization', selfOptimizationModule.default);
            log.info('✅ Self-Optimization routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load Self-Optimization router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            log.info('🤖 Loading autonomous actions router...', LogContext.SERVER);
            const autonomousActionsModule = await import('./routers/autonomous-actions');
            this.app.use('/api/v1/autonomous-actions', autonomousActionsModule.default);
            log.info('✅ Autonomous actions router mounted at /api/v1/autonomous-actions', LogContext.SERVER);
        }
        catch (error) {
            log.error('❌ Failed to load autonomous actions router', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const metricsRouter = (await import('./routers/metrics')).default;
            this.app.use('/api/v1/agents/metrics', metricsRouter);
            log.info('✅ Metrics/feedback routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.warn('⚠️ Metrics routes failed to load', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const factsRouter = (await import('./routers/verified-facts')).default;
            this.app.use('/api/v1/verified-facts', factsRouter);
            log.info('✅ Verified facts routes loaded', LogContext.SERVER);
        }
        catch (error) {
            log.warn('⚠️ Verified facts routes failed to load', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_BACKGROUND_JOBS !== 'true') {
                const { startFactsValidator } = await import('./services/verified-facts-validator');
                startFactsValidator();
                log.info('✅ Verified facts validator started', LogContext.SERVER);
            }
        }
        catch (error) {
            log.warn('⚠️ Verified facts validator not started', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_BACKGROUND_JOBS !== 'true') {
                const { startMemoryScheduler } = await import('./services/memory-scheduler');
                startMemoryScheduler();
                log.info('✅ Memory scheduler started', LogContext.SERVER);
            }
        }
        catch (error) {
            log.warn('⚠️ Memory scheduler not started', LogContext.SERVER, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
(async () => {
    const isCJS = typeof require !== 'undefined' && typeof module !== 'undefined';
    const isDirectCJS = isCJS && require.main === module;
    const isTest = process.env.NODE_ENV === 'test';
    const isESMDev = process.env.NODE_ENV !== 'production' && !isTest && process.env.TSX_DEV !== 'false';
    if (!isTest && (isDirectCJS || isESMDev)) {
        const server = new UniversalAIToolsServer();
        await server.start();
    }
})();
export default UniversalAIToolsServer;
export { UniversalAIToolsServer };
//# sourceMappingURL=server.js.map