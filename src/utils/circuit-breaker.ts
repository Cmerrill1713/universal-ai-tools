/**
 * Circuit Breaker Pattern Implementation
 * Provides automatic failure detection and recovery
 * Superior to Agent Zero's basic error handling
 */

import { log, LogContext } from './logger';

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening
  successThreshold?: number; // Number of successes to close from half-open
  timeout?: number; // Time in ms before trying half-open
  volumeThreshold?: number; // Minimum requests before evaluating
  errorThresholdPercentage?: number; // Error percentage to open circuit
  rollingWindow?: number; // Time window for metrics in ms
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  failedRequests: number;
  successfulRequests: number;
  rejectedRequests: number;
  state: CircuitState;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  errorRate: number;
  lastError?: string;
  consecutiveFailures: number;
  nextRetryTime?: number;
  rollingWindowMetrics?: {
    windowSize: number;
    requestsInWindow: number;
    errorsInWindow: number;
  };
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private nextAttempt?: number;
  private lastError?: string;
  private metrics: CircuitBreakerMetrics;
  private requestTimestamps: { time: number; success: boolean; error?: string }[] = [];

  constructor(
    private name: string,
    private options: CircuitBreakerOptions = {}
  ) {
    this.options = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      volumeThreshold: 10,
      errorThresholdPercentage: 50,
      rollingWindow: 60000, // 1 minute
      ...options,
    };

    this.metrics = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      rejectedRequests: 0,
      state: this.state,
      errorRate: 0,
      consecutiveFailures: 0,
    };
  }

  async execute<R>(operation: () => Promise<R>, fallback?: () => Promise<R>): Promise<R> {
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttempt && Date.now() < this.nextAttempt) {
        this.metrics.rejectedRequests++;
        log.warn(`⚡ Circuit breaker OPEN for ${this.name}`, LogContext.SYSTEM, {
          nextAttempt: new Date(this.nextAttempt).toISOString(),
          metrics: this.getMetrics(),
        });

        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }

      // Time to try half-open
      this.state = CircuitState.HALF_OPEN;
      log.info(`🔄 Circuit breaker HALF-OPEN for ${this.name}`, LogContext.SYSTEM);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);

      if (fallback && this.state !== CircuitState.CLOSED) {
        log.info(`🔄 Using fallback for ${this.name}`, LogContext.SYSTEM);
        return fallback();
      }

      throw error;
    }
  }

  private onSuccess(): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.recordRequest(true);

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold!) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        log.info(`✅ Circuit breaker CLOSED for ${this.name}`, LogContext.SYSTEM, {
          metrics: this.getMetrics(),
        });
      }
    } else {
      this.failureCount = 0;
      this.metrics.consecutiveFailures = 0;
    }

    this.metrics.lastSuccessTime = Date.now();
    this.updateMetrics();
  }

  private onFailure(error?: unknown): void {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.metrics.consecutiveFailures = this.failureCount + 1;

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.lastError = errorMessage;
    this.metrics.lastError = errorMessage;

    this.recordRequest(false, errorMessage);
    this.lastFailureTime = Date.now();
    this.metrics.lastFailureTime = this.lastFailureTime;

    if (this.state === CircuitState.HALF_OPEN) {
      this.openCircuit();
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;

      // Check if we should open based on threshold or percentage
      const shouldOpenByCount = this.failureCount >= this.options.failureThreshold!;
      const shouldOpenByPercentage = this.shouldOpenByErrorRate();

      if (shouldOpenByCount || shouldOpenByPercentage) {
        this.openCircuit();
      }
    }

    this.updateMetrics();
  }

  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.timeout!;
    this.successCount = 0;

    log.error(`❌ Circuit breaker OPEN for ${this.name}`, LogContext.SYSTEM, {
      failureCount: this.failureCount,
      nextAttempt: new Date(this.nextAttempt).toISOString(),
      metrics: this.getMetrics(),
    });
  }

  private recordRequest(success: boolean, error?: string): void {
    const now = Date.now();
    this.requestTimestamps.push({ time: now, success, error });

    // Clean old timestamps outside rolling window
    const cutoff = now - this.options.rollingWindow!;
    this.requestTimestamps = this.requestTimestamps.filter((r) => r.time > cutoff);
  }

  private shouldOpenByErrorRate(): boolean {
    if (this.requestTimestamps.length < this.options.volumeThreshold!) {
      return false;
    }

    const recentRequests = this.requestTimestamps.filter(
      (r) => r.time > Date.now() - this.options.rollingWindow!
    );

    if (recentRequests.length === 0) return false;

    const errorCount = recentRequests.filter((r) => !r.success).length;
    const errorRate = (errorCount / recentRequests.length) * 100;

    return errorRate >= this.options.errorThresholdPercentage!;
  }

  private updateMetrics(): void {
    const recentRequests = this.requestTimestamps.filter(
      (r) => r.time > Date.now() - this.options.rollingWindow!
    );

    const errorCount = recentRequests.filter((r) => !r.success).length;
    const errorRate = recentRequests.length > 0 ? (errorCount / recentRequests.length) * 100 : 0;

    this.metrics.state = this.state;
    this.metrics.errorRate = errorRate;
    this.metrics.consecutiveFailures = this.state === CircuitState.CLOSED ? 0 : this.failureCount;
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    const recentRequests = this.requestTimestamps.filter(
      (r) => r.time > Date.now() - this.options.rollingWindow!
    );

    const metrics: CircuitBreakerMetrics = {
      ...this.metrics,
      nextRetryTime: this.nextAttempt,
      rollingWindowMetrics: {
        windowSize: this.options.rollingWindow!,
        requestsInWindow: recentRequests.length,
        errorsInWindow: recentRequests.filter((r) => !r.success).length,
      },
    };

    return metrics;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttempt = undefined;
    this.requestTimestamps = [];
    this.metrics = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      rejectedRequests: 0,
      state: this.state,
      errorRate: 0,
      consecutiveFailures: 0,
    };

    log.info(`🔄 Circuit breaker reset for ${this.name}`, LogContext.SYSTEM);
  }

  // Force circuit to open (for testing/manual intervention)
  trip(): void {
    this.openCircuit();
  }

  // Force circuit to close (for manual recovery)
  close(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    log.info(`✅ Circuit breaker manually closed for ${this.name}`, LogContext.SYSTEM);
  }

  // Additional methods for compatibility
  recordFailure(): void {
    this.onFailure(new Error('Manual failure recorded'));
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getLastFailureTime(): number | undefined {
    return this.lastFailureTime;
  }
}

// Factory function for creating circuit breakers
export function createCircuitBreaker(
  name: string,
  options?: CircuitBreakerOptions
): CircuitBreaker {
  return new CircuitBreaker(name, options);
}

// Global circuit breaker registry
export class CircuitBreakerRegistry {
  private static breakers = new Map<string, CircuitBreaker>();

  static register(name: string, breaker: CircuitBreaker): void {
    this.breakers.set(name, breaker);
  }

  static get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  static getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  static getMetrics(): Record<string, CircuitBreakerMetrics> {
    const entries: Array<[string, CircuitBreakerMetrics]> = [];
    this.breakers.forEach((breaker, name) => {
      entries.push([name, breaker.getMetrics()]);
    });
    return Object.fromEntries(entries);
  }

  static reset(name?: string): void {
    if (name) {
      this.breakers.get(name)?.reset();
    } else {
      this.breakers.forEach((breaker) => breaker.reset());
    }
  }
}

// Export convenience function for monitoring all breakers
export function getCircuitBreakerStatus(): Record<string, CircuitBreakerMetrics> {
  return CircuitBreakerRegistry.getMetrics();
}
