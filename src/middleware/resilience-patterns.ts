/**
 * Resilience Patterns for Service Communication
 * Implements retry, bulkhead, rate limiting, and timeout patterns
 */

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'
import { circuitBreakerManager } from './circuit-breaker'

// ============= Retry Pattern =============

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number          // Base delay in ms
  maxDelay: number           // Maximum delay in ms
  backoffMultiplier: number  // Exponential backoff multiplier
  jitterRange: number        // Jitter range (0-1)
  retryableErrors?: (error: Error) => boolean
}

export interface RetryResult<T> {
  result: T
  attempts: number
  totalTime: number
  lastError?: Error
}

export class RetryPolicy {
  constructor(private config: RetryConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = performance.now()
    let lastError: Error = new Error('No attempts made')
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await operation()
        const totalTime = performance.now() - startTime
        
        return {
          result,
          attempts: attempt,
          totalTime,
          lastError: attempt > 1 ? lastError : undefined
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Check if error is retryable
        if (this.config.retryableErrors && !this.config.retryableErrors(lastError)) {
          throw lastError
        }
        
        // Don't delay after the last attempt
        if (attempt === this.config.maxAttempts) {
          throw lastError
        }
        
        const delay = this.calculateDelay(attempt)
        await this.sleep(delay)
      }
    }
    
    throw lastError!
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
      this.config.maxDelay
    )
    
    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * this.config.jitterRange * (Math.random() - 0.5)
    
    return Math.max(0, exponentialDelay + jitter)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============= Bulkhead Pattern =============

export interface BulkheadConfig {
  name: string
  maxConcurrency: number
  queueSize: number
  timeout: number
}

export class BulkheadIsolation {
  private running = 0
  private queue: Array<{
    operation: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
    timestamp: number
  }> = []
  
