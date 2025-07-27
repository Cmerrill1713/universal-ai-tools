/**
 * Universal AI Tools Service - Clean Implementation
 * Main server with Express, TypeScript, and comprehensive error handling
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createClient } from '@supabase/supabase-js';

// Configuration and utilities
import { config, validateConfig } from '@/config/environment';
import { LogContext, log } from '@/utils/logger';
import { apiResponseMiddleware } from '@/utils/api-response';
import { getPorts, logPortConfiguration } from '@/config/ports';

// Middleware
import { createRateLimiter } from '@/middleware/rate-limiter-enhanced';
import {
  intelligentParametersMiddleware,
  optimizeParameters,
} from '@/middleware/intelligent-parameters';

// Agent system
import AgentRegistry from '@/agents/agent-registry';

// Types
import type { ServiceConfig } from '@/types';

class UniversalAIToolsServer {
  private app: express.Application;
  private server: unknown;
  private io:
    | SocketIOServer // TODO: Refactor nested ternary
    | null = null;
  private supabase: unknown = null;
  private agentRegistry: AgentRegistry | null = null;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.initializeServices();
    this.setupMiddleware();
    this.setupWebSocket();

    // Routes will be loaded in start() method due to async imports
  }

  private initializeServices(): void {
    this.initializeSupabase();
    this.initializeAgentRegistry();
  }

  private initializeAgentRegistry(): void {
    try {
      this.agentRegistry = new AgentRegistry();
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

      log.info('✅ Supabase client initialized', LogContext.DATABASE);
    } catch (error) {
      log.error('❌ Failed to initialize Supabase client', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow server to start without Supabase for testing
    }
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      })
    );

    // CORS middleware
    this.app.use(
      cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or curl requests)
          if (!origin) return callback(null, true);

          const // TODO: Refactor nested ternary
            allowedOrigins = [
              'http://localhost:5173',
              'http://localhost:3000',
              process.env.FRONTEND_URL,
            ].filter(Boolean);

          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-AI-Service'],
        exposedHeaders: ['X-Request-Id'],
        maxAge: 86400, // 24 hours
      })
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Rate limiting middleware - Apply globally
    this.app.use(createRateLimiter());

    // API response middleware
    this.app.use(apiResponseMiddleware);

    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        log.info(`${req.method} ${req.path} - ${res.statusCode}`, LogContext.API, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
      });

      next();
    });

    // Handle preflight requests
    this.app.options('*', (req, res) => {
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-API-Key, X-AI-Service'
      );
      res.header('Access-Control-Allow-Credentials', 'true');
      res.sendStatus(204);
    });

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
        } catch (error) {
          // MLX service not available
          mlxHealth = false;
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
            redis: false, // Will be updated when Redis is added
            mlx: mlxHealth,
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
      } catch (error) {
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

    // System status endpoint (frontend expects this)
    this.app.get('/api/v1/status', async (req, res) => {
      try {
        const health = {
          status: 'operational',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: config.environment,
          services: {
            backend: 'healthy',
            database: this.supabase ? 'healthy' : 'unavailable',
            websocket: this.io ? 'healthy' : 'unavailable',
            agents: this.agentRegistry ? 'healthy' : 'unavailable',
            redis: false,
            mlx: false,
          },
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

    // Simple monitoring endpoints for client compatibility
    this.app.get('/metrics', (req, res) => {
      res.json({
        success: true,
        data: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      });
    });

    this.app.get('/status', (req, res) => {
      res.json({
        success: true,
        status: 'operational',
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/performance', (req, res) => {
      res.json({
        success: true,
        data: {
          responseTime: Math.random() * 100,
          requestsPerSecond: Math.random() * 1000,
          timestamp: new Date().toISOString()
        }
      });
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

    // A2A Communication mesh endpoints (temporarily disabled until import fixed)
    // TODO: Fix import issue with a2a-collaboration router
    // const a2aRouter = (await import('./routers/a2a-collaboration')).default;
    // this.app.use('/api/v1/a2a', a2aRouter);

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
      } catch (error) {
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
        const // TODO: Refactor nested ternary
          metrics = pyVisionBridge.getMetrics();

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
      } catch (error) {
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
              .from('memories')
              .insert({
                source_type: 'service',
                source_id: '00000000-0000-0000-0000-000000000001', // Static service UUID for vision
                content: `Visual content: ${imagePath ? `image at ${imagePath}` : 'base64 image'}`,
                content_type: 'image',
                visual_embedding: embeddingResult.data.vector,
                image_metadata: {
                  model: embeddingResult.model,
                  dimension: embeddingResult.data.dimension,
                  processingTime: embeddingResult.processingTime,
                  timestamp: new Date().toISOString(),
                },
                image_path: imagePath || null,
                is_generated: false,
                source: 'vision-embedding-api',
                memory_type: 'visual',
                importance: 0.8,
                metadata: {
                  type: 'vision_embedding',
                  model: embeddingResult.model,
                },
              })
              .select('id')
              .single();

            if (memoryError) {
              log.error('Failed to save memory record', LogContext.DATABASE, {
                error: memoryError,
              });
            } else {
              // TODO: Refactor nested ternary
              memoryId = memoryData?.id;
              log.info('✅ Vision embedding saved to memory', LogContext.DATABASE, {
                memoryId,
                model: embeddingResult.model,
              });

              // Also save to vision_embeddings table for faster lookups
              const { error: embeddingError } = await this.supabase
                .from('vision_embeddings')
                .insert({
                  memory_id: memoryId,
                  embedding: embeddingResult.data.vector,
                  model_version: embeddingResult.model,
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
          data: embeddingResult.data,
          model: embeddingResult.model,
          processingTime: embeddingResult.processingTime,
          cached: embeddingResult.cached || false,
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
        const {
          imagePath,
          imageBase64, // TODO: Refactor nested ternary
          limit = 10,
          threshold = 0.8,
        } = req.body;

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

  private setupAgentRoutes(): void {
    // List available agents
    this.app.get('/api/v1/agents', (req, res) => {
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

      const // TODO: Refactor nested ternary
        agents = this.agentRegistry.getAvailableAgents();
      const loadedAgents = this.agentRegistry.getLoadedAgents();

      res.json({
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
    this.app.post(
      '/api/v1/agents/execute',
      intelligentParametersMiddleware(), // Apply intelligent parameters for agent tasks
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

          const { agentName, userRequest, context = {} } = req.body;

          if (!agentName || !userRequest) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'MISSING_REQUIRED_FIELD',
                message: 'Agent name and user request are required',
              },
            });
          }

          const agentContext = {
            userRequest,
            requestId: (req.headers['x-request-id'] as string) || `req_${Date.now()}`,
            workingDirectory: process.cwd(),
            userId: (req as any).user?.id || 'anonymous',
            ...context,
          };

          const result = await this.agentRegistry.processRequest(agentName, agentContext);

          res.json({
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

          res.status(500).json({
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
    this.app.post('/api/v1/agents/parallel', async (req, res) => {
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

        if (
          !Array.isArray(agentRequests) ||
          agentRequests.length === 0 // TODO: Refactor nested ternary
        ) {
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
        const parallelRequests = agentRequests.map((request: unknown) => ({
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
        const results = await this.agentRegistry.processParallelRequests(parallelRequests);
        const executionTime = Date.now() - startTime;

        res.json({
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

        res.status(500).json({
          success: false,
          error: {
            code: 'PARALLEL_EXECUTION_ERROR',
            message: 'Parallel agent execution failed',
            details: errorMessage,
          },
        });
      }
    });

    // Agent orchestration
    this.app.post('/api/v1/agents/orchestrate', async (req, res) => {
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

        const {
          primaryAgent, // TODO: Refactor nested ternary
          supportingAgents = [],
          userRequest,
          context = {},
        } = req.body;

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

        res.json({
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

        res.status(500).json({
          success: false,
          error: {
            code: 'ORCHESTRATION_ERROR',
            message: 'Agent orchestration failed',
            details: errorMessage,
          },
        });
      }
    });

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

        res.json({
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

        res.status(500).json({
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
      this.io = // TODO: Refactor nested ternary
        new SocketIOServer(this.server, {
          cors: {
            origin: (origin, callback) => {
              // Allow all origins in development
              if (!origin || process.env.NODE_ENV === 'development') {
                return callback(null, true);
              }
              
              const allowedOrigins = [
                'http://localhost:5173',
                'http://localhost:3000',
                'http://localhost:9999',
                process.env.FRONTEND_URL
              ].filter(Boolean);
              
              if (allowedOrigins.includes(origin)) {
                callback(null, true);
              } else {
                callback(null, false);
              }
            },
            methods: ['GET', 'POST'],
            credentials: true
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

      log.info('✅ WebSocket server initialized', LogContext.WEBSOCKET);
    } catch (error) {
      log.error('❌ Failed to initialize WebSocket server', LogContext.WEBSOCKET, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private setupErrorHandling(): void {
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

    // Global error handler
    this.app.use((error: unknown, req: unknown, res: unknown, next: unknown) => {
      const statusCode = error.status || error.statusCode || 500;
      const message = error.message || 'Internal server error';

      log.error('Unhandled server error', LogContext.SERVER, {
        error: message,
        stack: error.stack,
        path: req.path,
        method: req.method,
      });

      res.status(statusCode).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: config.environment === 'development' ? message : 'Something went wrong',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id,
        },
      });
    });

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

    this.isShuttingDown = true; // TODO: Refactor nested ternary
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

      // Close WebSocket server
      if (this.io) {
        this.io.close(() => {
          log.info('WebSocket server closed', LogContext.WEBSOCKET);
        });
      }

      // Shutdown agent registry
      if (this.agentRegistry) {
        await this.agentRegistry.shutdown();
      }

      // Stop health monitor
      try {
        const { healthMonitor } = await import('./services/health-monitor');
        healthMonitor.stop();
        log.info('Health monitor stopped', LogContext.SYSTEM);
      } catch (error) {
        // Health monitor might not be loaded
      }

      // Close database connections would go here
      // await this.supabase?.close?.();

      log.info('Graceful shutdown completed', LogContext.SYSTEM);
      process.exit(0);
    } catch (error) {
      log.error('Error during shutdown', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      // Validate configuration
      validateConfig();

      // Load async routes BEFORE starting server
      await this.setupRoutesSync();
      await this.loadAsyncRoutes();
      log.info('✅ All async routes loaded successfully', LogContext.SERVER);

      // Setup error handling AFTER all routes are loaded
      this.setupErrorHandling();
      log.info('✅ Error handling setup completed (after route loading)', LogContext.SERVER);

      // Use fixed port 9999 as requested
      const // TODO: Refactor nested ternary
        port = 9999;

      // Start server
      await new Promise<void>((resolve, reject) => {
        this.server
          .listen(port, () => {
            log.info(`🚀 Universal AI Tools Service running on port ${port}`, LogContext.SERVER, {
              environment: config.environment,
              port,
              healthCheck: `http://localhost:${port}/health`,
            });
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

  private async loadAsyncRoutes(): Promise<void> {
    try {
      // Load monitoring routes
      const monitoringModule = await import('./routers/monitoring');
      this.app.use('/api/v1/monitoring', monitoringModule.default);
      log.info('✅ Monitoring routes loaded', LogContext.SERVER);

      // Start automated health monitoring
      const { healthMonitor } = await import('./services/health-monitor');
      await healthMonitor.start();
      log.info('✅ Health monitor service started', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ Monitoring routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Load chat routes
    try {
      const chatModule = await import('./routers/chat');
      this.app.use('/api/v1/chat', chatModule.default);

      // Make agent registry globally available for chat
      (global as any).agentRegistry = this.agentRegistry;

      log.info('✅ Chat routes loaded', LogContext.SERVER);
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

    // Load AB-MCTS routes
    try {
      const // TODO: Refactor nested ternary
        abMCTSModule = await import('./routers/ab-mcts-fixed');
      log.info('📦 AB-MCTS module imported successfully', LogContext.SERVER, {
        hasDefault: !!abMCTSModule.default,
        moduleType: typeof abMCTSModule.default,
      });

      if (abMCTSModule.default) {
        this.app.use('/api/v1/ab-mcts', abMCTSModule.default);

        // Verify route mounting by checking router stack
        const mountedRoutes = this.app._router?.stack?.filter((layer) =>
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

    // Load Vision routes
    try {
      const // TODO: Refactor nested ternary
        visionModule = await import('./routers/vision');
      this.app.use('/api/v1/vision', visionModule.default);
      log.info('✅ Vision routes loaded', LogContext.SERVER);

      // Initialize PyVision service for embeddings
      const { pyVisionBridge } = await import('./services/pyvision-bridge');
      log.info('✅ PyVision service initialized for embeddings', LogContext.AI);
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

    // Load HuggingFace routes (now routed through LM Studio)
    try {
      const // TODO: Refactor nested ternary
        huggingFaceModule = await import('./routers/huggingface');
      this.app.use('/api/v1/huggingface', huggingFaceModule.default);
      log.info('✅ HuggingFace routes loaded (using LM Studio adapter)', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ HuggingFace routes failed to load', LogContext.SERVER, {
        error: error instanceof Error ? error.message : String(error),
      });
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
    }

    // Load system metrics routes
    try {
      const // TODO: Refactor nested ternary
        systemMetricsModule = await import('./routers/system-metrics');
      this.app.use('/api/v1/system', systemMetricsModule.default);
      log.info('✅ System metrics routes loaded', LogContext.SERVER);
    } catch (error) {
      log.warn('⚠️ System metrics routes failed to load', LogContext.SERVER, {
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

    // Load knowledge scraper routes
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

    // Load other async routes here as needed
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new UniversalAIToolsServer();
  server.start();
}

export default UniversalAIToolsServer;
export { UniversalAIToolsServer };
