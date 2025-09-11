#!/usr/bin/env tsx

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { initializeConfig, config } from './src/config/index';
import { applySecurityMiddleware } from './src/middleware/security';
import { logger, LogContext } from './src/utils/enhanced-logger';

// Initialize configuration
initializeConfig();

const app = express();
const port = 9999;

// Create Supabase client
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey || ''
);

logger.info('🔐 Setting up security test server...');

// Apply security middleware
try {
  const securityInstance = applySecurityMiddleware(app);
  logger.info('✅ Security middleware applied successfully');
} catch (error) {
  logger.error('❌ Failed to apply security middleware', LogContext.SECURITY, {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}

// Test routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/v1/memory', (req, res) => {
  res.json({
    message: 'Memory endpoint test',
    receivedData: req.body,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/memory/search', (req, res) => {
  res.json({
    message: 'Search endpoint test',
    query: req.query,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/v1/memory/search', (req, res) => {
  res.json({
    message: 'Search endpoint test',
    receivedData: req.body,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(port, () => {
  logger.info(`🚀 Security test server running on http://localhost:${port}`);
  logger.info(`📍 Health check: http://localhost:${port}/health`);
  logger.info(`📍 API Health: http://localhost:${port}/api/health`);
  logger.info(`🔐 Security headers testing enabled`);
});
