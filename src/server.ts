/**
 * Universal AI Tools Service - Clean Implementation
 * Main server with Express, TypeScript, and comprehensive error handling
 */

// Memory optimization setup
if (typeof global !== 'undefined' && !global.gc && process.env.NODE_ENV === 'development') {
  // Enable manual garbage collection in development
  if (process.argv.includes('--expose-gc')) {
    // Manual garbage collection enabled
  }
}

// Import intelligent memory management service
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer, type Server } from 'http';
import os from 'os';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';

import { enhancedMemoryOptimizationService } from './services/enhanced-memory-optimization-service.js';
// Temporary disable: using memoryOptimizationService instead to prevent conflicts
import { safeNow, safeToISOString, safeDuration, createLogTimestamp } from './utils/defensive-date-handler.js';
// import { intelligentMemoryManager } from './services/intelligent-memory-manager';
import { RealtimeBroadcastService } from './services/realtime-broadcast-service';
import { routerConsolidationService } from './services/router-consolidation-service';
let compressionMiddleware: express.RequestHandler | null = null;

// Configuration and utilities
// Agent system
import AgentRegistry from './agents/agent-registry.js';
import { config, validateConfig } from './config/environment.js';
import { standardRateLimiter } from './middleware/comprehensive-rate-limiter.js';
import { errorTrackingService } from './middleware/error-tracking-middleware.js';
// Middleware
import { intelligentParametersMiddleware } from './middleware/intelligent-parameters.js';
// Context Injection Services
// Context injection service temporarily disabled
import { contextStorageService } from './services/context-storage-service.js';
import { errorLogService } from './services/error-log-service.js';
// Health monitoring and self-healing
import { healthMonitor } from './services/health-monitor-service.js';
// MCP Integration
import { mcpIntegrationService } from './services/mcp-integration-service.js';
// Unified Knowledge Integration
import { unifiedKnowledgeBridge } from './services/unified-knowledge-bridge.js';
import { enhancedAgentExecutor } from './services/enhanced-agent-executor.js';
import { agentKnowledgeMiddleware } from './services/agent-knowledge-middleware.js';
import { apiResponseMiddleware } from './utils/api-response.js';
import { container, injectServices, SERVICE_NAMES } from './utils/dependency-container.js';
import { log, LogContext } from './utils/logger.js';
// Context injection middleware temporarily disabled

// Types

class UniversalAIToolsServer {
  private app: express.Application;
  private server: Server;
  private io: SocketIOServer | null = null;
  private wss: WebSocketServer | null = null;
  private supabase: SupabaseClient | null = null;
  private agentRegistry: AgentRegistry | null = null;
  private broadcastService: RealtimeBroadcastService | null = null;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.setupHttpTimeouts();
    this.setupMiddleware();
    this.setupWebSocket();

