/**
 * Prometheus Middleware for Universal AI Tools
 * 
 * Integrates Prometheus metrics collection with our enhanced logging system
 * and provides specialized metrics for Sweet Athena interactions
 */
import { Request, Response, NextFunction } from 'express';
import { metricsCollector, register } from '../utils/prometheus-metrics';
import { logger, LogContext } from '../utils/enhanced-logger';

// Extend Express Request type to include Prometheus data
declare global {
  namespace Express {
    interface Request {
      prometheusStartTime?: number;
      prometheusTimerEnd?: () => void;
    }
  }
}

export class PrometheusMiddleware {
  // Main Prometheus metrics middleware
  static metricsCollector() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      req.prometheusStartTime = startTime;

      // Override res.end to capture final metrics
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Extract request data
        const method = req.method;
        const route = PrometheusMiddleware.extractRoute(req);
        const statusCode = res.statusCode;
        const aiService = req.headers['x-ai-service'] as string || 'unknown';
        const requestSize = PrometheusMiddleware.getRequestSize(req);
        const responseSize = PrometheusMiddleware.getResponseSize(res);

        // Record HTTP metrics
        metricsCollector.recordHttpRequest(
          method,
          route,
          statusCode,
          duration,
          requestSize,
          responseSize,
          aiService
        );

        // Log metrics collection for debugging
        logger.debug('Prometheus metrics recorded', LogContext.PERFORMANCE, {
          method,
          route,
          status_code: statusCode,
          duration_ms: duration,
          ai_service: aiService,
          request_size: requestSize,
          response_size: responseSize
        });

        // Special handling for Sweet Athena metrics
        if (PrometheusMiddleware.isAthenaRequest(req)) {
          PrometheusMiddleware.recordAthenaMetrics(req, res, duration);
        }

