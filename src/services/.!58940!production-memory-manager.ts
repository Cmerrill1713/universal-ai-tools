/**
 * Production Memory Manager
 * Comprehensive memory management, monitoring, and optimization for production environments
 */

import { EventEmitter } from 'events';
import { cpus, freemem, totalmem } from 'os';
import { performance } from 'perf_hooks';

import { log, LogContext } from '@/utils/logger';

export interface ProductionMemoryMetrics {
  timestamp: Date;
  process: {
    heapUsed: number;
    heapTotal: number;
    heapUsedPercent: number;
    rss: number;
    external: number;
    arrayBuffers: number;
    heapUsedMB: number;
    rssSpread: number;
  };
  system: {
    freeMemory: number;
    totalMemory: number;
    memoryUsagePercent: number;
    availableMemoryMB: number;
  };
  gc: {
    lastForcedGC?: Date;
    gcCount: number;
    gcTime: number;
    averageGCTime: number;
  };
  performance: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    cpuUsage: number;
  };
}

export interface MemoryPressureConfig {
  warningThreshold: number;
  criticalThreshold: number;
  emergencyThreshold: number;
  maxResponseTime: number;
  maxErrorRate: number;
  maxCpuUsage: number;
  gcIntervalMs: number;
  forceGCThreshold: number;
  maxConnections: number;
  connectionTimeout: number;
  maxCacheSize: number;
  cacheEvictionPercent: number;
}

export interface MemoryOptimizationStrategy {
  name: string;
  priority: number;
  execute(): Promise<{ saved: number; description: string }>;
}

export class ProductionMemoryManager extends EventEmitter {
  private config: MemoryPressureConfig;
  private metrics: ProductionMemoryMetrics[] = [];
  private optimizationStrategies: MemoryOptimizationStrategy[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMemoryPressureMode = false;
  private lastGCTime = 0;
  private gcStats = { count: 0, totalTime: 0 };
  private requestMetrics = { count: 0, errors: 0, totalTime: 0 };
  private connectionPools = new Map<string, any>();
  private caches = new Map<string, Map<string, any>>();

  constructor(config: Partial<MemoryPressureConfig> = {}) {
    super();
    
    this.config = {
      warningThreshold: 512,
      criticalThreshold: 768,
      emergencyThreshold: 1024,
      maxResponseTime: 2000,
      maxErrorRate: 0.05,
      maxCpuUsage: 80,
      gcIntervalMs: 30000,
      forceGCThreshold: 0.85,
      maxConnections: 1000,
      connectionTimeout: 30000,
      maxCacheSize: 100,
      cacheEvictionPercent: 0.3,
      ...config
    };

    this.initializeOptimizationStrategies();
    this.startMonitoring();
    this.setupGracefulShutdown();
  }

  private initializeOptimizationStrategies(): void {
    this.optimizationStrategies = [
      {
        name: 'force_garbage_collection',
        priority: 1,
        execute: async () => {
          const beforeHeap = process.memoryUsage().heapUsed;
          
          if (global.gc) {
            const startTime = performance.now();
            global.gc();
            const gcTime = performance.now() - startTime;
            
            this.gcStats.count++;
            this.gcStats.totalTime += gcTime;
            this.lastGCTime = Date.now();
            
            const afterHeap = process.memoryUsage().heapUsed;
            const saved = (beforeHeap - afterHeap) / 1024 / 1024;
            
            return {
              saved,
              description: `Forced GC freed ${saved.toFixed(2)}MB in ${gcTime.toFixed(2)}ms`
            };
          }
          
          return { saved: 0, description: 'GC not available' };
        }
      },
      {
        name: 'clear_expired_caches',
        priority: 2,
        execute: async () => {
          let totalCleared = 0;
          const clearedCaches: string[] = [];
          
          for (const [cacheName, cache] of this.caches.entries()) {
            if (cache.size > this.config.maxCacheSize) {
              const toRemove = Math.floor(cache.size * this.config.cacheEvictionPercent);
              const keys = Array.from(cache.keys()).slice(0, toRemove);
              keys.forEach(key => cache.delete(key));
              totalCleared += toRemove;
              clearedCaches.push(cacheName);
            }
          }
          
          return {
            saved: totalCleared * 0.01,
            description: `Cleared ${totalCleared} cache entries from: ${clearedCaches.join(', ')}`
          };
        }
      }
    ];
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeMemoryPressure();
      this.checkPerformanceThresholds();
    }, 5000);

        log.info('Production memory monitoring started', LogContext.SYSTEM, {
      interval: '5 seconds',
      thresholds: this.config
    });
  }

  private collectMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      free: freemem(),
      total: totalmem()
    };
    const cpuUsage = this.getCpuUsage();
    
    const metrics: ProductionMemoryMetrics = {
      timestamp: new Date(),
      process: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        heapUsedPercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        rss: memoryUsage.rss,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        heapUsedMB: memoryUsage.heapUsed / 1024 / 1024,
        rssSpread: memoryUsage.rss - memoryUsage.heapUsed
      },
      system: {
        freeMemory: systemMemory.free,
        totalMemory: systemMemory.total,
        memoryUsagePercent: ((systemMemory.total - systemMemory.free) / systemMemory.total) * 100,
        availableMemoryMB: systemMemory.free / 1024 / 1024
      },
      gc: {
        lastForcedGC: this.lastGCTime ? new Date(this.lastGCTime) : undefined,
        gcCount: this.gcStats.count,
        gcTime: this.gcStats.totalTime,
        averageGCTime: this.gcStats.count > 0 ? this.gcStats.totalTime / this.gcStats.count : 0
      },
      performance: {
        responseTime: this.requestMetrics.count > 0 ? this.requestMetrics.totalTime / this.requestMetrics.count : 0,
        throughput: this.requestMetrics.count,
        errorRate: this.requestMetrics.count > 0 ? this.requestMetrics.errors / this.requestMetrics.count : 0,
        cpuUsage
      }
    };

    this.metrics.push(metrics);
    
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    this.emit('metrics', metrics);
  }

  private analyzeMemoryPressure(): void {
    const currentMetrics = this.metrics[this.metrics.length - 1];
    if (!currentMetrics) return;

    const heapUsedMB = currentMetrics.process.heapUsedMB;
    
    let pressureLevel: 'normal' | 'warning' | 'critical' | 'emergency' = 'normal';
    
    if (heapUsedMB > this.config.emergencyThreshold) {
      pressureLevel = 'emergency';
    } else if (heapUsedMB > this.config.criticalThreshold) {
      pressureLevel = 'critical';
    } else if (heapUsedMB > this.config.warningThreshold) {
      pressureLevel = 'warning';
    }

    const shouldEnterPressureMode = pressureLevel !== 'normal';
    
    if (shouldEnterPressureMode && !this.isMemoryPressureMode) {
      this.enterMemoryPressureMode(pressureLevel);
    } else if (!shouldEnterPressureMode && this.isMemoryPressureMode) {
      this.exitMemoryPressureMode();
    }

    if (shouldEnterPressureMode) {
      this.executeOptimization(pressureLevel);
    }
  }

  private async enterMemoryPressureMode(level: string): Promise<void> {
    this.isMemoryPressureMode = true;
    
