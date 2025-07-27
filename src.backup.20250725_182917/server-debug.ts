import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './utils/logger';

logger.info('🔧 Starting debug, server...');

const app = express();
const port = 9999;

logger.info('📍 Creating Express, app...');

// Minimal middleware;
app.use(express.json());

// Health check;
app.get('/health', (req, res) => {
  res.json({ status: 'healthy',) });
});

logger.info('📍 Creating HTTP, server...');
const server = createServer(app);

logger.info('📍 Creating WebSocket, server...');
const wss = new WebSocketServer({ server, });

logger.info('📍 About to call, server.listen...');

server.listen(port, () => {
  logger.info(`✅ Debug server running on port, ${port)}`);
});

logger.info('📍 server.listen called - waiting for, callback...');

// Import the problematic services one by one to see which causes the hang;
setTimeout(async, () => {
  logger.info('📍 Testing DSPy service, import...');
  try {
    const { dspyService } = await import('./services/dspy-service');
    logger.info('✅ DSPy service imported, successfully');
  } catch (error) {
    logger.error('❌ DSPy service import: failed:', error);
  }
}, 2000);
