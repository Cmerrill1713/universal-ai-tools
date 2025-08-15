/**
 * Monitoring Dashboard API Router
 * Real-time metrics endpoints, historical data queries, and system status overview
 */

import { Router } from 'express';
import { z } from 'zod';

import { metricsCollectionService } from '@/services/monitoring/metrics-collection-service';
import { distributedTracingService } from '@/services/monitoring/distributed-tracing-service';
import { enhancedLoggingService } from '@/services/monitoring/enhanced-logging-service';
import { healthMonitor } from '@/services/health-monitor';
import { log, LogContext } from '@/utils/logger';

const router = Router();

// Validation schemas
const timeRangeSchema = z.object({
  start: z.string().transform(str => new Date(str)),
  end: z.string().transform(str => new Date(str))
});

const logFilterSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).optional(),
  context: z.string().optional(),
  timeRange: timeRangeSchema.optional(),
  traceId: z.string().optional(),
  userId: z.string().optional(),
  hasError: z.boolean().optional(),
  limit: z.number().min(1).max(1000).default(100)
});

/**
 * Get comprehensive system overview
 */
router.get('/overview', async (req, res) => {
  try {
    const overview = {
      timestamp: new Date().toISOString(),
      system: {
        health: await healthMonitor.getSystemHealth(),
        metrics: metricsCollectionService.getMetricsSummary(),
        tracing: distributedTracingService.getTraceStats(),
        logging: enhancedLoggingService.getMemoryUsage()
      },
      alerts: {
        critical: 0,
        warnings: 0,
        info: 0
      },
      performance: {
        uptime: process.uptime(),
        responseTime: 0, // Will be calculated by middleware
        throughput: 0, // Will be calculated from metrics
        errorRate: 0 // Will be calculated from metrics
      }
    };

    // Calculate performance metrics
    const recentMetrics = metricsCollectionService.getRecentSystemMetrics(1);
    if (recentMetrics.length > 0) {
      const latest = recentMetrics[0];
      if (latest) {
        overview.performance.responseTime = latest.memory.process.heapUsed / 1024 / 1024; // Rough estimate
      }
    }

    // Calculate alerts
    const systemHealth = await healthMonitor.getSystemHealth();
    overview.alerts.critical = systemHealth.services.filter(s => s.status === 'unhealthy').length;
    overview.alerts.warnings = systemHealth.services.filter(s => s.status === 'degraded').length;
    overview.alerts.info = systemHealth.services.filter(s => s.status === 'healthy').length;

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    log.error('Failed to get monitoring overview', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get monitoring overview'
    });
  }
});

/**
 * Get real-time system metrics
 */
router.get('/metrics/realtime', (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: metricsCollectionService.getRecentSystemMetrics(1)[0] || null,
      business: metricsCollectionService.getRecentBusinessMetrics(1)[0] || null,
      custom: metricsCollectionService.getRecentCustomMetrics(10),
      summary: metricsCollectionService.getMetricsSummary()
    };

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    log.error('Failed to get real-time metrics', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time metrics'
    });
  }
});

/**
 * Get historical metrics data
 */
router.get('/metrics/history', (req, res) => {
  try {
    const { hours = 24, resolution = 'hourly' } = req.query;
    const hoursNum = parseInt(hours as string);
    
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hoursNum * 60 * 60 * 1000));

    const systemMetrics = metricsCollectionService.getRecentSystemMetrics(hoursNum * 12); // 5-minute intervals
    const businessMetrics = metricsCollectionService.getRecentBusinessMetrics(hoursNum * 12);

    const history = {
      timeRange: { start: startTime, end: endTime },
      resolution,
      system: systemMetrics.filter(m => 
        new Date(m.timestamp) >= startTime && new Date(m.timestamp) <= endTime
      ),
      business: businessMetrics.filter(m => 
        new Date(m.timestamp) >= startTime && new Date(m.timestamp) <= endTime
      )
    };

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    log.error('Failed to get historical metrics', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get historical metrics'
    });
  }
});

/**
 * Get distributed tracing data
 */
