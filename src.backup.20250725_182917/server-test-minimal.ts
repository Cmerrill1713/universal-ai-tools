/**
 * Minimal test server to verify core functionality
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { logger } from './utils/logger';

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

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      core: true
    },
    version: process.env.npm_package_version || '1.0.0'
  };
  res.json(health);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Universal AI Tools - Minimal Test',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health'
    }
  });
});

// Start server
const startServer = async () => {
  try {
    server.listen(PORT, () => {
      logger.info(`🚀 Minimal Test Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;