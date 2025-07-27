import { EventEmitter } from 'events';
import * as v8 from 'v8';
import { performance } from 'perf_hooks';
import { LogContext, logger } from '../utils/enhanced-logger';
import type { MemoryConfig } from '../config/resources';
import { getResourceConfig } from '../config/resources';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface MemorySnapshot {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  heapUsedPercent: number;
  heapSizeLimit: number;
}

export interface MemoryLeak {
  id: string;
  type: string;
  size: number;
  growthRate: number;
  firstDetected: Date;
  lastChecked: Date;
  samples: number[];
}

export interface CacheEntry {
  key: string;
  size: number;
  lastAccessed: Date;
  hits: number;
  priority: number;
}

export class MemoryManager extends EventEmitter {
  private static instance: MemoryManager;
  private config: MemoryConfig;
  private snapshots: MemorySnapshot[] = [];
  private leaks: Map<string, MemoryLeak> = new Map();
  private caches: Map<string, Map<string, CacheEntry>> = new Map();
  private gcForced = 0;
  private monitoringInterval?: NodeJS.Timeout;
  private leakDetectionInterval?: NodeJS.Timeout;
  private heapSnapshotInterval?: NodeJS.Timeout;
  private lastGC: Date = new Date();
  private memoryPressureCallbacks: Array<() => void> = [];

