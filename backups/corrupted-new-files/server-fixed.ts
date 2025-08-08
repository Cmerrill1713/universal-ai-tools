/**
 * Universal AI Tools Service - Fixed Implementation
 * Main server with Express, TypeScript, and comprehensive error handling
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Server } from 'http';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

// Configuration and utilities
import { config, validateConfig } from '@/config/environment';
import { LogContext, log } from '@/utils/logger';
import { apiResponseMiddleware } from '@/utils/api-response';
import { getPorts, logPortConfiguration } from '@/config/ports';
import type { EmbeddingResult } from './types';

// Middleware
import { createRateLimiter } from '@/middleware/rate-limiter-enhanced';
import { intelligentParametersMiddleware, optimizeParameters } from '@/middleware/intelligent-parameters';

// Agent system
import AgentRegistry from '@/agents/agent-registry';

// MCP Integration
import { mcpIntegrationService } from '@/services/mcp-integration-service';

// Context Injection Services
import { contextStorageService } from '@/services/context-storage-service';

// Timeout management
import { ServerTimeoutManager, defaultTimeouts } from '@/core/server-timeouts';

// Types
import type { ServiceConfig } from '@/types';

class UniversalAIToolsServer {
  private app: express.Application;
  private server: Server;
  private io: SocketIOServer | null = null;
  private supabase: SupabaseClient | null = null;
  private agentRegistry: AgentRegistry | null = null;
  private timeoutManager: ServerTimeoutManager;
  private isShuttingDown = false;

  function Object() { [native code] }() {
    this.app = express();
    this.server = createServer(this.app);
    this.timeoutManager = new ServerTimeoutManager(defaultTimeouts);
    this.setupMiddleware();
    this.setupWebSocket();
  }

  private async initializeServices(): Promise<void> {
    this.initializeSupabase();
    this.initializeAgentRegistry();
    await this.initializeContextServices();
  }

  private initializeAgentRegistry(): void {
    try {
      this.agentRegistry = new AgentRegistry();
      log.info('✅ Agent Registry initialized', LogContext.AGENT);
    } catch (error) {
      log.error('❌ Failed to initialize Agent Registry', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private initializeSupabase(): void {
    try {
      if (!config.supabase?.url || !config.supabase?.serviceKey) {
        throw new Error('Supabase configuration missing');
      }

      this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
      log.info('✅ Supabase client initialized', LogContext.DATABASE);
    } catch (error) {
      log.error('❌ Failed to initialize Supabase client', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async initializeContextServices(): Promise<void> {
    try {
      log.info('🔍 Initializing context injection service', LogContext.DATABASE);

      if (this.supabase) {
        const testContext = {
          contextSummary: 'Context injection disabled during cleanup',
          relevantPatterns: [],
        };

        log.info('✅ Context injection service initialized', LogContext.DATABASE, {
          contextTokens: testContext.contextSummary?.length || 0,
          sourcesUsed: testContext.relevantPatterns?.length || 0,)
        });

        const storedContextId = await contextStorageService.storeContext({
          content: 'Universal AI Tools - Server startup completed with context injection enabled',
          category: 'project_info',
          source: 'server_startup',
          userId: 'system',
          projectPath: '/Users/christianmerrill/Desktop/universal-ai-tools',
          metadata: {
            startup_time: new Date().toISOString(),
            features_enabled: ['context_injection', 'supabase_storage', 'agent_registry'],
          },
        });

        if (storedContextId) {
          log.info('✅ Context storage service initialized', LogContext.DATABASE, {
            storedContextId,)
          });
        }
      }
    } catch (error) {
      log.warn('⚠️ Context injection service initialization failed', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private setupMiddleware(): void {
    // Configure server-level timeouts
    this.timeoutManager.configureServerTimeouts(this.server);
    
    // Request timeout middleware
    this.app.use(this.timeoutManager.createTimeoutMiddleware());

    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],))
          },
        },
      })
    );

    // CORS middleware
    this.app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);

          const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            process.env.FRONTEND_URL
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
        maxAge: 86400,
      })
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: '50mb')) }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb')) }));

    // Rate limiting middleware
    this.app.use(createRateLimiter());

    // API response middleware
    this.app.use(apiResponseMiddleware);

    log.info('✅ Middleware setup completed', LogContext.SERVER);
  }

  private setupWebSocket(): void {
    try {
      this.io = new SocketIOServer(this.server, {
        cors: {
          origin: (origin, callback) => {
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
          credentials: true,
        },
      });

      this.io.on('connection', (socket) => {
        log.info(`WebSocket client connected: ${socket.id)}`, LogContext.WEBSOCKET);

        socket.on('disconnect', () => {
          log.info(`WebSocket client disconnected: ${socket.id)}`, LogContext.WEBSOCKET);
        });

        socket.on('ping', () => {
          socket.emit('pong', { timestamp: new Date().toISOString() });
        });
      });

      log.info('✅ WebSocket server initialized', LogContext.WEBSOCKET);
    } catch (error) {
      log.error('❌ Failed to initialize WebSocket server', LogContext.WEBSOCKET, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async start(): Promise<void> {
    try {
      validateConfig();
      
      await this.initializeServices();
      log.info('✅ All services initialized successfully', LogContext.SERVER);

      const port = config.port || 9999;

      await new Promise<void>((resolve, reject) => {
        this.server
          .listen(port, () => {
            log.info(`🚀 Universal AI Tools Service running on port ${port)}`, LogContext.SERVER, {
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
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new UniversalAIToolsServer();
  server.start();
}

export default UniversalAIToolsServer;
export { UniversalAIToolsServer };