router.get('/traces', (req, res) => {
  try {
    const { limit = 50, status, minDuration } = req.query;
    const limitNum = parseInt(limit as string);
    
    let traces = Array.from(distributedTracingService.getActiveTraces().entries())
      .map(([traceId, spans]) => ({
        traceId,
        spans: spans.length,
        duration: spans.length > 0 ? Math.max(...spans.map(s => s.endTime || Date.now())) - Math.min(...spans.map(s => s.startTime)) : 0,
        status: spans.some(s => s.status === 'error') ? 'error' : 'ok',
        service: spans[0]?.serviceName || 'unknown',
        operation: spans[0]?.operationName || 'unknown',
        timestamp: new Date(Math.min(...spans.map(s => s.startTime)))
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply filters
    if (status) {
      traces = traces.filter(t => t.status === status);
    }

    if (minDuration) {
      const minDur = parseInt(minDuration as string);
      traces = traces.filter(t => t.duration >= minDur);
    }

    traces = traces.slice(0, limitNum);

    res.json({
      success: true,
      data: {
        traces,
        stats: distributedTracingService.getTraceStats()
      }
    });

  } catch (error) {
    log.error('Failed to get traces', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get traces'
    });
  }
});

/**
 * Get specific trace details
 */
router.get('/traces/:traceId', (req, res) => {
  try {
    const { traceId } = req.params;
    const trace = distributedTracingService.getTrace(traceId);

    if (!trace) {
      return res.status(404).json({
        success: false,
        error: 'Trace not found'
      });
    }

    const traceData = {
      traceId,
      spans: trace,
      duration: trace.length > 0 ? Math.max(...trace.map(s => s.endTime || Date.now())) - Math.min(...trace.map(s => s.startTime)) : 0,
      totalSpans: trace.length,
      errorSpans: trace.filter(s => s.status === 'error').length,
      services: [...new Set(trace.map(s => s.serviceName))],
      operations: [...new Set(trace.map(s => s.operationName))]
    };

    res.json({
      success: true,
      data: traceData
    });

  } catch (error) {
    log.error('Failed to get trace details', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get trace details'
    });
  }
});

/**
 * Get slow traces for performance analysis
 */
router.get('/traces/slow', (req, res) => {
  try {
    const { threshold = 5000, limit = 20 } = req.query;
    const thresholdNum = parseInt(threshold as string);
    const limitNum = parseInt(limit as string);

    const slowTraces = distributedTracingService.getSlowTraces(thresholdNum)
      .slice(0, limitNum)
      .map(span => ({
        traceId: span.traceId,
        spanId: span.spanId,
        operation: span.operationName,
        duration: span.duration,
        timestamp: new Date(span.startTime),
        status: span.status,
        tags: span.tags
      }));

    res.json({
      success: true,
      data: slowTraces
    });

  } catch (error) {
    log.error('Failed to get slow traces', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get slow traces'
    });
  }
});

/**
 * Get error traces
 */
router.get('/traces/errors', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const limitNum = parseInt(limit as string);

    const errorTraces = distributedTracingService.getErrorTraces()
      .slice(0, limitNum)
      .map(span => ({
        traceId: span.traceId,
        spanId: span.spanId,
        operation: span.operationName,
        duration: span.duration,
        timestamp: new Date(span.startTime),
        error: span.error,
        tags: span.tags
      }));

    res.json({
      success: true,
      data: errorTraces
    });

  } catch (error) {
    log.error('Failed to get error traces', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get error traces'
    });
  }
});

/**
 * Search and filter logs
 */
router.get('/logs', (req, res) => {
  try {
    const validation = logFilterSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors
      });
    }

    const { limit, ...filter } = validation.data;
    const logs = enhancedLoggingService.queryLogs(filter, limit);

    res.json({
      success: true,
      data: {
        logs,
        totalCount: logs.length,
        filter,
        memoryUsage: enhancedLoggingService.getMemoryUsage()
      }
    });

  } catch (error) {
    log.error('Failed to search logs', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to search logs'
    });
  }
});

/**
 * Get log aggregations and analytics
 */
router.get('/logs/analytics', (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'start and end parameters are required'
      });
    }

    const timeRange = {
      start: new Date(start as string),
      end: new Date(end as string)
    };

    const analytics = enhancedLoggingService.getLogAggregation(timeRange);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    log.error('Failed to get log analytics', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get log analytics'
    });
  }
});

/**
 * Export logs in various formats
 */
