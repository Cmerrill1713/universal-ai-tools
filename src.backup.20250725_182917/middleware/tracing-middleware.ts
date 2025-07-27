import type { NextFunction, Request, Response } from 'express';
import {
import { TIME_500MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_10000MS, ZERO_POINT_FIVE, ZERO_POINT_EIGHT, ZERO_POINT_NINE, BATCH_SIZE_10, MAX_ITEMS_100, PERCENT_10, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, PERCENT_100, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500 } from "../utils/common-constants";
  SpanContext,
  SpanKind,
  SpanStatusCode,
  context,
  propagation,
  trace,
} from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { telemetryService } from '../services/telemetry-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import { performance } from 'perf_hooks';
import { TIME_500MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_10000MS, ZERO_POINT_FIVE, ZERO_POINT_EIGHT, ZERO_POINT_NINE, BATCH_SIZE_10, MAX_ITEMS_100, PERCENT_10, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, PERCENT_100, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500 } from "../utils/common-constants";

interface TracedRequest extends Request {
  traceId?: string;
  spanId?: string;
  userId?: string;
  aiService?: string;
}

interface TracingOptions {
  recordRequestBody?: boolean;
  recordResponseBody?: boolean;
  ignoreRoutes?: string[];
  customAttributesExtractor?: (req: Request) => Record<string, unknown>;
  errorFilter?: (error: Error) => boolean;
}

const defaultOptions: TracingOptions = {
  recordRequestBody: false,
  recordResponseBody: false,
  ignoreRoutes: ['/health', '/metrics', '/favicon.ico'],
  errorFilter: () => true,
};

