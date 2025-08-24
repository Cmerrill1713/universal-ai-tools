/**
 * Memory Monitoring Service
 * Real-time memory usage monitoring and alerting
 */

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  heapUsagePercent: number;
  timestamp: Date;
}

export interface MemoryAlert {
  level: 'warning' | 'critical';
  message: string;
  metrics: MemoryMetrics;
  timestamp: Date;
}

export class MemoryMonitoringService {
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCallback: ((alert: MemoryAlert) => void) | null = null;
  private memoryHistory: MemoryMetrics[] = [];
  private readonly maxHistorySize = 1000;

  // Thresholds (in MB)
  private readonly WARNING_THRESHOLD = 800; // 800MB
  private readonly CRITICAL_THRESHOLD = 950; // 950MB (approaching 1GB limit)

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs = 5000): void {
    if (this.isMonitoring) {
      console.log('Memory monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log(`Memory monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Memory monitoring stopped');
  }

  /**
   * Set alert callback function
   */
  setAlertCallback(callback: (alert: MemoryAlert) => void): void {
    this.alertCallback = callback;
  }

  /**
   * Get current memory metrics
   */
  getCurrentMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return {
      heapUsed: Math.round(memUsage.heapUsed / (1024 * 1024)),
      heapTotal: Math.round(memUsage.heapTotal / (1024 * 1024)),
      external: Math.round(memUsage.external / (1024 * 1024)),
      arrayBuffers: Math.round(memUsage.arrayBuffers / (1024 * 1024)),
      heapUsagePercent: Math.round(heapUsagePercent * 100) / 100,
      timestamp: new Date()
    };
  }

  /**
   * Get memory usage history
   */
  getMemoryHistory(): MemoryMetrics[] {
    return [...this.memoryHistory];
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    current: MemoryMetrics;
    average: MemoryMetrics;
    peak: MemoryMetrics;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    const current = this.getCurrentMetrics();
    
    if (this.memoryHistory.length === 0) {
      return {
        current,
        average: current,
        peak: current,
        trend: 'stable'
      };
    }

    // Calculate average
    const avgHeapUsed = this.memoryHistory.reduce((sum, m) => sum + m.heapUsed, 0) / this.memoryHistory.length;
    const avgHeapTotal = this.memoryHistory.reduce((sum, m) => sum + m.heapTotal, 0) / this.memoryHistory.length;
    const avgExternal = this.memoryHistory.reduce((sum, m) => sum + m.external, 0) / this.memoryHistory.length;

    // Find peak usage
    const peak = this.memoryHistory.reduce((max, m) => m.heapUsed > max.heapUsed ? m : max);

    // Determine trend (compare last 10 measurements)
    const recentHistory = this.memoryHistory.slice(-10);
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    
    if (recentHistory.length >= 2) {
      const firstHalf = recentHistory.slice(0, Math.floor(recentHistory.length / 2));
      const secondHalf = recentHistory.slice(Math.floor(recentHistory.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, m) => sum + m.heapUsed, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.heapUsed, 0) / secondHalf.length;
      
      const difference = secondAvg - firstAvg;
      if (difference > 10) {trend = 'increasing';} else if (difference < -10) {trend = 'decreasing';}
    }

    return {
      current,
      average: {
        heapUsed: Math.round(avgHeapUsed),
        heapTotal: Math.round(avgHeapTotal),
        external: Math.round(avgExternal),
        arrayBuffers: 0,
        heapUsagePercent: Math.round((avgHeapUsed / avgHeapTotal) * 100 * 100) / 100,
        timestamp: new Date()
      },
      peak,
      trend
    };
  }

  /**
   * Force memory cleanup and optimization
   */
  async optimizeMemory(): Promise<MemoryMetrics> {
    const beforeMetrics = this.getCurrentMetrics();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Small delay to allow GC to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const afterMetrics = this.getCurrentMetrics();
    
    console.log(`Memory optimization: ${beforeMetrics.heapUsed}MB → ${afterMetrics.heapUsed}MB`);
    
    return afterMetrics;
  }

  private collectMetrics(): void {
    const metrics = this.getCurrentMetrics();
    
    // Add to history
    this.memoryHistory.push(metrics);
    
    // Maintain history size limit
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    // Check for alerts
    this.checkForAlerts(metrics);
  }

  private checkForAlerts(metrics: MemoryMetrics): void {
    if (!this.alertCallback) {return;}

    const totalMemoryMB = metrics.heapUsed + metrics.external;

    if (totalMemoryMB >= this.CRITICAL_THRESHOLD) {
      this.alertCallback({
        level: 'critical',
        message: `Critical memory usage: ${totalMemoryMB}MB (approaching 1GB limit)`,
        metrics,
        timestamp: new Date()
      });
    } else if (totalMemoryMB >= this.WARNING_THRESHOLD) {
      this.alertCallback({
        level: 'warning',
        message: `High memory usage: ${totalMemoryMB}MB`,
        metrics,
        timestamp: new Date()
      });
    }
  }
}

export const memoryMonitoringService = new MemoryMonitoringService();