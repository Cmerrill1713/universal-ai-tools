// Minimal server without problematic imports to isolate the issue

console.log('📍 Starting minimal server...');

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, initializeConfig } from './src/config/index';
import { logger, LogContext } from './src/utils/enhanced-logger';

console.log('📍 All imports completed successfully');

// Initialize configuration
initializeConfig();

console.log('📍 Configuration initialized');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📍 Creating Express app');
const app = express();
const { port } = config.server;

console.log('📍 Creating Supabase client');
// Supabase client
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey || ''
);

console.log('📍 Supabase client created successfully');

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Universal AI Tools Service (Minimal)',
    timestamp: new Date().toISOString(),
  });
});

// API Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    version: '1.0.0',
    status: 'minimal server running',
    endpoints: {
      health: 'GET /health',
      docs: 'GET /api/docs',
    },
  });
});

// Start server
console.log(`📍 About to start server on port ${port}...`);
const server = app.listen(port, () => {
  logger.info(`✅ Minimal Universal AI Tools Service running on port ${port}`);
  logger.info(`Health check: http://localhost:${port}/health`);
  logger.info(`API docs: http://localhost:${port}/api/docs`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit', LogContext.SYSTEM);
    process.exit(1);
  }, 5000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

console.log('📍 Server setup completed');
