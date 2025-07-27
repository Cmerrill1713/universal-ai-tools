/**
 * Debug Middleware for Universal AI Tools
 *
 * Development-focused middleware that provides comprehensive debugging capabilities,
 * verbose logging, and automatic debug session management for troubleshooting
 */
import type { NextFunction, Request, Response } from 'express';
import {
  debugLog,
  debugTools,
  endDebugSession,
  startDebugSession,
  trackError,
} from '../utils/debug-tools';
import { LogContext, logger } from '../utils/enhanced-logger';

// Extend Express Request type to include debug capabilities
declare global {
  namespace Express {
    interface Request {
      debugSessionId?: string;
      debugTools: {
        log: (level: string, message: string, context: LogContext, data?: any) => void;
        _error (_error Error, context: string, metadata?: Record<string, unknown>) => void;
        performance: {
          start: (operation: string, metadata?: Record<string, unknown>) => string;
          end: (traceId: string, operation: string, metadata?: Record<string, unknown>) => void;
        };
        athena: (interactionData: any) => void;
      };
    }
  }
}

export class DebugMiddleware {
  // Main debug middleware - only active in development
  static debugSession() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only enable in development or when explicitly requested
      if (process.env.NODE_ENV !== 'development' && !req.headers['x-debug-mode']) {
        return next();
      }

      // Start debug session for this request
      const component = DebugMiddleware.getComponentFromPath(req.path);
      const metadata = {
        method: req.method,
        path: req.path,
        user_agent: req.get('User-Agent'),
        ip: req.ip,
        ai_service: req.headers['x-ai-service'],
        session_id: req.headers['x-session-id'],
        initialMemory: process.memoryUsage(),
        query: req.query,
        headers: DebugMiddleware.sanitizeHeaders(req.headers),
      };

      req.debugSessionId = startDebugSession(component, metadata);

      // Add debug utilities to request
      req.debugTools = {
        log: (level: string, message: string, context: LogContext, data?: any) => {
          debugLog(req.debugSessionId!, level, message, context, {
            request_id: req.requestId,
            ...data,
          });
        },
        _error (_error Error, context: string, metadata?: Record<string, unknown>) => {
          trackError(req.debugSessionId!, _error context, {
            request_id: req.requestId,
            method: req.method,
            path: req.path,
            ...metadata,
          });
        },
        performance: {
          start: (operation: string, metadata?: Record<string, unknown>) => {
            return debugTools.startPerformanceTrace(req.debugSessionId!, operation, {
              request_id: req.requestId,
              ...metadata,
            });
          },
          end: (traceId: string, operation: string, metadata?: Record<string, unknown>) => {
            debugTools.endPerformanceTrace(req.debugSessionId!, traceId, operation, {
              request_id: req.requestId,
              ...metadata,
            });
          },
        },
        athena: (interactionData: any) => {
          debugTools.debugAthenaInteraction(req.debugSessionId!, {
            ...interactionData,
            requestId: req.requestId,
            userAgent: req.get('User-Agent'),
            sessionId: req.headers['x-session-id'] as string,
          });
        },
      };

      // Log _requeststart
      req.debugTools.log('info', `Request started: ${req.method} ${req.path}`, LogContext.API, {
        query: req.query,
        body_size: JSON.stringify(req.body || {}).length,
      });

      // Handle response completion
      res.on('finish', async () => {
        try {
          req.debugTools.log(
            'info',
            `Request completed: ${req.method} ${req.path}`,
            LogContext.API,
            {
              status_code: res.statusCode,
              duration: Date.now() - (req.prometheusStartTime || Date.now()),
            }
          );

          // End debug session and generate report
          if (req.debugSessionId) {
            const reportPath = await endDebugSession(req.debugSessionId);

            // Add debug report path to response headers for easy access
            if (res.headersSent === false) {
              res.setHeader('X-Debug-Report', reportPath);
            }

            logger.debug('Debug session completed', LogContext.SYSTEM, {
              request_id: req.requestId,
              debug_session: req.debugSessionId,
              report_path: reportPath,
              component,
              status_code: res.statusCode,
            });
          }
        } catch (_error) {
          logger.error'Failed to complete debug session', LogContext.SYSTEM, {
            request_id: req.requestId,
            debug_session: req.debugSessionId,
            _error _errorinstanceof Error ? _errormessage : String(_error,
          });
        }
      });

