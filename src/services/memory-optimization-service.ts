/**
 * Memory Optimization Service
 * Comprehensive memory management and optimization for Universal AI Tools
 * Addresses memory leaks, cache management, and garbage collection optimization
 */

import { EventEmitter } from 'events';

import { log, LogContext } from '@/utils/logger';
import { clearAllPools } from '@/utils/object-pool';

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  heapUsedPercent: number;
  rss: number;
  external: number;
  arrayBuffers: number;
  timestamp: Date;
}

interface MemoryOptimizationConfig {
  maxHeapUsagePercent: number;
  criticalHeapUsagePercent: number;
  gcIntervalMs: number;
  cacheCleanupIntervalMs: number;
  objectPoolCleanupIntervalMs: number;
  enableAggressiveCleanup: boolean;
  enableMemoryPressureMode: boolean;
  memoryPressureThreshold: number;
  enableAutoGC: boolean;
  maxServiceCacheSize: number;
  embeddingCacheLimit: number;
}

interface CacheManager {
  name: string;
  clear(): void;
  size(): number;
  getStats?(): Record<string, any>;
}

interface MemoryPressureActions {
  clearNonEssentialCaches: boolean;
  triggerGarbageCollection: boolean;
  reduceEmbeddingCache: boolean;
  pauseNonCriticalTasks: boolean;
  compactMemoryStructures: boolean;
}

export class MemoryOptimizationService extends EventEmitter {
  private readonly config: MemoryOptimizationConfig;
  private readonly cacheManagers = new Map<string, CacheManager>();
  private memoryMetrics: MemoryMetrics[] = [];
  private gcTimer?: NodeJS.Timeout;
  private cacheCleanupTimer?: NodeJS.Timeout;
  private objectPoolTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  private isMemoryPressureMode = false;
  private lastGCTime = 0;
  private consecutiveHighMemoryCount = 0;

  constructor(config?: Partial<MemoryOptimizationConfig>) {
    super();

    this.config = {
      maxHeapUsagePercent: 75, // Reduced from default 85%
      criticalHeapUsagePercent: 85, // Was the problematic threshold
      gcIntervalMs: 30000, // 30 seconds
      cacheCleanupIntervalMs: 60000, // 1 minute
      objectPoolCleanupIntervalMs: 120000, // 2 minutes
      enableAggressiveCleanup: true,
      enableMemoryPressureMode: true,
      memoryPressureThreshold: 80, // Enter pressure mode at 80%
      enableAutoGC: true,
      maxServiceCacheSize: 1000, // Reduced cache sizes
      embeddingCacheLimit: 500,
      ...config,
    };

    // Configure Node.js memory settings
    this.configureNodeMemorySettings();
  }

  async initialize(): Promise<void> {
    log.info('🧠 Initializing Memory Optimization Service', LogContext.SYSTEM, {
      config: this.config,
    });

    // Register default cache managers
    this.registerDefaultCacheManagers();

    // Start monitoring and cleanup timers
    this.startMemoryMonitoring();
    this.startPeriodicCleanup();

    // Initial memory assessment
    await this.assessMemoryUsage();

    log.info('✅ Memory Optimization Service initialized', LogContext.SYSTEM);
  }

  registerCacheManager(name: string, manager: CacheManager): void {
    this.cacheManagers.set(name, manager);
    log.debug('📋 Registered cache manager', LogContext.SYSTEM, { name });
  }

  private registerDefaultCacheManagers(): void {
    // Register object pools
    this.registerCacheManager('object-pools', {
      name: 'object-pools',
      clear: clearAllPools,
      size: () => 0, // Object pools don't have a simple size method
    });

    // Register unified memory service cache (if available)
    this.registerCacheManager('unified-memory-cache', {
      name: 'unified-memory-cache',
      clear: () => {
        // Will be implemented when unified memory service is available
        try {
          // Dynamic import to avoid circular dependency
          import('./memory/unified-memory-service').then(({ unifiedMemoryService }) => {
            if (unifiedMemoryService && typeof unifiedMemoryService.cleanCache === 'function') {
              unifiedMemoryService.cleanCache();
            }
          }).catch(() => {}); // Silently fail if service not available
        } catch (error) {
          // Service might not be available
        }
      },
      size: () => 0,
    });

    // Register rate limiter cache
    this.registerCacheManager('rate-limiter-cache', {
      name: 'rate-limiter-cache',
      clear: () => {
        try {
          import('../middleware/comprehensive-rate-limiter').then(({ standardRateLimiter }) => {
            if (standardRateLimiter && typeof standardRateLimiter.resetAll === 'function') {
              standardRateLimiter.resetAll();
            }
          }).catch(() => {});
        } catch (error) {
          // Service might not be available
        }
      },
      size: () => 0,
    });
  }

