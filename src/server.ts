/**
 * Universal AI Tools - Server Configuration
 * Main server setup and middleware configuration
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config';
import { logger } from './utils';

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
}

export class UniversalAIServer {
  private app: express.Application;
  private server: any;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'Universal AI Tools',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API status
    this.app.get('/api/v1/status', (req, res) => {
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
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Universal AI Tools',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          status: '/api/v1/status'
        }
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.originalUrl} not found`
      });
    });

    // Error handler
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Server error:', { error: err.message, stack: err.stack });
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });
  }

  public start(): void {
    this.server = createServer(this.app);
    
    this.server.listen(this.config.port, this.config.host, () => {
      logger.info(`🚀 Universal AI Tools server running on ${this.config.host}:${this.config.port}`);
      logger.info(`📊 Health check: http://${this.config.host}:${this.config.port}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  public shutdown(): void {
    logger.info('Shutting down server gracefully...');
    this.server?.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}

export default UniversalAIServer;