  private constructor() {
    super();
    this.config = getResourceConfig().memory;
    this.initialize();
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private initialize() {
    // Start memory monitoring
    this.startMonitoring();

    // Set up heap snapshot collection
    if (this.config.enableMemoryProfiling) {
      this.startHeapSnapshotCollection();
    }

    // Set up leak detection
    if (this.config.enableLeakDetection) {
      this.startLeakDetection();
    }

    // Handle process signals
    process.on('SIGUSR2', () => this.takeHeapSnapshot());
  }

  private startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.collectMemoryMetrics();
    }, this.config.memoryCheckInterval);

    // Monitor for memory pressure
    this.on('memory-pressure', (level: 'warning' | 'critical') => {
      logger.warn(`Memory pressure detected: ${level}`, LogContext.PERFORMANCE);
      this.handleMemoryPressure(level);
    });
  }

  private collectMemoryMetrics() {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapUsedPercent = (memUsage.heapUsed / heapStats.heap_size_limit) * 100;

    const snapshot: MemorySnapshot = {
      timestamp: new Date(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
      rss: memUsage.rss,
      heapUsedPercent,
      heapSizeLimit: heapStats.heap_size_limit,
    };

    this.snapshots.push(snapshot);

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }

    // Check thresholds
    if (heapUsedPercent >= this.config.criticalThresholdPercent) {
      this.emit('memory-pressure', 'critical');
    } else if (heapUsedPercent >= this.config.warningThresholdPercent) {
      this.emit('memory-pressure', 'warning');
    }

    // Emit metrics
    this.emit('memory-metrics', snapshot);

    // Log if verbose
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Memory metrics', LogContext.PERFORMANCE, {
        heapUsed: `${(snapshot.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(snapshot.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(snapshot.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsedPercent: `${snapshot.heapUsedPercent.toFixed(1)}%`,
      });
    }
  }

  private handleMemoryPressure(level: 'warning' | 'critical') {
    if (level === 'critical') {
      // Force garbage collection
      this.forceGC();

      // Clear caches
      this.clearAllCaches();

      // Execute registered callbacks
      this.memoryPressureCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          logger.error('Error in memory pressure callback', LogContext.PERFORMANCE, { _error});
        }
      });
    } else if (level === 'warning') {
      // Clear old cache entries
      this.evictOldCacheEntries();

      // Suggest GC
      if (Date.now() - this.lastGC.getTime() > this.config.gcInterval) {
        this.forceGC();
      }
    }
  }

  public forceGC() {
    if (global.gc) {
      const before = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      global.gc();
      this.gcForced++;
      this.lastGC = new Date();

      const after = process.memoryUsage().heapUsed;
      const duration = performance.now() - startTime;
      const freed = before - after;

      logger.info(
        `Forced GC completed in ${duration.toFixed(2)}ms, freed ${(freed / 1024 / 1024).toFixed(2)} MB`,
        LogContext.PERFORMANCE
      );

      this.emit('gc-completed', {
        duration,
        freedMemory: freed,
        heapBefore: before,
        heapAfter: after,
      });
    } else {
      logger.warn(
        'Garbage collection not exposed. Run with --expose-gc flag',
        LogContext.PERFORMANCE
      );
    }
  }

  // Leak detection
  private startLeakDetection() {
    const samples: Map<string, number[]> = new Map();

    this.leakDetectionInterval = setInterval(() => {
      const heapStats = v8.getHeapStatistics();
      const spaces = v8.getHeapSpaceStatistics();

      spaces.forEach((space) => {
        const key = space.space_name;
        const size = space.space_used_size;

        if (!samples.has(key)) {
          samples.set(key, []);
        }

        const spaceSamples = samples.get(key)!;
        spaceSamples.push(size);

        // Keep last 10 samples
        if (spaceSamples.length > 10) {
          spaceSamples.shift();
        }

        // Detect potential leak
        if (spaceSamples.length >= 5) {
          const growthRate = this.calculateGrowthRate(spaceSamples);

          if (growthRate > 0.1) {
            // 10% growth rate threshold
            const leak = this.leaks.get(key) || {
              id: key,
              type: 'heap-space',
              size,
              growthRate,
              firstDetected: new Date(),
              lastChecked: new Date(),
              samples: spaceSamples,
            };

            leak.size = size;
            leak.growthRate = growthRate;
            leak.lastChecked = new Date();
            leak.samples = spaceSamples;

            this.leaks.set(key, leak);

            logger.warn(
              `Potential memory leak detected in ${key}: ${(growthRate * 100).toFixed(1)}% growth rate`,
              LogContext.PERFORMANCE
            );
            this.emit('leak-detected', leak);
          } else {
            // Remove from leaks if growth stopped
            this.leaks.delete(key);
          }
        }
      });
    }, this.config.leakDetectionInterval);
  }

  private calculateGrowthRate(samples: number[]): number {
    if (samples.length < 2) return 0;

    const firstHalf = samples.slice(0, Math.floor(samples.length / 2));
    const secondHalf = samples.slice(Math.floor(samples.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    return (avgSecond - avgFirst) / avgFirst;
  }

  // Cache management
  public registerCache(name: string) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Map());
      logger.info(`Registered cache: ${name}`, LogContext.PERFORMANCE);
    }
  }

  public addCacheEntry(cacheName: string, key: string, size: number, priority = 1) {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      logger.warn(`Cache ${cacheName} not registered`, LogContext.PERFORMANCE);
      return;
    }

    cache.set(key, {
      key,
      size,
      lastAccessed: new Date(),
      hits: 0,
      priority,
    });

    // Check if eviction needed
    const totalSize = this.getCacheSize(cacheName);
    const heapUsedPercent =
      (process.memoryUsage().heapUsed / v8.getHeapStatistics().heap_size_limit) * 100;

    if (heapUsedPercent > this.config.cacheEvictionThreshold) {
      this.evictCacheEntries(cacheName, totalSize * 0.2); // Evict 20%
    }
  }

  public getCacheEntry(cacheName: string, key: string): CacheEntry | undefined {
    const cache = this.caches.get(cacheName);
    if (!cache) return undefined;

    const entry = cache.get(key);
    if (entry) {
      entry.lastAccessed = new Date();
      entry.hits++;
    }
    return entry;
  }

  public removeCacheEntry(cacheName: string, key: string) {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.delete(key);
    }
  }

  private getCacheSize(cacheName: string): number {
    const cache = this.caches.get(cacheName);
    if (!cache) return 0;

    let totalSize = 0;
    cache.forEach((entry) => {
      totalSize += entry.size;
    });
    return totalSize;
  }

  private evictCacheEntries(cacheName: string, targetSize: number) {
    const cache = this.caches.get(cacheName);
    if (!cache) return;

    // Sort by priority and last accessed time
    const entries = Array.from(cache.values()).sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower priority first
      }
      return a.lastAccessed.getTime() - b.lastAccessed.getTime(); // Older first
    });

    let evicted = 0;
    for (const entry of entries) {
      if (evicted >= targetSize) break;

      cache.delete(entry.key);
      evicted += entry.size;

      logger.debug(
        `Evicted cache entry: ${entry.key} (${entry.size} bytes)`,
        LogContext.PERFORMANCE
      );
    }

    logger.info(`Evicted ${evicted} bytes from cache ${cacheName}`, LogContext.PERFORMANCE);
    this.emit('cache-evicted', { cacheName, evictedSize: evicted });
  }

  private evictOldCacheEntries() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    this.caches.forEach((cache, cacheName) => {
      const toEvict: string[] = [];

      cache.forEach((entry, key) => {
        if (now - entry.lastAccessed.getTime() > maxAge) {
          toEvict.push(key);
        }
      });

      toEvict.forEach((key) => {
        cache.delete(key);
      });

      if (toEvict.length > 0) {
        logger.info(
          `Evicted ${toEvict.length} old entries from cache ${cacheName}`,
          LogContext.PERFORMANCE
        );
      }
    });
  }

  private clearAllCaches() {
    let totalCleared = 0;

    this.caches.forEach((cache, cacheName) => {
      const { size } = cache;
      cache.clear();
      totalCleared += size;
      logger.info(`Cleared cache ${cacheName}: ${size} entries`, LogContext.PERFORMANCE);
    });

    this.emit('caches-cleared', { totalCleared });
  }

  // Heap snapshots
  private startHeapSnapshotCollection() {
    this.heapSnapshotInterval = setInterval(() => {
      this.takeHeapSnapshot();
    }, this.config.heapSnapshotInterval);
  }

  public async takeHeapSnapshot(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `heap-${timestamp}.heapsnapshot`;
    const filepath = path.join(process.cwd(), 'heap-snapshots', filename);

    try {
      await fs.mkdir(path.dirname(filepath), { recursive: true });

      const stream = v8.getHeapSnapshot();
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      await fs.writeFile(filepath, Buffer.concat(chunks));

      logger.info(`Heap snapshot saved to ${filepath}`, LogContext.PERFORMANCE);
      this.emit('heap-snapshot', { filepath });

      return filepath;
    } catch (error) {
      logger.error('Failed to take heap snapshot', LogContext.PERFORMANCE, { _error});
      throw error;
    }
  }

  // Memory profiling
  public getMemoryProfile(): any {
    const current = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const spaces = v8.getHeapSpaceStatistics();

    return {
      current: {
        heapUsed: current.heapUsed,
        heapTotal: current.heapTotal,
        external: current.external,
        arrayBuffers: current.arrayBuffers || 0,
        rss: current.rss,
      },
      heap: {
        totalHeapSize: heapStats.total_heap_size,
        totalHeapSizeExecutable: heapStats.total_heap_size_executable,
        totalPhysicalSize: heapStats.total_physical_size,
        totalAvailableSize: heapStats.total_available_size,
        usedHeapSize: heapStats.used_heap_size,
        heapSizeLimit: heapStats.heap_size_limit,
        mallocedMemory: heapStats.malloced_memory,
        peakMallocedMemory: heapStats.peak_malloced_memory,
        doesZapGarbage: heapStats.does_zap_garbage,
      },
      spaces: spaces.map((space) => ({
        spaceName: space.space_name,
        spaceSize: space.space_size,
        spaceUsedSize: space.space_used_size,
        spaceAvailableSize: space.space_available_size,
        physicalSpaceSize: space.physical_space_size,
      })),
      caches: Array.from(this.caches.entries()).map(([name, cache]) => ({
        name,
        entries: cache.size,
        totalSize: this.getCacheSize(name),
      })),
      leaks: Array.from(this.leaks.values()),
      gcForced: this.gcForced,
      lastGC: this.lastGC,
    };
  }

  // Alerts and callbacks
  public onMemoryPressure(callback: () => void) {
    this.memoryPressureCallbacks.push(callback);
  }

  public removeMemoryPressureCallback(callback: () => void) {
    const index = this.memoryPressureCallbacks.indexOf(callback);
    if (index > -1) {
      this.memoryPressureCallbacks.splice(index, 1);
    }
  }

  // Memory usage alerts
  public checkMemoryUsage(): { status: 'ok' | 'warning' | 'critical'; details: any } {
    const current = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapUsedPercent = (current.heapUsed / heapStats.heap_size_limit) * 100;

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (heapUsedPercent >= this.config.criticalThresholdPercent) {
      status = 'critical';
    } else if (heapUsedPercent >= this.config.warningThresholdPercent) {
      status = 'warning';
    }

    return {
      status,
      details: {
        heapUsedPercent: heapUsedPercent.toFixed(1),
        heapUsed: `${(current.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapLimit: `${(heapStats.heap_size_limit / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(current.rss / 1024 / 1024).toFixed(2)} MB`,
        external: `${(current.external / 1024 / 1024).toFixed(2)} MB`,
      },
    };
  }

  // AI Assistant Memory Integration
  public async storeAIMemory(context: string, response: any, metadata: any = {}): Promise<void> {
    try {
      const memoryItem = {
        context,
        response,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          memoryPressure: this.getCurrentMemoryPressure(),
          cacheHits: this.getTotalCacheHits(),
        },
      };

      // Add to specialized AI memory cache
      this.addCacheEntry(
        'ai_memories',
        this.generateMemoryKey(context),
        JSON.stringify(memoryItem).length,
        5 // High priority for AI memories
      );

      logger.debug('AI memory stored', LogContext.PERFORMANCE, {
        contextLength: context.length,
        memoryPressure: this.getCurrentMemoryPressure(),
      });
    } catch (error) {
      logger.error('Failed to store AI memory', LogContext.PERFORMANCE, { _error});
    }
  }

  public retrieveAIMemory(context: string): any | null {
    try {
      const key = this.generateMemoryKey(context);
      const entry = this.getCacheEntry('ai_memories', key);

      if (entry) {
        return JSON.parse(key); // Simplified for demo
      }
      return null;
    } catch (error) {
      logger.error('Failed to retrieve AI memory', LogContext.PERFORMANCE, { _error});
      return null;
    }
  }

  private generateMemoryKey(context: string): string {
    // Simple hash function for memory keys
    return Buffer.from(context).toString('base64').substring(0, 32);
  }

  private getCurrentMemoryPressure(): number {
    const latest = this.snapshots[this.snapshots.length - 1];
    return latest ? latest.heapUsedPercent : 0;
  }

  private getTotalCacheHits(): number {
    let totalHits = 0;
    this.caches.forEach((cache) => {
      cache.forEach((entry) => {
        totalHits += entry.hits;
      });
    });
    return totalHits;
  }

  // Enhanced memory optimization for AI workloads
  public optimizeForAI(): void {
    logger.info('Optimizing memory manager for AI workloads...', LogContext.PERFORMANCE);

    // Register AI-specific caches
    this.registerCache('ai_memories');
    this.registerCache('agent_contexts');
    this.registerCache('orchestration_results');
    this.registerCache('dspy_outputs');

    // Add AI-specific memory pressure callback
    this.onMemoryPressure(() => {
      // Clear less critical caches first
      this.evictCacheEntries(
        'orchestration_results',
        this.getCacheSize('orchestration_results') * 0.3
      );
      this.evictCacheEntries('dspy_outputs', this.getCacheSize('dspy_outputs') * 0.2);
    });

    logger.info('Memory manager optimized for AI workloads', LogContext.PERFORMANCE);
  }

  // Get AI-specific memory metrics
  public getAIMemoryMetrics(): any {
    const aiCaches = ['ai_memories', 'agent_contexts', 'orchestration_results', 'dspy_outputs'];
    const metrics: any = {
      aiCacheStats: {},
      totalAIMemoryUsage: 0,
      memoryEfficiency: 0,
    };

    aiCaches.forEach((cacheName) => {
      const cache = this.caches.get(cacheName);
      if (cache) {
        const size = this.getCacheSize(cacheName);
        const hitRate = this.calculateCacheHitRate(cacheName);

        metrics.aiCacheStats[cacheName] = {
          entries: cache.size,
          sizeBytes: size,
          hitRate,
        };
        metrics.totalAIMemoryUsage += size;
      }
    });

    // Calculate overall efficiency
    const totalHits = this.getTotalCacheHits();
    const totalRequests = this.snapshots.length;
    metrics.memoryEfficiency = totalRequests > 0 ? totalHits / totalRequests : 0;

    return metrics;
  }

  private calculateCacheHitRate(cacheName: string): number {
    const cache = this.caches.get(cacheName);
    if (!cache) return 0;

    let totalHits = 0;
    let totalEntries = 0;

    cache.forEach((entry) => {
      totalHits += entry.hits;
      totalEntries++;
    });

    return totalEntries > 0 ? totalHits / totalEntries : 0;
  }

  // Shutdown
  public shutdown() {
    logger.info('Shutting down memory manager...', LogContext.PERFORMANCE);

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.leakDetectionInterval) {
      clearInterval(this.leakDetectionInterval);
    }
    if (this.heapSnapshotInterval) {
      clearInterval(this.heapSnapshotInterval);
    }

    this.clearAllCaches();
    this.removeAllListeners();

    logger.info('Memory manager shutdown complete', LogContext.PERFORMANCE);
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance();