        // Call original end method
        return originalEnd.apply(this, args);
      };

      next();
    };
  }

  // Sweet Athena specific metrics collection
  static athenaMetricsCollector() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (PrometheusMiddleware.isAthenaRequest(req)) {
        // Add Athena-specific metric recording to request
        req.recordAthenaInteraction = (
          interactionType: string,
          personalityMood: string,
          sweetnessLevel: number,
          responseTimeMs?: number
        ) => {
          const userId = req.headers['x-user-id'] as string || 'anonymous';
          const sessionId = req.headers['x-session-id'] as string || req.requestId || 'unknown';
          const model = req.body?.model || 'default';
          const actualResponseTime = responseTimeMs || (Date.now() - (req.prometheusStartTime || Date.now()));

          metricsCollector.recordAthenaInteraction(
            interactionType,
            personalityMood,
            userId,
            sessionId,
            actualResponseTime,
            sweetnessLevel,
            model
          );

          logger.info('Sweet Athena metrics recorded', LogContext.ATHENA, {
            interaction_type: interactionType,
            personality_mood: personalityMood,
            sweetness_level: sweetnessLevel,
            response_time_ms: actualResponseTime,
            user_id: userId,
            session_id: sessionId,
            model
          });
        };
      }

      next();
    };
  }

  // Database metrics middleware
  static databaseMetricsCollector() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add database metric recording to request
      req.recordDatabaseOperation = (
        table: string,
        operation: string,
        durationMs: number,
        error?: string
      ) => {
        metricsCollector.recordDatabaseOperation(table, operation, durationMs, error);
        
        logger.debug('Database metrics recorded', LogContext.DATABASE, {
          table,
          operation,
          duration_ms: durationMs,
          error,
          request_id: req.requestId
        });
      };

      next();
    };
  }

  // Memory metrics middleware
  static memoryMetricsCollector() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add memory metric recording to request
      req.recordMemoryOperation = (
        operationType: string,
        memoryType: string,
        durationMs: number,
        accuracy?: number
      ) => {
        const aiService = req.headers['x-ai-service'] as string || 'unknown';
        
        metricsCollector.recordMemoryOperation(
          operationType,
          memoryType,
          aiService,
          durationMs,
          accuracy
        );

        logger.debug('Memory metrics recorded', LogContext.MEMORY, {
          operation_type: operationType,
          memory_type: memoryType,
          duration_ms: durationMs,
          accuracy,
          ai_service: aiService,
          request_id: req.requestId
        });
      };

      next();
    };
  }

  // Security metrics middleware
  static securityMetricsCollector() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add security metric recording to request
      req.recordSecurityEvent = (eventType: string, severity: string) => {
        const sourceIp = req.ip || req.connection.remoteAddress || 'unknown';
        
        metricsCollector.recordSecurityEvent(eventType, severity, sourceIp);
        
        logger.info('Security metrics recorded', LogContext.SECURITY, {
          event_type: eventType,
          severity,
          source_ip: sourceIp,
          user_agent: req.get('User-Agent'),
          request_id: req.requestId
        });
      };

      next();
    };
  }

  // Test metrics middleware (for test environments)
  static testMetricsCollector() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (process.env.NODE_ENV === 'test' || req.headers['x-test-environment']) {
        req.recordTestExecution = (
          testSuite: string,
          testType: string,
          status: string,
          durationMs: number
        ) => {
          metricsCollector.recordTestExecution(testSuite, testType, status, durationMs);
          
          logger.debug('Test metrics recorded', LogContext.TEST, {
            test_suite: testSuite,
            test_type: testType,
            status,
            duration_ms: durationMs,
            request_id: req.requestId
          });
        };
      }

      next();
    };
  }

  // Metrics endpoint middleware
  static metricsEndpoint() {
    return async (req: Request, res: Response) => {
      try {
        const metrics = await metricsCollector.getMetrics();
        res.set('Content-Type', register.contentType);
        res.send(metrics);
        
        logger.debug('Prometheus metrics endpoint accessed', LogContext.PERFORMANCE, {
          request_id: req.requestId,
          ai_service: req.headers['x-ai-service'],
          source_ip: req.ip
        });
      } catch (error) {
        logger.error('Failed to generate Prometheus metrics', LogContext.PERFORMANCE, {
          error: error.message,
          request_id: req.requestId
        });
        
        res.status(500).json({
          error: 'Failed to generate metrics',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  // Health check endpoint with Prometheus integration
  static healthCheckEndpoint() {
    return async (req: Request, res: Response) => {
      try {
        const healthData = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          metrics_enabled: true,
          prometheus_registry: register.metrics ? 'active' : 'inactive'
        };

        // Update health metrics
        metricsCollector.recordTestExecution('health_check', 'endpoint', 'pass', 0);

        res.json(healthData);
        
        logger.debug('Health check endpoint accessed', LogContext.SYSTEM, {
          request_id: req.requestId,
          health_status: 'healthy',
          uptime: process.uptime()
        });
      } catch (error) {
        logger.error('Health check failed', LogContext.SYSTEM, {
          error: error.message,
          request_id: req.requestId
        });
        
        res.status(500).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  // Helper methods
  private static extractRoute(req: Request): string {
    // Extract meaningful route pattern
    const path = req.path || req.url || '/';
    
    // Replace IDs with patterns for better grouping
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-f0-9]{24}/g, '/:objectid');
  }

  private static getRequestSize(req: Request): number {
    const contentLength = req.get('Content-Length');
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    
    // Estimate size from body if available
    if (req.body) {
      try {
        return JSON.stringify(req.body).length;
      } catch {
        return 0;
      }
    }
    
    return 0;
  }

  private static getResponseSize(res: Response): number {
    const contentLength = res.get('Content-Length');
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    
    // Estimate from response data if available
    return 0; // Would need to capture response body to calculate accurately
  }

  private static isAthenaRequest(req: Request): boolean {
    return req.path.includes('/athena') || 
           req.path.includes('/assistant') || 
           req.path.includes('/conversation') ||
           req.headers['x-ai-service'] === 'sweet-athena';
  }

  private static recordAthenaMetrics(req: Request, res: Response, duration: number) {
    try {
      const interactionType = req.body?.interaction_type || 
                             req.query.interaction_type as string || 
                             PrometheusMiddleware.inferInteractionType(req.path);
      
      const personalityMood = req.body?.personality_mood || 
                             req.query.personality_mood as string || 
                             'sweet';
      
      const sweetnessLevel = req.body?.sweetness_level || 
                           req.query.sweetness_level as number || 
                           8;

      const userId = req.headers['x-user-id'] as string || 'anonymous';
      const sessionId = req.headers['x-session-id'] as string || req.requestId || 'unknown';
      const model = req.body?.model || 'default';

      metricsCollector.recordAthenaInteraction(
        interactionType,
        personalityMood,
        userId,
        sessionId,
        duration,
        sweetnessLevel,
        model
      );

      logger.info('Athena interaction metrics recorded automatically', LogContext.ATHENA, {
        interaction_type: interactionType,
        personality_mood: personalityMood,
        sweetness_level: sweetnessLevel,
        duration_ms: duration,
        status_code: res.statusCode
      });
    } catch (error) {
      logger.error('Failed to record Athena metrics', LogContext.ATHENA, {
        error: error.message,
        request_id: req.requestId
      });
    }
  }

  private static inferInteractionType(path: string): string {
    if (path.includes('/chat')) return 'conversation';
    if (path.includes('/avatar')) return 'avatar_animation';
    if (path.includes('/teach')) return 'teach_me';
    if (path.includes('/memory')) return 'memory_access';
    return 'general';
  }
}

// Extend Express Request interface
declare module 'express-serve-static-core' {
  interface Request {
    recordAthenaInteraction?: (
      interactionType: string,
      personalityMood: string,
      sweetnessLevel: number,
      responseTimeMs?: number
    ) => void;
    recordDatabaseOperation?: (
      table: string,
      operation: string,
      durationMs: number,
      error?: string
    ) => void;
    recordMemoryOperation?: (
      operationType: string,
      memoryType: string,
      durationMs: number,
      accuracy?: number
    ) => void;
    recordSecurityEvent?: (
      eventType: string,
      severity: string
    ) => void;
    recordTestExecution?: (
      testSuite: string,
      testType: string,
      status: string,
      durationMs: number
    ) => void;
  }
}

export default PrometheusMiddleware;