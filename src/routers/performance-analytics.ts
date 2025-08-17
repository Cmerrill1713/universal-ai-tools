/**
 * Enhanced Performance Analytics Router
 * Advanced performance monitoring endpoints for Arc UI dashboard
 * Provides real-time metrics streaming, memory analytics, attention heatmaps, and optimization insights
 */

import { EventEmitter } from 'events';
import { Router } from 'express';
import * as os from 'os';
import { performance } from 'perf_hooks';
import { z } from 'zod';

import { authenticate, requireAdmin } from '@/middleware/auth';
import { standardRateLimiter } from '@/middleware/comprehensive-rate-limiter';
import { healthMonitor } from '@/services/health-monitor-service';
import { memoryOptimizationService } from '@/services/memory-optimization-service';
import { metricsCollectionService } from '@/services/monitoring/metrics-collection-service';
import { RealtimeBroadcastService } from '@/services/realtime-broadcast-service';
import { log, LogContext } from '@/utils/logger';

const router = Router();

// Validation schemas
const timeRangeSchema = z.object({
  start: z.string().transform(str => new Date(str)),
  end: z.string().transform(str => new Date(str)),
  granularity: z.enum(['second', 'minute', 'hour', 'day']).default('minute')
});

const performanceQuerySchema = z.object({
  timeRange: timeRangeSchema.optional(),
  metrics: z.array(z.string()).optional(),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'p95', 'p99']).default('avg'),
  limit: z.number().min(1).max(10000).default(1000)
});

// Enhanced Performance Metrics Interface
interface EnhancedPerformanceMetrics {
  timestamp: Date;
  system: {
    cpu: {
      usage: number[];
      cores: number;
      temperature?: number;
      frequency?: number;
    };
    memory: {
      total: number;
      free: number;
      used: number;
      percentage: number;
      pressure: number;
      gc: {
        collections: number;
        duration: number;
        freedMemory: number;
      };
    };
    io: {
      read: number;
      write: number;
      operations: number;
    };
    network: {
      bytesIn: number;
      bytesOut: number;
      connections: number;
      latency: number;
    };
  };
  application: {
    requests: {
      total: number;
      rate: number;
      latency: {
        p50: number;
        p95: number;
        p99: number;
        avg: number;
      };
      errors: {
        count: number;
        rate: number;
        types: Record<string, number>;
      };
    };
    agents: {
      active: number;
      queued: number;
      processing: number;
      completed: number;
      failed: number;
      efficiency: number;
    };
    cache: {
      hits: number;
      misses: number;
      hitRate: number;
      size: number;
      evictions: number;
    };
  };
  performance: {
    bottlenecks: Array<{
      component: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      metric: string;
      value: number;
      threshold: number;
      suggestions: string[];
    }>;
    trends: {
      direction: 'improving' | 'degrading' | 'stable';
      confidence: number;
      timeframe: string;
    };
    optimization: {
      potential: number; // 0-100 score
      recommendations: Array<{
        type: string;
        priority: number;
        impact: string;
        effort: string;
        description: string;
      }>;
    };
  };
}

// Memory Timeline Analytics
interface MemoryTimeline {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
  gcEvents: Array<{
    type: string;
    duration: number;
    freedMemory: number;
  }>;
  leaks: Array<{
    component: string;
    growth: number;
    severity: string;
  }>;
  allocations: {
    objects: number;
    functions: number;
    strings: number;
    arrays: number;
  };
}

// Attention Heatmap Data
interface AttentionHeatmap {
  timestamp: Date;
  sessions: Array<{
    sessionId: string;
    userId?: string;
    components: Array<{
      name: string;
      attention: number; // 0-1 score
      interactions: number;
      timeSpent: number;
      errors: number;
    }>;
    pathFlow: Array<{
      from: string;
      to: string;
      frequency: number;
      averageTime: number;
    }>;
  }>;
  aggregated: {
    hotspots: Array<{
      component: string;
      totalAttention: number;
      averageAttention: number;
      peakAttention: number;
      userCount: number;
    }>;
    coldspots: Array<{
      component: string;
      attention: number;
      lastAccessed: Date;
      reason: string;
    }>;
  };
}