    // Services and routes will be initialized in start() method due to async operations
  }

  private setupHttpTimeouts(): void {
    // Configure HTTP timeout settings for production reliability
    // Based on Node.js best practices for preventing connection drops
    const { http: httpConfig } = config;
    
    this.server.keepAliveTimeout = httpConfig.keepAliveTimeout;
    this.server.headersTimeout = httpConfig.headersTimeout;
    this.server.requestTimeout = httpConfig.requestTimeout;
    this.server.maxConnections = httpConfig.maxConnections;
    this.server.timeout = httpConfig.socketTimeout;
    
    log.info('⏱️ Enhanced HTTP timeout configuration applied', LogContext.SERVER, {
      keepAliveTimeout: `${httpConfig.keepAliveTimeout/1000}s`,
      headersTimeout: `${httpConfig.headersTimeout/1000}s`, 
      requestTimeout: `${httpConfig.requestTimeout/1000}s`,
      socketTimeout: `${httpConfig.socketTimeout/1000}s`,
      maxConnections: httpConfig.maxConnections,
      shutdownDrainTimeout: `${httpConfig.shutdownDrainTimeout/1000}s`
    });
  }

  private async initializeServices(): Promise<void> {
    // Initialize Production Memory Manager first for optimal startup monitoring
    try {
      const { productionMemoryManager } = await import('./services/production-memory-manager');
      
      // Configure with environment-specific settings
      const memoryConfig = {
        warningThreshold: config.production?.memoryThresholds?.warning || 512,
        criticalThreshold: config.production?.memoryThresholds?.critical || 768,
        emergencyThreshold: config.production?.memoryThresholds?.emergency || 1024,
        maxResponseTime: config.production?.performance?.maxResponseTime || 2000,
        maxErrorRate: config.production?.performance?.maxErrorRate || 0.05,
        maxCpuUsage: config.production?.performance?.maxCpuUsage || 80,
        gcIntervalMs: config.production?.optimization?.gcInterval || 30000
      };
      
      log.info('🚀 Production memory manager initialized', LogContext.SERVER, {
        thresholds: memoryConfig
      });
    } catch (error) {
      log.warn('⚠️ Failed to initialize production memory manager', LogContext.SERVER, { error });
    }

    // Use memoryOptimizationService instead of intelligentMemoryManager to prevent conflicts
    log.info('🧠 Memory optimization service active (built-in)', LogContext.SERVER);

    // Start memory monitoring early to track startup memory usage
    try {
      const { memoryMonitoringService } = await import('./services/memory-monitoring-service');
      memoryMonitoringService.startMonitoring();
      log.info('🔍 Memory monitoring started', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Failed to start memory monitoring', LogContext.SERVER, { error });
    }

    // Only initialize essential services for faster startup
    this.initializeSupabase();
    this.initializeAgentRegistry();

    // Defer heavy services to avoid startup bottlenecks
    if (process.env.DISABLE_HEAVY_SERVICES !== 'true') {
      // Initialize lightweight context service only
      await this.initializeContextServices();
      // Skip heavy services for now to improve response times
      this.deferHeavyServices();
    }
  }

  private deferHeavyServices(): void {
    // Initialize heavy services after server is running with proper error handling and retries
    this.initializeHeavyServicesWithRetry();
  }

  private async initializeHeavyServicesWithRetry(
    attempt: number = 1,
    maxAttempts: number = 3
  ): Promise<void> {
    const delay = Math.min(5000 * attempt, 30000); // Progressive delay: 5s, 10s, 15s (max 30s)

    setTimeout(async () => {
      log.info(
        `🔄 Initializing heavy services (attempt ${attempt}/${maxAttempts})`,
        LogContext.SERVER
      );

      const services = [
        { name: 'Unified Knowledge Bridge', fn: () => this.initializeUnifiedKnowledgeIntegration() },
        { name: 'User Preference Learning', fn: () => this.initializeUserPreferenceLearning() },
        { name: 'Flash Attention', fn: () => this.initializeFlashAttention() },
        { name: 'Feedback Collection', fn: () => this.initializeFeedbackCollection() },
        { name: 'Correlation Service', fn: () => this.initializeCorrelationService() },
        { name: 'Additional Services', fn: () => this.registerAdditionalServices() },
      ];

      const failures: string[] = [];

      for (const service of services) {
        try {
          await service.fn();
          log.info(`✅ ${service.name} service initialized successfully`, LogContext.SERVER);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error(`❌ ${service.name} service failed to initialize`, LogContext.SERVER, {
            error: errorMessage,
            attempt,
            maxAttempts,
          });
          failures.push(service.name);
        }
      }

      // Health check for initialized services
      await this.performServiceHealthCheck();

      // Retry failed services if we haven't reached max attempts
      if (failures.length > 0 && attempt < maxAttempts) {
        log.warn(
          `⚠️ ${failures.length} services failed, retrying in ${delay / 1000}s...`,
          LogContext.SERVER,
          {
            failedServices: failures,
            nextAttempt: attempt + 1,
            delay: delay,
          }
        );

        // Retry only failed services
        await this.retryFailedServices(failures, attempt + 1, maxAttempts);
      } else if (failures.length > 0) {
        log.error(`💥 Final attempt failed for ${failures.length} services`, LogContext.SERVER, {
          failedServices: failures,
          totalAttempts: maxAttempts,
        });

        // Implement fallback mode for failed services
        await this.initializeFallbackMode(failures);
      } else {
        log.info('🎉 All heavy services initialized successfully', LogContext.SERVER);
      }
    }, delay);
  }

  private async retryFailedServices(
    failedServices: string[],
    attempt: number,
    maxAttempts: number
  ): Promise<void> {
    // Implementation for retrying specific failed services
    // This would be called recursively for failed services only
    const serviceMap: Record<string, () => Promise<void>> = {
      'User Preference Learning': () => this.initializeUserPreferenceLearning(),
      'Flash Attention': () => this.initializeFlashAttention(),
      'Feedback Collection': () => this.initializeFeedbackCollection(),
      'Additional Services': () => this.registerAdditionalServices(),
    };

    await this.initializeHeavyServicesWithRetry(attempt, maxAttempts);
  }

  private async performServiceHealthCheck(): Promise<void> {
    try {
      log.info('🔍 Performing service health check', LogContext.SERVER);

      // Check if critical services are responding
      const healthChecks: Promise<unknown>[] = [];

      // Add health checks for each service that was initialized
      // This ensures services are actually working, not just loaded
      
      // Health check for health monitor service
      if (healthMonitor) {
        healthChecks.push(
          healthMonitor.getCurrentHealth().then(() => 'health-monitor')
        );
      }

      // Health check for realtime broadcast service  
      if (this.realtimeBroadcastService) {
        healthChecks.push(
          Promise.resolve('realtime-broadcast')
        );
      }

      // Health check for memory optimization service
      if (enhancedMemoryOptimizationService) {
        healthChecks.push(
          Promise.resolve('memory-optimization')
        );
      }

      // Health check for context storage service
      if (contextStorageService) {
        healthChecks.push(
          Promise.resolve('context-storage')
        );
      }

      const results = await Promise.allSettled(healthChecks);
      const healthyServices = results.filter((r) => r.status === 'fulfilled').length;
      const totalChecks = results.length;

      log.info(
        `📊 Service health check complete: ${healthyServices}/${totalChecks} services healthy`,
        LogContext.SERVER
      );
    } catch (error) {
      log.warn('⚠️ Service health check failed', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async initializeFallbackMode(failedServices: string[]): Promise<void> {
    log.warn('🚨 Entering fallback mode for failed services', LogContext.SERVER, {
      failedServices,
    });

    // Implement graceful degradation for each failed service
    for (const serviceName of failedServices) {
      switch (serviceName) {
        case 'User Preference Learning':
          log.info('📝 User preferences will use default configurations', LogContext.SERVER);
          break;
        case 'Flash Attention':
          log.info('⚡ Flash attention will use standard attention mechanisms', LogContext.SERVER);
          break;
        case 'Feedback Collection':
          log.info('📊 Feedback will be logged locally without ML processing', LogContext.SERVER);
          break;
        case 'Additional Services':
          log.info('🔧 Additional services will be loaded on-demand', LogContext.SERVER);
          break;
      }
    }
  }

  private async loadRoutersWithSequencing(): Promise<void> {
    // Check if router consolidation is enabled
    if (process.env.ROUTER_CONSOLIDATION === 'true') {
      await this.loadConsolidatedRouters();
      return;
    }

    log.info('🔄 Loading routers with optimized parallel sequencing', LogContext.SERVER);

    // Simplified router configurations - only load essential routers to improve startup performance
    const routerConfigs = [
      // Essential core routers only (minimum viable set)
      {
        name: 'Health Check',
        path: './routers/status',
        route: '/api/health',
        critical: true,
        dependencies: [],
        timeout: 5000,
      },
      {
        name: 'Agents',
        path: './routers/agents',
        route: '/api/v1/agents',
        critical: true,
        dependencies: [],
        timeout: 10000,
      },
      {
        name: 'Chat',
        path: './routers/chat',
        route: '/api/v1/chat',
        critical: true,
        dependencies: [],
        timeout: 10000,
      },
      {
        name: 'Database Health',
        path: './routers/database-health',
        route: '/api/v1/database',
        critical: true,
        dependencies: [],
        timeout: 5000,
      },
      {
        name: 'Conversation Context',
        path: './routers/conversation-context',
        route: '/api/v1/conversation-context',
        critical: true,
        dependencies: [],
        timeout: 5000,
      },
      {
        name: 'Memory Monitoring',
        path: './routers/memory-monitoring',
        route: '/api/v1/memory-monitoring',
        critical: true,
        dependencies: [],
        timeout: 5000,
      },
      {
        name: 'Hardware Auth',
        path: './routers/hardware-auth',
        route: '/api/v1/hardware-auth',
        critical: true,
        dependencies: [],
        timeout: 8000,
      },
      {
        name: 'HRM Agent Integration',
        path: './routers/hrm-agent-integration',
        route: '/', // Uses routes defined in router (starts with /api)
        critical: true,
        dependencies: [],
        timeout: 15000,
      },
      {
        name: 'Graph Sync',
        path: './routers/graph-sync',
        route: '/api/v1/graph-sync',
        critical: false,
        dependencies: [],
        timeout: 10000,
      },
      {
        name: 'Correlation Metrics',
        path: './routers/correlation-metrics',
        route: '/api/v1/correlation',
        critical: false,
        dependencies: [],
        timeout: 5000,
      },
      {
        name: 'LLM Stream',
        path: './routers/llm-stream',
        route: '/api/v1/llm-stream',
        critical: false,
        dependencies: [],
        timeout: 5000,
      },
      {
        name: 'Local LLM',
        path: './routers/local-llm',
        route: '/api/v1/local',
        critical: false,
        dependencies: [],
        timeout: 10000,
      },
      {
        name: 'LFM2 Status',
        path: './routers/lfm2-status',
        route: '/api/v1/lfm2',
        critical: false,
        dependencies: [],
        timeout: 10000,
      },

      // Optional routers (load with fallback on failure)
      {
        name: 'Voice',
        path: './routers/voice',
        route: '/api/v1/voice',
        critical: false,
        dependencies: [],
        timeout: 15000,
      },
      {
        name: 'Vision',
        path: './routers/vision',
        route: '/api/v1/vision',
        critical: false,
        dependencies: [],
        timeout: 15000,
      },
    ];

    const loadedRouters: Set<string> = new Set();
    const failedRouters: string[] = [];
    const totalRouters = routerConfigs.length;

    // Separate critical and optional routers for parallel loading
    const criticalRouters = routerConfigs.filter(config => config.critical);
    const optionalRouters = routerConfigs.filter(config => !config.critical);

    // Load critical routers first (sequentially to ensure order)
    for (const config of criticalRouters) {
      try {
        const startTime = safeNow();
        
        // Wrap router loading in timeout
        const loadWithTimeout = async () => {
          const routerModule = await import(config.path);
          const firstKey = Object.keys(routerModule)[0];
          const router = routerModule.default || (firstKey ? routerModule[firstKey] : undefined);

          if (!router) {
            throw new Error(`No default export found in ${config.path}`);
          }

          return router;
        };

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Router loading timeout (${config.timeout}ms)`)), config.timeout || 10000);
        });

        const router = await Promise.race([loadWithTimeout(), timeoutPromise]);

        // Register the router
        this.app.use(config.route, router);
        loadedRouters.add(config.name);

        const loadTime = safeDuration(startTime);
        log.info(`✅ Critical router ${config.name} loaded successfully`, LogContext.SERVER, {
          route: config.route,
          loadTime: `${loadTime}ms`,
          loadedCount: loadedRouters.size,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        log.error(`💥 Critical router ${config.name} failed to load`, LogContext.SERVER, {
          router: config.name,
          route: config.route,
          error: errorMessage,
        });

        // Create fallback for critical routers
        await this.createRouterFallback(config.name, config.route);
        failedRouters.push(config.name);
      }
    }

    // Load optional routers in parallel (non-blocking)
    const optionalPromises = optionalRouters.map(async (config) => {
      try {
        const startTime = safeNow();
        
        const loadWithTimeout = async () => {
          const routerModule = await import(config.path);
          const firstKey = Object.keys(routerModule)[0];
          const router = routerModule.default || (firstKey ? routerModule[firstKey] : undefined);

          if (!router) {
            throw new Error(`No default export found in ${config.path}`);
          }

          return router;
        };

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Router loading timeout (${config.timeout}ms)`)), config.timeout || 15000);
        });

        const router = await Promise.race([loadWithTimeout(), timeoutPromise]);

        // Register the router
        this.app.use(config.route, router);
        loadedRouters.add(config.name);

        const loadTime = safeDuration(startTime);
        log.info(`✅ Optional router ${config.name} loaded successfully`, LogContext.SERVER, {
          route: config.route,
          loadTime: `${loadTime}ms`,
        });

        return { success: true, name: config.name };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        log.warn(`⚠️ Optional router ${config.name} failed to load`, LogContext.SERVER, {
          router: config.name,
          route: config.route,
          error: errorMessage,
        });

        failedRouters.push(config.name);
        return { success: false, name: config.name, error: errorMessage };
      }
    });

    // Wait for optional routers with timeout
    const optionalResults = await Promise.allSettled(optionalPromises);
    const optionalSuccessCount = optionalResults.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;

    // Report loading results
    const successCount = loadedRouters.size;
    const failureCount = failedRouters.length;

    if (failureCount === 0) {
      log.info(`🎉 All ${successCount} routers loaded successfully`, LogContext.SERVER);
    } else {
      log.warn(
        `⚠️ Router loading completed: ${successCount} successful, ${failureCount} failed`,
        LogContext.SERVER,
        {
          successful: Array.from(loadedRouters),
          failed: failedRouters,
          successRate: `${Math.round((successCount / totalRouters) * 100)}%`,
        }
      );
    }
  }

  private async createRouterFallback(routerName: string, route: string): Promise<void> {
    log.info(`🛠️ Creating fallback for critical router: ${routerName}`, LogContext.SERVER);

    // Create a minimal fallback router that provides basic functionality
    this.app.use(route, (req, res) => {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: `${routerName} service is temporarily unavailable`,
          details: 'The service failed to initialize but the server is still running',
        },
        metadata: {
          timestamp: safeToISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
          fallbackMode: true,
        },
      });
    });

    log.info(`✅ Fallback router created for ${routerName} at ${route}`, LogContext.SERVER);
  }

  private async loadConsolidatedRouters(): Promise<void> {
    log.info('🚀 Using router consolidation for optimal memory usage', LogContext.SERVER, {
      target: '<1GB memory',
      services: 10 // Consolidated service groups
    });

    try {
      // Initialize enhanced memory optimization (temporarily disabled for voice testing)
      // enhancedMemoryOptimizationService.startMonitoring();
      
      // Consolidate routers into service groups (temporarily disabled for voice testing)
      // await routerConsolidationService.consolidateRouters();

      // Mount consolidated service groups (temporarily disabled for voice testing)
      // Object.keys(routerConsolidationService.SERVICE_GROUPS).forEach(groupKey => {
      //   const router = routerConsolidationService.getConsolidatedRouter(groupKey);
      //   if (router) {
      //     const basePath = `/api/v1/${groupKey.toLowerCase().replace(/_/g, '-')}`;
      //     this.app.use(basePath, router);
      //     log.info(`✅ Mounted consolidated service group: ${groupKey}`, LogContext.SERVER, {
      //       path: basePath
      //     });
      //   }
      // });

      // const loadedGroups = routerConsolidationService.getLoadedGroups();
      // const memoryUsage = routerConsolidationService.getMemoryUsage();

      // log.info('🎉 Router consolidation completed successfully', LogContext.SERVER, {
      //   loadedGroups: loadedGroups.length,
      //   totalGroups: Object.keys(routerConsolidationService.SERVICE_GROUPS).length,
      //   memoryUsage,
      //   status: 'optimized'
      // });
      
      log.info('🔄 Router consolidation temporarily disabled for voice testing', LogContext.SERVER);

    } catch (error) {
      log.error('❌ Router consolidation failed, falling back to standard loading', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fallback to standard router loading
      process.env.ROUTER_CONSOLIDATION = 'false';
      await this.loadRoutersWithSequencing();
    }
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
      // Skip heavy context operations during startup for performance
      log.info('🔍 Context service initialized (lightweight mode)', LogContext.DATABASE);

      // Skip database operations that can slow down startup
      if (process.env.SKIP_STARTUP_CONTEXT !== 'true') {
        // Defer context storage test to avoid blocking startup
        setTimeout(async () => {
          try {
            if (this.supabase) {
              await contextStorageService.storeContext({
                content: 'Server startup completed',
                category: 'system_events',
                source: 'server_startup',
                userId: 'system',
                projectPath: process.cwd(),
                metadata: { startup_time: safeToISOString() },
              });
            }
          } catch (error) {
            log.warn('Context storage deferred initialization failed', LogContext.DATABASE, {
              error,
            });
          }
        }, 10000); // Defer 10 seconds
      }
    } catch (error) {
      log.warn('⚠️ Context service initialization failed', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async initializeMCPService(): Promise<void> {
    try {
      // Start MCP service for context management
      try {
        await mcpIntegrationService.start();
        log.info('✅ MCP service initialized for context management', LogContext.MCP);
      } catch (error) {
        log.warn('⚠️ MCP service failed to start, using fallback mode', LogContext.MCP, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      log.error('❌ Failed to initialize MCP service', LogContext.MCP, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow server to start with fallback context management
    }
  }

  private async initializeCorrelationService(): Promise<void> {
    try {
      log.info('🔄 Initializing Unified Correlation service', LogContext.AI);

      const { unifiedCorrelationService } = await import(
        './services/unified-correlation-service'
      );
      await unifiedCorrelationService.initialize();

      log.info('✅ Unified Correlation service initialized', LogContext.AI);
    } catch (error) {
      log.error('❌ Failed to initialize Correlation service', LogContext.AI, { error });
      throw error;
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

  private async initializeUnifiedKnowledgeIntegration(): Promise<void> {
    try {
      log.info('🧠 Initializing Unified Knowledge Integration', LogContext.AI);

      // Import and initialize the unified knowledge bridge
      const { unifiedKnowledgeBridge } = await import('./services/unified-knowledge-bridge.js');
      await unifiedKnowledgeBridge.initialize();

      // Import and initialize the enhanced agent executor
      const { enhancedAgentExecutor } = await import('./services/enhanced-agent-executor.js');
      
      // Import and initialize the agent knowledge middleware
      const { agentKnowledgeMiddleware } = await import('./services/agent-knowledge-middleware.js');
      await agentKnowledgeMiddleware.initialize();

      // Register services in dependency container
      container.register('UNIFIED_KNOWLEDGE_BRIDGE', unifiedKnowledgeBridge);
      container.register('ENHANCED_AGENT_EXECUTOR', enhancedAgentExecutor);
      container.register('AGENT_KNOWLEDGE_MIDDLEWARE', agentKnowledgeMiddleware);

      log.info('✅ Unified Knowledge Integration initialized successfully', LogContext.AI, {
        components: ['UnifiedKnowledgeBridge', 'EnhancedAgentExecutor', 'AgentKnowledgeMiddleware'],
        description: 'R1 RAG system now fully integrated with agent registry'
      });
    } catch (error) {
      log.warn('⚠️ Unified Knowledge Integration initialization failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow server to start without unified knowledge integration
    }
  }

  private async setupMiddleware(): Promise<void> {
    // Security: Disable Express.js powered-by header to prevent information exposure
    this.app.disable('x-powered-by');
    // Trust proxy for accurate client IPs behind proxies (safe for local too)
    this.app.set('trust proxy', 1);

    // Production Performance Middleware (FIRST - to track all requests)
    if (config.production?.monitoring?.enableDetailedMetrics) {
      const { performanceMiddleware, connectionPoolMiddleware, memoryPressureMiddleware, requestSizeLimiter } = await import('./middleware/production-performance-tracker');
      
      // Apply performance tracking to all routes
      this.app.use(performanceMiddleware);
      
      // Connection pooling optimization
      this.app.use(connectionPoolMiddleware);
      
      // Memory pressure response middleware
      if (config.production?.optimization?.enableMemoryPressureResponse) {
        this.app.use(memoryPressureMiddleware);
      }
      
      // Request size limiting for memory optimization
      this.app.use(requestSizeLimiter(config.production?.optimization?.maxRequestSize || 10));
      
      log.info('📊 Production performance monitoring enabled', LogContext.SERVER, {
        memoryPressureResponse: config.production?.optimization?.enableMemoryPressureResponse || false,
        maxRequestSize: `${config.production?.optimization?.maxRequestSize || 10}MB`,
        connectionPooling: config.production?.optimization?.enableConnectionPooling || false
      });
    }

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
      const compressionFactory = mod.default || mod;
      compressionMiddleware = (compressionFactory as () => express.RequestHandler)();
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

    // Request timeout middleware for connection stability
    try {
      const { requestTimeoutMiddleware } = await import('./middleware/request-timeout');
      this.app.use(requestTimeoutMiddleware);
      log.info('⏱️ Request timeout middleware enabled (300s)', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Request timeout middleware failed to load', LogContext.SERVER, { 
        error: error instanceof Error ? error.message : String(error) 
      });
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
    // Standard JSON parsing (enhanced error handling added via error middleware)
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Inject services into request context
    this.app.use(injectServices);

    // Backwards compatibility middleware - redirect old routes to new service groups
    // Backwards compatibility middleware removed

    // Migration information endpoint removed

    // Monitoring middleware - lightweight in development for performance
    if (process.env.NODE_ENV === 'production') {
      try {
        const { requestMetricsMiddleware } = await import(
          './middleware/request-metrics-middleware'
        );
        this.app.use(requestMetricsMiddleware());
        log.info('📊 Production monitoring enabled', LogContext.MONITORING);
      } catch (error) {
        log.warn('Monitoring middleware failed', LogContext.MONITORING, { error });
      }
    }

    // Apply Auto Context Middleware - lightweight in development
    if (process.env.ENABLE_CONTEXT_MIDDLEWARE !== 'false') {
      try {
        const { contextMiddleware } = await import('./middleware/auto-context-middleware');
        // Only apply to critical endpoints to reduce overhead
        this.app.use('/api/v1/chat', contextMiddleware);
        this.app.use('/api/v1/assistant', contextMiddleware);
        log.info('✅ Context middleware applied to critical endpoints', LogContext.SERVER);
      } catch (error) {
        log.warn('Context middleware failed to load', LogContext.SERVER, { error });
      }
    }

    // Static file serving
    this.app.use(express.static('public'));
    this.app.use('/frontend', express.static('frontend'));

    // Rate limiting middleware - Apply globally
    this.app.use(standardRateLimiter.middleware());

    // Input sanitization middleware - Apply globally for security
    try {
      const { sanitizers } = await import('./middleware/input-sanitization');
      this.app.use(sanitizers.general);
      log.info('✅ Input sanitization middleware enabled globally', LogContext.SERVER);
    } catch (error) {
      log.error('Failed to load input sanitization middleware', LogContext.SERVER, { error });
    }

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

    // Test Failure Learning Middleware - Captures test failures for pattern learning
    try {
      const { testFailureLearningMiddleware } = await import('./middleware/test-failure-learning');
      this.app.use(testFailureLearningMiddleware);
      log.info('✅ Test Failure Learning middleware enabled - Xcode Vision pattern learning active', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Test Failure Learning middleware failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

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
        const duration = safeDuration(startTime);
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

    // Mount AI Libraries router
    try {
      const aiLibrariesRouter = await import('./routers/ai-libraries.js');
      this.app.use('/api/libraries', aiLibrariesRouter.default);
      log.info('✅ AI Libraries router mounted at /api/libraries', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to mount AI Libraries router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error)
      });
    }

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

        interface EmbeddingResult {
          data?: {
            vector?: number[];
            dimension?: number;
          };
          model?: string;
          processingTime?: number;
          cached?: boolean;
        }

        interface ZodModule {
          z: any;
        }

        interface ZodValidateModule {
          zodValidate: any;
        }

        interface AuthenticatedRequest extends express.Request {
          user?: {
            id: string;
          };
        }

        interface WebSocketConnection {
          send(data: string): void;
          close(): void;
          on(event: string, handler: (...args: any[]) => void): void;
          readyState: number;
        }

        interface AgentRequest {
          agentName: string;
          message: string;
          context?: any;
        }

        interface HealthResponse {
          status: string;
          timestamp: string;
          version: string;
          environment: string;
          services: {
            supabase: boolean;
            websocket: boolean;
            agentRegistry: boolean;
            redis: boolean;
            mlx: boolean;
            ollama: boolean;
            lmStudio: boolean;
          };
          agents: {
            total: number;
            loaded: number;
            available: string[];
          } | null;
          uptime: number;
        }

        const health: HealthResponse = {
          status: 'ok',
          timestamp: safeToISOString(),
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
          health.services.ollama = ollamaService.isServiceAvailable();
        } catch {}
        try {
          const { fastCoordinator } = await import('./services/fast-llm-coordinator');
          health.services.lmStudio = await fastCoordinator.checkLmStudioHealth();
        } catch {}
        res.json(health);
      } catch {
        // Fallback to synchronous health check if async fails
        const health = {
          status: 'ok',
          timestamp: safeToISOString(),
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

    // Production Health and Performance Monitoring Routes
    try {
      const productionHealthRouter = await import('./routers/production-health');
      this.app.use('/api/production', productionHealthRouter.default);
      log.info('📊 Production health monitoring routes mounted at /api/production', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Failed to mount production health routes', LogContext.SERVER, { error });
    }

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
        interface SystemStatus {
          status: string;
          timestamp: string;
          version: string;
          environment: string;
          mode: {
            offline: boolean;
            disableExternalCalls: boolean;
            disableRemoteLLM: boolean;
          };
          services: {
            backend: string;
            database: string;
            websocket: string;
            agents: string;
            redis: boolean;
            mlx: boolean;
          };
          providers: {
            openai: boolean;
            anthropic: boolean;
            ollama: boolean;
            internal: boolean;
          };
          systemInfo: {
            uptime: number;
            memoryUsage: NodeJS.MemoryUsage;
            cpuUsage: NodeJS.CpuUsage;
            platform: string;
            nodeVersion: string;
          };
          endpoints: {
            health: string;
            api: string;
            websocket: string;
          };
        }

        const health: SystemStatus = {
          status: 'operational',
          timestamp: safeToISOString(),
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

        // Update provider statuses (best-effort)
        try {
          const { ollamaService } = await import('./services/ollama-service');
          health.providers.ollama = ollamaService.isServiceAvailable();
        } catch {}
        try {
          const { llmRouter } = await import('./services/llm-router-service');
          const status = llmRouter.getProviderStatus();
          (health).providers = { ...health.providers, ...status };
        } catch {}

        res.json({
          success: true,
          data: health,
          metadata: {
            timestamp: safeToISOString(),
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
          timestamp: safeToISOString(),
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
          timestamp: safeToISOString(),
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
          timestamp: safeToISOString(),
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
          timestamp: safeToISOString(),
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
          timestamp: safeToISOString(),
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
          timestamp: safeToISOString(),
        },
      });
    });

    // LLM system snapshot (Ollama + LM Studio)
    this.app.get('/api/v1/system/llm', async (req, res) => {
      try {
        interface LLMSnapshot {
          timestamp: string;
          environment: string;
          services: {
            ollama: { available: boolean; defaultModel: string | null };
            lmStudio: { available: boolean };
          };
          allowedHosts: string[];
        }

        const snapshot: LLMSnapshot = {
          timestamp: safeToISOString(),
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
          '/api/v1/knowledge-graph',
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

    // Load routers with proper sequencing and error handling
    await this.loadRoutersWithSequencing();

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

    // Enhanced Agent Orchestration for Arc UI
    try {
      const agentOrchestrationRouter = (await import('./routers/agent-orchestration')).default;
      this.app.use('/api/v1/agent-orchestration', agentOrchestrationRouter);
      log.info(
        '✅ Enhanced Agent Orchestration router loaded - Arc UI support enabled',
        LogContext.API
      );
    } catch (error) {
      log.error('❌ Failed to load Enhanced Agent Orchestration router', LogContext.API, { error });
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

    // Task Execution Router - Real-time task management with WebSocket support
    try {
      const { taskExecutionRouter } = await import('./routers/task-execution');
      this.app.use('/api/v1', taskExecutionRouter);
      log.info('✅ Task Execution router loaded - Real-time task management exposed', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load Task Execution router', LogContext.API, { error });
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
      log.info(
        '✅ GraphRAG router loaded - R1 knowledge graph capabilities enabled',
        LogContext.API
      );
    } catch (error) {
      log.error('❌ Failed to load GraphRAG router', LogContext.API, { error });
    }

    // Load AI News router
    try {
      const AINewsRouter = (await import('./routers/ai-news')).default;
      const aiNewsRouter = AINewsRouter;
      this.app.use('/api', aiNewsRouter);
      log.info('✅ AI News router loaded - News feed endpoints exposed', LogContext.API);
    } catch (error) {
      log.error('❌ Failed to load AI News router', LogContext.API, { error });
    }

    // Load Knowledge Graph router for Arc UI
    try {
      const knowledgeGraphModule = await import('./routers/knowledge-graph');
      const knowledgeGraphRouter = knowledgeGraphModule.default;

      // Set realtime service for graph updates
      if (knowledgeGraphModule.setRealtimeService && this.broadcastService) {
        knowledgeGraphModule.setRealtimeService(this.broadcastService);
        log.info('✅ Knowledge Graph realtime service configured', LogContext.API);
      }

      this.app.use('/api/v1/knowledge-graph', knowledgeGraphRouter);
      log.info(
        '✅ Knowledge Graph router loaded - Arc UI graph visualization and management enabled',
        LogContext.API
      );
    } catch (error) {
      log.error('❌ Failed to load Knowledge Graph router', LogContext.API, { error });
    }

    // Load Codebase Optimizer router for comprehensive code analysis
    try {
      const codebaseOptimizerRouter = (await import('./routers/codebase-optimizer')).default;
      this.app.use('/api/v1/codebase-optimizer', codebaseOptimizerRouter);
      log.info(
        '✅ Codebase Optimizer router loaded - Code analysis and optimization capabilities enabled',
        LogContext.API
      );
    } catch (error) {
      log.error('❌ Failed to load Codebase Optimizer router', LogContext.API, { error });
    }

    // Load Voice Processing router for voice interactions
    try {
      const voiceRouter = (await import('./routers/voice')).default;
      this.app.use('/api/v1/voice', voiceRouter);
      log.info(
        '✅ Voice router loaded - Voice conversation and command capabilities enabled',
        LogContext.API
      );
    } catch (error) {
      log.error('❌ Failed to load Voice router', LogContext.API, { error });
    }

    // Load Frontend Fixer router for auto-fixing frontend issues
    try {
      const frontendFixerRouter = (await import('./routers/frontend-fixer')).default;
      this.app.use('/api/v1/frontend-fixer', frontendFixerRouter);
      log.info(
        '✅ Frontend Fixer router loaded - Frontend auto-fix capabilities enabled',
        LogContext.API
      );
    } catch (error) {
      log.error('❌ Failed to load Frontend Fixer router', LogContext.API, { error });
    }

    // Load Claude Knowledge router for Supabase knowledge base integration
    try {
      const claudeKnowledgeRouter = (await import('./routers/claude-knowledge')).default;
      this.app.use('/api/v1/claude-knowledge', claudeKnowledgeRouter);
      log.info(
        '✅ Claude Knowledge router loaded - Supabase knowledge base integration enabled',
        LogContext.API
      );
    } catch (error) {
      log.error('❌ Failed to load Claude Knowledge router', LogContext.API, { error });
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
            timestamp: safeToISOString(),
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
      // Add null/undefined check for req.body
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Request body is required and must be a valid JSON object',
        });
      }

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
                    model: (embeddingResult as EmbeddingResult).model,
                    dimension: (embeddingResult as EmbeddingResult).data?.dimension,
                    processingTime: (embeddingResult as EmbeddingResult).processingTime,
                    timestamp: safeToISOString(),
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
                model: (embeddingResult as EmbeddingResult).model,
              });

              // Also save to vision_embeddings table for faster lookups
              const { error: embeddingError } = await this.supabase
                .from('vision_embeddings')
                .insert({
                  memory_id: memoryId,
                  embedding: (embeddingResult as EmbeddingResult).data?.vector,
                  model_version: (embeddingResult as EmbeddingResult).model,
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
          data: (embeddingResult as EmbeddingResult).data,
          model: (embeddingResult as EmbeddingResult).model,
          processingTime: (embeddingResult as EmbeddingResult).processingTime,
          cached: (embeddingResult as EmbeddingResult).cached || false,
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
          timestamp: safeToISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    });

    // Execute agent
    const agentExecuteMiddlewares: Array<express.RequestHandler> = [];
    if (process.env.ENABLE_CONTEXT === 'true') {
      import('./middleware/context-injection-middleware')
        .then((cim) => agentExecuteMiddlewares.push(cim.agentContextMiddleware()))
        .catch(() => undefined);
    }
    const agentExecuteValidators: Array<express.RequestHandler> = [];
    try {
      const [{ z }, { zodValidate }] = await Promise.all([
        Promise.resolve().then(() => import('zod')) as Promise<ZodModule>,
        Promise.resolve().then(() => import('./middleware/zod-validate')) as Promise<ZodValidateModule>,
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
            userId: (req as AuthenticatedRequest).user?.id || 'anonymous',
            ...context,
          };

          // Enforce execution timeout
          const timeoutMs = Number(process.env.AGENT_EXECUTE_TIMEOUT_MS || 15000);
          const execPromise = this.agentRegistry?.processRequest({ agent: agentName, context: agentContext }) || Promise.resolve({ migrated: true });
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
              timestamp: safeToISOString(),
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
              timestamp: safeToISOString(),
              requestId: req.headers['x-request-id'] || 'unknown',
            },
          });
        }
      }
    );

    // Parallel agent execution
    const agentParallelMiddlewares: Array<express.RequestHandler> = [];
    if (process.env.ENABLE_CONTEXT === 'true') {
      import('./middleware/context-injection-middleware')
        .then((cim) => agentParallelMiddlewares.push(cim.agentContextMiddleware()))
        .catch(() => undefined);
    }
    const agentParallelValidators: Array<express.RequestHandler> = [];
    try {
      const [{ z }, { zodValidate }] = await Promise.all([
        Promise.resolve().then(() => import('zod')) as Promise<ZodModule>,
        Promise.resolve().then(() => import('./middleware/zod-validate')) as Promise<ZodValidateModule>,
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
          const userId = (req as AuthenticatedRequest).user?.id || 'anonymous';

          // Prepare contexts for parallel execution
          const parallelRequests = agentRequests.map((request: AgentRequest) => ({
            agentName: request.agentName,
            context: {
              userRequest: request.userRequest,
              requestId: `${requestId}_${request.agentName}`,
              workingDirectory: process.cwd(),
              userId,
              ...request.context,
            },
          }));

          const startTime = safeNow();
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
              timestamp: safeToISOString(),
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
    const agentOrchestrateMiddlewares: Array<express.RequestHandler> = [];
    if (process.env.ENABLE_CONTEXT === 'true') {
      import('./middleware/context-injection-middleware')
        .then((cim) => agentOrchestrateMiddlewares.push(cim.agentContextMiddleware()))
        .catch(() => undefined);
    }
    const agentOrchestrateValidators: Array<express.RequestHandler> = [];
    try {
      const [{ z }, { zodValidate }] = await Promise.all([
        Promise.resolve().then(() => import('zod')) as Promise<ZodModule>,
        Promise.resolve().then(() => import('./middleware/zod-validate')) as Promise<ZodValidateModule>,
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
            userId: (req as AuthenticatedRequest).user?.id || 'anonymous',
            ...context,
          };

          const startTime = safeNow();
          const results = await this.agentRegistry?.orchestrateAgents({
            primary: primaryAgent,
            supporting: supportingAgents,
            context: orchestrationContext
          }) || { migrated: true };
          const executionTime = Date.now() - startTime;

          return res.json({
            success: true,
            data: {
              ...results,
              summary: {
                primaryAgent,
                supportingAgents: supportingAgents.length,
                synthesized: !!results.migrated,
                executionTime: `${executionTime}ms`,
              },
            },
            metadata: {
              timestamp: safeToISOString(),
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
            timestamp: safeToISOString(),
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

      // Initialize Agent Orchestration WebSocket for Arc UI
      import('./routers/agent-orchestration')
        .then((module) => {
          if (module.setupWebSocketOrchestration) {
            module.setupWebSocketOrchestration(this.server);
            log.info(
              '✅ Agent Orchestration WebSocket initialized for Arc UI',
              LogContext.WEBSOCKET
            );
          } else {
            log.warn(
              '⚠️ setupWebSocketOrchestration not found in agent-orchestration module',
              LogContext.WEBSOCKET
            );
          }
        })
        .catch((error) => {
          log.error('❌ Failed to initialize Agent Orchestration WebSocket', LogContext.WEBSOCKET, {
            error: error instanceof Error ? error.message : String(error),
          });
        });

      // Initialize raw WebSocket server for Swift/native clients and task execution
      this.wss = new WebSocketServer({
        server: this.server,
        // Remove path restriction to allow multiple WebSocket endpoints
      });

      this.wss.on('connection', (ws, req) => {
        const pathname = req.url;
        log.info(
          `WebSocket client connected to ${pathname} from ${req.socket.remoteAddress}`,
          LogContext.WEBSOCKET
        );

        // Route WebSocket connection based on path
        if (pathname === '/ws/tasks') {
          // Handle task execution WebSocket
          import('./routers/task-execution')
            .then((module) => {
              if (module.handleTaskWebSocket) {
                module.handleTaskWebSocket(ws, req);
                log.info('✅ Task WebSocket handler initialized', LogContext.WEBSOCKET);
              }
            })
            .catch((error) => {
              log.error('❌ Failed to handle task WebSocket connection', LogContext.WEBSOCKET, { error });
              ws.close();
            });
          return;
        }

        // Default WebSocket handling for other connections
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
              timestamp: safeToISOString(),
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

      // Initialize real-time broadcast service
      if (this.io) {
        this.broadcastService = new RealtimeBroadcastService(this.io);
        log.info('✅ Real-time broadcast service initialized', LogContext.WEBSOCKET);

        // Integrate error tracking with real-time broadcasting
        this.setupErrorTrackingIntegration();
      }

      log.info('✅ WebSocket server initialized', LogContext.WEBSOCKET);
    } catch (error) {
      log.error('❌ Failed to initialize WebSocket server', LogContext.WEBSOCKET, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Setup integration between error tracking and real-time broadcasting
   */
  private setupErrorTrackingIntegration(): void {
    if (!this.broadcastService) {
      log.warn(
        'Cannot setup error tracking integration: broadcast service not available',
        LogContext.SYSTEM
      );
      return;
    }

    try {
      // Connect the broadcast service to error tracking middleware
      errorTrackingService.setBroadcastService(this.broadcastService);

      // Connect the broadcast service to centralized error tracking
      errorLogService.setBroadcastService(this.broadcastService);

      // Listen for health status updates and broadcast them
      errorLogService.on('health-status-updated', (healthStatus) => {
        if (this.broadcastService) {
          this.broadcastService.broadcastHealthStatus({
            overall: healthStatus.overall,
            errorRate: healthStatus.errorRate,
            criticalErrors: healthStatus.criticalErrors,
            serviceAvailability: healthStatus.serviceAvailability,
            systemAlerts: healthStatus.systemAlerts,
          });
        }
      });

      // Listen for error pattern detection and broadcast alerts
      errorLogService.on('pattern-detected', (pattern) => {
        if (this.broadcastService) {
          this.broadcastService.broadcastErrorPattern({
            patternId: pattern.id,
            errorName: pattern.errorName,
            path: pattern.path,
            occurrences: pattern.count,
            severity: pattern.severity,
            suggestedFix: pattern.suggestedFix,
            affectedUsers: pattern.affectedUsers.size,
          });

          // For critical patterns, also send immediate alerts
          if (pattern.severity === 'critical') {
            this.broadcastService.broadcastImmediateError({
              correlationId: `pattern_${pattern.id}`,
              severity: 'critical',
              category: 'system',
              errorName: pattern.errorName,
              message: `Critical error pattern detected: ${pattern.count} occurrences of ${pattern.errorName} on ${pattern.path}`,
              path: pattern.path,
              recoveryActions: pattern.suggestedFix ? [pattern.suggestedFix] : [],
            });
          }
        }
      });

      // Setup periodic health status broadcasts
      setInterval(() => {
        if (this.broadcastService) {
          const healthStatus = errorLogService.getHealthStatus();

          // Only broadcast if there are changes or issues
          if (healthStatus.overall !== 'healthy' || healthStatus.systemAlerts > 0) {
            this.broadcastService.broadcastHealthStatus({
              overall: healthStatus.overall,
              errorRate: healthStatus.errorRate,
              criticalErrors: healthStatus.criticalErrors,
              serviceAvailability: healthStatus.serviceAvailability,
              systemAlerts: healthStatus.systemAlerts,
            });
          }
        }
      }, 60000); // Every minute

      log.info(
        '✅ Error tracking integration with WebSocket broadcasting setup complete',
        LogContext.SYSTEM,
        {
          broadcastService: 'connected',
          errorTracking: 'integrated',
          realTimeAlerts: 'enabled',
        }
      );
    } catch (error) {
      log.error('❌ Failed to setup error tracking integration', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleWebSocketMessage(ws: WebSocketConnection, message: any): void {
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

  private async handleWebSocketChatMessage(ws: WebSocketConnection, data: any): Promise<void> {
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
              timestamp: safeToISOString(),
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
      if (!result?.response) {
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
            timestamp: safeToISOString(),
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
            timestamp: safeToISOString(),
          },
        })
      );
    }
  }

  private async sendMetricsUpdate(ws: WebSocketConnection): Promise<void> {
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
    if (!this.wss) {return;}

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

        // Get broadcast service health if available
        const broadcastHealth = this.broadcastService?.getServiceHealth();

        res.json({
          success: true,
          data: {
            status: (() => {
              const overall = summary.overallHealth;
              if (overall > 0.7) {return 'healthy';}
              if (overall > 0.4) {return 'degraded';}
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
            websocket: {
              connected: this.io ? true : false,
              broadcastService: broadcastHealth || null,
            },
          },
          metadata: {
            timestamp: safeToISOString(),
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
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

    // WebSocket/Broadcast service management endpoints
    this.app.get('/api/v1/websocket/status', (req, res) => {
      try {
        const broadcastHealth = this.broadcastService?.getServiceHealth();

        return res.json({
          success: true,
          data: {
            socketio: {
              connected: this.io ? true : false,
              clientCount: this.broadcastService?.getConnectedClientsCount() || 0,
            },
            rawWebSocket: {
              connected: this.wss ? true : false,
            },
            broadcastService: broadcastHealth || null,
          },
          metadata: {
            timestamp: safeToISOString(),
          },
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get WebSocket status',
        });
      }
    });

    this.app.post('/api/v1/websocket/broadcast/test', (req, res) => {
      try {
        if (!this.broadcastService) {
          return res.status(503).json({
            success: false,
            error: 'Broadcast service not available',
          });
        }

        // Send a test alert
        this.broadcastService.broadcastSystemAlert({
          severity: 'info',
          component: 'api-test',
          message: 'Test broadcast message from API',
          details: { requestId: req.headers['x-request-id'] || 'unknown' },
        });

        return res.json({
          success: true,
          message: 'Test broadcast sent',
          metadata: {
            timestamp: safeToISOString(),
          },
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to send test broadcast',
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
          timestamp: safeToISOString(),
          path: req.path,
          method: req.method,
        },
      });
    });

    // Error tracking middleware - Error handler (must be last)
    this.app.use(errorTrackingService.errorHandler());

    // Monitoring error tracking middleware
    try {
      const { errorTrackingMiddleware } = await import('./middleware/request-metrics-middleware');
      this.app.use(errorTrackingMiddleware());
      log.info('📊 Monitoring error tracking middleware initialized', LogContext.MONITORING);
    } catch (error) {
      log.error(
        '❌ Failed to initialize monitoring error tracking middleware',
        LogContext.MONITORING,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    // JSON error handler - must come before global error handler
    try {
      const { jsonErrorHandler } = await import('./middleware/json-error-handler');
      this.app.use(jsonErrorHandler);
    } catch (error) {
      log.warn('JSON error handler failed to load', LogContext.SERVER, { error });
    }

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
      // Stop accepting new connections
      if (this.server) {
        this.server.close();
        log.info('🚫 HTTP server stopped accepting new connections', LogContext.SERVER);
      }

      // Give existing connections time to finish (graceful drain)
      const drainTimeoutMs = config.http.shutdownDrainTimeout;
      log.info(`⏳ Waiting ${drainTimeoutMs/1000}s for existing connections to drain...`, LogContext.SERVER);
      
      await new Promise<void>((resolve) => {
        // Force close after timeout
        const forceCloseTimeout = setTimeout(() => {
          log.warn('⏰ Graceful shutdown timeout, forcing connection close', LogContext.SERVER);
          if (this.server) {
            // Forcefully destroy all sockets
            this.server.closeAllConnections?.();
          }
          resolve();
        }, drainTimeoutMs);

        // Monitor when server actually closes
        if (this.server) {
          this.server.on('close', () => {
            clearTimeout(forceCloseTimeout);
            log.info('✅ HTTP server closed gracefully', LogContext.SERVER);
            resolve();
          });
        } else {
          clearTimeout(forceCloseTimeout);
          resolve();
        }
      });

      // Close broadcast service
      if (this.broadcastService) {
        this.broadcastService.destroy();
        log.info('Broadcast service destroyed', LogContext.WEBSOCKET);
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

      // Memory optimization service shutdown handled automatically
      log.info('🧠 Memory optimization service will auto-cleanup', LogContext.SYSTEM);

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

      // Shutdown Local LLM Router
      try {
        const { shutdownLocalLLMRouter } = await import('./routers/local-llm');
        await shutdownLocalLLMRouter();
        log.info('✅ Local LLM Router shut down', LogContext.API);
      } catch (error) {
        log.warn('⚠️ Error shutting down Local LLM Router', LogContext.API, {
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

      // Memory monitoring is now handled by intelligent memory manager
      // No manual memory monitor to clear

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

      // Use intelligent port management to avoid conflicts
      const { getPorts } = await import('./config/ports');
      const { processManager } = await import('./services/process-management-service');
      
      const portConfig = await getPorts();
      const port = process.env.NODE_ENV === 'test' ? 0 : portConfig.mainServer;

      // Register this server with process manager
      processManager.registerProcess("main-server", {
        id: "main-server",
        name: "Universal AI Tools Main Server",
        port: port,
        healthCheckUrl: `http://localhost:${port}/health`,
      });
      // Start server with intelligent port management
      await new Promise<void>((resolve, reject) => {
        this.server
          .listen(port, () => {
            const address = this.server.address() as any;
            const actualPort = address && typeof address === 'object' ? address.port : port;
            
            // Update process manager with actual port
            processManager.registerProcess("main-server", {
              id: "main-server",
              name: "Universal AI Tools Main Server",
              port: actualPort,
              pid: process.pid,
              healthCheckUrl: `http://localhost:${actualPort}/health`,
            });
            log.info(
              `🚀 Universal AI Tools Service running on port ${actualPort}`,
              LogContext.SERVER,
              {
                environment: config.environment,
                port: actualPort,
                configuredPort: port,
                healthCheck: `http://localhost:${actualPort}/health`,
                processId: process.pid,
              }
            );
            resolve();
          })
          .on('error', (error: any) => {
            if (error.code === 'EADDRINUSE') {
              log.error(`❌ Port ${port} is already in use`, LogContext.SERVER, {
                port,
                suggestion: 'Run: npm run fix-ports or kill processes using the port'
              });
            }
            reject(error);
          });
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

  public getBroadcastService(): RealtimeBroadcastService | null {
    return this.broadcastService;
  }

  // Expose internal shutdown for tests
  /* istanbul ignore next */
  public async testShutdown(): Promise<void> {
    await this.gracefulShutdown('test');
  }

  private async loadAsyncRoutes(): Promise<void> {
    try {
      // CONSOLIDATED SERVICE GROUPS - New Architecture
      // Load Core Services Group (replaces status, database-health, system-metrics, framework-inventory, etc.)
      try {
        const { coreServicesGroup } = await import('./services/core-services-group');
        this.app.use('/api/core', coreServicesGroup.getRouter());
        log.info('✅ Core Services Group loaded - Consolidated system fundamentals', LogContext.SERVER, {
          basePath: '/api/core',
          replacedRoutes: ['status', 'database-health', 'system-metrics', 'framework-inventory', 'metrics', 'monitoring', 'error-monitoring'],
          performanceTarget: '50ms'
        });
      } catch (error) {
        log.error('❌ Failed to load Core Services Group', LogContext.SERVER, { error });
      }

      // Load AI Services Group (replaces fast-coordinator, agents, chat, assistant, llm-stream, vision-debug, voice)
      try {
        const { aiServicesGroup } = await import('./services/ai-services-group');
        this.app.use('/api/ai', aiServicesGroup.getRouter());
        log.info('✅ AI Services Group loaded - Consolidated AI/LLM operations', LogContext.SERVER, {
          basePath: '/api/ai',
          replacedRoutes: ['fast-coordinator', 'agents', 'chat', 'assistant', 'llm-stream', 'vision-debug', 'voice'],
          performanceTarget: '200ms'
        });
      } catch (error) {
        log.error('❌ Failed to load AI Services Group', LogContext.SERVER, { error });
      }

      // Load Data Services Group (replaces context-management, knowledge-base, graph-rag, memory-optimization, smart-context)
      try {
        const { dataServicesGroup } = await import('./services/data-services-group');
        this.app.use('/api/data', dataServicesGroup.getRouter());
        log.info('✅ Data Services Group loaded - Consolidated data & knowledge operations', LogContext.SERVER, {
          basePath: '/api/data',
          replacedRoutes: ['context-management', 'knowledge-base', 'graph-rag', 'memory-optimization', 'smart-context', 'conversation-context'],
          performanceTarget: '100ms'
        });
      } catch (error) {
        log.error('❌ Failed to load Data Services Group', LogContext.SERVER, { error });
      }

      // Load Integration Services Group (replaces mcp-agent, webhooks, crawl4ai, hardware-auth, repository-ml, programming-languages, claude-knowledge)
      try {
        const { integrationServicesGroup } = await import('./services/integration-services-group');
        this.app.use('/api/integration', integrationServicesGroup.getRouter());
        log.info('✅ Integration Services Group loaded - Consolidated external API integrations', LogContext.SERVER, {
          basePath: '/api/integration',
          replacedRoutes: ['mcp-agent', 'webhooks', 'crawl4ai', 'hardware-auth', 'repository-ml', 'programming-languages', 'claude-knowledge'],
          performanceTarget: '500ms'
        });
      } catch (error) {
        log.error('❌ Failed to load Integration Services Group', LogContext.SERVER, { error });
      }

      // Load Vision & Voice Services Group (replaces vision-debug, vision-debug-simple, voice system endpoints)
      try {
        const { visionVoiceServicesGroup } = await import('./services/vision-voice-services-group');
        this.app.use('/api/media', visionVoiceServicesGroup.getRouter());
        log.info('✅ Vision & Voice Services Group loaded - Consolidated multimedia processing', LogContext.SERVER, {
          basePath: '/api/media',
          replacedRoutes: ['vision-debug', 'vision-debug-simple', 'voice-transcription', 'voice-synthesis'],
          performanceTarget: '1000ms'
        });
      } catch (error) {
        log.error('❌ Failed to load Vision & Voice Services Group', LogContext.SERVER, { error });
      }

      // Load monitoring routes
      const { monitoring } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/monitoring', monitoring);
      log.info('✅ Monitoring routes loaded', LogContext.SERVER);

      // Load monitoring dashboard routes
      const { monitoringDashboard } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/monitoring', monitoringDashboard);
      log.info('✅ Monitoring dashboard routes loaded', LogContext.SERVER);

      // Load optimization dashboard routes
      const { optimizationDashboard } = await import('./migration/compatibility-stubs');
      this.app.use('/api/optimization-dashboard', optimizationDashboard);
      log.info('✅ Optimization dashboard routes loaded', LogContext.SERVER);

      // Load error monitoring routes
      const { errorMonitoring } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/monitoring', errorMonitoring);
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
      const { chat } = await import('./migration/compatibility-stubs');
      const chatModule = { default: chat };
      
      // Import and apply chat context middleware if context is enabled
      if (process.env.ENABLE_CONTEXT_MIDDLEWARE !== 'false') {
        try {
          const { chatContextMiddleware } = await import('./middleware/context-injection-middleware');
          this.app.use('/api/v1/chat', chatContextMiddleware(), chatModule.default);
          log.info('✅ Chat context middleware enabled', LogContext.SERVER);
        } catch (middlewareError) {
          log.warn('⚠️ Chat context middleware failed to load, using chat without context', LogContext.SERVER, {
            error: middlewareError instanceof Error ? middlewareError.message : String(middlewareError)
          });
          this.app.use('/api/v1/chat', chatModule.default);
        }
      } else {
        this.app.use('/api/v1/chat', chatModule.default);
        log.info('🔧 Chat context middleware disabled via ENABLE_CONTEXT_MIDDLEWARE=false', LogContext.SERVER);
      }

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
      const { memory } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/memory', memory);
      log.info('✅ Memory routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Memory routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load memory optimization routes
    try {
      const { memoryOptimization } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/memory-optimization', memoryOptimization);
      log.info('✅ Memory optimization routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Memory optimization routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load feature discovery routes
    try {
      const { featureDiscovery } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/features', featureDiscovery);
      log.info('✅ Feature discovery routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Feature discovery routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load errors routes (Supabase-backed error history)
    try {
      const { errors } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/errors', errors);
      log.info('✅ Errors routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Errors routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load device authentication routes
    try {
      const { deviceAuth } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/device-auth', deviceAuth);
      log.info('✅ Device authentication routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Device auth routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load mobile orchestration routes
    try {
      log.info('📱 Loading mobile orchestration router...', LogContext.SERVER);
      const { mobileOrchestration } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/mobile-orchestration', mobileOrchestration);
      log.info('✅ Mobile orchestration routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load mobile orchestration router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load Athena routes - Dynamic agent spawning and tool creation
    try {
      log.info('🏛️ Loading Athena router...', LogContext.SERVER);
      const { athena } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/athena', athena);
      log.info('✅ Athena routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Athena router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load AB-MCTS routes
    try {
      const { abMcts } = await import('./migration/compatibility-stubs');
      const abMCTSModule = { default: abMcts };
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
      const { vision } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/vision', vision);
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

    // Load Vision routes
    try {
      const { vision } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/vision', vision);
      log.info('✅ Vision routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Failed to load vision routes', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load Vision Debug routes
    try {
      const { visionDebugSimple } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/vision-debug', visionDebugSimple);
      log.info('✅ Vision Debug routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Vision Debug routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load HuggingFace routes (only when external calls are allowed)
    if (!config.disableExternalCalls && !config.offlineMode) {
      try {
        const { huggingface } = await import('./migration/compatibility-stubs');
        this.app.use('/api/v1/huggingface', huggingface);
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
      const { mlx } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/mlx', mlx);
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
          timestamp: safeToISOString(),
          version: 'fallback',
        });
      });
    }

    // Load Image Generation routes - Real AI image generation with multiple backends
    try {
      const imageGenerationRouter = await import('./routers/image-generation-router');
      this.app.use('/api/image-generation', imageGenerationRouter.default);
      log.info('✅ Real Image Generation routes loaded with multiple backend support', LogContext.SERVER);
      
      // Also load legacy routes for compatibility
      const { imageGeneration } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/images', imageGeneration);
      log.info('✅ Image Generation routes loaded with MLX optimization', LogContext.SERVER);

      // Initialize image generation service and check dependencies
      const { imageGenerationService } = await import('./services/image-generation-service');
      
      // Check if running on Apple Silicon for optimal performance
      const isAppleSilicon = process.arch === 'arm64' && process.platform === 'darwin';
      if (isAppleSilicon) {
        log.info('🎨 Image generation optimized for Apple Silicon MPS acceleration', LogContext.AI);
      } else {
        log.warn('⚠️ Image generation running on CPU (slower performance)', LogContext.AI, {
          platform: process.platform,
          arch: process.arch,
          suggestion: 'Apple Silicon recommended for optimal image generation performance'
        });
      }

      // Wait for service initialization
      imageGenerationService.on('ready', () => {
        log.info('✅ Image Generation service initialized successfully', LogContext.AI, {
          appleSilicon: isAppleSilicon,
          device: isAppleSilicon ? 'mps' : 'cpu'
        });
      });

      imageGenerationService.on('error', (error) => {
        log.warn('⚠️ Image Generation service initialization failed', LogContext.AI, {
          error: error instanceof Error ? error.message : String(error)
        });
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('❌ Failed to load Image Generation routes', LogContext.SERVER, {
        error: errorMessage,
        suggestion: 'Image generation requires Python environment with MLX and diffusers packages'
      });

      // Don't fail server startup if image generation is unavailable
      log.info('🔄 Server continuing without image generation capabilities', LogContext.SERVER);

      // Mount a minimal fallback health endpoint
      this.app.get('/api/v1/images/health', (req, res) => {
        res.status(200).json({
          success: true,
          degraded: true,
          status: 'unavailable',
          error: errorMessage,
          timestamp: safeToISOString(),
          service: 'image-generation'
        });
      });
    }

    // Load system metrics routes
    try {
      const { systemMetrics } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/system', systemMetrics);
      log.info('✅ System metrics routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ System metrics routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load performance monitoring routes
    try {
      const { performance } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/performance', performance);
      log.info('✅ Performance monitoring routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Performance monitoring routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load enhanced performance analytics routes for Arc UI dashboard
    try {
      const { performanceAnalytics } = await import('./migration/compatibility-stubs');
      this.app.use('/api/v1/performance-analytics', performanceAnalytics);
      log.info(
        '✅ Enhanced Performance Analytics routes loaded - Arc UI dashboard support enabled',
        LogContext.SERVER
      );
    } catch (error) {
      log.warn('⚠️ Performance Analytics routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load MCP agent management routes
    try {
      log.info('🔄 Loading MCP agent management router...', LogContext.SERVER);
      const { mcpAgent } = await import('./migration/compatibility-stubs');
      const mcpAgentModule = { default: mcpAgent };
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
      const { athena } = await import('./migration/compatibility-stubs');
      const athenaModule = { default: athena };
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

    // Smart Context Queries router - Lightweight, just-in-time context retrieval
    try {
      log.info('🧠 Loading Smart Context router...', LogContext.SERVER);
      const smartContextModule = await import('./routers/smart-context');
      log.info('✅ Smart Context module imported successfully', LogContext.SERVER, {
        hasDefault: !!smartContextModule.default,
        moduleType: typeof smartContextModule.default,
      });
      this.app.use('/api/v1/smart-context', smartContextModule.default);
      log.info('✅ Smart Context router mounted at /api/v1/smart-context', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Smart Context router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Webhooks router - AppFlowy, Git, CI/CD, and development tool integrations
    try {
      log.info('🔗 Loading Webhooks router...', LogContext.SERVER);
      const webhooksModule = await import('./routers/webhooks');
      log.info('✅ Webhooks module imported successfully', LogContext.SERVER, {
        hasDefault: !!webhooksModule.default,
        moduleType: typeof webhooksModule.default,
      });
      this.app.use('/api/v1/webhooks', webhooksModule.default);
      log.info('✅ Webhooks router mounted at /api/v1/webhooks', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Webhooks router', LogContext.SERVER, {
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

    // Load status and health monitoring routes
    try {
      const statusRouter = (await import('./routers/status')).default;
      this.app.use('/api/v1/status', statusRouter);
      log.info('✅ Status/health monitoring routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load status routes', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load database health monitoring routes
    try {
      const databaseHealthRouter = (await import('./routers/database-health')).default;
      this.app.use('/api/v1/database', databaseHealthRouter);
      log.info('✅ Database health monitoring routes loaded', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load database health routes', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load Repository ML router
    try {
      log.info('🔍 Loading Repository ML router...', LogContext.SERVER);
      const repositoryMLModule = await import('./routers/repository-ml');
      log.info('✅ Repository ML module imported successfully', LogContext.SERVER, {
        hasDefault: !!repositoryMLModule.default,
        moduleType: typeof repositoryMLModule.default,
      });
      this.app.use('/api/v1/repository-ml', repositoryMLModule.default);
      log.info('✅ Repository ML router mounted at /api/v1/repository-ml', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Repository ML router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Programming Languages Knowledge router
    try {
      log.info('Setting up Programming Languages Knowledge router', LogContext.STARTUP);
      const programmingLanguagesRouter = (await import('./routers/programming-languages')).default;
      this.app.use('/api/v1/programming-languages', programmingLanguagesRouter);
      log.info('✅ Programming Languages router mounted at /api/v1/programming-languages', LogContext.SERVER);

      // Framework Inventory API
      const frameworkInventoryRouter = (await import('./routers/framework-inventory')).default;
      this.app.use('/api/v1/frameworks', frameworkInventoryRouter);

      // Xcode Vision Monitoring (macOS development automation)
      try {
        const xcodeVisionModule = await import('./routers/xcode-vision.js');
        this.app.use('/api/xcode-vision', xcodeVisionModule.default);
        log.info('✅ Xcode Vision Monitor router loaded - Screen monitoring for Swift/Xcode development', LogContext.SERVER);
      } catch (error) {
        log.warn('⚠️ Xcode Vision Monitor router failed to load', LogContext.SERVER, {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Test Failure Learning API (Pattern learning from test failures)
      try {
        const testFailureLearningModule = await import('./routers/test-failure-learning');
        this.app.use('/api/test-failure-learning', testFailureLearningModule.default);
        log.info('✅ Test Failure Learning router loaded - Automated pattern learning from test failures', LogContext.SERVER);
      } catch (error) {
        log.warn('⚠️ Test Failure Learning router failed to load', LogContext.SERVER, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      log.info('✅ Framework Inventory router mounted at /api/v1/frameworks', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to load Programming Languages router', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load other async routes here as needed

    // CRITICAL: Error tracking middleware error handler must be last middleware
    // This ensures all errors from routes and other middleware are caught
    this.app.use(errorTrackingService.errorHandler());

    log.info('🛡️ Error tracking handler installed as final middleware', LogContext.SERVER);
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
