/**
 * Correlation ID Management
 * Provides request tracking across distributed services
 */

import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';
import { LogContext, log } from './logger';
import { getCurrentSpan } from './tracing';

// AsyncLocalStorage for correlation ID context
const correlationIdStorage = new AsyncLocalStorage<string>();

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return `corr_${uuidv4()}`;
}

/**
 * Validate correlation ID format
 */
export function isValidCorrelationId(correlationId: string): boolean {
  if (!correlationId || typeof correlationId !== 'string') {
    return false;
  }
  
  // Check for reasonable length (UUID is 36 chars + prefix)
  if (correlationId.length < 5 || correlationId.length > 100) {
    return false;
  }
  
  // Check for basic format (alphanumeric, hyphens, underscores)
  return /^[a-zA-Z0-9_-]+$/.test(correlationId);
}

/**
 * Get current correlation ID from async context
 */
export function getCorrelationId(): string | undefined {
  return correlationIdStorage.getStore();
}

/**
 * Run a function with a correlation ID context
 */
export async function withCorrelationId<T>(
  correlationId: string,
  fn: () => Promise<T>
): Promise<T> {
  return correlationIdStorage.run(correlationId, async () => {
    // Add to current span if tracing is active
    const span = getCurrentSpan();
    if (span) {
      span.setAttribute('correlation_id', correlationId);
    }

    // Add to logger context
    log.debug('🔗 Correlation ID set', LogContext.SYSTEM, { correlationId });

    return fn();
  });
}

/**
 * Express middleware to handle correlation IDs
 */
export function correlationIdMiddleware() {
  return (req: any, res: any, next: any) => {
    // Check for existing correlation ID in headers
    let correlationId = req.headers['x-correlation-id'] as string;
    
    // Validate existing correlation ID or generate new one
    if (!correlationId || !isValidCorrelationId(correlationId)) {
      if (correlationId) {
        log.warn('Invalid correlation ID received, generating new one', LogContext.API, {
          invalidId: correlationId,
        });
      }
      correlationId = generateCorrelationId();
    }

    // Store in request object
    req.correlationId = correlationId;

    // Add to response headers
    res.setHeader('X-Correlation-ID', correlationId);

    // Run the rest of the request in correlation context
    correlationIdStorage.run(correlationId, () => {
      log.info('📨 Request received', LogContext.API, {
        method: req.method,
        path: req.path,
        correlationId,
        userAgent: req.headers['user-agent'],
      });

      // Continue with correlation ID context
      next();
    });
  };
}

/**
 * Add correlation ID to outgoing HTTP requests
 */
export function addCorrelationIdToRequest(headers: Record<string, string>): Record<string, string> {
  const correlationId = getCorrelationId();
  if (correlationId) {
    headers['X-Correlation-ID'] = correlationId;
  }
  return headers;
}

/**
 * WebSocket correlation ID handler
 */
export function handleWebSocketCorrelation(socket: any): void {
  socket.on('message', (data: any) => {
    let correlationId: string;
    
    // Handle different data formats
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        correlationId = parsed.correlationId;
      } catch {
        correlationId = generateCorrelationId();
      }
    } else if (data && typeof data === 'object') {
      correlationId = data.correlationId;
    } else {
      correlationId = generateCorrelationId();
    }
    
    // Validate and use correlation ID
    if (!correlationId || !isValidCorrelationId(correlationId)) {
      correlationId = generateCorrelationId();
    }
    
    // Store correlation ID on socket
    socket.correlationId = correlationId;

    // Run handlers with correlation context
    correlationIdStorage.run(correlationId, () => {
      log.debug('🔌 WebSocket message received', LogContext.WEBSOCKET, {
        correlationId,
        socketId: socket.id,
      });
    });
  });
}

/**
 * Correlation ID for async job processing
 */
export class CorrelatedJob {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || generateCorrelationId();
  }

  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return withCorrelationId(this.correlationId, async () => {
      log.info(`🏃 Starting job: ${name}`, LogContext.SYSTEM, {
        correlationId: this.correlationId,
        jobName: name,
      });

      const startTime = Date.now();
      
      try {
        const result = await fn();
        const duration = Date.now() - startTime;

        log.info(`✅ Job completed: ${name}`, LogContext.SYSTEM, {
          correlationId: this.correlationId,
          jobName: name,
          duration: `${duration}ms`,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        log.error(`❌ Job failed: ${name}`, LogContext.SYSTEM, {
          correlationId: this.correlationId,
          jobName: name,
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    });
  }

  getCorrelationId(): string {
    return this.correlationId;
  }
}

/**
 * Decorator for methods that need correlation tracking
 */
export function Correlated(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const correlationId = getCorrelationId() || generateCorrelationId();
    
    return withCorrelationId(correlationId, async () => {
      return originalMethod.apply(this, args);
    });
  };

  return descriptor;
}

/**
 * Extract correlation ID from various sources
 */
export function extractCorrelationId(source: any): string | undefined {
  // From express request
  if (source.correlationId) {
    return source.correlationId;
  }

  // From headers
  if (source.headers?.['x-correlation-id']) {
    return source.headers['x-correlation-id'];
  }

  // From WebSocket
  if (source.socket?.correlationId) {
    return source.socket.correlationId;
  }

  // From context metadata
  if (source.metadata?.correlationId) {
    return source.metadata.correlationId;
  }}

/**
 * Format log with correlation ID
 */
export function logWithCorrelation(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context: LogContext,
  metadata?: Record<string, any>
): void {
  const correlationId = getCorrelationId();
  const enhancedMetadata = {
    ...metadata,
    ...(correlationId ? { correlationId } : {}),
  };

  log[level](message, context, enhancedMetadata);
}