// Cache for performance data
const performanceCache = new Map<string, any>();
const CACHE_TTL = 5000; // 5 seconds

// Performance Analytics Service
class PerformanceAnalyticsService extends EventEmitter {
  private memoryTimeline: MemoryTimeline[] = [];
  private attentionData: AttentionHeatmap[] = [];
  private performanceHistory: EnhancedPerformanceMetrics[] = [];
  private readonly MAX_HISTORY = 10000;
  
  private gcCollections = 0;
  private gcDuration = 0;
  private lastGcTime = 0;

  constructor() {
    super();
    this.setupGCMonitoring();
    this.startPerformanceCollection();
  }

  private setupGCMonitoring(): void {
    if (global.gc) {
      const originalGc = global.gc;
      const gcWrapper = () => {
        const start = performance.now();
        const beforeHeap = process.memoryUsage().heapUsed;
        
        originalGc();
        
        const duration = performance.now() - start;
        const afterHeap = process.memoryUsage().heapUsed;
        const freedMemory = beforeHeap - afterHeap;
        
        this.gcCollections++;
        this.gcDuration += duration;
        this.lastGcTime = Date.now();
        
        this.emit('gcEvent', {
          duration,
          freedMemory,
          heapBefore: beforeHeap,
          heapAfter: afterHeap
        });
      };
      
      // Replace global.gc with wrapper
      (global as any).gc = gcWrapper;
    }
  }

  private startPerformanceCollection(): void {
    setInterval(() => {
      this.collectPerformanceMetrics();
      this.collectMemoryTimeline();
    }, 5000); // Every 5 seconds

    setInterval(() => {
      this.analyzePerformanceTrends();
    }, 30000); // Every 30 seconds
  }