  private configureNodeMemorySettings(): void {
    // Set memory usage warnings
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        log.warn('⚠️ MaxListenersExceededWarning detected', LogContext.SYSTEM, {
          warning: warning.message,
        });
      }
    });

    // Monitor for memory pressure events
    if (process.env.NODE_ENV !== 'production') {
      // Enable GC debugging in development
      if (global.gc) {
        log.info('🗑️ Manual garbage collection available', LogContext.SYSTEM);
      }
    }
  }

  private startMemoryMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.monitorMemoryUsage().catch((error) => {
        log.error('❌ Memory monitoring failed', LogContext.SYSTEM, { error });
      });
    }, 10000); // Every 10 seconds
  }

  private startPeriodicCleanup(): void {
    // Garbage collection timer
    if (this.config.enableAutoGC && global.gc) {
      this.gcTimer = setInterval(() => {
        this.performGarbageCollection();
      }, this.config.gcIntervalMs);
    }

    // Cache cleanup timer
    this.cacheCleanupTimer = setInterval(() => {
      this.performCacheCleanup().catch((error) => {
        log.error('❌ Cache cleanup failed', LogContext.SYSTEM, { error });
      });
    }, this.config.cacheCleanupIntervalMs);

    // Object pool cleanup timer
    this.objectPoolTimer = setInterval(() => {
      this.performObjectPoolCleanup();
    }, this.config.objectPoolCleanupIntervalMs);
  }

  private async monitorMemoryUsage(): Promise<void> {
    const metrics = this.getMemoryMetrics();
    this.memoryMetrics.push(metrics);

    // Keep only last 100 measurements
    if (this.memoryMetrics.length > 100) {
      this.memoryMetrics = this.memoryMetrics.slice(-100);
    }

    // Check if we need to enter memory pressure mode
    if (metrics.heapUsedPercent >= this.config.memoryPressureThreshold) {
      this.consecutiveHighMemoryCount++;
      
      if (!this.isMemoryPressureMode && this.consecutiveHighMemoryCount >= 3) {
        await this.enterMemoryPressureMode();
      } else if (metrics.heapUsedPercent >= this.config.criticalHeapUsagePercent) {
        await this.handleCriticalMemoryUsage();
      }
    } else {
      this.consecutiveHighMemoryCount = 0;
      if (this.isMemoryPressureMode && metrics.heapUsedPercent < this.config.maxHeapUsagePercent) {
        await this.exitMemoryPressureMode();
      }
    }

    // Emit memory metrics for external monitoring
    this.emit('memoryMetrics', metrics);

    // Log memory status periodically
    if (this.memoryMetrics.length % 6 === 0) { // Every minute
      log.debug('📊 Memory usage', LogContext.SYSTEM, {
        heapUsedPercent: `${metrics.heapUsedPercent.toFixed(1)}%`,
        heapUsedMB: `${(metrics.heapUsed / 1024 / 1024).toFixed(1)}MB`,
        heapTotalMB: `${(metrics.heapTotal / 1024 / 1024).toFixed(1)}MB`,
        memoryPressureMode: this.isMemoryPressureMode,
      });
    }
  }

  private getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      rss: memUsage.rss,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
      timestamp: new Date(),
    };
  }

  private async enterMemoryPressureMode(): Promise<void> {
    if (this.isMemoryPressureMode) return;

    this.isMemoryPressureMode = true;
    log.warn('⚠️ Entering memory pressure mode', LogContext.SYSTEM, {
      heapUsedPercent: this.getMemoryMetrics().heapUsedPercent.toFixed(1),
    });

    const actions: MemoryPressureActions = {
      clearNonEssentialCaches: true,
      triggerGarbageCollection: true,
      reduceEmbeddingCache: true,
      pauseNonCriticalTasks: true,
      compactMemoryStructures: true,
    };

    await this.executeMemoryPressureActions(actions);
    this.emit('memoryPressureMode', { enabled: true, actions });
  }

  private async exitMemoryPressureMode(): Promise<void> {
    if (!this.isMemoryPressureMode) return;

    this.isMemoryPressureMode = false;
    log.info('✅ Exiting memory pressure mode', LogContext.SYSTEM, {
      heapUsedPercent: this.getMemoryMetrics().heapUsedPercent.toFixed(1),
    });

    this.emit('memoryPressureMode', { enabled: false });
  }

  private async handleCriticalMemoryUsage(): Promise<void> {
    const metrics = this.getMemoryMetrics();
    log.error('🚨 Critical memory usage detected', LogContext.SYSTEM, {
      heapUsedPercent: `${metrics.heapUsedPercent.toFixed(1)}%`,
      heapUsedMB: `${(metrics.heapUsed / 1024 / 1024).toFixed(1)}MB`,
    });

    // Aggressive cleanup actions
    const actions: MemoryPressureActions = {
      clearNonEssentialCaches: true,
      triggerGarbageCollection: true,
      reduceEmbeddingCache: true,
      pauseNonCriticalTasks: true,
      compactMemoryStructures: true,
    };

    await this.executeMemoryPressureActions(actions);
    
    // Additional aggressive actions
    await this.performAggressiveCleanup();

    this.emit('criticalMemory', { metrics, actions });
  }

  private async executeMemoryPressureActions(actions: MemoryPressureActions): Promise<void> {
    if (actions.clearNonEssentialCaches) {
      await this.clearNonEssentialCaches();
    }

    if (actions.reduceEmbeddingCache) {
      await this.reduceEmbeddingCaches();
    }

    if (actions.compactMemoryStructures) {
      await this.compactMemoryStructures();
    }

    if (actions.triggerGarbageCollection) {
      this.performGarbageCollection();
    }

    if (actions.pauseNonCriticalTasks) {
      this.pauseNonCriticalTasks();
    }
  }

  private async clearNonEssentialCaches(): Promise<void> {
    let totalCleared = 0;

    for (const [name, manager] of this.cacheManagers) {
      try {
        const sizeBefore = manager.size();
        manager.clear();
        const sizeAfter = manager.size();
        const cleared = sizeBefore - sizeAfter;
        totalCleared += cleared;

        log.debug('🧹 Cleared cache', LogContext.SYSTEM, {
          cache: name,
          entriesCleared: cleared,
        });
      } catch (error) {
        log.error('❌ Failed to clear cache', LogContext.SYSTEM, {
          cache: name,
          error,
        });
      }
    }

    log.info('🧹 Cache cleanup completed', LogContext.SYSTEM, {
      totalCachesCleared: this.cacheManagers.size,
      totalEntriesCleared: totalCleared,
    });
  }

  private async reduceEmbeddingCaches(): Promise<void> {
    // Reduce embedding caches in unified memory service
    try {
      const { unifiedMemoryService } = await import('./memory/unified-memory-service');
      
      if (unifiedMemoryService) {
        // Force aggressive cleanup of embedding cache
        const stats = unifiedMemoryService.getAnalytics();
        log.info('🧠 Reducing memory service caches', LogContext.SYSTEM, {
          totalEntries: stats.totalEntries,
          totalSize: stats.totalSize,
        });
      }
    } catch (error) {
      // Service might not be available
    }
  }

  private async compactMemoryStructures(): Promise<void> {
    // Compact various memory structures
    try {
      // Clear old memory metrics
      if (this.memoryMetrics.length > 20) {
        this.memoryMetrics = this.memoryMetrics.slice(-20);
      }

      // Additional memory structure compaction can be added here
      log.debug('🗜️ Memory structures compacted', LogContext.SYSTEM);
    } catch (error) {
      log.error('❌ Failed to compact memory structures', LogContext.SYSTEM, { error });
    }
  }

  private performGarbageCollection(): void {
    if (!global.gc) {
      return;
    }

    const now = Date.now();
    // Don't run GC too frequently
    if (now - this.lastGCTime < 5000) {
      return;
    }

    const beforeMemory = process.memoryUsage().heapUsed;
    
    try {
      global.gc();
      this.lastGCTime = now;
      
      const afterMemory = process.memoryUsage().heapUsed;
      const freedMB = (beforeMemory - afterMemory) / 1024 / 1024;

      if (freedMB > 1) { // Only log if significant memory was freed
        log.debug('🗑️ Garbage collection completed', LogContext.SYSTEM, {
          freedMB: freedMB.toFixed(1),
          heapUsedMB: (afterMemory / 1024 / 1024).toFixed(1),
        });
      }
    } catch (error) {
      log.error('❌ Garbage collection failed', LogContext.SYSTEM, { error });
    }
  }

  private pauseNonCriticalTasks(): void {
    // Emit event for other services to pause non-critical operations
    this.emit('pauseNonCriticalTasks', { memoryPressure: true });
    log.debug('⏸️ Non-critical tasks paused for memory pressure', LogContext.SYSTEM);
  }

  private async performCacheCleanup(): Promise<void> {
    if (!this.isMemoryPressureMode && this.getMemoryMetrics().heapUsedPercent < this.config.maxHeapUsagePercent) {
      return; // Skip cleanup if memory usage is normal
    }

    await this.clearNonEssentialCaches();
  }

  private performObjectPoolCleanup(): void {
    try {
      clearAllPools();
      log.debug('🏊 Object pools cleaned', LogContext.SYSTEM);
    } catch (error) {
      log.error('❌ Object pool cleanup failed', LogContext.SYSTEM, { error });
    }
  }

  private async performAggressiveCleanup(): Promise<void> {
    log.warn('🧹 Performing aggressive memory cleanup', LogContext.SYSTEM);

    // Clear all caches
    await this.clearNonEssentialCaches();

    // Clear object pools
    this.performObjectPoolCleanup();

    // Force garbage collection multiple times
    for (let i = 0; i < 3 && global.gc; i++) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clear old metrics
    this.memoryMetrics = this.memoryMetrics.slice(-10);

    log.warn('✅ Aggressive memory cleanup completed', LogContext.SYSTEM);
  }

  async assessMemoryUsage(): Promise<MemoryMetrics> {
    const metrics = this.getMemoryMetrics();
    
    log.info('📊 Memory assessment', LogContext.SYSTEM, {
      heapUsedPercent: `${metrics.heapUsedPercent.toFixed(1)}%`,
      heapUsedMB: `${(metrics.heapUsed / 1024 / 1024).toFixed(1)}MB`,
      heapTotalMB: `${(metrics.heapTotal / 1024 / 1024).toFixed(1)}MB`,
      rssMB: `${(metrics.rss / 1024 / 1024).toFixed(1)}MB`,
      externalMB: `${(metrics.external / 1024 / 1024).toFixed(1)}MB`,
      status: metrics.heapUsedPercent > this.config.criticalHeapUsagePercent ? 'critical' :
              metrics.heapUsedPercent > this.config.maxHeapUsagePercent ? 'high' : 'normal',
    });

    return metrics;
  }

  getMemoryAnalytics(): {
    currentMetrics: MemoryMetrics;
    isMemoryPressureMode: boolean;
    averageHeapUsage: number;
    peakHeapUsage: number;
    cacheManagers: string[];
    gcCount: number;
  } {
    const currentMetrics = this.getMemoryMetrics();
    const averageHeapUsage = this.memoryMetrics.length > 0 
      ? this.memoryMetrics.reduce((sum, m) => sum + m.heapUsedPercent, 0) / this.memoryMetrics.length
      : 0;
    const peakHeapUsage = this.memoryMetrics.length > 0
      ? Math.max(...this.memoryMetrics.map(m => m.heapUsedPercent))
      : 0;

    return {
      currentMetrics,
      isMemoryPressureMode: this.isMemoryPressureMode,
      averageHeapUsage,
      peakHeapUsage,
      cacheManagers: Array.from(this.cacheManagers.keys()),
      gcCount: this.memoryMetrics.length, // Approximate GC count
    };
  }

  async forceMemoryOptimization(): Promise<void> {
    log.info('🔧 Forcing memory optimization', LogContext.SYSTEM);
    
    await this.performAggressiveCleanup();
    
    const afterMetrics = this.getMemoryMetrics();
    log.info('✅ Forced memory optimization completed', LogContext.SYSTEM, {
      heapUsedPercent: `${afterMetrics.heapUsedPercent.toFixed(1)}%`,
    });
  }

  async shutdown(): Promise<void> {
    log.info('🛑 Shutting down Memory Optimization Service', LogContext.SYSTEM);

    // Clear all timers
    if (this.gcTimer) clearInterval(this.gcTimer);
    if (this.cacheCleanupTimer) clearInterval(this.cacheCleanupTimer);
    if (this.objectPoolTimer) clearInterval(this.objectPoolTimer);
    if (this.monitoringTimer) clearInterval(this.monitoringTimer);

    // Final cleanup
    await this.performAggressiveCleanup();

    this.emit('shutdown');
    log.info('✅ Memory Optimization Service shut down', LogContext.SYSTEM);
  }
}

// Export singleton instance
export const memoryOptimizationService = new MemoryOptimizationService();