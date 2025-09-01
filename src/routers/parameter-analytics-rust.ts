/**
 * Parameter Analytics Rust Service REST API Router
 * 
 * High-performance analytics endpoints powered by Rust backend
 * Delivering 10-50x performance improvements for parameter analysis
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, query, validationResult } from 'express-validator';
import { getParameterAnalyticsRustService, ParameterAnalyticsRustIntegration } from '../services/parameter-analytics-rust-integration';
import { log, LogContext } from '../utils/logger';
import type { 
  ParameterExecution, 
  EffectivenessFilter, 
  TaskType, 
  PerformanceTestConfig 
} from '../services/parameter-analytics-service';

const router = express.Router();

// Rate limiting for analytics endpoints
const analyticsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 analytics operations per minute per IP
  message: 'Too many analytics requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

const performanceTestRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  max: 10, // 10 performance tests per minute per IP
  message: 'Too many performance test requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
router.use(analyticsRateLimit);

/**
 * Health check endpoint
 * GET /api/v1/parameter-analytics-rust/health
 */
router.get('/health', async (req, res) => {
  try {
    const service = await getParameterAnalyticsRustService();
    const health = await service.healthCheck();
    
    const statusCode = health.healthy ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    log.error('Health check failed:', error, LogContext.API);
    res.status(503).json({
      healthy: false,
      status: 'error',
      service: 'parameter-analytics-rust-service',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable'
    });
  }
});

/**
 * Process parameter execution
 * POST /api/v1/parameter-analytics-rust/execution
 */