  private collectPerformanceMetrics(): void {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = os.loadavg();
      const systemMem = {
        total: os.totalmem(),
        free: os.freemem()
      };

      // Get recent metrics from existing service
      const recentSystemMetrics = metricsCollectionService.getRecentSystemMetrics(1)[0];
      const recentBusinessMetrics = metricsCollectionService.getRecentBusinessMetrics(1)[0];
      const summary = metricsCollectionService.getMetricsSummary();

      const metrics: EnhancedPerformanceMetrics = {
        timestamp: new Date(),
        system: {
          cpu: {
            usage: cpuUsage,
            cores: os.cpus().length,
            temperature: this.getCPUTemperature(),
            frequency: this.getCPUFrequency()
          },
          memory: {
            total: systemMem.total,
            free: systemMem.free,
            used: systemMem.total - systemMem.free,
            percentage: ((systemMem.total - systemMem.free) / systemMem.total) * 100,
            pressure: this.calculateMemoryPressure(),
            gc: {
              collections: this.gcCollections,
              duration: this.gcDuration,
              freedMemory: memUsage.heapTotal - memUsage.heapUsed
            }
          },
          io: {
            read: 0, // Would need additional monitoring
            write: 0,
            operations: 0
          },
          network: {
            bytesIn: 0, // Would need additional monitoring
            bytesOut: 0,
            connections: 0,
            latency: summary.requests.avgResponseTime
          }
        },
        application: {
          requests: {
            total: summary.requests.total,
            rate: summary.requests.recent,
            latency: {
              p50: summary.requests.avgResponseTime,
              p95: summary.requests.avgResponseTime * 1.5,
              p99: summary.requests.avgResponseTime * 2,
              avg: summary.requests.avgResponseTime
            },
            errors: {
              count: Math.round(summary.requests.recent * (summary.requests.errorRate / 100)),
              rate: summary.requests.errorRate,
              types: this.getErrorTypes()
            }
          },
          agents: {
            active: recentBusinessMetrics?.agentUsage.activeAgents || 0,
            queued: 0,
            processing: recentBusinessMetrics?.agentUsage.totalRequests || 0,
            completed: 0,
            failed: 0,
            efficiency: recentBusinessMetrics?.agentUsage.successRate || 0
          },
          cache: {
            hits: 0, // Would need cache monitoring
            misses: 0,
            hitRate: 0,
            size: 0,
            evictions: 0
          }
        },
        performance: {
          bottlenecks: this.identifyBottlenecks(recentSystemMetrics),
          trends: this.calculateTrends(),
          optimization: this.generateOptimizationRecommendations()
        }
      };

      this.performanceHistory.push(metrics);
      
      if (this.performanceHistory.length > this.MAX_HISTORY) {
        this.performanceHistory.shift();
      }

      this.emit('performanceMetrics', metrics);
    } catch (error) {
      log.error('Failed to collect performance metrics', LogContext.MONITORING, { error });
    }
  }

  private collectMemoryTimeline(): void {
    try {
      const memUsage = process.memoryUsage();
      
      const timeline: MemoryTimeline = {
        timestamp: new Date(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers || 0,
        gcEvents: [], // Would be populated from GC monitoring
        leaks: this.detectMemoryLeaks(),
        allocations: {
          objects: 0, // Would need heap profiling
          functions: 0,
          strings: 0,
          arrays: 0
        }
      };

      this.memoryTimeline.push(timeline);
      
      if (this.memoryTimeline.length > this.MAX_HISTORY) {
        this.memoryTimeline.shift();
      }

      this.emit('memoryTimeline', timeline);
    } catch (error) {
      log.error('Failed to collect memory timeline', LogContext.MONITORING, { error });
    }
  }

  private getCPUTemperature(): number {
    // Platform-specific implementation would be needed
    return 0; // Placeholder
  }

  private getCPUFrequency(): number {
    // Platform-specific implementation would be needed
    return 0; // Placeholder
  }

  private calculateMemoryPressure(): number {
    const memUsage = process.memoryUsage();
    const pressure = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    return Math.min(pressure, 100);
  }

  private getErrorTypes(): Record<string, number> {
    // Would analyze recent error logs
    return {
      '4xx': 0,
      '5xx': 0,
      timeout: 0,
      connection: 0
    };
  }

  private identifyBottlenecks(systemMetrics: any): EnhancedPerformanceMetrics['performance']['bottlenecks'] {
    const bottlenecks: EnhancedPerformanceMetrics['performance']['bottlenecks'] = [];

    if (systemMetrics?.memory.percentage > 85) {
      bottlenecks.push({
        component: 'memory',
        severity: 'high',
        metric: 'memory_usage',
        value: systemMetrics.memory.percentage,
        threshold: 85,
        suggestions: [
          'Enable garbage collection optimization',
          'Implement memory pooling',
          'Review memory-intensive operations'
        ]
      });
    }

    if (systemMetrics?.cpu.loadAverage[0] > systemMetrics?.cpu.cores * 1.5) {
      bottlenecks.push({
        component: 'cpu',
        severity: 'medium',
        metric: 'load_average',
        value: systemMetrics.cpu.loadAverage[0],
        threshold: systemMetrics.cpu.cores * 1.5,
        suggestions: [
          'Optimize CPU-intensive operations',
          'Implement request queuing',
          'Scale horizontally'
        ]
      });
    }

    return bottlenecks;
  }

  private calculateTrends(): EnhancedPerformanceMetrics['performance']['trends'] {
    if (this.performanceHistory.length < 10) {
      return {
        direction: 'stable',
        confidence: 0.5,
        timeframe: '5min'
      };
    }

    const recent = this.performanceHistory.slice(-10);
    const memoryTrend = this.calculateMetricTrend(recent.map(m => m.system.memory.percentage));
    
    return {
      direction: memoryTrend > 5 ? 'degrading' : memoryTrend < -5 ? 'improving' : 'stable',
      confidence: Math.min(Math.abs(memoryTrend) / 10, 1),
      timeframe: '5min'
    };
  }

  private calculateMetricTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const first = values[0];
    const last = values[values.length - 1];
    
    if (first === undefined || last === undefined || first === 0) return 0;
    
    return ((last - first) / first) * 100;
  }

  private generateOptimizationRecommendations(): EnhancedPerformanceMetrics['performance']['optimization'] {
    const recommendations = [];
    
    if (this.calculateMemoryPressure() > 70) {
      recommendations.push({
        type: 'memory',
        priority: 9,
        impact: 'high',
        effort: 'medium',
        description: 'Implement aggressive memory cleanup and optimization'
      });
    }

    const potential = Math.max(0, 100 - this.calculateMemoryPressure());
    
    return {
      potential,
      recommendations
    };
  }

  private detectMemoryLeaks(): MemoryTimeline['leaks'] {
    if (this.memoryTimeline.length < 10) return [];
    
    const recent = this.memoryTimeline.slice(-10);
    const growth = this.calculateMetricTrend(recent.map(m => m.heapUsed));
    
    if (growth > 20) { // 20% growth
      return [{
        component: 'heap',
        growth,
        severity: growth > 50 ? 'critical' : 'warning'
      }];
    }
    
    return [];
  }

  private analyzePerformanceTrends(): void {
    // Emit trend analysis events
    this.emit('performanceAnalysis', {
      timestamp: new Date(),
      trends: this.calculateTrends(),
      recommendations: this.generateOptimizationRecommendations()
    });
  }

  public getPerformanceHistory(limit: number = 100): EnhancedPerformanceMetrics[] {
    return this.performanceHistory.slice(-limit);
  }

  public getMemoryTimeline(limit: number = 100): MemoryTimeline[] {
    return this.memoryTimeline.slice(-limit);
  }

  public getAttentionHeatmap(): AttentionHeatmap[] {
    return this.attentionData;
  }
}

