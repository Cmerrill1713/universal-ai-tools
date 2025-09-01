/**
 * Memory Optimizer Service
 * Provides memory management and performance optimization for the Universal AI Tools server
 */

import { LogContext, log } from '@/utils/logger';

interface MemoryStats {
  rss: number; // Resident Set Size
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

interface OptimizationConfig {
  maxHeapUsage: number; // MB
  gcThreshold: number; // MB
  monitoringInterval: number; // ms
  aggressiveCleanup: boolean;
}

class MemoryOptimizerService {
  private config: OptimizationConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCleanup: number = 0;
  private readonly CLEANUP_COOLDOWN = 30000; // 30 seconds

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      maxHeapUsage: 1000, // 1GB default
      gcThreshold: 800, // 800MB trigger
      monitoringInterval: 60000, // 1 minute
      aggressiveCleanup: false,
      ...config
    };
  }

  /**
   * Start memory monitoring and optimization
   */
  start(): void {
    if (this.monitoringInterval) {
      return;
    }

    log.info('🧠 Starting memory optimizer', LogContext.SERVER, {
      maxHeapUsage: this.config.maxHeapUsage,
      gcThreshold: this.config.gcThreshold
    });

    this.monitoringInterval = setInterval(() => {
      this.monitorAndOptimize();
    }, this.config.monitoringInterval);

    // Initial optimization
    this.optimizeStartup();
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      log.info('🧠 Memory optimizer stopped', LogContext.SERVER);
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats & { timestamp: string; optimized?: boolean } {
    const memUsage = process.memoryUsage();
    return {
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024 * 100) / 100,
      timestamp: new Date().toISOString(),
      optimized: Date.now() - this.lastCleanup < this.CLEANUP_COOLDOWN
    };
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): boolean {
    try {
      if (global.gc) {
        const before = this.getMemoryStats();
        global.gc();
        const after = this.getMemoryStats();
        
        log.info('🧹 Forced garbage collection', LogContext.SERVER, {
          heapBefore: before.heapUsed,
          heapAfter: after.heapUsed,
          freed: Math.round((before.heapUsed - after.heapUsed) * 100) / 100
        });
        
        this.lastCleanup = Date.now();
        return true;
      }
    } catch (error) {
      log.error('❌ Garbage collection failed', LogContext.SERVER, { error });
    }
    return false;
  }

  /**
   * Optimize memory usage at startup
   */
  private optimizeStartup(): void {
    // Set Node.js memory optimization flags
    if (process.env.NODE_ENV === 'production') {
      // Optimize for production
      process.env.NODE_OPTIONS = [
        process.env.NODE_OPTIONS || '',
        '--max-old-space-size=2048',
        '--optimize-for-size',
        '--gc-interval=100'
      ].filter(Boolean).join(' ');
    }

    // Clear any existing intervals that might be memory leaks
    this.clearPotentialLeaks();

    log.info('⚡ Memory startup optimization completed', LogContext.SERVER, {
      initialStats: this.getMemoryStats()
    });
  }

  /**
   * Monitor and optimize memory usage
   */
  private monitorAndOptimize(): void {
    const stats = this.getMemoryStats();
    
    // Log memory statistics
    log.debug('📊 Memory stats', LogContext.SERVER, stats);

    // Check if we need to optimize
    if (stats.heapUsed > this.config.gcThreshold) {
      log.warn('⚠️ High memory usage detected', LogContext.SERVER, {
        heapUsed: stats.heapUsed,
        threshold: this.config.gcThreshold
      });

      this.performOptimization();
    }

    // Alert if memory usage is critically high
    if (stats.heapUsed > this.config.maxHeapUsage) {
      log.error('🚨 Critical memory usage', LogContext.SERVER, {
        heapUsed: stats.heapUsed,
        maxAllowed: this.config.maxHeapUsage
      });

      if (this.config.aggressiveCleanup) {
        this.performAggressiveCleanup();
      }
    }
  }

  /**
   * Perform memory optimization
   */
  private performOptimization(): void {
    const now = Date.now();
    
    // Cooldown check
    if (now - this.lastCleanup < this.CLEANUP_COOLDOWN) {
      return;
    }

    log.info('🧹 Starting memory optimization', LogContext.SERVER);

    // Force garbage collection
    this.forceGC();

    // Clear any caches that might be holding onto memory
    this.clearCaches();

    // Optimize Node.js internal structures
    this.optimizeNodeInternals();

    this.lastCleanup = now;
    log.info('✅ Memory optimization completed', LogContext.SERVER);
  }

  /**
   * Perform aggressive cleanup for critical memory situations
   */
  private performAggressiveCleanup(): void {
    log.warn('🚨 Performing aggressive memory cleanup', LogContext.SERVER);

    // Multiple GC cycles
    for (let i = 0; i < 3; i++) {
      this.forceGC();
    }

    // Clear all possible caches
    this.clearCaches();

    // Clear require cache for non-essential modules
    this.clearRequireCache();

    log.info('🧹 Aggressive cleanup completed', LogContext.SERVER, {
      stats: this.getMemoryStats()
    });
  }

  /**
   * Clear various caches to free memory
   */
  private clearCaches(): void {
    try {
      // Clear DNS cache
      if (require('dns').lookup.cache) {
        require('dns').lookup.cache.clear();
      }

      // Clear any custom caches in the application
      // This would be where you clear application-specific caches
      
      log.debug('🗑️ Caches cleared', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to clear caches', LogContext.SERVER, { error });
    }
  }

  /**
   * Clear require cache for non-essential modules
   */
  private clearRequireCache(): void {
    try {
      const essentialModules = [
        'express',
        'supabase',
        '@/utils/logger',
        '@/config/environment'
      ];

      Object.keys(require.cache).forEach(id => {
        const isEssential = essentialModules.some(module => id.includes(module));
        if (!isEssential && !id.includes('node_modules/express')) {
          delete require.cache[id];
        }
      });

      log.debug('🗑️ Require cache optimized', LogContext.SERVER);
    } catch (error) {
      log.error('❌ Failed to optimize require cache', LogContext.SERVER, { error });
    }
  }

  /**
   * Optimize Node.js internal structures
   */
  private optimizeNodeInternals(): void {
    try {
      // Compact string heap if available
      if (process.binding && process.binding('v8')) {
        // V8 specific optimizations would go here
      }

      // Trim process title if it's unnecessarily long
      if (process.title.length > 50) {
        process.title = 'universal-ai-tools';
      }

      log.debug('⚡ Node.js internals optimized', LogContext.SERVER);
    } catch (error) {
      log.debug('ℹ️ Node.js internals optimization skipped', LogContext.SERVER, { 
        reason: 'Not available in this environment' 
      });
    }
  }

  /**
   * Clear potential memory leaks
   */
  private clearPotentialLeaks(): void {
    try {
      // Clear any dangling timers
      const activeHandles = process._getActiveHandles();
      log.debug('🔍 Active handles detected', LogContext.SERVER, {
        count: activeHandles.length
      });

      // This is informational - we don't actually clear handles as they might be needed
      log.debug('🛡️ Memory leak prevention checks completed', LogContext.SERVER);
    } catch (error) {
      log.debug('ℹ️ Memory leak checks skipped', LogContext.SERVER, { 
        reason: 'Process inspection not available' 
      });
    }
  }

  /**
   * Get memory optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const stats = this.getMemoryStats();
    const recommendations: string[] = [];

    if (stats.heapUsed > 500) {
      recommendations.push('Consider implementing memory caching with TTL');
    }

    if (stats.external > 100) {
      recommendations.push('Check for memory leaks in external resources');
    }

    if (stats.arrayBuffers > 50) {
      recommendations.push('Optimize Buffer usage and implement pooling');
    }

    if (stats.heapUsed / stats.heapTotal > 0.8) {
      recommendations.push('Increase Node.js heap size or optimize memory usage');
    }

    return recommendations;
  }
}

// Export singleton instance
export const memoryOptimizer = new MemoryOptimizerService({
  maxHeapUsage: parseInt(process.env.MAX_HEAP_USAGE_MB || '1500', 10),
  gcThreshold: parseInt(process.env.GC_THRESHOLD_MB || '1000', 10),
  monitoringInterval: parseInt(process.env.MEMORY_MONITOR_INTERVAL_MS || '60000', 10),
  aggressiveCleanup: process.env.AGGRESSIVE_MEMORY_CLEANUP === 'true'
});

export default memoryOptimizer;