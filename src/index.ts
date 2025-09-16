#!/usr/bin/env node

/**
 * Universal AI Tools - Main Entry Point
 *
 * This is the main entry point for the Universal AI Tools backend service.
 * It initializes and starts the server with all necessary configurations.
 */

import { UniversalAIToolsServer } from './server.js';
import { logger } from './utils/logger.js';
import { LogContext } from './types/logging.js';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error, LogContext.SERVER);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason, LogContext.SERVER);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully', LogContext.SERVER);
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully', LogContext.SERVER);
  process.exit(0);
});

/**
 * Main function to start the server
 */
async function main() {
  try {
    logger.info('🚀 Starting Universal AI Tools Server...', LogContext.SERVER);

    const server = new UniversalAIToolsServer();
    await server.start();

    logger.info('✅ Server started successfully!', LogContext.SERVER);
    logger.info('🌐 Server running on http://localhost:8080', LogContext.SERVER);
    logger.info(
      '📚 API Documentation available at http://localhost:8080/api/v1',
      LogContext.SERVER
    );
  } catch (error) {
    logger.error('❌ Failed to start server:', error, LogContext.SERVER);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  logger.error('❌ Fatal error in main:', error, LogContext.SERVER);
  process.exit(1);
});