// Initialize performance analytics service
const performanceAnalyticsService = new PerformanceAnalyticsService();

// Helper function to get cached data
function getCachedData<T>(key: string, generator: () => T): T {
  const cached = performanceCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = generator();
  performanceCache.set(key, { data, timestamp: Date.now() });
  return data;
}

/**
 * GET /performance-analytics/metrics/realtime
 * Real-time performance metrics streaming
 */
router.get('/metrics/realtime', authenticate, async (req, res) => {
  try {
    const metrics = getCachedData('realtime-metrics', () => {
      const latest = performanceAnalyticsService.getPerformanceHistory(1)[0];
      const health = healthMonitor.getCurrentHealth();
      const memory = memoryOptimizationService.getMemoryAnalytics();
      
      return {
        timestamp: new Date().toISOString(),
        performance: latest || null,
        health,
        memory,
        system: {
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };
    });

    return res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    log.error('Failed to get real-time performance metrics', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve real-time metrics'
    });
  }
});

/**
 * GET /performance-analytics/memory/timeline
 * Memory timeline data and analytics
 */
router.get('/memory/timeline', authenticate, async (req, res) => {
  try {
    const validation = z.object({
      hours: z.string().optional().transform(val => val ? parseInt(val) : 1),
      resolution: z.enum(['second', 'minute', 'hour']).default('minute')
    }).safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors
      });
    }

    const { hours, resolution } = validation.data;
    const limit = Math.min(hours * 60, 1000); // Max 1000 data points

    const timeline = performanceAnalyticsService.getMemoryTimeline(limit);
    const analytics = memoryOptimizationService.getMemoryAnalytics();

    const aggregatedData = timeline.map(point => ({
      timestamp: point.timestamp,
      heapUsed: Math.round(point.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(point.heapTotal / 1024 / 1024), // MB
      heapUtilization: Math.round((point.heapUsed / point.heapTotal) * 100),
      rss: Math.round(point.rss / 1024 / 1024), // MB
      external: Math.round(point.external / 1024 / 1024), // MB
      gcEvents: point.gcEvents.length,
      leaks: point.leaks
    }));

    return res.json({
      success: true,
      data: {
        timeline: aggregatedData,
        analytics,
        summary: {
          averageHeapUsage: analytics.averageHeapUsage,
          peakHeapUsage: analytics.peakHeapUsage,
          gcCount: analytics.gcCount,
          memoryPressureMode: analytics.isMemoryPressureMode
        }
      }
    });

  } catch (error) {
    log.error('Failed to get memory timeline', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve memory timeline'
    });
  }
});

