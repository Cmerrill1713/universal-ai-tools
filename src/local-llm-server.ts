/**
 * Local LLM Server
 * Standalone server for local LLM services (Ollama, LM Studio)
 * Runs on port 3456 by default, no authentication required for local access
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

import localLLMRouter from './routers/local-llm';
import { log, LogContext } from './utils/logger';

const PORT = process.env.LOCAL_LLM_PORT || 7456;

class LocalLLMServer {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Enable CORS for local access
    this.app.use(cors({
      origin: [
        'http://localhost:*',
        'http://127.0.0.1:*',
        'http://0.0.0.0:*',
        // Allow macOS app
        'file://*',
        'capacitor://*',
      ],
      credentials: true,
    }));

    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      log.debug(`Local LLM Request: ${req.method} ${req.path}`, LogContext.API, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return next();
    });

    // Simple rate limiting for local access
    const requestCounts = new Map<string, number>();
    this.app.use((req, res, next) => {
      const key = req.ip || 'unknown';
      const count = requestCounts.get(key) || 0;
      
      if (count > 100) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests from this IP',
        });
      }

      requestCounts.set(key, count + 1);
      
      // Reset counts every minute
      setTimeout(() => {
        requestCounts.set(key, Math.max(0, (requestCounts.get(key) || 0) - 1));
      }, 60000);

      return next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        service: 'local-llm-server',
        port: PORT,
        timestamp: new Date().toISOString(),
      });
    });

    // Mount local LLM router
    this.app.use('/local', localLLMRouter);

    // OpenAI-compatible endpoints for easier integration
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        const { messages, model, temperature, max_tokens } = req.body;
        
        // Extract the last user message
        const userMessage = messages
          ?.filter((m: any) => m.role === 'user')
          ?.pop()?.content || '';
        
        const systemMessage = messages
          ?.find((m: any) => m.role === 'system')?.content;

        // Forward to local chat endpoint
        const response = await fetch(`http://localhost:${PORT}/local/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            system: systemMessage,
            model,
            temperature,
            max_tokens,
          }),
        });

        const result = await response.json();

        if (result.success) {
          // Format as OpenAI response
          res.json({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: result.model || 'local-model',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: result.response,
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: Math.ceil(userMessage.length / 4),
              completion_tokens: Math.ceil(result.response.length / 4),
              total_tokens: Math.ceil((userMessage.length + result.response.length) / 4),
            },
          });
        } else {
          res.status(500).json({
            error: {
              message: result.error,
              type: 'server_error',
            },
          });
        }
      } catch (error) {
        res.status(500).json({
          error: {
            message: error instanceof Error ? error.message : 'Internal server error',
            type: 'server_error',
          },
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
          'GET /health',
          'GET /local/health',
          'GET /local/models',
          'POST /local/chat',
          'POST /local/completion',
          'POST /v1/chat/completions (OpenAI compatible)',
        ],
      });
    });

    // Error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      log.error('Local LLM Server Error', LogContext.API, {
        error: err.message,
        stack: err.stack,
        path: req.path,
      });

      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);
        
        this.server.listen(PORT, () => {
          log.info(`🚀 Local LLM Server started`, LogContext.API, {
            port: PORT,
            endpoints: [
              `http://localhost:${PORT}/health`,
              `http://localhost:${PORT}/local/chat`,
              `http://localhost:${PORT}/v1/chat/completions`,
            ],
          });
          
          console.log(`
╔════════════════════════════════════════════╗
║       Local LLM Server Started             ║
╠════════════════════════════════════════════╣
║  Port: ${PORT}                              ║
║  No authentication required                ║
║  Access: http://localhost:${PORT}           ║
╚════════════════════════════════════════════╝

Available endpoints:
  - GET  /health                 - Server health
  - GET  /local/health          - Service health
  - GET  /local/models          - List models
  - POST /local/chat            - Chat with LLM
  - POST /local/completion      - Text completion
  - POST /v1/chat/completions   - OpenAI compatible

Example:
  curl -X POST http://localhost:${PORT}/local/chat \\
    -H "Content-Type: application/json" \\
    -d '{"message": "Hello", "provider": "ollama"}'
          `);
          
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            log.error(`Port ${PORT} is already in use`, LogContext.API);
            reject(new Error(`Port ${PORT} is already in use`));
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          log.info('Local LLM Server stopped', LogContext.API);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Start server if run directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this module is being run directly
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  const server = new LocalLLMServer();
  
  server.start().catch((error) => {
    console.error('Failed to start Local LLM Server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down Local LLM Server...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}

export default LocalLLMServer;