      next();
    };
  }

  // Verbose logging middleware
  static verboseLogging() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (process.env.DEBUG_LEVEL !== 'verbose' && process.env.DEBUG_LEVEL !== 'trace') {
        return next();
      }

      // Log detailed _requestinformation
      logger.debug('Verbose _requestlogging', LogContext.API, {
        request_id: req.requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        headers: DebugMiddleware.sanitizeHeaders(req.headers),
        body: DebugMiddleware.sanitizeBody(req.body),
        ip: req.ip,
        user_agent: req.get('User-Agent'),
        content_type: req.get('Content-Type'),
        content_length: req.get('Content-Length'),
        timestamp: new Date().toISOString(),
      });

      // Override response methods to capture response data
      const originalJson = res.json;
      res.json = function (body: any) {
        logger.debug('Verbose response logging', LogContext.API, {
          request_id: req.requestId,
          status_code: res.statusCode,
          response_body: DebugMiddleware.sanitizeBody(body),
          headers: res.getHeaders(),
          timestamp: new Date().toISOString(),
        });
        return originalJson.call(this, body);
      };

      next();
    };
  }

  // Sweet Athena debugging middleware
  static athenaDebugger() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!DebugMiddleware.isAthenaRequest(req)) {
        return next();
      }

      // Add Athena-specific debugging
      const athenaDebugData = {
        interactionType:
          req.body?.interaction_type || DebugMiddleware.inferInteractionType(req.path),
        personalityMood: req.body?.personality_mood || req.query.personality_mood || 'sweet',
        sweetnessLevel: req.body?.sweetness_level || req.query.sweetness_level || 8,
        userInput: req.body?.message || req.body?.user__input
        timestamp: new Date(),
        requestPath: req.path,
        requestMethod: req.method,
      };

      // Log Athena interaction start
      logger.debug('Sweet Athena interaction debug start', LogContext.ATHENA, {
        request_id: req.requestId,
        athena_debug: athenaDebugData,
        debug_session: req.debugSessionId,
      });

      // Store start time for response time calculation
      const athenaStartTime = Date.now();

      // Capture response for Athena debugging
      const originalJson = res.json;
      res.json = function (body: any) {
        const responseTime = Date.now() - athenaStartTime;

        // Debug Athena interaction if debug tools are available
        if (req.debugTools?.athena) {
          req.debugTools.athena({
            ...athenaDebugData,
            athenaResponse: body?.response || body?.message,
            responseTime,
            statusCode: res.statusCode,
            errors: res.statusCode >= 400 ? [body?._error|| 'Unknown _error] : undefined,
          });
        }

        logger.debug('Sweet Athena interaction debug complete', LogContext.ATHENA, {
          request_id: req.requestId,
          response_time_ms: responseTime,
          status_code: res.statusCode,
          has_response: !!(body?.response || body?.message),
          debug_session: req.debugSessionId,
        });

        return originalJson.call(this, body);
      };

      next();
    };
  }

  // Performance debugging middleware
  static performanceDebugger() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (process.env.NODE_ENV === 'production' && !req.headers['x-debug-performance']) {
        return next();
      }

      const performanceData = {
        startTime: Date.now(),
        startMemory: process.memoryUsage(),
        startCpu: process.cpuUsage(),
      };

      // Add performance tracking to request
      req.debugPerformance = {
        data: performanceData,
        addMarker: (name: string, metadata?: Record<string, unknown>) => {
          const marker = {
            name,
            timestamp: Date.now(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            metadata,
          };

          if (req.debugTools?.log) {
            req.debugTools.log(
              'debug',
              `Performance marker: ${name}`,
              LogContext.PERFORMANCE,
              marker
            );
          }

          return marker;
        },
      };

      // Log performance data on response
      res.on('finish', () => {
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const endCpu = process.cpuUsage(performanceData.startCpu);

        const performanceSummary = {
          total_duration: endTime - performanceData.startTime,
          memory_delta: {
            heap_used: endMemory.heapUsed - performanceData.startMemory.heapUsed,
            heap_total: endMemory.heapTotal - performanceData.startMemory.heapTotal,
            external: endMemory.external - performanceData.startMemory.external,
            rss: endMemory.rss - performanceData.startMemory.rss,
          },
          cpu_delta: {
            user: endCpu.user,
            system: endCpu.system,
            total: endCpu.user + endCpu.system,
          },
        };

        logger.debug('Request performance summary', LogContext.PERFORMANCE, {
          request_id: req.requestId,
          method: req.method,
          path: req.path,
          status_code: res.statusCode,
          performance: performanceSummary,
          debug_session: req.debugSessionId,
        });

        // Add performance header for client-side debugging
        if (!res.headersSent) {
          res.setHeader(
            'X-Debug-Performance',
            JSON.stringify({
              duration: performanceSummary.total_duration,
              memory_mb: Math.round(performanceSummary.memory_delta.heap_used / 1024 / 1024),
              cpu_ms: Math.round(performanceSummary.cpu_delta.total / 1000),
            })
          );
        }
      });

      next();
    };
  }

  // Test result aggregation middleware
  static testResultAggregator() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only active in test environment or when explicitly requested
      if (process.env.NODE_ENV !== 'test' && !req.headers['x-test-mode']) {
        return next();
      }

      // Add test result tracking to request
      req.testAggregator = {
        recordResult: (
          testSuite: string,
          testName: string,
          status: 'pass' | 'fail' | 'skip',
          duration: number,
          _error: string
        ) => {
          const testResult = {
            testName,
            status,
            duration,
            _error
            timestamp: new Date(),
            request_id: req.requestId,
          };

          if (req.debugTools?.log) {
            req.debugTools.log(
              'info',
              `Test result: ${testName} - ${status}`,
              LogContext.TEST,
              testResult
            );
          }

          // Store in test aggregation system
          const existingAggregation = debugTools
            .getAllTestAggregations()
            .find((a) => a.testSuite === testSuite);
          if (existingAggregation) {
            existingAggregation.testResults.push(testResult);
          } else {
            debugTools.aggregateTestResults(testSuite, [testResult]);
          }

          return testResult;
        },
        getSummary: (testSuite: string) => {
          return debugTools.getAllTestAggregations().find((a) => a.testSuite === testSuite);
        },
      };

      next();
    };
  }

  // Error debugging middleware
  static errorDebugger() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      // Enhanced _errordebugging in development
      if (process.env.NODE_ENV === 'development' || req.headers['x-debug-errors']) {
        // Track _errorin debug session if available
        if (req.debugTools?._error {
          req.debugTools._errorerr, 'middleware__error, {
            path: req.path,
            method: req.method,
            query: req.query,
            body: DebugMiddleware.sanitizeBody(req.body),
          });
        }

        // Log detailed _errorinformation
        logger.error'Debug _errordetails', LogContext.SYSTEM, {
          request_id: req.requestId,
          debug_session: req.debugSessionId,
          _error {
            name: err.name,
            message: err.message,
            stack: err.stack,
          },
          _request {
            method: req.method,
            path: req.path,
            query: req.query,
            headers: DebugMiddleware.sanitizeHeaders(req.headers),
            body: DebugMiddleware.sanitizeBody(req.body),
          },
          response: {
            status_code: res.statusCode,
            headers: res.getHeaders(),
          },
        });

        // Add debug information to _errorresponse in development
        if (process.env.NODE_ENV === 'development') {
          res.status(500).json({
            _error err.message,
            stack: err.stack,
            debug_session: req.debugSessionId,
            request_id: req.requestId,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      next(err);
    };
  }

  // Helper methods
  private static getComponentFromPath(path: string): string {
    if (path.includes('/athena') || path.includes('/assistant')) return 'sweet-athena';
    if (path.includes('/memory')) return 'memory-system';
    if (path.includes('/orchestration')) return 'dspy-orchestration';
    if (path.includes('/tools')) return 'tools-system';
    if (path.includes('/knowledge')) return 'knowledge-system';
    if (path.includes('/context')) return 'context-system';
    return 'general-api';
  }

  private static isAthenaRequest(req: Request): boolean {
    return (
      req.path.includes('/athena') ||
      req.path.includes('/assistant') ||
      req.path.includes('/conversation') ||
      req.headers['x-ai-service'] === 'sweet-athena'
    );
  }

  private static inferInteractionType(path: string): string {
    if (path.includes('/chat')) return 'conversation';
    if (path.includes('/avatar')) return 'avatar_animation';
    if (path.includes('/teach')) return 'teach_me';
    if (path.includes('/memory')) return 'memory_access';
    return 'general';
  }

  private static sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'cookie',
      'x-auth-token',
      'x-secret-key',
      'x-private-key',
      'password',
    ];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private static sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'secret',
      'token',
      'key',
      'apiKey',
      'authToken',
      'privateKey',
      'secretKey',
      'accessToken',
      'refreshToken',
    ];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

// Extend Express Request interface for debug capabilities
declare module 'express-serve-static-core' {
  interface Request {
    debugPerformance?: {
      data: any;
      addMarker: (name: string, metadata?: Record<string, unknown>) => any;
    };
    testAggregator?: {
      recordResult: (
        testSuite: string,
        testName: string,
        status: 'pass' | 'fail' | 'skip',
        duration: number,
        _error: string
      ) => any;
      getSummary: (testSuite: string) => any;
    };
  }
}

export default DebugMiddleware;