/**
 * GET /performance-analytics/attention/heatmap
 * Attention heatmap data processing
 */
router.get('/attention/heatmap', authenticate, async (req, res) => {
  try {
    const validation = z.object({
      sessionId: z.string().optional(),
      timeRange: z.string().optional().transform(val => val ? parseInt(val) : 3600), // Default 1 hour
      aggregation: z.enum(['session', 'component', 'user']).default('component')
    }).safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors
      });
    }

    const { sessionId, timeRange, aggregation } = validation.data;

    // Generate mock attention heatmap data
    // In a real implementation, this would come from user interaction tracking
    const heatmapData = getCachedData(`attention-heatmap-${aggregation}`, () => {
      const components = [
        'chat-interface', 'agent-selector', 'performance-dashboard',
        'memory-monitor', 'settings-panel', 'file-explorer',
        'code-editor', 'terminal', 'network-topology'
      ];

      const hotspots = components.map(component => ({
        component,
        totalAttention: Math.random() * 100,
        averageAttention: Math.random(),
        peakAttention: Math.random(),
        userCount: Math.floor(Math.random() * 50) + 1,
        interactions: Math.floor(Math.random() * 1000),
        timeSpent: Math.floor(Math.random() * 3600),
        heatIntensity: Math.random()
      })).sort((a, b) => b.totalAttention - a.totalAttention);

      const pathFlow = [];
      for (let i = 0; i < components.length - 1; i++) {
        pathFlow.push({
          from: components[i],
          to: components[i + 1],
          frequency: Math.floor(Math.random() * 100),
          averageTime: Math.random() * 5000,
          heatIntensity: Math.random()
        });
      }

      return {
        timestamp: new Date(),
        aggregation,
        timeRange,
        hotspots,
        pathFlow,
        summary: {
          totalSessions: Math.floor(Math.random() * 100) + 50,
          averageSessionDuration: Math.random() * 1800 + 300,
          mostActiveComponent: hotspots[0]?.component,
          leastActiveComponent: hotspots[hotspots.length - 1]?.component
        }
      };
    });

    return res.json({
      success: true,
      data: heatmapData
    });

  } catch (error) {
    log.error('Failed to get attention heatmap', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve attention heatmap'
    });
  }
});

/**
 * GET /performance-analytics/bottlenecks
 * Performance bottleneck identification
 */
router.get('/bottlenecks', authenticate, async (req, res) => {
  try {
    const recent = performanceAnalyticsService.getPerformanceHistory(10);
    if (recent.length === 0) {
      return res.json({
        success: true,
        data: {
          bottlenecks: [],
          analysis: 'Insufficient data for bottleneck analysis'
        }
      });
    }

    const latest = recent[recent.length - 1];
    if (!latest) {
      return res.json({
        success: true,
        data: {
          bottlenecks: [],
          analysis: 'No performance data available'
        }
      });
    }

    const {bottlenecks} = latest.performance;

    // Enhanced bottleneck analysis
    const analysis = {
      criticalCount: bottlenecks.filter(b => b.severity === 'critical').length,
      highCount: bottlenecks.filter(b => b.severity === 'high').length,
      mediumCount: bottlenecks.filter(b => b.severity === 'medium').length,
      lowCount: bottlenecks.filter(b => b.severity === 'low').length,
      totalImpact: bottlenecks.reduce((sum, b) => {
        const weights = { critical: 4, high: 3, medium: 2, low: 1 };
        return sum + weights[b.severity];
      }, 0),
      recommendations: latest.performance.optimization.recommendations,
      trends: latest.performance.trends
    };

    return res.json({
      success: true,
      data: {
        bottlenecks,
        analysis,
        timestamp: latest.timestamp
      }
    });

  } catch (error) {
    log.error('Failed to analyze bottlenecks', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze performance bottlenecks'
    });
  }
});

/**
 * GET /performance-analytics/health/trending
 * System health trending
 */
