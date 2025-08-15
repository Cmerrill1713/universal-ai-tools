/**
 * Memory Optimization Router
 * Provides endpoints for monitoring and managing memory optimization
 */

import { Router } from 'express';

import { authRequired } from '@/middleware/auth';
import { sendError, sendSuccess } from '@/utils/api-response';
import { log, LogContext } from '@/utils/logger';

const router = Router();

/**
 * GET /api/v1/memory/status
 * Get current memory status and optimization analytics
 */
router.get('/status', authRequired, async (req, res) => {
  try {
    const { memoryOptimizationService } = await import('../services/memory-optimization-service');
    
    const analytics = memoryOptimizationService.getMemoryAnalytics();
    const currentMetrics = await memoryOptimizationService.assessMemoryUsage();

    sendSuccess(res, {
      status: 'success',
      data: {
        currentMetrics,
        analytics,
        memoryPressureMode: analytics.isMemoryPressureMode,
        recommendations: generateMemoryRecommendations(currentMetrics, analytics),
      },
    });
  } catch (error) {
    log.error('❌ Failed to get memory status', LogContext.API, { error });
    sendError(res, 'MEMORY_STATUS_ERROR', 'Failed to get memory status', 500);
  }
});

/**
 * POST /api/v1/memory/optimize
 * Force memory optimization
 */
router.post('/optimize', authRequired, async (req, res) => {
  try {
    const { memoryOptimizationService } = await import('../services/memory-optimization-service');
    
    const beforeMetrics = await memoryOptimizationService.assessMemoryUsage();
    await memoryOptimizationService.forceMemoryOptimization();
    const afterMetrics = await memoryOptimizationService.assessMemoryUsage();

    const improvement = beforeMetrics.heapUsedPercent - afterMetrics.heapUsedPercent;

    sendSuccess(res, {
      status: 'success',
      data: {
        message: 'Memory optimization completed',
        beforeMetrics,
        afterMetrics,
        improvement: `${improvement.toFixed(2)}%`,
        freedMB: ((beforeMetrics.heapUsed - afterMetrics.heapUsed) / 1024 / 1024).toFixed(2),
      },
    });

    log.info('🧠 Manual memory optimization completed', LogContext.API, {
      improvement: `${improvement.toFixed(2)}%`,
      freedMB: ((beforeMetrics.heapUsed - afterMetrics.heapUsed) / 1024 / 1024).toFixed(2),
    });
  } catch (error) {
    log.error('❌ Failed to optimize memory', LogContext.API, { error });
    sendError(res, 'MEMORY_OPTIMIZATION_ERROR', 'Failed to optimize memory', 500);
  }
});

/**
 * GET /api/v1/memory/analytics
 * Get detailed memory analytics and metrics
 */
router.get('/analytics', authRequired, async (req, res) => {
  try {
    const { memoryOptimizationService } = await import('../services/memory-optimization-service');
    
    const analytics = memoryOptimizationService.getMemoryAnalytics();

    sendSuccess(res, {
      status: 'success',
      data: {
        analytics,
        trends: calculateMemoryTrends(analytics),
        health: assessMemoryHealth(analytics),
      },
    });
  } catch (error) {
    log.error('❌ Failed to get memory analytics', LogContext.API, { error });
    sendError(res, 'MEMORY_ANALYTICS_ERROR', 'Failed to get memory analytics', 500);
  }
});

/**
 * POST /api/v1/memory/gc
 * Force garbage collection (development only)
 */
router.post('/gc', authRequired, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return sendError(res, 'FORBIDDEN_ERROR', 'Manual garbage collection not allowed in production', 403);
    }

    if (!global.gc) {
      return sendError(res, 'GC_NOT_AVAILABLE', 'Garbage collection not available (run with --expose-gc)', 400);
    }

    const beforeMemory = process.memoryUsage();
    global.gc();
    const afterMemory = process.memoryUsage();

    const freedMB = (beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024;

    sendSuccess(res, {
      status: 'success',
      data: {
        message: 'Garbage collection completed',
        beforeMemory: {
          heapUsedMB: (beforeMemory.heapUsed / 1024 / 1024).toFixed(2),
          heapTotalMB: (beforeMemory.heapTotal / 1024 / 1024).toFixed(2),
        },
        afterMemory: {
          heapUsedMB: (afterMemory.heapUsed / 1024 / 1024).toFixed(2),
          heapTotalMB: (afterMemory.heapTotal / 1024 / 1024).toFixed(2),
        },
        freedMB: freedMB.toFixed(2),
      },
    });

    log.info('🗑️ Manual garbage collection completed', LogContext.API, {
      freedMB: freedMB.toFixed(2),
    });
  } catch (error) {
    log.error('❌ Failed to run garbage collection', LogContext.API, { error });
    sendError(res, 'GC_ERROR', 'Failed to run garbage collection', 500);
  }
});