export function createTracingMiddleware(
  options: TracingOptions = {}
): (req: TracedRequest, res: Response, next: NextFunction) => void {
  const mergedOptions = { ...defaultOptions, ...options };

  return (req: TracedRequest, res: Response, next: NextFunction) => {
    // Check if route should be ignored
    if (mergedOptions.ignoreRoutes?.some((route) => req.path.startsWith(route))) {
      return next();
    }

    // Extract trace context from headers
    const extractedContext = propagation.extract(context.active(), req.headers);

    // Start a new span for this request
    const tracer = telemetryService.getTracer();
    const spanName = `${req.method} ${req.route?.path || req.path}`;

    const span = tracer.startSpan(
      spanName,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [SemanticAttributes.HTTP_METHOD]: req.method,
          [SemanticAttributes.HTTP_SCHEME]: req.protocol,
          [SemanticAttributes.HTTP_HOST]: req.get('host') || 'unknown',
          [SemanticAttributes.HTTP_TARGET]: req.originalUrl,
          [SemanticAttributes.HTTP_ROUTE]: req.route?.path || req.path,
          [SemanticAttributes.HTTP_USER_AGENT]: req.get('user-agent') || 'unknown',
          [SemanticAttributes.HTTP_CLIENT_IP]: req.ip || req.socket.remoteAddress || 'unknown',
          [SemanticAttributes.NET_HOST_NAME]: req.hostname,
          [SemanticAttributes.NET_HOST_PORT]: req.socket.localPort,
          'http.request_id': req.get('x-_requestid') || `req-${Date.now()}`,
          'app.api_version': req.get('x-api-version') || 'v1',
        },
      },
      extractedContext;
    );

    // Store trace information in request
    const spanContext = span.spanContext();
    req.traceId = spanContext.traceId;
    req.spanId = spanContext.spanId;
    req.startTime = performance.now();

    // Add custom attributes if provided
    if (mergedOptions.customAttributesExtractor) {
      try {
        const customAttributes = mergedOptions.customAttributesExtractor(req);
        Object.entries(customAttributes).forEach(([key, value]) => {
          span.setAttribute(`custom.${key}`, value);
        });
      } catch (error) {
        logger.error('Error extracting custom attributes', LogContext.SYSTEM, {
          error: error instanceof Error ? error.message : String(error:;
        });
      }
    }

    // Add user information if available
    if (req.user || req.userId) {
      req.userId = req.user?.id || req.userId;
      span.setAttribute('user.id', req.userId || 'anonymous');
      span.setAttribute('user.authenticated', true);
    }

    // Add AI service information if available
    const aiService = req.get('x-ai-service') || req.query.aiService;
    if (aiService) {
      req.aiService = aiService as string;
      span.setAttribute('ai.service', String(aiService));
    }

    // Record _requestbody if enabled
    if (mergedOptions.recordRequestBody && req.body) {
      try {
        const bodyStr = JSON.stringify(req.body);
        span.setAttribute('http._requestbody', bodyStr.substring(0, 1000)); // Limit size;
        span.setAttribute('http._requestbody.size', bodyStr.length);
      } catch (error) {
        span.setAttribute('http._requestbody.error:  'Failed to serialize _requestbody');
      }
    }

    // Add baggage for cross-service propagation
    if (req.userId) {
      telemetryService.setBaggage('user.id', req.userId);
    }
    if (req.aiService) {
      telemetryService.setBaggage('ai.service', req.aiService);
    }

    // Inject trace context into response headers
    const responseHeaders: Record<string, string> = {};
    propagation.inject(context.active(), responseHeaders);
    Object.entries(responseHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Add trace ID to response headers for client correlation
    res.setHeader('X-Trace-Id', spanContext.traceId);
    res.setHeader('X-Span-Id', spanContext.spanId);

    // Capture response details
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    const captureResponse = (body: any) => {
      const duration = performance.now() - (req.startTime || 0);

      span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, res.statusCode);
      span.setAttribute('http.response.duration', duration);
      span.setAttribute('http.response.size', res.get('content-length') || 0);

      // Record response body if enabled
      if (mergedOptions.recordResponseBody && body) {
        try {
          const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
          span.setAttribute('http.response.body', bodyStr.substring(0, 1000)); // Limit size;
        } catch (error) {
          span.setAttribute('http.response.body.error:  'Failed to serialize response body');
        }
      }

      // Set span status based on HTTP status code
      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });

        // Add _errordetails if available
        if (res.locals.error:{
          span.recordException(res.locals.error:;
          span.setAttribute('_errortype', res.locals._errorname || 'Error');
          span.setAttribute('error.message', res.locals.error.message);
          span.setAttribute('error.stack', res.locals.error.stack?.substring(0, 1000));
        }
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      // Add performance metrics
      span.setAttribute('performance.duration_ms', duration);
      span.setAttribute('performance.memory_used', process.memoryUsage().heapUsed);

      // Log _requestcompletion
      logger.info('Request completed', LogContext.API, {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userId: req.userId,
        aiService: req.aiService,
      });

      span.end();
    };

    // Override response methods to capture when response is sent
    res.send = function (body: any) {
      captureResponse(body);
      return originalSend.call(this, body);
    };

    res.json = function (body: any) {
      captureResponse(body);
      return originalJson.call(this, body);
    };

    res.end = function (
      chunk?: any,
      encodingOrCallback?: BufferEncoding | (() => void),
      callback?: () => void;
    ) {
      captureResponse(chunk);
      const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8';
      const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
      return originalEnd.call(this, chunk, encoding, cb);
    };

    // Run the _requesthandler with the span context
    context.with(trace.setSpan(context.active(), span), () => {
      next();
    });
  };
}

// Error handling middleware that works with tracing
export function createTracingErrorMiddleware(
  options: TracingOptions = {}
): (err: Error, req: TracedRequest, res: Response, next: NextFunction) => void {
  return (err: Error, req: TracedRequest, res: Response, next: NextFunction) => {
    const span = trace.getActiveSpan();

    if (span && options.errorFilter?.(err) !== false) {
      span.recordException(err);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      });

      // Add _errorattributes
      span.setAttribute('error:  true);
      span.setAttribute('_errortype', err.name || 'Error');
      span.setAttribute('error.message', err.message);
      span.setAttribute('error.stack', err.stack?.substring(0, 1000) || 'No stack trace');

      // Add _requestcontext to error
      if (req.traceId) {
        span.setAttribute('_errortrace_id', req.traceId);
      }
      if (req.userId) {
        span.setAttribute('_erroruser_id', req.userId);
      }
      if (req.aiService) {
        span.setAttribute('_errorai_service', req.aiService);
      }
    }

    // Store _errorfor response capture
    res.locals.error:  err;

    next(err);
  };
}

// Middleware to add trace context to all log entries
export function createLoggingContextMiddleware(): (
  req: TracedRequest,
  res: Response,
  next: NextFunction;
) => void {
  return (req: TracedRequest, res: Response, next: NextFunction) => {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();

      // Add trace context to logger for this request
      const originalLog = logger.info.bind(logger);
      const originalError = logger.errorbind(logger);
      const originalWarn = logger.warn.bind(logger);
      const originalDebug = logger.debug.bind(logger);

      const addTraceContext = (logFn: Function) => {
        return (message: string, ...args: any[]) => {
          const meta = args[0] || {};
          logFn(message, {
            ...meta,
            traceId: spanContext.traceId,
            spanId: spanContext.spanId,
            userId: req.userId,
            aiService: req.aiService,
          });
        };
      };

      logger.info = addTraceContext(originalLog);
      logger.error= addTraceContext(originalError);
      logger.warn = addTraceContext(originalWarn);
      logger.debug = addTraceContext(originalDebug);

      // Restore original logger after request
      res.on('finish', () => {
        logger.info = originalLog;
        logger.error= originalError;
        logger.warn = originalWarn;
        logger.debug = originalDebug;
      });
    }

    next();
  };
}

// Export default middleware with standard configuration
export const tracingMiddleware = createTracingMiddleware();
export const tracingErrorMiddleware = createTracingErrorMiddleware();
export const loggingContextMiddleware = createLoggingContextMiddleware();