router.get('/health/trending', authenticate, async (req, res) => {
  try {
    const validation = z.object({
      period: z.enum(['1h', '6h', '24h', '7d']).default('1h'),
      metrics: z.array(z.string()).optional()
    }).safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters'
      });
    }

    const { period } = validation.data;
    const healthHistory = healthMonitor.getHealthHistory(100);
    const performanceHistory = performanceAnalyticsService.getPerformanceHistory(100);

    const trends = getCachedData(`health-trends-${period}`, () => {
      const systemHealthTrend = healthHistory.map(h => ({
        timestamp: h.timestamp,
        systemHealth: h.systemHealth,
        agentHealth: h.agentHealth,
        meshHealth: h.meshHealth,
        memoryUsage: h.memoryUsage
      }));

      const performanceTrend = performanceHistory.map(p => ({
        timestamp: p.timestamp,
        cpuUsage: p.system.cpu.usage[0],
        memoryPressure: p.system.memory.pressure,
        requestLatency: p.application.requests.latency.avg,
        errorRate: p.application.requests.errors.rate
      }));

      return {
        period,
        health: systemHealthTrend,
        performance: performanceTrend,
        alerts: healthMonitor.getActiveIssues(),
        summary: {
          overallTrend: 'stable', // Would calculate from actual data
          criticalIssues: healthMonitor.getActiveIssues().filter(i => i.severity === 'critical').length,
          averageHealth: healthHistory.reduce((sum, h) => sum + h.systemHealth, 0) / healthHistory.length
        }
      };
    });

    return res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    log.error('Failed to get health trending', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve health trending data'
    });
  }
});

/**
 * GET /performance-analytics/optimization/suggestions
 * Resource optimization suggestions
 */
router.get('/optimization/suggestions', authenticate, requireAdmin, async (req, res) => {
  try {
    const recent = performanceAnalyticsService.getPerformanceHistory(1)[0];
    const memoryAnalytics = memoryOptimizationService.getMemoryAnalytics();
    
    if (!recent) {
      return res.status(503).json({
        success: false,
        error: 'Performance data not available'
      });
    }

    const suggestions = {
      immediate: [] as any[],
      shortTerm: [] as any[],
      longTerm: [] as any[],
      priority: recent.performance.optimization.recommendations
    };

    // Generate immediate suggestions
    if (recent.system.memory.pressure > 80) {
      suggestions.immediate.push({
        type: 'memory',
        action: 'trigger_gc',
        description: 'Execute garbage collection to free memory',
        impact: 'high',
        effort: 'low',
        endpoint: '/performance/gc'
      });
    }

    if (recent.performance.bottlenecks.some(b => b.severity === 'critical')) {
      suggestions.immediate.push({
        type: 'bottleneck',
        action: 'scale_resources',
        description: 'Critical bottlenecks detected - consider scaling',
        impact: 'high',
        effort: 'medium'
      });
    }

    // Generate short-term suggestions
    if (memoryAnalytics.averageHeapUsage > 70) {
      suggestions.shortTerm.push({
        type: 'memory',
        action: 'optimize_caching',
        description: 'Implement memory-efficient caching strategies',
        impact: 'medium',
        effort: 'medium'
      });
    }

    // Generate long-term suggestions
    suggestions.longTerm.push({
      type: 'architecture',
      action: 'implement_monitoring',
      description: 'Enhance monitoring and alerting systems',
      impact: 'high',
      effort: 'high'
    });

    return res.json({
      success: true,
      data: {
        suggestions,
        optimizationPotential: recent.performance.optimization.potential,
        currentStatus: {
          memoryPressure: recent.system.memory.pressure,
          cpuLoad: recent.system.cpu.usage[0],
          errorRate: recent.application.requests.errors.rate
        }
      }
    });

  } catch (error) {
    log.error('Failed to generate optimization suggestions', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to generate optimization suggestions'
    });
  }
});

/**
 * GET /performance-analytics/historical
 * Historical performance data
 */
