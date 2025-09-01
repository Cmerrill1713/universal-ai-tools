/**
 * Circuit Breaker Pattern Implementation
 * Provides resilient service communication with automatic failure detection and recovery
 */

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  name: string
  failureThreshold: number        // Number of failures before opening circuit
  recoveryTimeout: number         // Time to wait before trying to close circuit (ms)
  monitoringWindow: number        // Time window to monitor for failures (ms)
  expectedResponseTime: number    // Expected response time in ms
  slowCallThreshold: number       // Threshold for considering a call slow (ms)
  slowCallRateThreshold: number   // Percentage of slow calls before opening circuit
  minimumCalls: number            // Minimum number of calls in window before evaluating
  successThreshold: number        // Number of successful calls needed to close circuit
}

export interface CircuitBreakerMetrics {
  state: CircuitState
  failureCount: number
  successCount: number
  slowCallCount: number
  totalCalls: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  stateChangedAt: Date
  averageResponseTime: number
  failureRate: number
  slowCallRate: number
}

export interface CircuitBreakerEvents {
  stateChanged: (from: CircuitState, to: CircuitState, reason: string) => void
  callExecuted: (success: boolean, duration: number) => void
  circuitOpened: (reason: string, metrics: CircuitBreakerMetrics) => void
  circuitClosed: (metrics: CircuitBreakerMetrics) => void
  fallbackExecuted: (reason: string) => void
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitState: CircuitState,
    public readonly metrics: CircuitBreakerMetrics
  ) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private slowCallCount = 0
  private totalCalls = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private stateChangedAt = new Date()
  private responseTimes: number[] = []
  private nextAttempt = 0
  private halfOpenCallCount = 0

  constructor(private config: CircuitBreakerConfig) {
    super()
    this.setMaxListeners(100) // Allow many listeners for metrics collection
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        if (fallback) {
          this.emit('fallbackExecuted', 'Circuit breaker is open')
          return await this.ensurePromise(fallback)
        }
        throw new CircuitBreakerError(
          `Circuit breaker is open for ${this.config.name}`,
          this.state,
          this.getMetrics()
        )
      } else {
        this.setState(CircuitState.HALF_OPEN, 'Recovery timeout elapsed')
        this.halfOpenCallCount = 0
      }
    }

    const startTime = performance.now()
    
    try {
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise()
      ])
      
      const duration = performance.now() - startTime
      this.onSuccess(duration)
      
      return result as T
    } catch (error) {
      const duration = performance.now() - startTime
      const errorObj = error instanceof Error ? error : new Error(String(error))
      this.onFailure(errorObj, duration)
      
      if (fallback) {
        this.emit('fallbackExecuted', `Operation failed: ${errorObj.message}`)
        return await this.ensurePromise(fallback)
      }
      
      throw error
    }
  }

  /**
   * Execute with automatic retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    retryDelay: number = 1000,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.execute(operation, attempt === retries ? fallback : undefined)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < retries && !(error instanceof CircuitBreakerError)) {
          // Exponential backoff with jitter
          const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
    }

    throw lastError!
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const windowStart = Date.now() - this.config.monitoringWindow
    const recentResponseTimes = this.responseTimes.filter(
      (_, index) => index >= this.responseTimes.length - 100 // Last 100 calls
    )

    const averageResponseTime = recentResponseTimes.length > 0
      ? recentResponseTimes.reduce((sum, time) => sum + time, 0) / recentResponseTimes.length
      : 0

    const failureRate = this.totalCalls > 0 ? this.failureCount / this.totalCalls : 0
    const slowCallRate = this.totalCalls > 0 ? this.slowCallCount / this.totalCalls : 0

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      slowCallCount: this.slowCallCount,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt,
      averageResponseTime,
      failureRate,
      slowCallRate
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.setState(CircuitState.CLOSED, 'Manual reset')
    this.failureCount = 0
    this.successCount = 0
    this.slowCallCount = 0
    this.totalCalls = 0
    this.halfOpenCallCount = 0
    this.responseTimes = []
    this.nextAttempt = 0
  }

  /**
   * Force the circuit breaker to open
   */
  forceOpen(reason: string = 'Manually forced open'): void {
    this.setState(CircuitState.OPEN, reason)
    this.scheduleNextAttempt()
  }

  /**
   * Get the current state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Check if the circuit breaker is allowing calls
   */
  isCallAllowed(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true
      case CircuitState.OPEN:
        return Date.now() >= this.nextAttempt
      case CircuitState.HALF_OPEN:
        return this.halfOpenCallCount < this.config.successThreshold
    }
  }

  private onSuccess(duration: number): void {
    this.recordCall(true, duration)
    this.successCount++
    this.lastSuccessTime = new Date()
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCallCount++
      if (this.halfOpenCallCount >= this.config.successThreshold) {
        this.setState(CircuitState.CLOSED, 'Sufficient successful calls in half-open state')
        this.failureCount = 0 // Reset failure count when closing
      }
    }

    this.emit('callExecuted', true, duration)
  }

  private onFailure(error: Error, duration: number): void {
    this.recordCall(false, duration)
    this.failureCount++
    this.lastFailureTime = new Date()

    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.OPEN, `Failure in half-open state: ${error.message}`)
      this.scheduleNextAttempt()
    } else if (this.shouldOpenCircuit()) {
      const reason = this.getOpenReason()
      this.setState(CircuitState.OPEN, reason)
      this.scheduleNextAttempt()
      this.emit('circuitOpened', reason, this.getMetrics())
    }

    this.emit('callExecuted', false, duration)
  }

  private recordCall(success: boolean, duration: number): void {
    this.totalCalls++
    this.responseTimes.push(duration)
    
    // Keep only recent response times to prevent memory leak
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-500)
    }

    // Track slow calls
    if (duration > this.config.slowCallThreshold) {
      this.slowCallCount++
    }

    // Clean up old data outside monitoring window
    const windowStart = Date.now() - this.config.monitoringWindow
    // This is a simplified cleanup - in production, you'd want more sophisticated sliding window
  }

  private shouldOpenCircuit(): boolean {
    if (this.totalCalls < this.config.minimumCalls) {
      return false
    }

    // Check failure rate
    const failureRate = this.failureCount / this.totalCalls
    if (failureRate >= this.config.failureThreshold / 100) {
      return true
    }

    // Check slow call rate
    const slowCallRate = this.slowCallCount / this.totalCalls
    if (slowCallRate >= this.config.slowCallRateThreshold / 100) {
      return true
    }

    return false
  }

  private getOpenReason(): string {
    const failureRate = (this.failureCount / this.totalCalls) * 100
    const slowCallRate = (this.slowCallCount / this.totalCalls) * 100
    
    if (failureRate >= this.config.failureThreshold) {
      return `High failure rate: ${failureRate.toFixed(2)}%`
    }
    if (slowCallRate >= this.config.slowCallRateThreshold) {
      return `High slow call rate: ${slowCallRate.toFixed(2)}%`
    }
    return 'Circuit breaker threshold exceeded'
  }

  private setState(newState: CircuitState, reason: string): void {
    const oldState = this.state
    this.state = newState
    this.stateChangedAt = new Date()

    if (newState === CircuitState.CLOSED && oldState !== CircuitState.CLOSED) {
      this.emit('circuitClosed', this.getMetrics())
    }

    this.emit('stateChanged', oldState, newState, reason)
  }

  private scheduleNextAttempt(): void {
    this.nextAttempt = Date.now() + this.config.recoveryTimeout
  }

  private createTimeoutPromise<T>(): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.config.expectedResponseTime}ms`))
      }, this.config.expectedResponseTime * 2) // 2x expected time before timeout
    })
  }

  private async ensurePromise<T>(fn: (() => Promise<T>) | (() => T)): Promise<T> {
    const result = fn()
    return result instanceof Promise ? result : Promise.resolve(result)
  }
}

/**
 * Circuit Breaker Manager for managing multiple circuit breakers
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>()
  private defaultConfigs = new Map<string, Partial<CircuitBreakerConfig>>()

  constructor() {
    // Set up default configurations for different service types
    this.defaultConfigs.set('api', {
      failureThreshold: 50,        // 50% failure rate
      recoveryTimeout: 60000,      // 60 seconds
      monitoringWindow: 300000,    // 5 minutes
      expectedResponseTime: 5000,  // 5 seconds
      slowCallThreshold: 2000,     // 2 seconds
      slowCallRateThreshold: 30,   // 30% slow calls
      minimumCalls: 10,
      successThreshold: 3
    })

    this.defaultConfigs.set('database', {
      failureThreshold: 30,        // 30% failure rate (more strict)
      recoveryTimeout: 30000,      // 30 seconds
      monitoringWindow: 180000,    // 3 minutes
      expectedResponseTime: 2000,  // 2 seconds
      slowCallThreshold: 1000,     // 1 second
      slowCallRateThreshold: 20,   // 20% slow calls
      minimumCalls: 5,
      successThreshold: 2
    })

    this.defaultConfigs.set('ml-inference', {
      failureThreshold: 40,        // 40% failure rate
      recoveryTimeout: 120000,     // 2 minutes
      monitoringWindow: 600000,    // 10 minutes
      expectedResponseTime: 30000, // 30 seconds
      slowCallThreshold: 15000,    // 15 seconds
      slowCallRateThreshold: 40,   // 40% slow calls
      minimumCalls: 3,
      successThreshold: 2
    })

    this.defaultConfigs.set('external-api', {
      failureThreshold: 60,        // 60% failure rate (more lenient)
      recoveryTimeout: 180000,     // 3 minutes
      monitoringWindow: 300000,    // 5 minutes
      expectedResponseTime: 10000, // 10 seconds
      slowCallThreshold: 5000,     // 5 seconds
      slowCallRateThreshold: 50,   // 50% slow calls
      minimumCalls: 5,
      successThreshold: 3
    })
  }

  /**
   * Get or create a circuit breaker for a service
   */
  getCircuitBreaker(
    name: string,
    type: string = 'api',
    customConfig?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!
    }

    const defaultConfig = this.defaultConfigs.get(type) || this.defaultConfigs.get('api')!
    const config: CircuitBreakerConfig = {
      name,
      failureThreshold: 50,
      recoveryTimeout: 60000,
      monitoringWindow: 300000,
      expectedResponseTime: 5000,
      slowCallThreshold: 2000,
      slowCallRateThreshold: 30,
      minimumCalls: 10,
      successThreshold: 3,
      ...defaultConfig,
      ...customConfig
    }

    const breaker = new CircuitBreaker(config)
    this.breakers.set(name, breaker)
    
    // Set up logging for important events
    breaker.on('stateChanged', (from, to, reason) => {
      console.log(`🔄 Circuit breaker ${name}: ${from} -> ${to} (${reason})`)
    })

    breaker.on('circuitOpened', (reason, metrics) => {
      console.warn(`⚠️ Circuit breaker ${name} opened: ${reason}`)
      console.warn(`   Metrics: ${metrics.failureRate.toFixed(2)}% failure rate, ${metrics.totalCalls} total calls`)
    })

    breaker.on('circuitClosed', (metrics) => {
      console.log(`✅ Circuit breaker ${name} closed after recovery`)
    })

    return breaker
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {}
    
    for (const [name, breaker] of this.breakers.entries()) {
      metrics[name] = breaker.getMetrics()
    }
    
    return metrics
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset()
    }
    console.log(`🔄 Reset all ${this.breakers.size} circuit breakers`)
  }

  /**
   * Get circuit breakers in open state
   */
  getOpenCircuits(): string[] {
    const openCircuits: string[] = []
    
    for (const [name, breaker] of this.breakers.entries()) {
      if (breaker.getState() === CircuitState.OPEN) {
        openCircuits.push(name)
      }
    }
    
    return openCircuits
  }

  /**
   * Remove a circuit breaker
   */
  removeCircuitBreaker(name: string): boolean {
    return this.breakers.delete(name)
  }

  /**
   * Get the number of managed circuit breakers
   */
  size(): number {
    return this.breakers.size
  }
}

// Export a global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager()