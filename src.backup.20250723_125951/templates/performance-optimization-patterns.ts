/**
 * Performance Optimization Patterns for AI Systems
 * Battle-tested patterns for high-performance AI applications
 *
 * Based on research from successful AI platforms and optimization techniques:
 * - Caching strategies for LLM responses
 * - Connection pooling and resource management
 * - Batch processing patterns
 * - Memory management for long-running processes
 * - Circuit breakers and graceful degradation
 */

import { LRUCache } from 'lru-cache';
import { EventEmitter } from 'events';

// Response Caching for LLM calls
export class AIResponseCache {
  private cache: LRUCache<string, any>;
  private ttlCache: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    maxSize = 1000,
    private defaultTTL = 300000 // 5 minutes
  ) {
    this.cache = new LRUCache({
      max: maxSize,
      dispose: (key) => {
        const timeout = this.ttlCache.get(key);
        if (timeout) {
          clearTimeout(timeout);
          this.ttlCache.delete(key);
        }
      },
    });
  }

  // Create cache key from requestparameters
  private createKey(prompt: string, model: string, params: any: string {
    const cleanParams = { ...params };
    delete cleanParams.timestamp; // Remove non-deterministic fields

    return JSON.stringify({
      prompt: prompt.trim(),
      model,
      params: cleanParams,
    });
  }

  async get(prompt: string, model: string, params: any: Promise<any | null> {
    const key = this.createKey(prompt, model, params;
    return this.cache.get(key) || null;
  }

  async set(
    prompt: string,
    model: string,
    params: any,
    response: any,
    ttl?: number
  ))): Promise<void> {
    const key = this.createKey(prompt, model, params;
    const actualTTL = ttl || this.defaultTTL;

    this.cache.set(key, response;

    // Set TTL
    const timeout = setTimeout(() => {
      this.cache.delete(key);
      this.ttlCache.delete(key);
    }, actualTTL);

    this.ttlCache.set(key, timeout;
  }

  clear()): void {
    this.cache.clear();
    this.ttlCache.forEach((timeout) => clearTimeout(timeout));
    this.ttlCache.clear();
  }

  getStats(): { size: number; maxSize: number; hitRatio: number, } {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hitRatio: this.cache.calculatedSize / (this.cache.calculatedSize + this.cache.size),
    };
  }
}

// Connection Pool Manager for external services
export class ConnectionPool extends EventEmitter {
  private activeConnections: Set<any> = new Set();
  private idleConnections: Array<any> = [];
  private connectionQueue: Array<{
    resolve: (connection: any => void;
    reject: (_error: Error => void;
    timeout: NodeJS.Timeout;
  }> = [];

  constructor(
    private createConnection: () => Promise<unknown>,
    private destroyConnection: (connection: any => Promise<void>,
    private validateConnection: (connection: any => Promise<boolean>,
    private config: {
      minConnections: number;
      maxConnections: number;
      acquireTimeout: number;
      idleTimeout: number;
    } = {
      minConnections: 2,
      maxConnections: 10,
      acquireTimeout: 30000,
      idleTimeout: 300000,
    }
  ) {
    super();
    this.initializePool();
  }

  private async initializePool())): Promise<void> {
    for (let i = 0; i < this.config.minConnections; i++) {
      try {
        const connection = await this.createConnection();
        this.idleConnections.push(connection);
      } catch (error) {
        this.emit('connectionError', error);
      }
    }
  }

  async acquire()): Promise<unknown> {
    // Try to get idle connection first
    if (this.idleConnections.length > 0) {
      const connection = this.idleConnections.pop()!;

      // Validate connection
      try {
        const isValid = await this.validateConnection(connection);
        if (isValid) {
          this.activeConnections.add(connection);
          return connection;
        } else {
          await this.destroyConnection(connection);
        }
      } catch (error) {
        await this.destroyConnection(connection);
      }
    }

    // Create new connection if under limit
    if (this.getTotalConnections() < this.config.maxConnections) {
      try {
        const connection = await this.createConnection();
        this.activeConnections.add(connection);
        return connection;
      } catch (error) {
        this.emit('connectionError', error);
        throw error;
      }
    }

    // Wait for available connection
    return new Promise((resolve, reject => {
      const timeout = setTimeout(() => {
        const index = this.connectionQueue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.connectionQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeout);

      this.connectionQueue.push({ resolve, reject, timeout });
    });
  }

  async release(connection: any)): Promise<void> {
    if (!this.activeConnections.has(connection)) {
      return; // Not our connection
    }

    this.activeConnections.delete(connection);

    // If there's a queued request fulfill it
    if (this.connectionQueue.length > 0) {
      const queued = this.connectionQueue.shift()!;
      clearTimeout(queued.timeout);
      this.activeConnections.add(connection);
      queued.resolve(connection);
      return;
    }

    // Return to idle pool
    this.idleConnections.push(connection);

    // Set idle timeout
    setTimeout(async () => {
      const index = this.idleConnections.indexOf(connection);
      if (index !== -1 && this.idleConnections.length > this.config.minConnections) {
        this.idleConnections.splice(index, 1);
        await this.destroyConnection(connection);
      }
    }, this.config.idleTimeout);
  }

  private getTotalConnections(): number {
    return this.activeConnections.size + this.idleConnections.length;
  }

  async destroy())): Promise<void> {
    // Clear queue
    this.connectionQueue.forEach(({ timeout, reject }) => {
      clearTimeout(timeout);
      reject(new Error('Pool destroyed'));
    });
    this.connectionQueue = [];

    // Destroy all connections
    const allConnections = [...Array.from(this.activeConnections), ...this.idleConnections];

    await Promise.all(allConnections.map((conn) => this.destroyConnection(conn)));

    this.activeConnections.clear();
    this.idleConnections = [];
  }

  getStats()): any {
    return {
      active: this.activeConnections.size,
      idle: this.idleConnections.length,
      queued: this.connectionQueue.length,
      total: this.getTotalConnections(),
    };
  }
}

