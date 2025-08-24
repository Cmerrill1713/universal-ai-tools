/**
 * Request Metrics Middleware
 * Automatically captures request/response metrics for monitoring
 */

import type { NextFunction,Request, Response } from 'express';
import { performance } from 'perf_hooks';

import { distributedTracingService } from '@/services/monitoring/distributed-tracing-service';
import { metricsCollectionService } from '@/services/monitoring/metrics-collection-service';
import { log, LogContext } from '@/utils/logger';

export interface ExtendedRequest extends Request {
  startTime?: number;
  requestId?: string;
  userId?: string;
  traceSpan?: any;
  traceContext?: any;
}

export interface ExtendedResponse extends Response {
  metrics?: {
    startTime: number;
    endTime?: number;
    duration?: number;
    contentLength?: number;
  };
}

/**
 * Enhanced request metrics middleware that integrates with monitoring services
 */
export function requestMetricsMiddleware() {
  return (req: ExtendedRequest, res: ExtendedResponse, next: NextFunction) => {
    const startTime = performance.now();
    req.startTime = startTime;
    req.requestId = generateRequestId();

    // Initialize response metrics
    res.metrics = {
      startTime,
    };

    // Extract user ID from various sources
    const userId = extractUserId(req);
    if (userId) {
      req.userId = userId;
    }

    // Extract trace context from headers and start tracing
    const parentContext = distributedTracingService.extractFromHeaders(req.headers);
    const span = distributedTracingService.startTrace(
      `${req.method} ${req.path}`,
      parentContext || undefined
    );

    // Add request tags to span
    span.tags = {
      'http.method': req.method,
      'http.url': req.originalUrl || req.url,
      'http.user_agent': req.get('User-Agent'),
      'http.remote_addr': req.ip || req.connection?.remoteAddress,
      'http.request_size': req.get('Content-Length') || 0,
      'user.id': userId,
      'request.id': req.requestId
    };

    // Store span in request for later access
    req.traceSpan = span;
    req.traceContext = distributedTracingService.getCurrentContext();

    // Inject trace headers for downstream services
    const traceHeaders = distributedTracingService.injectIntoHeaders();
    Object.assign(req.headers, traceHeaders);

    // Hook into response to capture metrics
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    res.send = function(body: any) {
      captureResponseMetrics(req, res, body);
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      captureResponseMetrics(req, res, JSON.stringify(body));
      return originalJson.call(this, body);
    };

    res.end = function(chunk?: any, encoding?: any) {
      if (chunk) {
        captureResponseMetrics(req, res, chunk);
      } else {
        captureResponseMetrics(req, res);
      }
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Capture response metrics and finalize tracing
 */
function captureResponseMetrics(
  req: ExtendedRequest,
  res: ExtendedResponse,
  body?: any
): void {
  const endTime = performance.now();
  const duration = endTime - (req.startTime || endTime);

  // Update response metrics
  if (res.metrics) {
    res.metrics.endTime = endTime;
    res.metrics.duration = duration;
    res.metrics.contentLength = body ? Buffer.byteLength(body, 'utf8') : 0;
  }

  // Record request metrics
  try {
    metricsCollectionService.recordRequest({
      method: req.method,
      path: req.path || req.url,
      statusCode: res.statusCode,
      responseTime: duration,
      timestamp: new Date(),
      userId: req.userId,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection?.remoteAddress,
      contentLength: res.metrics?.contentLength,
      errorMessage: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined
    });
  } catch (error) {
    log.error('Failed to record request metrics', LogContext.MONITORING, { error });
  }

  // Update trace span
  if (req.traceSpan) {
    try {
      req.traceSpan.tags['http.status_code'] = res.statusCode;
      req.traceSpan.tags['http.response_size'] = res.metrics?.contentLength || 0;
      req.traceSpan.tags['request.duration'] = duration;

      if (res.statusCode >= 400) {
        req.traceSpan.status = 'error';
        req.traceSpan.tags.error = true;
        req.traceSpan.tags.errorMessage = `HTTP ${res.statusCode}`;

        // Log error to span
        distributedTracingService.logToSpan(
          'error',
          `Request failed with status ${res.statusCode}`,
          {
            statusCode: res.statusCode,
            path: req.path,
            method: req.method
          }
        );
      }

      distributedTracingService.finishSpan(req.traceSpan.spanId);
    } catch (error) {
      log.error('Failed to update trace span', LogContext.MONITORING, { error });
    }
  }

  // Log request completion
  const logLevel = res.statusCode >= 500 ? 'error' : 
                   res.statusCode >= 400 ? 'warn' : 'info';

  log[logLevel](`${req.method} ${req.path} ${res.statusCode}`, LogContext.API, {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: Math.round(duration * 100) / 100,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.userId,
    requestId: req.requestId,
    traceId: req.traceContext?.traceId
  });

  // Record custom metrics for slow requests
  if (duration > 5000) { // 5 seconds
    metricsCollectionService.incrementCounter(
      'slow_requests_total',
      1,
      {
        method: req.method,
        path: req.path,
        status_code: res.statusCode.toString()
      }
    );
  }

  // Record error metrics
  if (res.statusCode >= 400) {
    metricsCollectionService.incrementCounter(
      'http_requests_errors_total',
      1,
      {
        method: req.method,
        path: req.path,
        status_code: res.statusCode.toString()
      }
    );
  }

  // Record response time histogram
  metricsCollectionService.recordHistogram(
    'http_request_duration_ms',
    duration,
    {
      method: req.method,
      path: req.path,
      status_code: res.statusCode.toString()
    }
  );
}

/**
 * Extract user ID from request
 */
function extractUserId(req: ExtendedRequest): string | undefined {
  // Try various sources for user ID
  if (req.user && typeof req.user === 'object') {
    const user = req.user as any;
    return user.id || user.userId || user._id || user.sub;
  }

  // Check headers
  const authHeader = req.get('Authorization');
  if (authHeader) {
    // Extract from JWT token (simplified)
    try {
      const token = authHeader.replace('Bearer ', '');
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1] || '', 'base64').toString());
        return payload.sub || payload.userId || payload.id;
      }
    } catch (error) {
      // Invalid token, continue
    }
  }

  // Check custom headers
  return req.get('X-User-ID') || req.get('X-UserID');
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Middleware to track API endpoint usage
 */
