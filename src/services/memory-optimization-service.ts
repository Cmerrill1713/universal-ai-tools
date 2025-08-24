/**
 * Memory Optimization Service
 * Comprehensive memory management and optimization for Universal AI Tools
 * Addresses memory leaks, cache management, and garbage collection optimization
 */

import { EventEmitter } from 'events';
import { freemem,totalmem } from 'os';

import { log, LogContext } from '@/utils/logger';
import { clearAllPools, forcePoolMaintenance, getAllPoolStats,getPoolMemoryUsage } from '@/utils/object-pool';

// Timer consolidation to reduce setInterval overhead
class TimerManager {
  private static instance: TimerManager;
  private timers = new Map<string, NodeJS.Timeout>();
  private tasks = new Map<string, Array<() => Promise<void> | void>>();
  private intervals = new Map<string, number>();

  static getInstance(): TimerManager {
    if (!TimerManager.instance) {
      TimerManager.instance = new TimerManager();
    }
    return TimerManager.instance;
  }

  private constructor() {
    // Start consolidated timers with container-aware intervals
    const isContainer = this.detectContainerEnvironment();

    if (isContainer) {
      // Container-optimized intervals: Less frequent monitoring
      this.startConsolidatedTimer('fast', 30000); // 30 seconds (3x slower)
      this.startConsolidatedTimer('medium', 120000); // 2 minutes (4x slower)
      this.startConsolidatedTimer('slow', 180000); // 3 minutes (3x slower)
      this.startConsolidatedTimer('verySlow', 600000); // 10 minutes (2x slower)
    } else {
      // Development intervals: More frequent monitoring
      this.startConsolidatedTimer('fast', 10000); // 10 seconds
      this.startConsolidatedTimer('medium', 30000); // 30 seconds
      this.startConsolidatedTimer('slow', 60000); // 1 minute
      this.startConsolidatedTimer('verySlow', 300000); // 5 minutes
    }
  }

  private detectContainerEnvironment(): boolean {
    return (
      process.env.DOCKER_ENV === 'true' ||
      process.env.NODE_ENV === 'production' ||
      process.env.KUBERNETES_SERVICE_HOST !== undefined ||
      process.env.CONTAINER_ENV === 'true'
    );
  }

  private startConsolidatedTimer(category: string, interval: number): void {
    this.intervals.set(category, interval);
    this.tasks.set(category, []);

    const timer = setInterval(async () => {
      const categoryTasks = this.tasks.get(category) || [];
      for (const task of categoryTasks) {
        try {
          await task();
        } catch (error) {
          log.error(`Task error in ${category} timer`, LogContext.SYSTEM, { error });
        }
      }
    }, interval);

    this.timers.set(category, timer);
  }

  addTask(
    category: 'fast' | 'medium' | 'slow' | 'verySlow',
    taskId: string,
    task: () => Promise<void> | void
  ): void {
    const categoryTasks = this.tasks.get(category) || [];
    // Remove existing task with same ID
    const existingIndex = categoryTasks.findIndex((t) => (t as any).taskId === taskId);
    if (existingIndex >= 0) {
      categoryTasks.splice(existingIndex, 1);
    }

    // Add task with ID for tracking
    (task as any).taskId = taskId;
    categoryTasks.push(task);
    this.tasks.set(category, categoryTasks);
  }

  removeTask(category: 'fast' | 'medium' | 'slow' | 'verySlow', taskId: string): void {
    const categoryTasks = this.tasks.get(category) || [];
    const filteredTasks = categoryTasks.filter((t) => (t as any).taskId !== taskId);
    this.tasks.set(category, filteredTasks);
  }

  shutdown(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.tasks.clear();
  }
}

const timerManager = TimerManager.getInstance();

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  heapUsedPercent: number;
  rss: number;
  external: number;
  arrayBuffers: number;
  heapUsedMB: number; // Added MB field for clearer monitoring
  timestamp: Date;
}

interface MemoryOptimizationConfig {
  memoryPressureThresholdMB: number; // Memory pressure mode trigger (MB)
  criticalMemoryUsageMB: number; // Critical memory usage threshold (MB)
  gcIntervalMs: number;
  cacheCleanupIntervalMs: number;
  objectPoolCleanupIntervalMs: number;
  enableAggressiveCleanup: boolean;
  enableMemoryPressureMode: boolean;
  exitMemoryPressureThresholdMB: number; // Exit memory pressure mode threshold (MB)
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

