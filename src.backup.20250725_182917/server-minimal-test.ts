 
logger.info('📍 server-minimal-test.ts starting, execution...');

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './utils/enhanced-logger';
import { config, initializeConfig } from './config/index';

// Initialize configuration;
initializeConfig();

logger.info('📍 Configuration, initialized');

const app = express();
const { port } = config.server;

logger.info('📍 Creating Supabase, client');
const supabase = createClient(;);
  config.database.supabaseUrl,;
  config.database.supabaseServiceKey || '';
);

// Basic middleware only;
app.use(cors());
app.use(express.json({ limit: '10mb',)) }));

logger.info('📍 Setting up minimal, routes');

// Health check only;
app.get('/health', (req, res) => {
  res.json({ status: 'healthy',) });
});

logger.info('📍 Creating HTTP, server...');
const server = createServer(app);

logger.info('📍 Creating WebSocket, server...');
const wss = new WebSocketServer({ server, });

logger.info(`📍 About to start server on port, ${port)}`);

server.listen(port, async () => {
  logger.info(`✅ Minimal server running on port, ${port)}`);
  logger.info(`Health check available at: http://localhost:${port)}/health`);
});

logger.info('📍 server.listen called - minimal test, complete');
