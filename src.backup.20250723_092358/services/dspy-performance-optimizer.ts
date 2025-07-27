/**
 * DSPy Performance Optimizer
 *
 * Enhances DSPy orchestration performance through:
 * - Intelligent caching of DSPy responses
 * - Performance monitoring and optimization
 * - Adaptive model selection
 * - Resource allocation optimization
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { memoryManager } from './memory-manager';
import { dspyService } from './dspy-service';
import { performance } from 'perf_hooks';

export interface DSPyPerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  averageLatency: number;
  cacheHitRate: number;
  modelPerformance: Map<string, ModelMetrics>;
  optimizationScore: number;
  lastOptimized: Date;
}

export interface ModelMetrics {
  name: string;
  totalRequests: number;
  successfulRequests: number;
  averageLatency: number;
  averageConfidence: number;
  memoryUsage: number;
  complexity: number;
}

export interface OptimizationConfig {
  enableCaching: boolean;
  enableModelSelection: boolean;
  enableResourceOptimization: boolean;
  cacheSize: number;
  optimizationInterval: number;
  performanceThreshold: number;
}

export class DSPyPerformanceOptimizer extends EventEmitter {
  private static instance: DSPyPerformanceOptimizer;
  private config: OptimizationConfig;
  private metrics: DSPyPerformanceMetrics;
  private responseCache = new Map<string, any>();
  private modelSelectionCache = new Map<string, string>();
  private optimizationTimer?: NodeJS.Timeout;
  private isOptimizing = false;

  private constructor(config: Partial<OptimizationConfig> = {}) {
    super();

    this.config = {
      enableCaching: true,
      enableModelSelection: true,
      enableResourceOptimization: true,
      cacheSize: 1000,
      optimizationInterval: 300000, // 5 minutes
      performanceThreshold: 0.8,
      ...config,
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      averageLatency: 0,
      cacheHitRate: 0,
      modelPerformance: new Map(),
      optimizationScore: 1.0,
      lastOptimized: new Date(),
    };

    this.initialize();
  }

  public static getInstance(config?: Partial<OptimizationConfig>): DSPyPerformanceOptimizer {
    if (!DSPyPerformanceOptimizer.instance) {
      DSPyPerformanceOptimizer.instance = new DSPyPerformanceOptimizer(config);
    }
    return DSPyPerformanceOptimizer.instance;
  }

  private initialize(): void {
    // Register AI-specific caches in memory manager
    memoryManager.optimizeForAI();

    // Start periodic optimization
    if (this.config.optimizationInterval > 0) {
      this.optimizationTimer = setInterval(() => {
        this.performOptimization();
      }, this.config.optimizationInterval);
    }

    logger.info('🚀 DSPy Performance Optimizer initialized');
  }

  /**
   * Optimize DSPy requestwith caching and performance monitoring
   */
  async optimizeRequest(operation: string, params: any): Promise<unknown> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(operation, params);

    this.metrics.totalRequests++;

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        this.updateCacheHitRate(true);
        logger.debug(`🎯 Cache hit for DSPy operation: ${operation}`);
        return cached;
      }
    }

    // Select optimal model if enabled
    let optimizedParams = params;
    if (this.config.enableModelSelection) {
      optimizedParams = await this.optimizeModelSelection(operation, params);
    }

    try {
      // Execute DSPy request
      const result = await dspyService.requestoperation, optimizedParams);
      const latency = performance.now() - startTime;

      // Update metrics
      this.updateMetrics(operation, latency, result.success, optimizedParams.model);

      // Cache successful responses
      if (this.config.enableCaching && result.success) {
        this.cacheResponse(cacheKey, result);
      }

      // Update cache hit rate for miss
      this.updateCacheHitRate(false);

      this.metrics.successfulRequests++;

      logger.debug(`✅ DSPy requestcompleted: ${operation} (${latency.toFixed(2)}ms)`);
      this.emit('request_completed', { operation, latency, success: result.success });

      return result;
    } catch (error) {
      const latency = performance.now() - startTime;
      this.updateMetrics(operation, latency, false, optimizedParams.model);

      logger.error(❌ DSPy requestfailed: ${operation}`, error);
      this.emit('request_failed', { operation, latency, error});

      throw error;
    }
  }

  /**
   * Generate cache key for DSPy requests
   */
  private generateCacheKey(operation: string, params: any): string {
    const paramsHash = Buffer.from(JSON.stringify(params)).toString('base64').substring(0, 32);
    return `dspy:${operation}:${paramsHash}`;
  }

  /**
   * Get cached response
   */
  private getCachedResponse(key: string): any | null {
    if (this.responseCache.has(key)) {
      const cached = this.responseCache.get(key);
      // Check if cache entry is still valid (1 hour TTL)
      if (Date.now() - cached.timestamp < 3600000) {
        return cached.data;
      } else {
        this.responseCache.delete(key);
      }
    }
    return null;
  }

  /**
   * Cache DSPy response
   */
  private cacheResponse(key: string, data: any): void {
    // Implement LRU cache behavior
    if (this.responseCache.size >= this.config.cacheSize) {
      const firstKey = this.responseCache.keys().next().value;
      if (firstKey !== undefined) {
        this.responseCache.delete(firstKey);
      }
    }

    this.responseCache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Also store in memory manager
    memoryManager.addCacheEntry(
      'dspy_outputs',
      key,
      JSON.stringify(data).length,
      3 // Medium priority
    );
  }

  /**
   * Optimize model selection based on historical performance
   */
  private async optimizeModelSelection(operation: string, params: any): Promise<unknown> {
    if (!params.model) {
      // Select best performing model for this operation
      const bestModel = this.selectOptimalModel(operation);
      if (bestModel) {
        params.model = bestModel;
        logger.debug(`🎯 Selected optimal model: ${bestModel} for ${operation}`);
      }
    }
    return params;
  }

  /**
   * Select optimal model based on performance metrics
   */
  private selectOptimalModel(operation: string): string | null {
    let bestModel: string | null = null;
    let bestScore = 0;

    this.metrics.modelPerformance.forEach((metrics, modelName) => {
      // Calculate performance score
      const successRate = metrics.successfulRequests / metrics.totalRequests;
      const latencyScore = Math.max(0, 1 - metrics.averageLatency / 10000); // Normalize latency
      const confidenceScore = metrics.averageConfidence;

      const performanceScore = successRate * 0.4 + latencyScore * 0.3 + confidenceScore * 0.3;

      if (performanceScore > bestScore) {
        bestScore = performanceScore;
        bestModel = modelName;
      }
    });

    return bestModel;
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(
    operation: string,
    latency: number,
    success: boolean,
    model?: string
  ): void {
    // Update overall metrics
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (this.metrics.totalRequests - 1) + latency) /
      this.metrics.totalRequests;

    // Update model-specific metrics
    if (model) {
      if (!this.metrics.modelPerformance.has(model)) {
        this.metrics.modelPerformance.set(model, {
          name: model,
          totalRequests: 0,
          successfulRequests: 0,
          averageLatency: 0,
          averageConfidence: 0,
          memoryUsage: 0,
          complexity: 0,
        });
      }

      const modelMetrics = this.metrics.modelPerformance.get(model)!;
      modelMetrics.totalRequests++;
      if (success) modelMetrics.successfulRequests++;

      modelMetrics.averageLatency =
        (modelMetrics.averageLatency * (modelMetrics.totalRequests - 1) + latency) /
        modelMetrics.totalRequests;
    }

    // Update optimization score
    this.updateOptimizationScore();
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(isHit: boolean): void {
    const hitWeight = isHit ? 1 : 0;
    this.metrics.cacheHitRate =
      (this.metrics.cacheHitRate * (this.metrics.totalRequests - 1) + hitWeight) /
      this.metrics.totalRequests;
  }

  /**
   * Calculate and update optimization score
   */
  private updateOptimizationScore(): void {
    const successRate = this.metrics.successfulRequests / this.metrics.totalRequests;
    const latencyScore = Math.max(0, 1 - this.metrics.averageLatency / 5000); // Target 5s max latency
    const cacheEfficiency = this.metrics.cacheHitRate;

    this.metrics.optimizationScore = successRate * 0.4 + latencyScore * 0.3 + cacheEfficiency * 0.3;
  }

  /**
   * Perform optimization cycle
   */
  private async performOptimization(): Promise<void> {
    if (this.isOptimizing) return;

    this.isOptimizing = true;
    logger.info('🔄 Starting DSPy performance optimization cycle...');

    try {
      // Clear old cache entries
      this.cleanupCache();

      // Optimize model selection cache
      this.optimizeModelSelectionCache();

      // Update optimization timestamp
      this.metrics.lastOptimized = new Date();

      // Emit optimization event
      this.emit('optimization_completed', {
        score: this.metrics.optimizationScore,
        cacheHitRate: this.metrics.cacheHitRate,
        averageLatency: this.metrics.averageLatency,
      });

      logger.info(`✅ Optimization completed. Score: ${this.metrics.optimizationScore.toFixed(3)}`);
    } catch (error) {
      logger.error('❌ Optimization cycle failed:', error);
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const entriesRemoved: string[] = [];

    this.responseCache.forEach((value, key) => {
      if (now - value.timestamp > 3600000) {
        // 1 hour TTL
        this.responseCache.delete(key);
        entriesRemoved.push(key);
      }
    });

    if (entriesRemoved.length > 0) {
      logger.debug(`🧹 Cleaned up ${entriesRemoved.length} expired cache entries`);
    }
  }

  /**
   * Optimize model selection cache
   */
  private optimizeModelSelectionCache(): void {
    // Clear underperforming model selections
    this.modelSelectionCache.clear();

    // Rebuild with current best performers
    this.metrics.modelPerformance.forEach((metrics, modelName) => {
      const performanceScore = metrics.successfulRequests / metrics.totalRequests;
      if (performanceScore >= this.config.performanceThreshold) {
        this.modelSelectionCache.set(modelName, modelName);
      }
    });
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): DSPyPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.cacheHitRate < 0.3) {
      recommendations.push('Consider increasing cache size for better performance');
    }

    if (this.metrics.averageLatency > 5000) {
      recommendations.push('High latency detected - consider model optimization');
    }

    if (this.metrics.optimizationScore < 0.7) {
      recommendations.push('Overall performance below threshold - review configuration');
    }

    const bestModel = this.selectOptimalModel('general');
    if (bestModel) {
      recommendations.push(`Best performing model: ${bestModel}`);
    }

    return recommendations;
  }

  /**
   * Force optimization cycle
   */
  async forceOptimization(): Promise<void> {
    await this.performOptimization();
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.responseCache.clear();
    this.modelSelectionCache.clear();
    logger.info('🧹 All DSPy caches cleared');
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      averageLatency: 0,
      cacheHitRate: 0,
      modelPerformance: new Map(),
      optimizationScore: 1.0,
      lastOptimized: new Date(),
    };
    logger.info('📊 Performance metrics reset');
  }

  /**
   * Shutdown optimizer
   */
  shutdown(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }
    this.clearCaches();
    this.removeAllListeners();
    logger.info('🔥 DSPy Performance Optimizer shutdown complete');
  }
}

// Export singleton instance
export const dspyOptimizer = DSPyPerformanceOptimizer.getInstance();