// Batch Processing for efficient operations
export class BatchProcessor<T, R> {
  private batch: T[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private pendingPromises: Array<{
    resolve: (result: R => void;
    reject: (_error: Error => void;
  }> = [];

  constructor(
    private processBatch: (items: T[]) => Promise<R[]>,
    private config: {
      batchSize: number;
      batchTimeout: number;
      maxConcurrentBatches: number;
    } = {
      batchSize: 10,
      batchTimeout: 100,
      maxConcurrentBatches: 3,
    }
  ) {}

  async add(item: T: Promise<R> {
    return new Promise((resolve, reject => {
      this.batch.push(item);
      this.pendingPromises.push({ resolve, reject });

      // Process if batch is full
      if (this.batch.length >= this.config.batchSize) {
        this.processPendingBatch();
        return;
      }

      // Set timeout for partial batch
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.processPendingBatch();
        }, this.config.batchTimeout);
      }
    });
  }

  private async processPendingBatch())): Promise<void> {
    if (this.batch.length === 0) return;

    const currentBatch = this.batch.splice(0);
    const currentPromises = this.pendingPromises.splice(0);

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    try {
      const results = await this.processBatch(currentBatch);

      currentPromises.forEach((promise, index => {
        if (results[index] !== undefined) {
          promise.resolve(results[index]);
        } else {
          promise.reject(new Error('No result for batch item'));
        }
      });
    } catch (error) {
      currentPromises.forEach((promise) => {
        promise.reject(error as Error);
      });
    }
  }

  async flush())): Promise<void> {
    if (this.batch.length > 0) {
      await this.processPendingBatch();
    }
  }
}

// Memory-efficient streaming processor
export class StreamProcessor<T> extends EventEmitter {
  private buffer: T[] = [];
  private isProcessing = false;

  constructor(
    private processChunk: (chunk: T[]) => Promise<void>,
    private config: {
      chunkSize: number;
      highWaterMark: number;
      lowWaterMark: number;
    } = {
      chunkSize: 100,
      highWaterMark: 1000,
      lowWaterMark: 100,
    }
  ) {
    super();
  }