/**
 * GET /api/v1/memory/config
 * Get memory optimization configuration
 */
router.get('/config', authRequired, async (req, res) => {
  try {
    const { memoryOptimizationService } = await import('../services/memory-optimization-service');
    
    // Access the private config through analytics
    const analytics = memoryOptimizationService.getMemoryAnalytics();

    sendSuccess(res, {
      status: 'success',
      data: {
        memoryPressureMode: analytics.isMemoryPressureMode,
        cacheManagers: analytics.cacheManagers,
        nodeSettings: {
          nodeEnv: process.env.NODE_ENV,
          gcAvailable: !!global.gc,
          platform: process.platform,
          arch: process.arch,
        },
        recommendations: [
          'Run with --expose-gc for manual garbage collection',
          'Monitor memory usage trends regularly',
          'Consider increasing heap size with --max-old-space-size if needed',
          'Use memory profiling tools in development',
        ],
      },
    });
  } catch (error) {
    log.error('❌ Failed to get memory config', LogContext.API, { error });
    sendError(res, 'MEMORY_CONFIG_ERROR', 'Failed to get memory config', 500);
  }
});

// Helper functions

function generateMemoryRecommendations(metrics: any, analytics: any): string[] {
  const recommendations: string[] = [];

  if (metrics.heapUsedPercent > 85) {
    recommendations.push('🚨 Critical: Memory usage is very high. Consider immediate optimization.');
    recommendations.push('💾 Increase heap size with --max-old-space-size=4096 or higher');
  } else if (metrics.heapUsedPercent > 75) {
    recommendations.push('⚠️ Warning: Memory usage is elevated. Monitor closely.');
    recommendations.push('🧹 Consider running manual optimization');
  } else if (metrics.heapUsedPercent > 60) {
    recommendations.push('📊 Info: Memory usage is moderate. Continue monitoring.');
  } else {
    recommendations.push('✅ Good: Memory usage is within normal range.');
  }

  if (analytics.isMemoryPressureMode) {
    recommendations.push('🔄 Memory pressure mode is active - automatic optimizations running');
  }

  if (analytics.averageHeapUsage > 70) {
    recommendations.push('📈 Average memory usage is high - consider optimizing memory-intensive operations');
  }

  if (!global.gc) {
    recommendations.push('🗑️ Enable manual garbage collection with --expose-gc for better control');
  }

  return recommendations;
}

function calculateMemoryTrends(analytics: any): any {
  return {
    currentVsAverage: analytics.averageHeapUsage > 0 
      ? ((analytics.currentMetrics.heapUsedPercent - analytics.averageHeapUsage) / analytics.averageHeapUsage * 100).toFixed(2)
      : 0,
    currentVsPeak: analytics.peakHeapUsage > 0
      ? ((analytics.currentMetrics.heapUsedPercent / analytics.peakHeapUsage) * 100).toFixed(2)
      : 0,
    status: analytics.currentMetrics.heapUsedPercent > analytics.averageHeapUsage * 1.2 ? 'above_average' :
            analytics.currentMetrics.heapUsedPercent < analytics.averageHeapUsage * 0.8 ? 'below_average' : 'normal',
  };
}

function assessMemoryHealth(analytics: any): any {
  const heapPercent = analytics.currentMetrics.heapUsedPercent;
  
  let status = 'healthy';
  let score = 100;

  if (heapPercent > 85) {
    status = 'critical';
    score = 20;
  } else if (heapPercent > 75) {
    status = 'warning';
    score = 50;
  } else if (heapPercent > 60) {
    status = 'moderate';
    score = 75;
  }

  // Adjust score based on memory pressure mode
  if (analytics.isMemoryPressureMode) {
    score = Math.max(30, score - 20);
  }

  return {
    status,
    score,
    message: getHealthMessage(status, analytics.isMemoryPressureMode),
  };
}

function getHealthMessage(status: string, memoryPressureMode: boolean): string {
  const baseMessages = {
    healthy: 'Memory usage is within optimal range',
    moderate: 'Memory usage is elevated but manageable',
    warning: 'Memory usage is high and should be monitored',
    critical: 'Memory usage is critically high and requires immediate attention',
  };

  let message = baseMessages[status as keyof typeof baseMessages] || 'Unknown status';
  
  if (memoryPressureMode) {
    message += ' (Memory pressure mode active)';
  }

  return message;
}

export default router;