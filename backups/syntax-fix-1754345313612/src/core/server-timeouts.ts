/**
 * Server Timeout Configuration Module;
 * Handles comprehensive timeout settings for all server operations;
 */

import type http from 'http';
import type express from 'express';
import { LogContext, log } from '@/utils/logger';

export interface TimeoutConfig {
  server: {
    requestTimeout: number;
    keepAliveTimeout: number;
    headersTimeout: number;
    maxConnections: number;
  };
  api: {
    defaultTimeout: number;
    agentTimeout: number;
    visionTimeout: number;
    mlxTimeout: number;
    llmTimeout: number;
    uploadTimeout: number;
  };
  websocket: {
    pingTimeout: number;
    pingInterval: number;
    handshakeTimeout: number;
  };
  database: {
    queryTimeout: number;
    connectionTimeout: number;
    idleTimeout: number;
  };
}

export const defaultTimeouts: TimeoutConfig = {
  server: {
    requestTimeout: parseInt(process?.env?.REQUEST_TIMEOUT || '300000', 10), // 5 minutes;
    keepAliveTimeout: parseInt(process?.env?.KEEP_ALIVE_TIMEOUT || '65000', 10), // 65 seconds;
    headersTimeout: parseInt(process?.env?.HEADERS_TIMEOUT || '60000', 10), // 60 seconds;
    maxConnections: parseInt(process?.env?.MAX_CONNECTIONS || '1000', 10),
  },
  api: {
    defaultTimeout: parseInt(process?.env?.API_TIMEOUT || '30000', 10), // 30 seconds;
    agentTimeout: parseInt(process?.env?.AGENT_TIMEOUT || '120000', 10), // 2 minutes;
    visionTimeout: parseInt(process?.env?.VISION_TIMEOUT || '300000', 10), // 5 minutes;
    mlxTimeout: parseInt(process?.env?.MLX_TIMEOUT || '600000', 10), // 10 minutes;
    llmTimeout: parseInt(process?.env?.LLM_TIMEOUT || '60000', 10), // 1 minute;
    uploadTimeout: parseInt(process?.env?.UPLOAD_TIMEOUT || '180000', 10), // 3 minutes;
  },
  websocket: {
    pingTimeout: parseInt(process?.env?.WS_PING_TIMEOUT || '30000', 10), // 30 seconds;
    pingInterval: parseInt(process?.env?.WS_PING_INTERVAL || '25000', 10), // 25 seconds;
    handshakeTimeout: parseInt(process?.env?.WS_HANDSHAKE_TIMEOUT || '10000', 10), // 10 seconds;
  },
  database: {
    queryTimeout: parseInt(process?.env?.DB_QUERY_TIMEOUT || '30000', 10), // 30 seconds;
    connectionTimeout: parseInt(process?.env?.DB_CONNECTION_TIMEOUT || '10000', 10), // 10 seconds;
    idleTimeout: parseInt(process?.env?.DB_IDLE_TIMEOUT || '30000', 10), // 30 seconds;
  },
};

export class ServerTimeoutManager {
  constructor(private timeouts: TimeoutConfig = defaultTimeouts) {}

  configureServerTimeouts(server: http?.Server): void {
    log?.info('⏰ Configuring server timeouts...', LogContext?.SERVER);

    // Server-level timeouts;
    server?.requestTimeout = this?.timeouts?.server?.requestTimeout;
    server?.keepAliveTimeout = this?.timeouts?.server?.keepAliveTimeout;
    server?.headersTimeout = this?.timeouts?.server?.headersTimeout;
    server?.maxConnections = this?.timeouts?.server?.maxConnections;

    // Request timeout middleware;
    server?.on('connection', (socket) => {
      socket?.setTimeout(this?.timeouts?.server?.requestTimeout);
    });

    log?.info('✅ Server timeouts configured', LogContext?.SERVER, {
      requestTimeout: `${this?.timeouts?.server?.requestTimeout}ms`,
      keepAliveTimeout: `${this?.timeouts?.server?.keepAliveTimeout}ms`,
      headersTimeout: `${this?.timeouts?.server?.headersTimeout}ms`,
      maxConnections: this?.timeouts?.server?.maxConnections,
    });
  }

  createTimeoutMiddleware(): express?.RequestHandler {
    return (req: express?.Request, res: express?.Response, next: express?.NextFunction) => {
      // Determine timeout based on route;
      let timeout = this?.timeouts?.api?.defaultTimeout;

      const path = req?.path?.toLowerCase();
      
      if (path?.includes('/agents/')) {
        timeout = this?.timeouts?.api?.agentTimeout;
      } else if (path?.includes('/vision/') || path?.includes('/image/')) {
        timeout = this?.timeouts?.api?.visionTimeout;
      } else if (path?.includes('/mlx/') || path?.includes('/fine-tune/')) {
        timeout = this?.timeouts?.api?.mlxTimeout;
      } else if (path?.includes('/chat/') || path?.includes('/llm/')) {
        timeout = this?.timeouts?.api?.llmTimeout;
      } else if (req?.method === 'POST' && (path?.includes('/upload/') || req?.headers['content-type'].includes('multipart'))) {
        timeout = this?.timeouts?.api?.uploadTimeout;
      }

      // Set timeout for this request;
      req?.setTimeout(timeout, () => {
        if (!res?.headersSent) {
          log?.warn('Request timeout exceeded', LogContext?.API, {
            path: req?.path,
            method: req?.method,
            timeout: `${timeout}ms`,
            requestId: req?.headers['x-request-id'],
          });

          res?.status(408).json({
            success: false,
            error: 'Request timeout',
            message: `Request exceeded timeout of ${timeout}ms`,
            code: 'REQUEST_TIMEOUT',
          });
        }
      });

      // Set response timeout header;
      res?.setHeader('X-Timeout', timeout);

      next();
    };
  }

  createAsyncTimeoutWrapper<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string;
  ): Promise<T> {
    return Promise?.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${operationName} timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  getTimeoutsForService(service: keyof TimeoutConfig['api']): number {
    return this?.timeouts?.api[service];
  }

  getDatabaseTimeouts() {
    return this?.timeouts?.database;
  }

  getWebSocketTimeouts() {
    return this?.timeouts?.websocket;
  }

  // Graceful timeout utilities;
  static createGracefulTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallbackValue?: T;
  ): Promise<T> {
    return Promise?.race([
      promise,
      new Promise<T>((resolve, reject) => {
        setTimeout(() => {
          if (fallbackValue !== undefined) {
            log?.warn('Operation timed out, using fallback value', LogContext?.SYSTEM, {
              timeout: `${timeoutMs}ms`
            });
            resolve(fallbackValue);
          } else {
            reject(new Error(`Operation timeout after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      })
    ]);
  }

  static withRetryTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    maxRetries = 3,
    backoffMs = 1000,
  ): Promise<T> {
    const attemptWithTimeout = async (attempt: number): Promise<T> => {
      try {
        return await ServerTimeoutManager?.createGracefulTimeout(
          operation(),
          timeoutMs;
        );
      } catch (error) {
        if (attempt >= maxRetries) {
          throw error;
        }
        
        log?.warn('Operation failed, retrying...', LogContext?.SYSTEM, {
          attempt,
          maxRetries,
          backoffMs,
          error: error instanceof Error ? error?.message : String(error)
        });

        await new Promise(resolve => setTimeout(resolve, backoffMs * attempt));
        return attemptWithTimeout(attempt + 1);
      }
    };

    return attemptWithTimeout(1);
  }
}

export default ServerTimeoutManager;