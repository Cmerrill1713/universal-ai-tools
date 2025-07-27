/**
 * Universal AI Tools - Minimal Working Server
 * Basic server to test core functionality while fixing dependencies
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

// Use basic logger fallback
const logger = {
  info: (msg: string, data?: any) => logger.info(`[INFO] ${msg}`, data || ''),
  error: (msg: string, data?: any) => logger.error(`[ERROR] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
  debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || '')
};

// Application setup
const app = express();
const server = createServer(app);

// Configuration
const PORT = process.env.PORT || 9999;
const NODE_ENV = process.env.NODE_ENV || 'development';

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

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      server: true,
      dependencies: 'minimal'
    },
    version: '1.0.0-minimal'
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
        chat: '/api/v1/chat',
        status: '/api/v1/status'
      }
    }
  });
});

// Basic chat endpoint for testing
app.post('/api/v1/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    res.json({
      success: true,
      message: `Echo: ${message}`,
      timestamp: new Date().toISOString(),
      mode: 'minimal-server'
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
    mode: 'dependency-fixing'
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

// Start server
const startServer = async () => {
  try {
    server.listen(PORT, () => {
      logger.info(`🚀 Universal AI Tools Service (Minimal) running on port ${PORT}`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`📱 API status: http://localhost:${PORT}/api/v1/status`);
      logger.info(`💬 Test chat: POST http://localhost:${PORT}/api/v1/chat`);
      logger.info(`🛠️  Mode: Dependency fixing - minimal functionality`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;