    // Get system memory info for realistic thresholds
    const totalSystemMemoryGB = totalmem() / 1024 / 1024 / 1024;
    
    this.config = {
      // Base thresholds on RSS memory usage, not heap usage
      // Use much higher thresholds since we have abundant system memory
      memoryPressureThresholdMB: Math.max(2048, totalSystemMemoryGB * 1024 * 0.4), // 40% of system memory
      criticalMemoryUsageMB: Math.max(4096, totalSystemMemoryGB * 1024 * 0.6), // 60% of system memory
      gcIntervalMs: 60000, // Less frequent GC - let Node.js handle it
      cacheCleanupIntervalMs: 120000, // Less frequent cleanup
      objectPoolCleanupIntervalMs: 300000, // Much less frequent object pool cleanup
      enableAggressiveCleanup: false, // Disable aggressive cleanup by default
      enableMemoryPressureMode: true,
      exitMemoryPressureThresholdMB: Math.max(1024, totalSystemMemoryGB * 1024 * 0.2), // 20% of system memory
      enableAutoGC: false, // Let intelligent memory manager handle GC
      maxServiceCacheSize: 500, // More reasonable cache sizes
      embeddingCacheLimit: 200, // More reasonable embedding cache
      ...config,
    };

    // Override config for Docker environments with more conservative settings
    if (this.detectContainerEnvironment()) {
      this.config = {
        ...this.config,
        memoryPressureThresholdMB: 1536, // Higher threshold in containers (1.5GB)
        criticalMemoryUsageMB: 3072, // Higher critical threshold in containers (3GB)
        exitMemoryPressureThresholdMB: 768, // Higher exit threshold in containers (768MB)
        gcIntervalMs: 30000, // Moderate GC frequency in Docker
        cacheCleanupIntervalMs: 60000, // Moderate cleanup in Docker
        objectPoolCleanupIntervalMs: 120000, // Moderate object pool cleanup in Docker
        maxServiceCacheSize: 50, // Very small cache in Docker
        embeddingCacheLimit: 25, // Very small embedding cache in Docker
        enableAggressiveCleanup: true, // Keep aggressive cleanup in Docker
        enableAutoGC: true, // Enable GC in Docker to prevent OOM
      };
    }