  async push(item: T)): Promise<void> {
    this.buffer.push(item);

    // Apply backpressure if buffer is full
    if (this.buffer.length >= this.config.highWaterMark) {
      this.emit('backpressure', this.buffer.length);
      await this.processUntilLowWater();
    } else if (!this.isProcessing && this.buffer.length >= this.config.chunkSize) {
      this.processNextChunk();
    }
  }

  private async processNextChunk())): Promise<void> {
    if (this.isProcessing || this.buffer.length === 0) return;

    this.isProcessing = true;

    try {
      const chunk = this.buffer.splice(0, this.config.chunkSize);
      await this.processChunk(chunk);
      this.emit('processed', chunk.length);
    } catch (error) {
      this.emit('_error, error;
    } finally {
      this.isProcessing = false;

      // Continue processing if there's more data
      if (this.buffer.length >= this.config.chunkSize) {
        setImmediate(() => this.processNextChunk());
      }
    }
  }

  private async processUntilLowWater())): Promise<void> {
    while (this.buffer.length > this.config.lowWaterMark) {
      await this.processNextChunk();
      // Small delay to prevent blocking
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  async flush())): Promise<void> {
    while (this.buffer.length > 0) {
      await this.processNextChunk();
    }
  }

  getStats(): { bufferSize: number; isProcessing: boolean, } {
    return {
      bufferSize: this.buffer.length,
      isProcessing: this.isProcessing,
    };
  }
}

// Resource limiter to prevent OOM
export class ResourceLimiter {
  private currentMemory = 0;
  private currentCPU = 0;
  private operations: Set<string> = new Set();

  constructor(
    private limits: {
      maxMemoryMB: number;
      maxCPUPercent: number;
      maxConcurrentOperations: number;
    }
  ) {}

  async checkResources(): Promise<boolean> {
    const memoryUsage = process.memoryUsage();
    this.currentMemory = memoryUsage.heapUsed / 1024 / 1024; // MB

    // Simple CPU check (you'd want a more sophisticated: implementation
    const cpuUsage = process.cpuUsage();
    this.currentCPU = (cpuUsage.user + cpuUsage.system) / 1000000; // seconds

    return (;
      this.currentMemory < this.limits.maxMemoryMB &&
      this.operations.size < this.limits.maxConcurrentOperations
    );
  }

  async withResourceCheck<T>(operationId: string, operation: () => Promise<T>): Promise<T> {
    if (!(await this.checkResources())) {
      throw new Error('Resource limits exceeded');
    }

    this.operations.add(operationId);

    try {
      return await operation();
    } finally {
      this.operations.delete(operationId);
    }
  }

  getStats()): any {
    return {
      memoryUsageMB: this.currentMemory,
      memoryLimitMB: this.limits.maxMemoryMB,
      concurrentOperations: this.operations.size,
      maxConcurrentOperations: this.limits.maxConcurrentOperations,
    };
  }
}

// Performance Monitor
export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, number[]> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  startMetric(name: string: () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration;
    };
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(value);

    // Keep only last 1000 measurements
    if (values.length > 1000) {
      values.shift();
    }

    this.emit('metric', { name, value });
  }

  getStats(name: string): any {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) {
      return { count: 0 };
    }

    const sorted = [...values].sort((a, b => a - b);

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: values.reduce((a, b => a + b, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  getAllStats(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name] of this.metrics) {
      result[name] = this.getStats(name);
    }
    return result;
  }

  startPeriodicMetrics(intervalMs = 60000)): void {
    const interval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.recordMetric('memory.heap.used', memUsage.heapUsed / 1024 / 1024);
      this.recordMetric('memory.heap.total', memUsage.heapTotal / 1024 / 1024);
      this.recordMetric('memory.external', memUsage.external / 1024 / 1024);

      const cpuUsage = process.cpuUsage();
      this.recordMetric('cpu.user', cpuUsage.user / 1000);
      this.recordMetric('cpu.system', cpuUsage.system / 1000);
    }, intervalMs);

    this.intervals.set('system', interval);
  }

  stop()): void {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
  }
}

// Export utility functions
export function createOptimizedAISystem(config: {
  cacheSize?: number;
  cacheTTL?: number;
  connectionPool?: any;
  batchSize?: number;
  resourceLimits?: any;
}) {
  const cache = new AIResponseCache(config.cacheSize, config.cacheTTL);
  const monitor = new PerformanceMonitor();
  const limiter = new ResourceLimiter(
    config.resourceLimits || {
      maxMemoryMB: 1024,
      maxCPUPercent: 80,
      maxConcurrentOperations: 100,
    }
  );

  monitor.startPeriodicMetrics();

  return {
    cache,
    monitor,
    limiter,

    async shutdown() {
      monitor.stop();
      if (config.connectionPool) {
        await config.connectionPool.destroy();
      }
    },
  };
}