router.post('/execution', [
  body('id').isUUID().withMessage('Valid execution ID required'),
  body('taskType').isString().notEmpty().withMessage('Task type is required'),
  body('userInput').isString().notEmpty().withMessage('User input is required'),
  body('parameters').isObject().withMessage('Parameters object is required'),
  body('model').isString().notEmpty().withMessage('Model name is required'),
  body('provider').isString().notEmpty().withMessage('Provider name is required'),
  body('requestId').isString().notEmpty().withMessage('Request ID is required'),
  body('timestamp').isISO8601().withMessage('Valid timestamp required'),
  body('executionTime').isNumeric().withMessage('Execution time must be numeric'),
  body('tokenUsage').isObject().withMessage('Token usage object is required'),
  body('responseLength').isNumeric().withMessage('Response length must be numeric'),
  body('success').isBoolean().withMessage('Success flag must be boolean'),
  body('retryCount').isNumeric().withMessage('Retry count must be numeric'),
  body('complexity').isIn(['simple', 'medium', 'complex']).withMessage('Invalid complexity level'),
  body('endpoint').isString().notEmpty().withMessage('Endpoint is required')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const service = await getParameterAnalyticsRustService();
    const execution: ParameterExecution = req.body;
    
    const startTime = performance.now();
    const result = await service.processExecution(execution);
    const duration = performance.now() - startTime;
    
    log.info(`Processed execution ${execution.id} in ${duration.toFixed(2)}ms`, LogContext.API);
    
    res.json({
      success: true,
      result,
      processingTimeMs: duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log.error('Failed to process execution:', error, LogContext.API);
    res.status(500).json({
      success: false,
      error: 'Failed to process execution',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get parameter effectiveness metrics  
 * POST /api/v1/parameter-analytics-rust/effectiveness
 */
router.post('/effectiveness', [
  body('taskTypes').optional().isArray().withMessage('Task types must be an array'),
  body('models').optional().isArray().withMessage('Models must be an array'),
  body('providers').optional().isArray().withMessage('Providers must be an array'),
  body('complexity').optional().isArray().withMessage('Complexity must be an array'),
  body('timeRange').optional().isObject().withMessage('Time range must be an object'),
  body('minExecutions').optional().isNumeric().withMessage('Min executions must be numeric'),
  body('minConfidence').optional().isFloat({ min: 0, max: 1 }).withMessage('Min confidence must be between 0 and 1')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const service = await getParameterAnalyticsRustService();
    const filter: EffectivenessFilter = req.body;
    
    const startTime = performance.now();
    const effectiveness = await service.getEffectiveness(filter);
    const duration = performance.now() - startTime;
    
    log.info(`Retrieved ${effectiveness.length} effectiveness metrics in ${duration.toFixed(2)}ms`, LogContext.API);
    
    res.json({
      success: true,
      result: effectiveness,
      count: effectiveness.length,
      processingTimeMs: duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log.error('Failed to get effectiveness metrics:', error, LogContext.API);
    res.status(500).json({
      success: false,
      error: 'Failed to get effectiveness metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate optimization insights
 * POST /api/v1/parameter-analytics-rust/insights
 */
router.post('/insights', [
  body('taskType').isString().notEmpty().withMessage('Task type is required')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const service = await getParameterAnalyticsRustService();
    const taskType: TaskType = req.body.taskType;
    
    const startTime = performance.now();
    const insights = await service.generateInsights(taskType);
    const duration = performance.now() - startTime;
    
    log.info(`Generated ${insights.length} insights for ${taskType} in ${duration.toFixed(2)}ms`, LogContext.API);
    
    res.json({
      success: true,
      result: insights,
      count: insights.length,
      processingTimeMs: duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log.error('Failed to generate insights:', error, LogContext.API);
    res.status(500).json({
      success: false,
      error: 'Failed to generate insights',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get real-time analytics snapshot
 * GET /api/v1/parameter-analytics-rust/analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const service = await getParameterAnalyticsRustService();
    
    const startTime = performance.now();
    const analytics = await service.getAnalytics();
    const duration = performance.now() - startTime;
    
    log.info(`Retrieved analytics snapshot in ${duration.toFixed(2)}ms`, LogContext.API);
    
    res.json({
      success: true,
      result: analytics,
      processingTimeMs: duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log.error('Failed to get analytics:', error, LogContext.API);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics snapshot',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Performance test endpoint
 * POST /api/v1/parameter-analytics-rust/performance-test
 */
router.post('/performance-test', performanceTestRateLimit, [
  body('testType').isIn(['simple', 'complex']).withMessage('Test type must be simple or complex'),
  body('operations').isInt({ min: 1, max: 10000 }).withMessage('Operations must be between 1 and 10000'),
  body('taskType').isString().notEmpty().withMessage('Task type is required')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const service = await getParameterAnalyticsRustService();
    const config: PerformanceTestConfig = req.body;
    
    log.info(`Starting ${config.testType} performance test with ${config.operations} operations`, LogContext.API);
    
    const result = await service.performanceTest(config);
    
    log.info(`Performance test completed: ${result.throughputOpsPerSec.toFixed(0)} ops/sec, ${result.avgLatencyMs.toFixed(2)}ms avg latency`, LogContext.API);
    
    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log.error('Performance test failed:', error, LogContext.API);
    res.status(500).json({
      success: false,
      error: 'Performance test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Service version information
 * GET /api/v1/parameter-analytics-rust/version
 */
router.get('/version', async (req, res) => {
  try {
    const service = await getParameterAnalyticsRustService();
    const versionInfo = service.getVersion();
    
    res.json({
      success: true,
      version: JSON.parse(versionInfo),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log.error('Failed to get version:', error, LogContext.API);
    res.json({
      success: false,
      version: {
        service: 'parameter-analytics-rust-service',
        version: '0.1.0',
        status: 'error'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Batch processing endpoint for multiple executions
 * POST /api/v1/parameter-analytics-rust/batch-execution
 */
router.post('/batch-execution', [
  body('executions').isArray({ min: 1, max: 100 }).withMessage('Executions must be an array with 1-100 items'),
  body('executions.*').isObject().withMessage('Each execution must be an object')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const service = await getParameterAnalyticsRustService();
    const executions: ParameterExecution[] = req.body.executions;
    
    const startTime = performance.now();
    const results = [];
    const errors = [];
    
    // Process executions in parallel batches
    const batchSize = 10;
    for (let i = 0; i < executions.length; i += batchSize) {
      const batch = executions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (execution, index) => {
        try {
          const result = await service.processExecution(execution);
          return { index: i + index, success: true, result };
        } catch (error) {
          return { 
            index: i + index, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const batchResult of batchResults) {
        if (batchResult.success) {
          results.push(batchResult.result);
        } else {
          errors.push({
            index: batchResult.index,
            error: batchResult.error
          });
        }
      }
    }
    
    const duration = performance.now() - startTime;
    const successRate = results.length / executions.length;
    
    log.info(`Batch processed ${executions.length} executions in ${duration.toFixed(2)}ms (${successRate * 100}% success rate)`, LogContext.API);
    
    res.json({
      success: true,
      results,
      errors,
      totalProcessed: executions.length,
      successfulProcessed: results.length,
      successRate,
      processingTimeMs: duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log.error('Batch execution failed:', error, LogContext.API);
    res.status(500).json({
      success: false,
      error: 'Batch execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Statistics endpoint for service metrics
 * GET /api/v1/parameter-analytics-rust/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const service = await getParameterAnalyticsRustService();
    const health = await service.healthCheck();
    
    // Build comprehensive statistics
    const stats = {
      serviceStatus: health.healthy ? 'operational' : 'degraded',
      totalProcessed: health.totalProcessed,
      processingQueueSize: health.processingQueueSize,
      cacheConnected: health.cacheConnected,
      databaseConnected: health.databaseConnected,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      rustyProcessingAvailable: await service.isHealthy(),
    };
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log.error('Failed to get service stats:', error, LogContext.API);
    res.status(500).json({
      success: false,
      error: 'Failed to get service statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware specific to this router
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  log.error('Parameter Analytics Rust API Error:', error, LogContext.API);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error in Parameter Analytics Rust service',
    message: error.message || 'Unknown error',
    timestamp: new Date().toISOString()
  });
});

export default router;