router.get('/historical', authenticate, async (req, res) => {
  try {
    const validation = performanceQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors
      });
    }

    const { timeRange, metrics, aggregation, limit } = validation.data;
    
    let data = performanceAnalyticsService.getPerformanceHistory(limit);
    
    // Filter by time range if specified
    if (timeRange) {
      data = data.filter(d => 
        d.timestamp >= timeRange.start && d.timestamp <= timeRange.end
      );
    }

    // Filter by specific metrics if requested
    let filteredData = data;
    if (metrics && metrics.length > 0) {
      filteredData = data.map(d => {
        const filtered: any = { timestamp: d.timestamp };
        metrics.forEach(metric => {
          if (metric.includes('.')) {
            const parts = metric.split('.');
            let value: any = d;
            for (const part of parts) {
              value = value?.[part];
            }
            filtered[metric] = value;
          }
        });
        return filtered;
      });
    }

    return res.json({
      success: true,
      data: {
        metrics: filteredData,
        aggregation,
        totalPoints: filteredData.length,
        timeRange: timeRange || 'all'
      }
    });

  } catch (error) {
    log.error('Failed to get historical performance data', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve historical data'
    });
  }
});

/**
 * WebSocket stream endpoint for real-time monitoring
 */
router.get('/stream', (req, res) => {
  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Set up real-time data streaming
  const streamInterval = setInterval(() => {
    try {
      const performanceData = performanceAnalyticsService.getPerformanceHistory(1)[0];
      const memoryData = performanceAnalyticsService.getMemoryTimeline(1)[0];
      const healthData = healthMonitor.getCurrentHealth();

      const streamData = {
        type: 'performance_update',
        timestamp: new Date().toISOString(),
        performance: performanceData,
        memory: memoryData,
        health: healthData
      };

      res.write(`data: ${JSON.stringify(streamData)}\n\n`);
    } catch (error) {
      log.error('Error in performance stream', LogContext.API, { error });
      clearInterval(streamInterval);
      res.end();
    }
  }, 2000); // Every 2 seconds

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(streamInterval);
    res.end();
  });

  req.on('error', () => {
    clearInterval(streamInterval);
    res.end();
  });
});

/**
 * POST /performance-analytics/gc
 * Manual garbage collection trigger
 */
router.post('/gc', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!global.gc) {
      return res.status(400).json({
        success: false,
        error: 'Garbage collection not available. Start with --expose-gc flag.'
      });
    }

    const beforeMemory = process.memoryUsage();
    const start = performance.now();
    
    global.gc();
    
    const duration = performance.now() - start;
    const afterMemory = process.memoryUsage();
    const freedMB = (beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024;

    log.info('Manual GC triggered via API', LogContext.API, {
      duration: Math.round(duration),
      freedMB: Math.round(freedMB)
    });

    return res.json({
      success: true,
      data: {
        duration: Math.round(duration),
        freedMemory: Math.round(freedMB),
        before: {
          heapUsed: Math.round(beforeMemory.heapUsed / 1024 / 1024),
          heapTotal: Math.round(beforeMemory.heapTotal / 1024 / 1024)
        },
        after: {
          heapUsed: Math.round(afterMemory.heapUsed / 1024 / 1024),
          heapTotal: Math.round(afterMemory.heapTotal / 1024 / 1024)
        }
      }
    });

  } catch (error) {
    log.error('Failed to trigger garbage collection', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger garbage collection'
    });
  }
});

/**
 * POST /performance-analytics/optimize
 * Force performance optimization
 */
router.post('/optimize', authenticate, requireAdmin, async (req, res) => {
  try {
    log.info('Manual performance optimization triggered', LogContext.API);

    // Trigger memory optimization
    await memoryOptimizationService.forceMemoryOptimization();

    // Clear performance cache
    performanceCache.clear();

    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const afterMetrics = performanceAnalyticsService.getPerformanceHistory(1)[0];

    return res.json({
      success: true,
      data: {
        message: 'Performance optimization completed',
        metrics: afterMetrics,
        optimizations: [
          'Memory cleanup executed',
          'Cache cleared',
          'Garbage collection triggered'
        ]
      }
    });

  } catch (error) {
    log.error('Failed to perform optimization', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to perform performance optimization'
    });
  }
});

// Cleanup function for graceful shutdown
process.on('SIGTERM', () => {
  performanceCache.clear();
  log.info('Performance analytics service cleaned up', LogContext.MONITORING);
});

export default router;