/**
 * Voice Service Circuit Breaker
 * 
 * Implements circuit breaker pattern for voice services to prevent
 * cascading failures and provide graceful degradation.
 */

import { log, LogContext } from './logger';

export enum CircuitState {
  CLOSED = 'closed',    // Normal operation
  OPEN = 'open',        // Service is failing, reject requests
  HALF_OPEN = 'half-open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;     // Number of failures before opening
  successThreshold: number;      // Number of successes to close from half-open
  timeout: number;              // Time in ms before trying half-open
  volumeThreshold: number;      // Minimum requests before evaluating
  errorThresholdPercentage: number; // Error percentage to trip
}

export class VoiceServiceCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private nextAttempt?: Date;
  private requestCount = 0;
  private errorCount = 0;
  private lastResetTime = new Date();

  constructor(
    private readonly serviceName: string,
    private readonly config: CircuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      volumeThreshold: 10,
      errorThresholdPercentage: 50
    }
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker is ${this.state} for ${this.serviceName}`);
    }

    this.requestCount++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Check if request can be executed
   */
  private canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        log.info(`🔄 Circuit breaker entering half-open state`, LogContext.SYSTEM, {
          service: this.serviceName
        });
        return true;
      }
      return false;
    }

    // Half-open state
    return true;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.errorCount = 0;
        log.info(`✅ Circuit breaker closed`, LogContext.SYSTEM, {
          service: this.serviceName
        });
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    this.failureCount++;
    this.errorCount++;
    this.lastFailureTime = new Date();

    log.warn(`⚠️ Circuit breaker failure`, LogContext.SYSTEM, {
      service: this.serviceName,
      failureCount: this.failureCount,
      error: error instanceof Error ? error.message : String(error)
    });

    if (this.state === CircuitState.HALF_OPEN) {
      this.trip();
      return;
    }

    if (this.state === CircuitState.CLOSED) {
      // Check if we should trip based on volume and error percentage
      if (this.requestCount >= this.config.volumeThreshold) {
        const errorPercentage = (this.errorCount / this.requestCount) * 100;
        
        if (errorPercentage >= this.config.errorThresholdPercentage || 
            this.failureCount >= this.config.failureThreshold) {
          this.trip();
        }
      } else if (this.failureCount >= this.config.failureThreshold) {
        this.trip();
      }
    }
  }

  /**
   * Trip the circuit breaker to open state
   */
  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.config.timeout);
    this.successCount = 0;
    
    log.error(`🔴 Circuit breaker opened`, LogContext.SYSTEM, {
      service: this.serviceName,
      nextAttempt: this.nextAttempt.toISOString()
    });
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? new Date() >= this.nextAttempt : false;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit health metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorPercentage: this.requestCount > 0 
        ? (this.errorCount / this.requestCount) * 100 
        : 0,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      service: this.serviceName
    };
  }

  /**
   * Reset circuit breaker state (for testing or manual intervention)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttempt = undefined;
    this.lastResetTime = new Date();
    
    log.info(`🔧 Circuit breaker manually reset`, LogContext.SYSTEM, {
      service: this.serviceName
    });
  }

  /**
   * Force open the circuit (for maintenance)
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.config.timeout);
    
    log.warn(`🚫 Circuit breaker forced open`, LogContext.SYSTEM, {
      service: this.serviceName
    });
  }
}

/**
 * Circuit breaker manager for all voice services
 */
export class VoiceCircuitBreakerManager {
  private static instance: VoiceCircuitBreakerManager;
  private breakers = new Map<string, VoiceServiceCircuitBreaker>();

  private constructor() {}

  static getInstance(): VoiceCircuitBreakerManager {
    if (!VoiceCircuitBreakerManager.instance) {
      VoiceCircuitBreakerManager.instance = new VoiceCircuitBreakerManager();
    }
    return VoiceCircuitBreakerManager.instance;
  }

  /**
   * Get or create a circuit breaker for a service
   */
  getBreaker(serviceName: string, config?: CircuitBreakerConfig): VoiceServiceCircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new VoiceServiceCircuitBreaker(serviceName, config));
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all circuit breaker metrics
   */
  getAllMetrics() {
    const metrics: Record<string, any> = {};
    this.breakers.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });
    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const statuses: Record<string, CircuitState> = {};
    let allHealthy = true;
    
    this.breakers.forEach((breaker, name) => {
      const state = breaker.getState();
      statuses[name] = state;
      if (state !== CircuitState.CLOSED) {
        allHealthy = false;
      }
    });

    return {
      healthy: allHealthy,
      services: statuses,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const voiceCircuitManager = VoiceCircuitBreakerManager.getInstance();

// Predefined circuit breakers for voice services
export const circuitBreakers = {
  stt: voiceCircuitManager.getBreaker('speech-to-text', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000,
    volumeThreshold: 5,
    errorThresholdPercentage: 60
  }),
  tts: voiceCircuitManager.getBreaker('text-to-speech', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000,
    volumeThreshold: 5,
    errorThresholdPercentage: 60
  }),
  voiceAgent: voiceCircuitManager.getBreaker('voice-agent', {
    failureThreshold: 3, // More sensitive for voice
    successThreshold: 2,
    timeout: 15000, // Faster recovery
    volumeThreshold: 3, // Lower volume threshold
    errorThresholdPercentage: 40
  }),
  ollama: voiceCircuitManager.getBreaker('ollama-llm', {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 120000,
    volumeThreshold: 10,
    errorThresholdPercentage: 40
  })
};