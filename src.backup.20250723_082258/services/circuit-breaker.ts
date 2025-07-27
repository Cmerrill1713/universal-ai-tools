import OpossumCircuitBreaker from 'opossum';
import { LogContext, logger } from '../utils/enhanced-logger';
import { EventEmitter } from 'events';
import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import { TIME_500MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_10000MS, ZERO_POINT_FIVE, ZERO_POINT_EIGHT, ZERO_POINT_NINE, BATCH_SIZE_10, MAX_ITEMS_100, PERCENT_10, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, PERCENT_100, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500 } from "../utils/common-constants";

interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  rollingCountTimeout: number;
  rollingCountBuckets: number;
  name: string;
  fallback?: (...args: any[]) => any;
}

interface CircuitBreakerMetrics {
  name: string;
  state: string;
  requests: number;
  failures: number;
  successes: number;
  rejects: number;
  timeouts: number;
  fallbacks: number;
  latencyMean: number;
  latencyPercentiles: Record<string, number>;
}

export class CircuitBreakerService extends EventEmitter {
  private breakers: Map<string, OpossumCircuitBreaker<any, any>> = new Map();
  private metrics: Map<string, CircuitBreakerMetrics> = new Map();

  constructor() {
    super();
  }

  /**
   * Create or get a circuit breaker for a specific service
   */
  getBreaker(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): OpossumCircuitBreaker<any, any> {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const defaultOptions = {
      timeout: 10000, // 10 seconds
      errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
      resetTimeout: 30000, // Try again after 30 seconds
      rollingCountTimeout: 10000, // Count errors over 10 seconds
      rollingCountBuckets: 10, // 10 buckets of 1 second each
      name,
      ...options,
    };

    // Create the circuit breaker with a generic function
    const breaker = new OpossumCircuitBreaker(async (fn: Function, ...args: any[]) => {
      return await fn(...args);
    }, defaultOptions);

    // Set up event listeners
    this.setupEventListeners(breaker, name);

    // Initialize metrics
    this.metrics.set(name, {
      name,
      state: 'closed',
      requests: 0,
      failures: 0,
      successes: 0,
      rejects: 0,
      timeouts: 0,
      fallbacks: 0,
      latencyMean: 0,
      latencyPercentiles: {},
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  /**
   * Set up event listeners for circuit breaker
   */
  private setupEventListeners(breaker: OpossumCircuitBreaker<any, any>, name: string): void {
    breaker.on('success', (result) => {
      const metrics = this.metrics.get(name)!;
      metrics.successes++;
      metrics.requests++;
      logger.debug(`Circuit breaker ${name}: Success`, LogContext.SYSTEM);
    });

    breaker.on('failure', (_error => {
      const metrics = this.metrics.get(name)!;
      metrics.failures++;
      metrics.requests++;
      logger.warn(`Circuit breaker ${name}: Failure`, LogContext.SYSTEM, { _error _errormessage });
    });

    breaker.on('timeout', () => {
      const metrics = this.metrics.get(name)!;
      metrics.timeouts++;
      metrics.requests++;
      logger.warn(`Circuit breaker ${name}: Timeout`, LogContext.SYSTEM);
    });

    breaker.on('reject', () => {
      const metrics = this.metrics.get(name)!;
      metrics.rejects++;
      logger.warn(`Circuit breaker ${name}: Rejected (circuit open)`, LogContext.SYSTEM);
    });

    breaker.on('open', () => {
      const metrics = this.metrics.get(name)!;
      metrics.state = 'open';
      logger.error`Circuit breaker ${name}: Circuit OPENED`, LogContext.SYSTEM);
      this.emit('circuit-open', { name });
    });

    breaker.on('halfOpen', () => {
      const metrics = this.metrics.get(name)!;
      metrics.state = 'half-open';
      logger.info(`Circuit breaker ${name}: Circuit HALF-OPEN`, LogContext.SYSTEM);
    });

    breaker.on('close', () => {
      const metrics = this.metrics.get(name)!;
      metrics.state = 'closed';
      logger.info(`Circuit breaker ${name}: Circuit CLOSED`, LogContext.SYSTEM);
      this.emit('circuit-close', { name });
    });

    breaker.on('fallback', (result) => {
      const metrics = this.metrics.get(name)!;
      metrics.fallbacks++;
      logger.info(`Circuit breaker ${name}: Fallback executed`, LogContext.SYSTEM);
    });
  }

  /**
   * Wrap an HTTP _requestwith circuit breaker
   */
  async httpRequest(
    name: string,
    config: AxiosRequestConfig,
    options?: Partial<CircuitBreakerOptions>
  ): Promise<unknown> {
    const breaker = this.getBreaker(name, {
      fallback: () => {
        logger.warn(`HTTP _requestfallback for ${name}`, LogContext.API);
        return { data: null, fallback: true };
      },
      ...options,
    });

    return breaker.fire(async () => {
      const response = await axios(config);
      return response.data;
    });
  }

  /**
   * Wrap a database query with circuit breaker
   */
  async databaseQuery<T>(
    name: string,
    queryFn: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>
  ): Promise<T> {
    const breaker = this.getBreaker(`db-${name}`, {
      timeout: 5000, // 5 seconds for DB queries
      fallback: () => {
        logger.warn(`Database query fallback for ${name}`, LogContext.DATABASE);
        throw new Error('Database temporarily unavailable');
      },
      ...options,
    });

    return breaker.fire(queryFn) as Promise<T>;
  }

  /**
   * Wrap a model inference call with circuit breaker
   */
  async modelInference<T>(
    modelName: string,
    inferenceFn: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>
  ): Promise<T> {
    const breaker = this.getBreaker(`model-${modelName}`, {
      timeout: 30000, // 30 seconds for model inference
      errorThresholdPercentage: 30, // More tolerant for models
      fallback: async () => {
        logger.warn(`Model inference fallback for ${modelName}`, LogContext.SYSTEM);
        // Try a simpler model as fallback
        throw new Error('Model temporarily unavailable');
      },
      ...options,
    });

    return breaker.fire(inferenceFn) as Promise<T>;
  }

  /**
   * Wrap a Redis operation with circuit breaker
   */
  async redisOperation<T>(
    operation: string,
    operationFn: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>
  ): Promise<T> {
    const breaker = this.getBreaker(`redis-${operation}`, {
      timeout: 2000, // 2 seconds for Redis
      errorThresholdPercentage: 40,
      resetTimeout(TIME_1000MS0, // 10 seconds
      fallback: () => {
        logger.warn(`Redis operation fallback for ${operation}`, LogContext.SYSTEM);
        return null; // Return null for cache misses
      },
      ...options,
    });

    return breaker.fire(operationFn) as Promise<T>;
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics for a specific circuit breaker
   */
  getMetrics(name: string): CircuitBreakerMetrics | undefined {
    return this.metrics.get(name);
  }

  /**
   * Reset a specific circuit breaker
   */
  reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.close();
      logger.info(`Circuit breaker ${name} manually reset`, LogContext.SYSTEM);
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker, name) => {
      breaker.close();
      logger.info(`Circuit breaker ${name} manually reset`, LogContext.SYSTEM);
    });
  }

  /**
   * Health check for circuit breakers
   */
  healthCheck(): {
    healthy: boolean;
    openCircuits: string[];
    metrics: CircuitBreakerMetrics[];
  } {
    const openCircuits = Array.from(this.metrics.entries())
      .filter(([_, m]) => m.state === 'open')
      .map(([name]) => name);

    return {
      healthy: openCircuits.length === 0,
      openCircuits,
      metrics: this.getAllMetrics(),
    };
  }
}

// Export singleton instance
export const circuitBreaker = new CircuitBreakerService();

// Helper functions for common patterns
export function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options?: Partial<CircuitBreakerOptions>
): Promise<T> {
  const breaker = circuitBreaker.getBreaker(name, options);
  return breaker.fire(fn) as Promise<T>;
}

export function httpWithCircuitBreaker(
  url: string,
  config?: AxiosRequestConfig,
  options?: Partial<CircuitBreakerOptions>
): Promise<unknown> {
  const urlObj = new URL(url);
  const name = `http-${urlObj.hostname}`;

  return circuitBreaker.httpRequest(
    name,
    {
      url,
      ...config,
    },
    options
  );
}

// Decorators for class methods
export function CircuitBreaker(options?: Partial<CircuitBreakerOptions>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const name = `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return withCircuitBreaker(name, () => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
