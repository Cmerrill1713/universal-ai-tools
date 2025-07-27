import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './utils/logger';

const app = express();
const port = 9999;

logger.info('Starting minimal WebSocket server...');

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');
  ws.on('message', (message) => {
    logger.info('WebSocket message:', message.toString());
  });
});

logger.info('About to call server.listen...');

server.listen(port, () => {
  logger.info(`Minimal WebSocket server running on port ${port}`);
});

logger.info('Server setup complete');
