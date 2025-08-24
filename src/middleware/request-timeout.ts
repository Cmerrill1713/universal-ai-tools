/**
 * Request Timeout Middleware
 * Implements configurable request timeouts to prevent hanging requests
 * and improve server responsiveness under load
 */

import { NextFunction, Request, Response } from 'express';

import { log, LogContext } from '../utils/logger';

// Extend Request interface to include timeout tracking
declare global {
  namespace Express {
    interface Request {
      timeoutId?: NodeJS.Timeout;
      isTimedOut?: boolean;
    }
  }
}

interface TimeoutConfig {
  defaultTimeout: number; // Default timeout in milliseconds
  slowOperationTimeout: number; // Timeout for known slow operations
  routes: {
    [pattern: string]: number; // Route-specific timeouts
  };
}

// Default timeout configuration
const DEFAULT_CONFIG: TimeoutConfig = {
  defaultTimeout: 30000, // 30 seconds
  slowOperationTimeout: 120000, // 2 minutes for heavy operations
  routes: {
    // Health endpoints - fast
    '/health': 5000,
    '/status': 5000,
    '/metrics': 10000,
    
    // Chat endpoints - moderate
    '/api/chat': 60000,
    '/api/agents': 60000,
    
    // Heavy operations - slow
    '/api/memory/optimize': 120000,
    '/api/mlx': 180000,
    '/api/vision': 120000,
    '/api/knowledge': 90000,
    '/api/graph-rag': 90000,
    
    // File uploads and processing
    '/api/upload': 300000, // 5 minutes
    '/api/process': 180000, // 3 minutes
  }
};

/**
 * Creates a request timeout middleware with configurable timeouts
 */
export function createTimeoutMiddleware(config: Partial<TimeoutConfig> = {}) {
  const finalConfig: TimeoutConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    routes: {
      ...DEFAULT_CONFIG.routes,
      ...(config.routes || {})
    }
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if response is already sent
    if (res.headersSent) {
      return next();
    }

    // Determine timeout for this route
    const timeout = getTimeoutForRoute(req.path, req.method, finalConfig);
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        req.isTimedOut = true;
        
        log.warn('Request timeout exceeded', LogContext.API, {
          path: req.path,
          method: req.method,
          timeout: `${timeout}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });

        res.status(408).json({
          error: 'Request timeout',
          message: `Request exceeded timeout of ${timeout}ms`,
          timeout: timeout,
          timestamp: new Date().toISOString()
        });
      }
    }, timeout);

    // Store timeout ID for cleanup
    req.timeoutId = timeoutId;

    // Override res.end to clear timeout
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
      if (req.timeoutId) {
        clearTimeout(req.timeoutId);
        delete req.timeoutId;
      }
      return originalEnd.call(this, chunk, encoding, cb);
    };

    // Override res.json and other response methods to clear timeout
    const originalJson = res.json;
    res.json = function(body?: any): Response {
      if (req.timeoutId) {
        clearTimeout(req.timeoutId);
        delete req.timeoutId;
      }
      return originalJson.call(this, body);
    };

    // Clear timeout on response finish
    res.on('finish', () => {
      if (req.timeoutId) {
        clearTimeout(req.timeoutId);
        delete req.timeoutId;
      }
    });

    // Clear timeout on connection close
    res.on('close', () => {
      if (req.timeoutId) {
        clearTimeout(req.timeoutId);
        delete req.timeoutId;
      }
    });

    next();
  };
}

/**
 * Determines the appropriate timeout for a given route
 */
function getTimeoutForRoute(path: string, method: string, config: TimeoutConfig): number {
  // Check for exact route matches first
  for (const [route, timeout] of Object.entries(config.routes)) {
    if (path === route || path.startsWith(route)) {
      return timeout;
    }
  }

  // Check for pattern matches
  for (const [pattern, timeout] of Object.entries(config.routes)) {
    if (matchesPattern(path, pattern)) {
      return timeout;
    }
  }

  // Check if it's a known slow operation
  const slowOperationPatterns = [
    '/optimize',
    '/process',
    '/analyze',
    '/generate',
    '/upload',
    '/export',
    '/backup'
  ];

  if (slowOperationPatterns.some(pattern => path.includes(pattern))) {
    return config.slowOperationTimeout;
  }

  return config.defaultTimeout;
}

/**
 * Simple pattern matching for routes
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Convert pattern to regex (simple implementation)
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\//g, '\\/');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Default request timeout middleware with production-ready configuration
 */
export const requestTimeoutMiddleware = createTimeoutMiddleware();

/**
 * Express timeout configuration for server-level settings
 */
export function configureServerTimeouts(server: any): void {
  try {
    // Configure keep-alive timeout (should be longer than load balancer timeout)
    server.keepAliveTimeout = 120000; // 2 minutes
    
    // Configure headers timeout (should be slightly longer than keep-alive)
    server.headersTimeout = 121000; // 2 minutes + 1 second
    
    // Configure request timeout (for the entire request)
    server.requestTimeout = 300000; // 5 minutes for maximum request duration
    
    log.info('✅ Server timeout configuration applied', LogContext.SERVER, {
      keepAliveTimeout: '120s',
      headersTimeout: '121s', 
      requestTimeout: '300s'
    });
  } catch (error) {
    log.error('❌ Failed to configure server timeouts', LogContext.SERVER, { error });
  }
}

/**
 * Timeout configuration for different environments
 */
export const timeoutConfigs = {
  development: {
    defaultTimeout: 60000, // 1 minute - more lenient for debugging
    slowOperationTimeout: 300000, // 5 minutes
  },
  production: {
    defaultTimeout: 30000, // 30 seconds - stricter for performance
    slowOperationTimeout: 120000, // 2 minutes
  },
  test: {
    defaultTimeout: 10000, // 10 seconds - fast for testing
    slowOperationTimeout: 30000, // 30 seconds
  }
};

/**
 * Get timeout configuration based on current environment
 */
export function getEnvironmentTimeoutConfig(): Partial<TimeoutConfig> {
  const env = process.env.NODE_ENV || 'development';
  return timeoutConfigs[env as keyof typeof timeoutConfigs] || timeoutConfigs.development;
}

/**
 * Health check for timeout middleware
 */
export function getTimeoutMiddlewareHealth(): {
  status: 'healthy' | 'degraded';
  config: TimeoutConfig;
  activeTimeouts: number;
} {
  // This is a simple implementation - in production you might want to track active timeouts
  return {
    status: 'healthy',
    config: DEFAULT_CONFIG,
    activeTimeouts: 0 // Would need to implement tracking for this
  };
}

export default requestTimeoutMiddleware;