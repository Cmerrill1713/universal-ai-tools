/**
 * Exponential Backoff Retry Utility
 * Provides consistent retry logic with jitter across all services
 */

import { LogContext, log } from './logger';
import { getCurrentSpan } from './tracing';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
  retryCondition?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
  jitter: true,
  retryCondition: (error) => {
    // Retry on network errors and 5xx status codes
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    if (error.response?.status >= 500) {
      return true;
    }
    // Don't retry on client errors (4xx)
    if (error.response?.status >= 400 && error.response?.status < 500) {
      return false;
    }
    return true;
  },
  onRetry: (error, attempt, delayMs) => {
    log.warn(`🔄 Retry attempt ${attempt}`, LogContext.SYSTEM, {
      error: error.message || String(error),
      delayMs,
      code: error.code,
      status: error.response?.status,
    });
  },
};

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      // Add retry info to current span if tracing is active
      const span = getCurrentSpan();
      if (span) {
        span.setAttribute('retry.attempt', attempt);
        span.setAttribute('retry.max_attempts', opts.maxRetries);
      }

      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === opts.maxRetries || !opts.retryCondition(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const baseDelay = Math.min(
        opts.initialDelayMs * Math.pow(opts.factor, attempt - 1),
        opts.maxDelayMs
      );

      // Add jitter to prevent thundering herd
      const jitterAmount = opts.jitter ? Math.random() * baseDelay * 0.2 : 0;
      const delayMs = Math.floor(baseDelay + jitterAmount);

      // Call retry callback
      opts.onRetry(error, attempt, delayMs);

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper with custom configuration
 */
export function createRetryWrapper(defaultOptions?: RetryOptions) {
  return <T>(fn: () => Promise<T>, overrideOptions?: RetryOptions): Promise<T> => {
    return withRetry(fn, { ...defaultOptions, ...overrideOptions });
  };
}

/**
 * Retry with circuit breaker pattern
 */
export class RetryWithCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeMs = 60000,
    private readonly retryOptions?: RetryOptions
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit breaker state
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeMs) {
        this.state = 'HALF_OPEN';
        log.info('⚡ Circuit breaker entering HALF_OPEN state', LogContext.SYSTEM);
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await withRetry(fn, {
        ...this.retryOptions,
        onRetry: (error, attempt, delayMs) => {
          this.retryOptions?.onRetry?.(error, attempt, delayMs);
          
          // Track failures (only on final attempt failure, not on retry)
          if (attempt === (this.retryOptions?.maxRetries || DEFAULT_OPTIONS.maxRetries)) {
            this.failures++;
            this.lastFailureTime = Date.now();

            // Open circuit if threshold reached
            if (this.failures >= this.failureThreshold && this.state === 'CLOSED') {
              this.state = 'OPEN';
              log.error('⚡ Circuit breaker opened due to failures', LogContext.SYSTEM, {
                failures: this.failures,
                threshold: this.failureThreshold,
              });
            }
          }
        },
      });

      // Reset on success
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        log.info('⚡ Circuit breaker closed after successful request', LogContext.SYSTEM);
      }

      return result;
    } catch (error) {
      // If in HALF_OPEN state, go back to OPEN
      if (this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
        this.lastFailureTime = Date.now();
        log.error('⚡ Circuit breaker reopened after failure in HALF_OPEN state', LogContext.SYSTEM);
      }
      throw error;
    }
  }

  getState(): string {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: Date.now() - this.lastFailureTime,
    };
  }
}

/**
 * Helper function to sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Predefined retry strategies
 */
export const RetryStrategies = {
  // Fast retry for transient errors
  fast: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    factor: 2,
  },

  // Standard retry for most operations
  standard: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    factor: 2,
  },

  // Aggressive retry for critical operations
  aggressive: {
    maxRetries: 5,
    initialDelayMs: 500,
    maxDelayMs: 30000,
    factor: 1.5,
  },

  // Slow retry for rate-limited operations
  slow: {
    maxRetries: 3,
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    factor: 2,
  },
};

// Export convenience functions
export const retryFast = createRetryWrapper(RetryStrategies.fast);
export const retryStandard = createRetryWrapper(RetryStrategies.standard);
export const retryAggressive = createRetryWrapper(RetryStrategies.aggressive);
export const retrySlow = createRetryWrapper(RetryStrategies.slow);