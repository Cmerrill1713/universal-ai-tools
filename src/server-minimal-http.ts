import express from 'express';
import { createServer } from 'http';
import { logger } from './utils/logger';

const app = express();
const port = 9999;

logger.info('Starting minimal HTTP server...');

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const server = createServer(app);

logger.info('About to call server.listen...');

server.listen(port, () => {
  logger.info(`Minimal HTTP server running on port ${port}`);
});

logger.info('Server setup complete');