  constructor(private config: BulkheadConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queueItem = {
        operation,
        resolve,
        reject,
        timestamp: Date.now()
      }
      
      if (this.running < this.config.maxConcurrency) {
        this.executeImmediate(queueItem)
      } else if (this.queue.length < this.config.queueSize) {
        this.queue.push(queueItem)
      } else {
        reject(new Error(`Bulkhead ${this.config.name}: Queue is full`))
      }
    })
  }

  private async executeImmediate(queueItem: any): Promise<void> {
    this.running++
    
    try {
      // Check for timeout
      const elapsed = Date.now() - queueItem.timestamp
      if (elapsed > this.config.timeout) {
        queueItem.reject(new Error(`Bulkhead ${this.config.name}: Operation timed out`))
        return
      }
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Bulkhead ${this.config.name}: Operation timeout`))
        }, this.config.timeout - elapsed)
      })
      
      const result = await Promise.race([
        queueItem.operation(),
        timeoutPromise
      ])
      
      queueItem.resolve(result)
    } catch (error) {
      queueItem.reject(error)
    } finally {
      this.running--
      this.processQueue()
    }
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.config.maxConcurrency) {
      const nextItem = this.queue.shift()!
      this.executeImmediate(nextItem)
    }
  }

  getStats() {
    return {
      name: this.config.name,
      running: this.running,
      queued: this.queue.length,
      maxConcurrency: this.config.maxConcurrency,
      queueSize: this.config.queueSize
    }
  }
}

// ============= Rate Limiting Pattern =============

export interface RateLimiterConfig {
  windowSizeMs: number
  maxRequests: number
  refillRate?: number  // Requests per second for token bucket
}

export class TokenBucketRateLimiter {
  private tokens: number
  private lastRefill: number
  
  constructor(private config: RateLimiterConfig) {
    this.tokens = config.maxRequests
    this.lastRefill = Date.now()
  }

  async acquire(tokens: number = 1): Promise<boolean> {
    this.refillBucket()
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens
      return true
    }
    
    return false
  }

  async waitForTokens(tokens: number = 1, maxWaitMs: number = 5000): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.acquire(tokens)) {
        return true
      }
      
      // Wait a short time before trying again
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    return false
  }

  private refillBucket(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    
    if (this.config.refillRate) {
      // Token bucket with continuous refill
      const tokensToAdd = (elapsed / 1000) * this.config.refillRate
      this.tokens = Math.min(this.config.maxRequests, this.tokens + tokensToAdd)
    } else {
      // Simple sliding window
      if (elapsed >= this.config.windowSizeMs) {
        this.tokens = this.config.maxRequests
      }
    }
    
    this.lastRefill = now
  }

  getStatus() {
    this.refillBucket()
    return {
      tokens: Math.floor(this.tokens),
      maxTokens: this.config.maxRequests,
      refillRate: this.config.refillRate || 0
    }
  }
}

// ============= Timeout Pattern =============

export class TimeoutManager {
  static withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
    
    return Promise.race([promise, timeoutPromise])
  }

  static withDeadline<T>(
    promise: Promise<T>,
    deadline: Date,
    timeoutMessage?: string
  ): Promise<T> {
    const now = Date.now()
    const deadlineTime = deadline.getTime()
    
    if (now >= deadlineTime) {
      return Promise.reject(new Error(timeoutMessage || 'Deadline has already passed'))
    }
    
    return this.withTimeout(promise, deadlineTime - now, timeoutMessage)
  }
}

// ============= Service Resilience Wrapper =============

export interface ServiceResilienceConfig {
  serviceName: string
  circuitBreaker?: {
    enabled: boolean
    type?: string
    customConfig?: any
  }
  retry?: RetryConfig
  bulkhead?: BulkheadConfig
  rateLimit?: RateLimiterConfig
  timeout?: number
}

export class ResilientServiceClient extends EventEmitter {
  private bulkhead?: BulkheadIsolation
  private rateLimiter?: TokenBucketRateLimiter
  private retryPolicy?: RetryPolicy
  
  constructor(private config: ServiceResilienceConfig) {
    super()
    
    if (config.bulkhead) {
      this.bulkhead = new BulkheadIsolation(config.bulkhead)
    }
    
    if (config.rateLimit) {
      this.rateLimiter = new TokenBucketRateLimiter(config.rateLimit)
    }
    
    if (config.retry) {
      this.retryPolicy = new RetryPolicy(config.retry)
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Apply rate limiting
    if (this.rateLimiter) {
      const allowed = await this.rateLimiter.waitForTokens(1, 1000)
      if (!allowed) {
        throw new Error(`Rate limit exceeded for ${this.config.serviceName}`)
      }
    }

    // Get circuit breaker if enabled
    const circuitBreaker = this.config.circuitBreaker?.enabled
      ? circuitBreakerManager.getCircuitBreaker(
          this.config.serviceName,
          this.config.circuitBreaker.type,
          this.config.circuitBreaker.customConfig
        )
      : null

    // Wrap operation with timeout
    const timeoutOperation = () => {
      return this.config.timeout
        ? TimeoutManager.withTimeout(operation(), this.config.timeout)
        : operation()
    }

    // Execute with resilience patterns
    const resilientOperation = async (): Promise<T> => {
      if (this.bulkhead) {
        return await this.bulkhead.execute(timeoutOperation)
      } else {
        return await timeoutOperation()
      }
    }

    try {
      let result: T

      if (circuitBreaker && this.retryPolicy) {
        // Use both circuit breaker and retry
        const retryResult = await this.retryPolicy.execute(async () => {
          return await circuitBreaker.execute(resilientOperation)
        })
        result = retryResult.result
        
        this.emit('operationCompleted', {
          service: this.config.serviceName,
          success: true,
          attempts: retryResult.attempts,
          totalTime: retryResult.totalTime
        })
      } else if (circuitBreaker) {
        // Use only circuit breaker
        result = await circuitBreaker.execute(resilientOperation)
        
        this.emit('operationCompleted', {
          service: this.config.serviceName,
          success: true,
          attempts: 1
        })
      } else if (this.retryPolicy) {
        // Use only retry
        const retryResult = await this.retryPolicy.execute(resilientOperation)
        result = retryResult.result
        
        this.emit('operationCompleted', {
          service: this.config.serviceName,
          success: true,
          attempts: retryResult.attempts,
          totalTime: retryResult.totalTime
        })
      } else {
        // No resilience patterns, just execute
        result = await resilientOperation()
        
        this.emit('operationCompleted', {
          service: this.config.serviceName,
          success: true,
          attempts: 1
        })
      }

      return result
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      this.emit('operationFailed', {
        service: this.config.serviceName,
        error: errorObj.message,
        errorType: errorObj.constructor.name
      })
      throw error
    }
  }

  getStatus() {
    const status: any = {
      serviceName: this.config.serviceName,
      patterns: {
        circuitBreaker: this.config.circuitBreaker?.enabled || false,
        retry: !!this.retryPolicy,
        bulkhead: !!this.bulkhead,
        rateLimit: !!this.rateLimiter,
        timeout: !!this.config.timeout
      }
    }

    if (this.bulkhead) {
      status.bulkhead = this.bulkhead.getStats()
    }

    if (this.rateLimiter) {
      status.rateLimit = this.rateLimiter.getStatus()
    }

    if (this.config.circuitBreaker?.enabled) {
      const circuitBreaker = circuitBreakerManager.getCircuitBreaker(this.config.serviceName)
      status.circuitBreaker = circuitBreaker.getMetrics()
    }

    return status
  }
}

// ============= Resilience Manager =============

export class ResilienceManager {
  private clients = new Map<string, ResilientServiceClient>()
  
  createServiceClient(config: ServiceResilienceConfig): ResilientServiceClient {
    if (this.clients.has(config.serviceName)) {
      return this.clients.get(config.serviceName)!
    }
    
    const client = new ResilientServiceClient(config)
    this.clients.set(config.serviceName, client)
    
    // Set up event monitoring
    client.on('operationCompleted', (event) => {
      console.log(`✅ ${event.service}: Operation completed successfully`)
      if (event.attempts > 1) {
        console.log(`   Required ${event.attempts} attempts (${event.totalTime}ms total)`)
      }
    })

    client.on('operationFailed', (event) => {
      console.warn(`❌ ${event.service}: Operation failed - ${event.errorType}: ${event.error}`)
    })
    
    return client
  }
  
  getServiceClient(serviceName: string): ResilientServiceClient | undefined {
    return this.clients.get(serviceName)
  }
  
  getAllServiceStatus(): Record<string, any> {
    const status: Record<string, any> = {}
    
    for (const [name, client] of this.clients.entries()) {
      status[name] = client.getStatus()
    }
    
    // Add global circuit breaker status
    status._circuitBreakers = circuitBreakerManager.getAllMetrics()
    status._openCircuits = circuitBreakerManager.getOpenCircuits()
    
    return status
  }
  
  resetAllCircuitBreakers(): void {
    circuitBreakerManager.resetAll()
  }
}

// Export a global resilience manager instance
export const resilienceManager = new ResilienceManager()

// ============= Service Configuration Presets =============

export const ResiliencePresets = {
  // For critical internal services (database, cache, etc.)
  critical: (serviceName: string): ServiceResilienceConfig => ({
    serviceName,
    circuitBreaker: {
      enabled: true,
      type: 'database'
    },
    retry: {
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 2000,
      backoffMultiplier: 2,
      jitterRange: 0.1,
      retryableErrors: (error) => !error.message.includes('timeout')
    },
    bulkhead: {
      name: serviceName,
      maxConcurrency: 10,
      queueSize: 50,
      timeout: 5000
    },
    rateLimit: {
      windowSizeMs: 1000,
      maxRequests: 100,
      refillRate: 50
    },
    timeout: 3000
  }),

  // For ML inference services
  mlInference: (serviceName: string): ServiceResilienceConfig => ({
    serviceName,
    circuitBreaker: {
      enabled: true,
      type: 'ml-inference'
    },
    retry: {
      maxAttempts: 2,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitterRange: 0.2,
      retryableErrors: (error) => error.message.includes('timeout') || error.message.includes('overload')
    },
    bulkhead: {
      name: serviceName,
      maxConcurrency: 5,
      queueSize: 20,
      timeout: 30000
    },
    rateLimit: {
      windowSizeMs: 60000,
      maxRequests: 10,
      refillRate: 1
    },
    timeout: 25000
  }),

  // For external API calls
  external: (serviceName: string): ServiceResilienceConfig => ({
    serviceName,
    circuitBreaker: {
      enabled: true,
      type: 'external-api'
    },
    retry: {
      maxAttempts: 4,
      baseDelay: 500,
      maxDelay: 8000,
      backoffMultiplier: 2,
      jitterRange: 0.3,
      retryableErrors: (error) => error.message.includes('5') || error.message.includes('timeout')
    },
    bulkhead: {
      name: serviceName,
      maxConcurrency: 20,
      queueSize: 100,
      timeout: 15000
    },
    rateLimit: {
      windowSizeMs: 1000,
      maxRequests: 20,
      refillRate: 10
    },
    timeout: 12000
  }),

  // For lightweight internal services
  standard: (serviceName: string): ServiceResilienceConfig => ({
    serviceName,
    circuitBreaker: {
      enabled: true,
      type: 'api'
    },
    retry: {
      maxAttempts: 2,
      baseDelay: 250,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitterRange: 0.1
    },
    timeout: 5000
  })
}