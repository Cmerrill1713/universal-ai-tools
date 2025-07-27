#!/usr/bin/env node

// Minimal server test to verify basic functionality

console.log('🚀 Starting minimal server test...');

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { config, initializeConfig } from './src/config/index';
import { logger } from './src/utils/enhanced-logger';

// Initialize configuration
initializeConfig();

const app = express();
const port = config.server.port || 9999;

// Create Supabase client
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey || ''
);

// Apply basic middleware
app.use(cors());
app.use(express.json());

// Simple health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(port, () => {
  logger.info(`✅ Minimal server running on port ${port}`);
  logger.info(`Test with: curl http://localhost:${port}/health`);
  
  // Auto-close after 5 seconds for testing
  setTimeout(() => {
    logger.info('Test completed, shutting down...');
    server.close();
    process.exit(0);
  }, 5000);
});

// Error handling
server.on('error', (error) => {
  logger.error('Server error:', error);
  process.exit(1);
});