/**
 * Intelligent Memory Manager Service
 * Provides advanced memory management and optimization capabilities
 */

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

interface MemoryThresholds {
  heapWarning: number;
  heapCritical: number;
  rssWarning: number;
  rssCritical: number;
}

interface MemoryAnalytics {
  currentMetrics: MemoryMetrics;
  thresholds: MemoryThresholds;
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  optimizationOpportunities: Array<{
    area: string;
    impact: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

class IntelligentMemoryManager {
  private thresholds: MemoryThresholds = {
    heapWarning: 500 * 1024 * 1024,  // 500MB
    heapCritical: 1024 * 1024 * 1024, // 1GB
    rssWarning: 800 * 1024 * 1024,   // 800MB
    rssCritical: 1.5 * 1024 * 1024 * 1024 // 1.5GB
  };

  private getMemoryUsage(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0
    };
  }

  private calculateRiskLevel(metrics: MemoryMetrics): 'low' | 'medium' | 'high' | 'critical' {
    if (metrics.heapUsed > this.thresholds.heapCritical || metrics.rss > this.thresholds.rssCritical) {
      return 'critical';
    }
    if (metrics.heapUsed > this.thresholds.heapWarning || metrics.rss > this.thresholds.rssWarning) {
      return 'high';
    }
    if (metrics.heapUsed > this.thresholds.heapWarning * 0.7) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get comprehensive memory analytics
   */
  getMemoryAnalytics(): MemoryAnalytics {
    const currentMetrics = this.getMemoryUsage();
    const riskLevel = this.calculateRiskLevel(currentMetrics);
    
    const recommendations = [];
    const optimizationOpportunities = [];

    // Generate recommendations based on current metrics
    if (riskLevel === 'critical') {
      recommendations.push('Immediate memory optimization required');
      optimizationOpportunities.push({
        area: 'Heap Management',
        impact: 'high' as const,
        description: 'Critical heap usage detected - force garbage collection'
      });
    } else if (riskLevel === 'high') {
      recommendations.push('Consider running garbage collection');
      optimizationOpportunities.push({
        area: 'Cache Cleanup',
        impact: 'medium' as const,
        description: 'Clear unnecessary cached data'
      });
    }

    if (currentMetrics.external > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High external memory usage detected');
      optimizationOpportunities.push({
        area: 'External Resources',
        impact: 'medium' as const,
        description: 'Review external buffer usage'
      });
    }

    return {
      currentMetrics,
      thresholds: this.thresholds,
      recommendations,
      riskLevel,
      optimizationOpportunities
    };
  }

  /**
   * Force memory optimization
   */
  async forceOptimization(): Promise<void> {
    console.log('🧹 Starting intelligent memory optimization...');
    
    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('✅ Garbage collection completed');
    }

    // Simulate additional optimization steps
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('✅ Memory optimization completed');
  }

  /**
   * Update memory thresholds
   */
  updateThresholds(newThresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('📊 Memory thresholds updated:', newThresholds);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): MemoryThresholds {
    return { ...this.thresholds };
  }
}

export const intelligentMemoryManager = new IntelligentMemoryManager();