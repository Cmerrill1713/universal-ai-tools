/**
 * HRM Demo Server - Clean implementation demonstrating HRM integration
 * This bypasses the corrupted files and shows the working HRM integration
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { LogContext, log } from './utils/logger';

// Import HRM components directly
import { HRMSapientAgent } from './agents/cognitive/hrm-sapient-agent';
import { hrmSapientService } from './services/hrm-sapient-service';
import hrmRouter from './routers/hrm';

class HRMDemoServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer> | null = null;
  private port: number;

  constructor(port = 9999) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable for API
      crossOriginEmbedderPolicy: false,
    }));

    // CORS
    this.app.use(cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }));

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        message: 'HRM Demo Server running',
        hrm: {
          service: hrmSapientService.getStatus(),
          agent: 'available'
        }
      });
    });

    // HRM routes
    this.app.use('/api/v1/hrm', hrmRouter);

    // Demo endpoint to test HRM directly
    this.app.post('/api/v1/hrm/demo', async (req, res) => {
      try {
        const { puzzleType, input } = req.body;
        
        const agent = new HRMSapientAgent({
          name: 'hrm',
          model: 'hrm-sapient',
          systemPrompt: 'Hierarchical Reasoning Model'
        });

        let result;
        switch (puzzleType) {
          case 'arc':
            result = await agent.solveARCPuzzle(input);
            break;
          case 'sudoku':
            result = await agent.solveSudokuPuzzle(input);
            break;
          case 'maze':
            result = await agent.solveMazePuzzle(input);
            break;
          default:
            throw new Error(`Unknown puzzle type: ${puzzleType}`);
        }

        res.json({
          success: true,
          puzzleType,
          result,
          agent: 'hrm-sapient'
        });
      } catch (error) {
        log.error('HRM demo error', LogContext.API, {
          error: error instanceof Error ? error.message : String(error)
        });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Catch-all
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        availableRoutes: [
          'GET /health',
          'GET /api/v1/hrm/status',
          'POST /api/v1/hrm/reason',
          'POST /api/v1/hrm/solve/arc',
          'POST /api/v1/hrm/solve/sudoku',
          'POST /api/v1/hrm/solve/maze',
          'POST /api/v1/hrm/demo'
        ]
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Initialize HRM service
      await hrmSapientService.initialize();
      log.info('✅ HRM service initialized', LogContext.STARTUP);

      // Start server
      this.server = createServer(this.app);
      
      await new Promise<void>((resolve, reject) => {
        this.server!.listen(this.port, () => {
          log.info(`🚀 HRM Demo Server running on port ${this.port}`, LogContext.STARTUP);
          log.info(`📍 Health check: http://localhost:${this.port}/health`, LogContext.STARTUP);
          log.info(`🧠 HRM API: http://localhost:${this.port}/api/v1/hrm`, LogContext.STARTUP);
          resolve();
        }).on('error', reject);
      });
    } catch (error) {
      log.error('Failed to start HRM demo server', LogContext.STARTUP, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          log.info('🛑 HRM Demo Server stopped', LogContext.SHUTDOWN);
          resolve();
        });
      });
    }
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new HRMDemoServer(parseInt(process.env.PORT || '9999'));
  
  server.start().catch((error) => {
    log.error('Fatal error starting server', LogContext.STARTUP, {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    log.info('SIGTERM received, shutting down gracefully', LogContext.SHUTDOWN);
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    log.info('SIGINT received, shutting down gracefully', LogContext.SHUTDOWN);
    await server.stop();
    process.exit(0);
  });
}

export default HRMDemoServer;