export function apiUsageMiddleware() {
  return (req: ExtendedRequest, res: ExtendedResponse, next: NextFunction) => {
    // Track API endpoint usage
    metricsCollectionService.incrementCounter(
      'api_endpoint_requests_total',
      1,
      {
        method: req.method,
        path: req.path || req.url,
        version: req.get('API-Version') || 'v1'
      }
    );

    // Track user activity if available
    if (req.userId) {
      metricsCollectionService.incrementCounter(
        'user_requests_total',
        1,
        {
          user_id: req.userId,
          endpoint: req.path || req.url
        }
      );
    }

    next();
  };
}

/**
 * Middleware to track business metrics
 */
export function businessMetricsMiddleware() {
  return (req: ExtendedRequest, res: ExtendedResponse, next: NextFunction) => {
    // Track agent-related requests
    if (req.path?.includes('/agent') || req.path?.includes('/chat')) {
      metricsCollectionService.incrementCounter(
        'agent_requests_total',
        1,
        {
          agent_type: extractAgentType(req),
          user_id: req.userId || 'anonymous'
        }
      );
    }

    // Track model usage
    if (req.path?.includes('/models') || req.body?.model) {
      const model = req.body?.model || extractModelFromPath(req.path);
      if (model) {
        metricsCollectionService.incrementCounter(
          'model_requests_total',
          1,
          {
            model,
            provider: extractProviderFromModel(model)
          }
        );
      }
    }

    next();
  };
}

/**
 * Extract agent type from request
 */
function extractAgentType(req: ExtendedRequest): string {
  if (req.path?.includes('/enhanced')) {return 'enhanced';}
  if (req.path?.includes('/synthesizer')) {return 'synthesizer';}
  if (req.path?.includes('/cognitive')) {return 'cognitive';}
  if (req.body?.agentType) {return req.body.agentType;}
  return 'default';
}

/**
 * Extract model from path
 */
function extractModelFromPath(path?: string): string | undefined {
  if (!path) {return undefined;}
  
  const modelMatch = path.match(/\/models\/([^\/]+)/);
  return modelMatch ? modelMatch[1] : undefined;
}

/**
 * Extract provider from model name
 */
function extractProviderFromModel(model: string): string {
  if (model.includes('ollama')) {return 'ollama';}
  if (model.includes('lfm2')) {return 'lfm2';}
  if (model.includes('claude')) {return 'claude';}
  if (model.includes('gpt')) {return 'openai';}
  return 'unknown';
}

/**
 * Error tracking middleware
 */
export function errorTrackingMiddleware() {
  return (error: Error, req: ExtendedRequest, res: ExtendedResponse, next: NextFunction) => {
    // Record error metrics
    metricsCollectionService.incrementCounter(
      'application_errors_total',
      1,
      {
        error_type: error.name,
        endpoint: req.path || req.url,
        method: req.method
      }
    );

    // Add error to trace span
    if (req.traceSpan) {
      distributedTracingService.finishSpan(req.traceSpan.spanId, error);
    }

    // Log error with full context
    log.error('Request error', LogContext.API, {
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.userId,
      requestId: req.requestId,
      traceId: req.traceContext?.traceId
    });

    next(error);
  };
}

/**
 * Performance monitoring middleware for specific operations
 */
export function performanceMiddleware(operationName: string) {
  return (req: ExtendedRequest, res: ExtendedResponse, next: NextFunction) => {
    const startTime = performance.now();

    // Hook into response to measure operation time
    const originalSend = res.send;
    res.send = function(body: any) {
      const duration = performance.now() - startTime;
      
      // Record operation performance
      metricsCollectionService.recordHistogram(
        'operation_duration_ms',
        duration,
        {
          operation: operationName,
          status: res.statusCode >= 400 ? 'error' : 'success'
        }
      );

      // Track slow operations
      if (duration > 1000) { // 1 second
        metricsCollectionService.incrementCounter(
          'slow_operations_total',
          1,
          {
            operation: operationName,
            threshold: '1s'
          }
        );
      }

      return originalSend.call(this, body);
    };

    next();
  };
}