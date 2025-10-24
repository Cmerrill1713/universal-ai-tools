#!/usr/bin/env node
/**
 * Universal AI Tools - Main Server Entry Point
 * Comprehensive AI orchestration platform
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config';
import { logger } from './utils';

const PORT = parseInt(process.env.PORT || '9999', 10);

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

// API routes
app.get('/api/v1/status', (req, res) => {
  res.json({
    status: 'operational',
    services: {
      'universal-ai-tools': 'running',
      'neuroforge': 'available',
      'api-gateway': 'active'
    },
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Universal AI Tools',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      status: '/api/v1/status',
      docs: '/api/docs'
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
server.listen(PORT, () => {
  logger.info(`🚀 Universal AI Tools server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`📋 API status: http://localhost:${PORT}/api/v1/status`);
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