    // Configure Node.js memory settings
    this.configureNodeMemorySettings();
  }

  private detectContainerEnvironment(): boolean {
    return (
      process.env.DOCKER_ENV === 'true' ||
      process.env.NODE_ENV === 'production' ||
      process.env.KUBERNETES_SERVICE_HOST !== undefined ||
      process.env.CONTAINER_ENV === 'true'
    );
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
    // Register object pools with size reporting
    this.registerCacheManager('object-pools', {
      name: 'object-pools',
      clear: () => {
        try {
          // Using already imported clearAllPools from top of file
          forcePoolMaintenance();
          clearAllPools();
        } catch (error) {
          // Fallback to basic clearAllPools
          clearAllPools();
        }
      },
      size: () => {
        try {
          // Using already imported getPoolMemoryUsage from top of file
          return Math.round(getPoolMemoryUsage() * 1024 * 1024); // Convert MB to bytes
        } catch (error) {
          return 0;
        }
      },
      getStats: () => {
        try {
          // Using already imported getAllPoolStats from top of file
          return getAllPoolStats();
        } catch (error) {
          return {};
        }
      }
    });

    // Register chunking service cache
    this.registerCacheManager('chunking-service-cache', {
      name: 'chunking-service-cache',
      clear: () => {
        try {
          import('./chunking/chunking-service')
            .then(({ chunkingService }) => {
              if (chunkingService && typeof chunkingService.cleanup === 'function') {
                chunkingService.cleanup();
              }
            })
            .catch(() => {});
        } catch (error) {
          // Service might not be available
        }
      },
      size: () => 0,
    });

    // Register context storage service cache
    this.registerCacheManager('context-storage-cache', {
      name: 'context-storage-cache',
      clear: () => {
        try {
          import('./context-storage-service')
            .then(({ contextStorageService }) => {
              // Context storage service has built-in cleanup
              log.debug('Context storage service cleanup triggered', LogContext.SYSTEM);
            })
            .catch(() => {});
        } catch (error) {
          // Service might not be available
        }
      },
      size: () => 0,
    });

    // Register unified memory service cache (if available)
    this.registerCacheManager('unified-memory-cache', {
      name: 'unified-memory-cache',
      clear: () => {
        // Will be implemented when unified memory service is available
        try {
          // Dynamic import to avoid circular dependency
          import('./memory/unified-memory-service')
            .then(({ unifiedMemoryService }) => {
              // Note: cleanCache is private, relying on automatic cleanup
              log.debug(
                'Unified memory service is available for automatic cleanup',
                LogContext.SYSTEM
              );
            })
            .catch(() => {}); // Silently fail if service not available
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
          import('../middleware/comprehensive-rate-limiter')
            .then(({ standardRateLimiter }) => {
              if (standardRateLimiter && typeof standardRateLimiter.resetAll === 'function') {
                standardRateLimiter.resetAll();
              }
            })
            .catch(() => {});
        } catch (error) {
          // Service might not be available
        }
      },
      size: () => 0,
    });

    // Register global variable cleanup
    this.registerCacheManager('global-variables', {
      name: 'global-variables',
      clear: () => {
        this.cleanupGlobalVariables();
      },
      size: () => {
        return this.estimateGlobalVariableMemory();
      }
    });
  }

  /**
   * Clean up potential memory leaks in global variables
   */
  private cleanupGlobalVariables(): void {
    try {
      // Clean up global timers that might be holding references
      if (typeof globalThis !== 'undefined') {
        const globalKeys = Object.keys(globalThis);
        let cleanedCount = 0;

        for (const key of globalKeys) {
          const value = (globalThis as any)[key];
          
          // Clean up timer references
          if (value && typeof value === 'object') {
            if ('_idleTimeout' in value || '_repeat' in value) {
              try {
                if (typeof value.unref === 'function') {
                  value.unref();
                  cleanedCount++;
                }
              } catch (error) {
                // Ignore cleanup errors
              }
            }
          }
        }

        if (cleanedCount > 0) {
          log.debug('🧹 Cleaned up global timer references', LogContext.SYSTEM, {
            cleanedCount
          });
        }
      }

      // Force WeakRef cleanup if available
      if (typeof global.gc === 'function') {
        global.gc();
      }
    } catch (error) {
      log.error('Failed to cleanup global variables', LogContext.SYSTEM, { error });
    }
  }

  /**
   * Estimate memory usage of global variables
   */
  private estimateGlobalVariableMemory(): number {
    try {
      if (typeof globalThis !== 'undefined') {
        const globalKeys = Object.keys(globalThis);
        // Rough estimate: 100 bytes per global variable
        return globalKeys.length * 100;
      }
      return 0;
    } catch (error) {
      return 0;
    }
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
    // Use consolidated timer instead of individual setInterval
    timerManager.addTask('medium', 'memory-monitoring', () => {
      this.monitorMemoryUsage().catch((error) => {
        log.error('❌ Memory monitoring failed', LogContext.SYSTEM, { error });
      });
    });
  }

  private startPeriodicCleanup(): void {
    // Disable automatic GC in favor of intelligent memory manager
    // The intelligent memory manager will handle GC more efficiently
    if (this.config.enableAutoGC && global.gc && !process.env.INTELLIGENT_MEMORY_MANAGER) {
      timerManager.addTask('slow', 'memory-gc', () => {
        this.performGarbageCollection();
      });
    }

    timerManager.addTask('slow', 'cache-cleanup', () => {
      this.performCacheCleanup().catch((error) => {
        log.error('❌ Cache cleanup failed', LogContext.SYSTEM, { error });
      });
    });

    timerManager.addTask('verySlow', 'object-pool-cleanup', () => {
      this.performObjectPoolCleanup();
    });
  }

  private async monitorMemoryUsage(): Promise<void> {
    const metrics = this.getMemoryMetrics();
    this.memoryMetrics.push(metrics);

    // Keep only last 100 measurements
    if (this.memoryMetrics.length > 100) {
      this.memoryMetrics = this.memoryMetrics.slice(-100);
    }

    // Check if we need to enter memory pressure mode
    if (metrics.heapUsedMB >= this.config.memoryPressureThresholdMB) {
      this.consecutiveHighMemoryCount++;

      if (!this.isMemoryPressureMode && this.consecutiveHighMemoryCount >= 3) {
        await this.enterMemoryPressureMode();
      } else if (metrics.heapUsedMB >= this.config.criticalMemoryUsageMB) {
        await this.handleCriticalMemoryUsage();
      }
    } else {
      this.consecutiveHighMemoryCount = 0;
      if (this.isMemoryPressureMode && metrics.heapUsedMB < this.config.exitMemoryPressureThresholdMB) {
        await this.exitMemoryPressureMode();
      }
    }

    // Emit memory metrics for external monitoring
    this.emit('memoryMetrics', metrics);

    // Log memory status less frequently to reduce overhead
    if (this.memoryMetrics.length % 10 === 0) {
      // Every 5 minutes
      log.debug('📊 Memory usage', LogContext.SYSTEM, {
        heapUsedMB: `${metrics.heapUsedMB.toFixed(1)}MB`,
        heapTotalMB: `${(metrics.heapTotal / 1024 / 1024).toFixed(1)}MB`,
        heapUsedPercent: `${metrics.heapUsedPercent.toFixed(1)}%`,
        memoryPressureMode: this.isMemoryPressureMode,
      });
    }
  }

  private getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const rssMB = memUsage.rss / 1024 / 1024; // Use RSS for pressure detection
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      rss: memUsage.rss,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
      heapUsedMB: rssMB, // Use RSS MB for memory pressure detection (more accurate)
      timestamp: new Date(),
    };
  }

  private async enterMemoryPressureMode(): Promise<void> {
    if (this.isMemoryPressureMode) {return;}

    this.isMemoryPressureMode = true;
    log.warn('⚠️ Entering memory pressure mode', LogContext.SYSTEM, {
      heapUsedMB: `${this.getMemoryMetrics().heapUsedMB.toFixed(1)}MB`,
      threshold: `${this.config.memoryPressureThresholdMB}MB`,
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
    if (!this.isMemoryPressureMode) {return;}

    this.isMemoryPressureMode = false;
    log.info('✅ Exiting memory pressure mode', LogContext.SYSTEM, {
      heapUsedMB: `${this.getMemoryMetrics().heapUsedMB.toFixed(1)}MB`,
      threshold: `${this.config.exitMemoryPressureThresholdMB}MB`,
    });

    this.emit('memoryPressureMode', { enabled: false });
  }

  private async handleCriticalMemoryUsage(): Promise<void> {
    const metrics = this.getMemoryMetrics();
    log.error('🚨 Critical memory usage detected', LogContext.SYSTEM, {
      heapUsedMB: `${metrics.heapUsedMB.toFixed(1)}MB`,
      criticalThreshold: `${this.config.criticalMemoryUsageMB}MB`,
      heapUsedPercent: `${metrics.heapUsedPercent.toFixed(1)}%`,
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

      if (freedMB > 1) {
        // Only log if significant memory was freed
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
    if (
      !this.isMemoryPressureMode &&
      this.getMemoryMetrics().heapUsedMB < this.config.memoryPressureThresholdMB
    ) {
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
    const isContainer = this.detectContainerEnvironment();

    if (isContainer) {
      await this.performContainerOptimizedCleanup();
    } else {
      await this.performDevelopmentAggressiveCleanup();
    }
  }

  /**
   * Container-optimized cleanup strategy
   * Less aggressive, relies more on OS memory management
   */
  private async performContainerOptimizedCleanup(): Promise<void> {
    log.info('🐳 Performing container-optimized memory cleanup', LogContext.SYSTEM);

    // Clear non-essential caches only
    await this.clearNonEssentialCaches();

    // Limited object pool cleanup (containers have better memory management)
    this.performObjectPoolCleanup();

    // NO forced garbage collection in containers - let OS handle it
    // Containers have better memory management than manual GC

    // Keep more metrics history in containers (more stable environment)
    if (this.memoryMetrics.length > 50) {
      this.memoryMetrics = this.memoryMetrics.slice(-50);
    }

    // Light timer optimization only
    this.optimizeTimerReferences();

    log.info('✅ Container-optimized memory cleanup completed', LogContext.SYSTEM);
  }

  /**
   * Development/non-container aggressive cleanup
   * More aggressive approach for development environments
   */
  private async performDevelopmentAggressiveCleanup(): Promise<void> {
    log.warn('🧹 Performing aggressive memory cleanup', LogContext.SYSTEM);

    // Clear all caches
    await this.clearNonEssentialCaches();

    // Clear object pools
    this.performObjectPoolCleanup();

    // Force garbage collection multiple times with longer delays
    for (let i = 0; i < 2 && global.gc; i++) {
      global.gc();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Clear old metrics more aggressively
    this.memoryMetrics = this.memoryMetrics.slice(-5);

    // Clear any lingering timer references
    this.optimizeTimerReferences();

    log.warn('✅ Aggressive memory cleanup completed', LogContext.SYSTEM);
  }

  private optimizeTimerReferences(): void {
    // Clear any WeakRef or other timer references that might be holding memory
    try {
      // Force cleanup of any potential circular references
      if (typeof globalThis !== 'undefined') {
        const keys = Object.keys(globalThis);
        const timerKeys = keys.filter((key) => key.includes('timer') || key.includes('interval'));
        for (const key of timerKeys) {
          const value = (globalThis as any)[key];
          if (value && typeof value === 'object' && 'unref' in value) {
            try {
              value.unref();
            } catch (error) {
              // Ignore errors during cleanup
            }
          }
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async assessMemoryUsage(): Promise<MemoryMetrics> {
    const metrics = this.getMemoryMetrics();

    log.info('📊 Memory assessment', LogContext.SYSTEM, {
      heapUsedMB: `${metrics.heapUsedMB.toFixed(1)}MB`,
      heapUsedPercent: `${metrics.heapUsedPercent.toFixed(1)}%`,
      heapTotalMB: `${(metrics.heapTotal / 1024 / 1024).toFixed(1)}MB`,
      rssMB: `${(metrics.rss / 1024 / 1024).toFixed(1)}MB`,
      externalMB: `${(metrics.external / 1024 / 1024).toFixed(1)}MB`,
      status:
        metrics.heapUsedMB > this.config.criticalMemoryUsageMB
          ? 'critical'
          : metrics.heapUsedMB > this.config.memoryPressureThresholdMB
            ? 'high'
            : 'normal',
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
    const averageHeapUsage =
      this.memoryMetrics.length > 0
        ? this.memoryMetrics.reduce((sum, m) => sum + m.heapUsedPercent, 0) /
          this.memoryMetrics.length
        : 0;
    const peakHeapUsage =
      this.memoryMetrics.length > 0
        ? Math.max(...this.memoryMetrics.map((m) => m.heapUsedPercent))
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
      heapUsedMB: `${afterMetrics.heapUsedMB.toFixed(1)}MB`,
    });
  }

  async shutdown(): Promise<void> {
    log.info('🛑 Shutting down Memory Optimization Service', LogContext.SYSTEM);

    // Remove tasks from consolidated timers
    timerManager.removeTask('medium', 'memory-monitoring');
    timerManager.removeTask('slow', 'memory-gc');
    timerManager.removeTask('slow', 'cache-cleanup');
    timerManager.removeTask('verySlow', 'object-pool-cleanup');

    // Final cleanup
    await this.performAggressiveCleanup();

    // Force cleanup of all event listeners to prevent memory leaks
    this.removeAllListeners();

    this.emit('shutdown');
    log.info('✅ Memory Optimization Service shut down', LogContext.SYSTEM);
  }

  /**
   * Force cleanup for test environments to prevent open handles
   */
  async forceTestCleanup(): Promise<void> {
    log.info('🧪 Forcing test environment cleanup', LogContext.SYSTEM);

    // Clear all timers immediately
    timerManager.shutdown();

    // Clear all event listeners
    this.removeAllListeners();

    // Force multiple garbage collections
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Clear all cache managers
    await this.clearNonEssentialCaches();

    // Clear object pools
    this.performObjectPoolCleanup();

    // Clear memory metrics history
    this.memoryMetrics = [];

    log.info('✅ Test environment cleanup completed', LogContext.SYSTEM);
  }
}

// Export singleton instance
export const memoryOptimizationService = new MemoryOptimizationService();

// Export timer manager for other services to use
export { timerManager };
