#!/usr/bin/env node
/**
 * Universal AI Tools - Main Server Entry Point
 * Comprehensive AI orchestration platform
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

// Simple configuration
const PORT = parseInt(process.env.PORT || '9999', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Simple logger
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || ''),
  debug: (message: string, data?: any) => console.debug(`[DEBUG] ${message}`, data || '')
};

// Create Express app
const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Universal AI Tools Service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Athena API routes
app.get('/api/v1/status', (req, res) => {
  res.json({
    status: 'operational',
    services: {
      'universal-ai-tools': 'running',
      'athena-backend': 'http://localhost:8013',
      'athena-api': 'http://localhost:8888',
      'neuroforge': 'available',
      'api-gateway': 'active'
    },
    timestamp: new Date().toISOString()
  });
});

// Athena backend proxy
app.use('/api/v1/athena', async (req, res) => {
  try {
    const athenaUrl = `http://localhost:8013${req.path}`;
    const response = await fetch(athenaUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    logger.error('Athena proxy error:', { error: error.message });
    res.status(502).json({ error: 'Athena backend unavailable' });
  }
});

// Athena integration endpoints
app.get('/api/v1/athena/health', async (req, res) => {
  try {
    const athenaResponse = await fetch('http://localhost:8013/health');
    const athenaData = await athenaResponse.json();
    res.json({
      ...athenaData,
      gateway: 'universal-ai-tools',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(502).json({
      error: 'Athena backend unavailable',
      gateway: 'universal-ai-tools',
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Universal AI Tools - Athena Gateway',
    version: '1.0.0',
    status: 'running',
    athena: {
      backend: 'http://localhost:8013',
      api: 'http://localhost:8888',
      swift_app: 'AthenaIOS/AthenaApp.swift'
    },
    endpoints: {
      health: '/health',
      status: '/api/v1/status',
      athena_health: '/api/v1/athena/health',
      athena_proxy: '/api/v1/athena/*'
    }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error:', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
server.listen(PORT, HOST, () => {
  logger.info(`🚀 Universal AI Tools server running on ${HOST}:${PORT}`);
  logger.info(`📊 Health check: http://${HOST}:${PORT}/health`);
  logger.info(`📋 API status: http://${HOST}:${PORT}/api/v1/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;