router.get('/logs/export', (req, res) => {
  try {
    const { format = 'json', ...filterParams } = req.query;
    
    const validation = logFilterSchema.safeParse(filterParams);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors
      });
    }

    const { limit, ...filter } = validation.data;
    const exportData = enhancedLoggingService.exportLogs(filter, format as 'json' | 'csv' | 'ndjson');

    // Set appropriate content type
    const contentTypes = {
      json: 'application/json',
      csv: 'text/csv',
      ndjson: 'application/x-ndjson'
    };

    const contentType = contentTypes[format as keyof typeof contentTypes] || 'application/json';
    const filename = `logs-${new Date().toISOString().split('T')[0]}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);

  } catch (error) {
    log.error('Failed to export logs', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to export logs'
    });
  }
});

/**
 * Get health status of all services
 */
router.get('/health', async (req, res) => {
  try {
    const health = await healthMonitor.getSystemHealth();
    
    const status = health.status === 'healthy' ? 200 : 
                   health.status === 'degraded' ? 207 : 503;

    res.status(status).json({
      success: true,
      data: health
    });

  } catch (error) {
    log.error('Failed to get health status', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get health status'
    });
  }
});

/**
 * Get endpoint performance metrics
 */
router.get('/metrics/endpoints', (req, res) => {
  try {
    const { path, method } = req.query;
    
    if (path && method) {
      // Get metrics for specific endpoint
      const metrics = metricsCollectionService.getEndpointMetrics(
        method as string, 
        path as string
      );
      
      res.json({
        success: true,
        data: {
          endpoint: `${method} ${path}`,
          metrics
        }
      });
    } else {
      // Get all endpoint metrics (summary)
      const summary = metricsCollectionService.getMetricsSummary();
      
      res.json({
        success: true,
        data: {
          summary,
          endpoints: [] // Would need to track all endpoints
        }
      });
    }

  } catch (error) {
    log.error('Failed to get endpoint metrics', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get endpoint metrics'
    });
  }
});

/**
 * Get Prometheus-compatible metrics
 */
router.get('/metrics/prometheus', (req, res) => {
  try {
    const prometheusData = metricsCollectionService.toPrometheusFormat();
    
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusData);

  } catch (error) {
    log.error('Failed to get Prometheus metrics', LogContext.API, { error });
    res.status(500).send('# Failed to get metrics\n');
  }
});

/**
 * Get Jaeger-compatible traces
 */
router.get('/traces/jaeger', (req, res) => {
  try {
    const jaegerData = distributedTracingService.exportJaegerFormat();
    
    res.json(jaegerData);

  } catch (error) {
    log.error('Failed to get Jaeger traces', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get Jaeger traces'
    });
  }
});

/**
 * Server-Sent Events stream for real-time monitoring
 */
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString(),
    message: 'Connected to monitoring stream'
  })}\n\n`);

  // Set up metric streaming
  const interval = setInterval(() => {
    try {
      const data = {
        type: 'metrics',
        timestamp: new Date().toISOString(),
        system: metricsCollectionService.getRecentSystemMetrics(1)[0] || null,
        business: metricsCollectionService.getRecentBusinessMetrics(1)[0] || null,
        tracing: distributedTracingService.getTraceStats(),
        health: healthMonitor.getSystemHealth()
      };

      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      log.error('Error in monitoring stream', LogContext.API, { error });
    }
  }, 5000); // Update every 5 seconds

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });

  req.on('error', () => {
    clearInterval(interval);
    res.end();
  });
});

/**
 * Create custom metric
 */
router.post('/metrics/custom', (req, res) => {
  try {
    const { name, value, type = 'gauge', labels } = req.body;
    
    if (!name || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'name and value are required'
      });
    }

    if (!['counter', 'gauge', 'histogram', 'summary'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid metric type'
      });
    }

    metricsCollectionService.recordCustomMetric({
      name,
      value: Number(value),
      type,
      labels,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Custom metric recorded'
    });

  } catch (error) {
    log.error('Failed to create custom metric', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create custom metric'
    });
  }
});

/**
 * Clear metrics history
 */
router.delete('/metrics/history', (req, res) => {
  try {
    metricsCollectionService.clearHistory();
    
    res.json({
      success: true,
      message: 'Metrics history cleared'
    });

  } catch (error) {
    log.error('Failed to clear metrics history', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to clear metrics history'
    });
  }
});

/**
 * Clear logs from memory
 */
router.delete('/logs/memory', (req, res) => {
  try {
    enhancedLoggingService.clearMemoryLogs();
    
    res.json({
      success: true,
      message: 'Memory logs cleared'
    });

  } catch (error) {
    log.error('Failed to clear memory logs', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to clear memory logs'
    });
  }
});

export default router;