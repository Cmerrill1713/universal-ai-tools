/**
 * Incremental Server - Adds comprehensive features to working chat
 * This bridges the gap between simple working chat and full production server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createClient } from '@supabase/supabase-js';

// Utilities
import { LogContext, log } from './utils/logger.js';
import { config } from './config/environment.js';

// Services
import AgentRegistry from './agents/agent-registry.js';
import { intelligentAgentSelector } from './services/intelligent-agent-selector.js';
import { SupabaseMemoryService } from './services/supabase-memory-service.js';

// Routers
import chatRouter from './routers/chat.js';
import memoryRouter from './routers/memory.js';
import monitoringRouter from './routers/monitoring.js';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize core services
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Initialize agent registry
const agentRegistry = new AgentRegistry();
(global as any).agentRegistry = agentRegistry;

// Initialize memory service
const memoryService = new SupabaseMemoryService();
(global as any).memoryService = memoryService;

// Health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    version: '2.0.0-incremental',
    services: {
      agentRegistry: agentRegistry ? 'available' : 'unavailable',
      memoryService: memoryService ? 'available' : 'unavailable',
      intelligentAgentSelector: intelligentAgentSelector ? 'available' : 'unavailable'
    },
    timestamp: new Date().toISOString()
  };
  res.json(health);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Universal AI Tools - Incremental Server',
    version: '2.0.0-incremental',
    status: 'running',
    endpoints: [
      '/health',
      '/api/v1/chat',
      '/api/v1/memory',
      '/api/v1/monitoring'
    ]
  });
});

// Mount routers
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/memory', memoryRouter);
app.use('/api/v1/monitoring', monitoringRouter);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  log.error('Unhandled error', LogContext.SERVER, {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred'
    }
  });
});

// WebSocket handling
io.on('connection', (socket) => {
  log.info('WebSocket client connected', LogContext.WEBSOCKET, {
    id: socket.id
  });

  socket.on('disconnect', () => {
    log.info('WebSocket client disconnected', LogContext.WEBSOCKET, {
      id: socket.id
    });
  });
});

// Start server
const PORT = process.env.PORT || 9999;

async function start() {
  try {
    // Initialize services
    log.info('🚀 Starting Universal AI Tools Incremental Server', LogContext.SERVER);
    
    // Start server
    server.listen(PORT, () => {
      log.info(`✅ Server running on port ${PORT}`, LogContext.SERVER, {
        environment: process.env.NODE_ENV || 'development',
        healthCheck: `http://localhost:${PORT}/health`
      });
      
      console.log(`\n🟢 Incremental server running at http://localhost:${PORT}`);
      console.log(`\n📝 Test the chat endpoint:`);
      console.log(`curl -X POST http://localhost:${PORT}/api/v1/chat \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"message": "Hello, how can you help me?", "userId": "test-user"}'`);
    });
  } catch (error) {
    log.error('Failed to start server', LogContext.SERVER, {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  log.info('SIGTERM received, shutting down gracefully', LogContext.SERVER);
  server.close(() => {
    log.info('Server closed', LogContext.SERVER);
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  log.info('SIGINT received, shutting down gracefully', LogContext.SERVER);
  server.close(() => {
    log.info('Server closed', LogContext.SERVER);
    process.exit(0);
  });
});

// Start the server
start().catch((error) => {
  log.error('Fatal error starting server', LogContext.SERVER, {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});

export default app;