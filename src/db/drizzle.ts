/**
 * Drizzle Database Client Management
 * Implements robust connection handling with retry logic and proper error handling
 */
import type { Pool } from 'pg';

import { CircuitBreakerRegistry } from '../utils/circuit-breaker';
import { log, LogContext } from '../utils/logger';

interface DrizzleClientOptions {
  retryAttempts?: number;
  retryDelay?: number;
  useCircuitBreaker?: boolean;
}

const DEFAULT_OPTIONS: Required<DrizzleClientOptions> = {
  retryAttempts: 3,
  retryDelay: 1000,
  useCircuitBreaker: true,
};

export class DatabaseConnectionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

export async function getDrizzleClient(pool: Pool, options: DrizzleClientOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const breaker = opts.useCircuitBreaker 
    ? CircuitBreakerRegistry.get('drizzle-database')
    : null;

  const connectWithRetry = async (attempt = 1): Promise<any> => {
    try {
      log.debug(`Attempting to create Drizzle client (attempt ${attempt}/${opts.retryAttempts})`, LogContext.DATABASE);
      
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const client = drizzle(pool);
      
      // Validate connection with a simple query
      await pool.query('SELECT 1');
      
      log.info('✅ Drizzle client created successfully', LogContext.DATABASE, {
        attempt,
        poolSize: pool.totalCount,
        poolIdle: pool.idleCount,
        poolWaiting: pool.waitingCount
      });
      
      return client;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`Failed to create Drizzle client (attempt ${attempt}/${opts.retryAttempts})`, LogContext.DATABASE, {
        error: errorMessage,
        attempt,
        maxAttempts: opts.retryAttempts
      });

      if (attempt >= opts.retryAttempts) {
        throw new DatabaseConnectionError(
          `Failed to create Drizzle client after ${opts.retryAttempts} attempts: ${errorMessage}`,
          error instanceof Error ? error : new Error(errorMessage)
        );
      }

      // Exponential backoff with jitter
      const delay = opts.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      log.debug(`Retrying Drizzle client creation in ${delay}ms`, LogContext.DATABASE);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectWithRetry(attempt + 1);
    }
  };

  try {
    if (breaker) {
      return await breaker.execute(connectWithRetry);
    } else {
      return await connectWithRetry();
    }
  } catch (error) {
    log.error('Critical: Failed to create Drizzle client', LogContext.DATABASE, {
      error: error instanceof Error ? error.message : String(error),
      retryAttempts: opts.retryAttempts,
      useCircuitBreaker: opts.useCircuitBreaker
    });
    
    // Instead of returning null, throw a proper error
    throw error instanceof DatabaseConnectionError 
      ? error 
      : new DatabaseConnectionError('Failed to create Drizzle client', error instanceof Error ? error : undefined);
  }
}



