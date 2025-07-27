/**
 * Universal AI Tools - Minimal Working Server
 * Clean implementation for testing while fixing dependencies
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Basic logger implementation
const logger = {
  info: (msg: string, data?: any) => logger.info(`[INFO] ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg: string, data?: any) => logger.error(`[ERROR] ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data ? JSON.stringify(data, null, 2) : '')
};

// Application setup
const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Configuration
const PORT = process.env.PORT || 9999;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Supabase client with fallback
let supabase: any = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    logger.info('✅ Supabase client initialized');
  } else {
    logger.warn('⚠️ Supabase credentials not provided, running without database');
  }
} catch (error) {
  logger.error('❌ Failed to initialize Supabase client:', error);
}

// Basic middleware setup
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  next();
});

// Simple authentication middleware
const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  // Skip auth for health checks and public endpoints
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/') {
    return next();
  }

  if (apiKey) {
    // API Key authentication
    req.apiKey = apiKey;
    req.aiService = { service_name: req.headers['x-ai-service'] || 'default' };
    return next();
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // For development, allow unauthenticated requests
  if (NODE_ENV === 'development') {
    req.user = { id: 'dev-user' };
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
};

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      supabase: !!supabase,
      redis: false, // not implemented yet
      agentRegistry: false, // not implemented yet
      server: true
    },
    version: '1.0.0-minimal',
    mode: 'dependency-fixing'
  };
  res.json(health);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Universal AI Tools',
    status: 'running',
    version: '1.0.0-minimal',
    mode: 'dependency-fixing',
    endpoints: {
      health: '/health',
      api: {
        status: '/api/v1/status',
        chat: '/api/v1/chat'
      }
    }
  });
});

// Basic chat endpoint for testing
app.post('/api/v1/chat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    // Echo response for now
    res.json({
      success: true,
      message: `Echo from Universal AI Tools: ${message}`,
      timestamp: new Date().toISOString(),
      mode: 'minimal-server',
      requestId: Math.random().toString(36).substring(2, 15)
    });

  } catch (error) {
    logger.error('Chat endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API status endpoint
app.get('/api/v1/status', (req, res) => {
  res.json({
    server: 'running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: NODE_ENV,
    version: '1.0.0-minimal',
    mode: 'dependency-fixing',
    features: {
      supabase: !!supabase,
      websocket: true,
      authentication: true
    }
  });
});

// List available agents (placeholder)
app.get('/api/v1/agents', authMiddleware, (req, res) => {
  res.json({
    success: true,
    agents: [
      { name: 'evaluation_agent', status: 'available', category: 'cognitive' },
      { name: 'human_feedback_service', status: 'available', category: 'service' },
      { name: 'internal_llm_relay', status: 'available', category: 'service' }
    ],
    totalCount: 3,
    mode: 'minimal-server'
  });
});

// WebSocket handling
io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`WebSocket client disconnected: ${socket.id}`);
  });

  // Echo test for WebSocket
  socket.on('test', (data) => {
    logger.info('WebSocket test received:', data);
    socket.emit('test_response', {
      original: data,
      timestamp: new Date().toISOString(),
      server: 'universal-ai-tools-minimal'
    });
  });
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Path ${req.path} not found`
  });
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close WebSocket connections
    io.close();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise });
  gracefulShutdown('unhandledRejection');
});

// Start server
const startServer = async () => {
  try {
    server.listen(PORT, () => {
      logger.info(`🚀 Universal AI Tools Service (Minimal) running on port ${PORT}`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`📡 WebSocket server ready`);
      logger.info(`🛠️  Mode: Dependency fixing - minimal functionality`);
      logger.info(`💬 Test endpoints:`);
      logger.info(`   GET http://localhost:${PORT}/api/v1/status`);
      logger.info(`   POST http://localhost:${PORT}/api/v1/chat`);
      logger.info(`   GET http://localhost:${PORT}/api/v1/agents`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;