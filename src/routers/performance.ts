/**
 * Performance Monitoring Router
 * Provides real-time performance metrics and memory usage
 */

import { Router } from 'express';
import os from 'os';

import { log, LogContext } from '@/utils/logger';

const router = Router();

interface PerformanceMetrics {
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    heapUtilization: number;
  };
  system: {
    loadAverage: number[];
    freeMemory: number;
    totalMemory: number;
    memoryUtilization: number;
    cpuCount: number;
  };
  process: {
    uptime: number;
    pid: number;
    version: string;
    arch: string;
    platform: string;
  };
  gc?: {
    available: boolean;
    lastRun?: number;
  };
}

router.get('/metrics', async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      heapUtilization: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    };

    const systemMemory = {
      freeMemory: Math.round(os.freemem() / 1024 / 1024),
      totalMemory: Math.round(os.totalmem() / 1024 / 1024),
    };

    const metrics: PerformanceMetrics = {
      memory: memUsageMB,
      system: {
        loadAverage: os.loadavg(),
        freeMemory: systemMemory.freeMemory,
        totalMemory: systemMemory.totalMemory,
        memoryUtilization: Math.round(((systemMemory.totalMemory - systemMemory.freeMemory) / systemMemory.totalMemory) * 100),
        cpuCount: os.cpus().length,
      },
      process: {
        uptime: Math.round(process.uptime()),
        pid: process.pid,
        version: process.version,
        arch: process.arch,
        platform: process.platform,
      },
      gc: {
        available: typeof global.gc === 'function',
      },
    };

    log.debug('Performance metrics requested', LogContext.API, {
      heapUsed: memUsageMB.heapUsed,
      heapUtilization: memUsageMB.heapUtilization,
    });

    return res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    log.error('Failed to get performance metrics', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics',
    });
  }
});

router.post('/gc', async (req, res) => {
  try {
    if (typeof global.gc !== 'function') {
      return res.status(400).json({
        success: false,
        error: 'Garbage collection not available. Start with --expose-gc flag.',
      });
    }

    const beforeMemory = process.memoryUsage();
    const beforeHeapMB = Math.round(beforeMemory.heapUsed / 1024 / 1024);

    global.gc();

    const afterMemory = process.memoryUsage();
    const afterHeapMB = Math.round(afterMemory.heapUsed / 1024 / 1024);
    const freedMB = beforeHeapMB - afterHeapMB;

    log.info('Manual garbage collection triggered', LogContext.API, {
      beforeHeapMB,
      afterHeapMB,
      freedMB,
    });

    return res.json({
      success: true,
      data: {
        before: {
          heapUsed: beforeHeapMB,
          heapTotal: Math.round(beforeMemory.heapTotal / 1024 / 1024),
        },
        after: {
          heapUsed: afterHeapMB,
          heapTotal: Math.round(afterMemory.heapTotal / 1024 / 1024),
        },
        freed: freedMB,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    log.error('Failed to trigger garbage collection', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger garbage collection',
    });
  }
});

router.get('/object-pools', async (req, res) => {
  try {
    const { requestPool, responsePool, arrayPool, bufferPool } = await import('../utils/object-pool');
    
    const poolStats = {
      requestPool: requestPool.size(),
      responsePool: responsePool.size(),
      arrayPool: 'N/A', // ArrayPool doesn't expose size method
      bufferPool: 'N/A', // BufferPool doesn't expose size method
    };

    return res.json({
      success: true,
      data: poolStats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    log.error('Failed to get object pool stats', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve object pool statistics',
    });
  }
});

router.post('/clear-pools', async (req, res) => {
  try {
    const { clearAllPools } = await import('../utils/object-pool');
    clearAllPools();

    log.info('Object pools cleared manually', LogContext.API);

    return res.json({
      success: true,
      message: 'All object pools cleared',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    log.error('Failed to clear object pools', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to clear object pools',
    });
  }
});

export default router;