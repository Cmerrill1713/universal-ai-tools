/**
 * Logging Middleware for Universal AI Tools
 *
 * Comprehensive request/response logging with performance monitoring,
 * error tracking, and specialized Sweet Athena interaction logging
 */
import type { NextFunction, Request, Response } from 'express';
import { LogContext, enhancedLogger, logger } from '../utils/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type to include logging data
declare global {
  namespace Express {
    interface Request {
      timerId?: string;
      logger?: typeof logger;
    }
  }
}

interface RequestMetadata {
  user_agent?: string;
  ip_address?: string;
  user_id?: string;
  session_id?: string;
  api_key?: string;
  ai_service?: string;
  request_size: number;
  response_size?: number;
}

interface SweetAthenaRequestData {
  interaction_type?: string;
  personality_mood?: string;
  sweetness_level?: number;
  user_input: string;
}

export class LoggingMiddleware {
  // Main request logging middleware
  static requestLogger() {
    return (req: Request, res: Response, next): NextFunction => {
      // Generate unique request ID
      req.requestId = uuidv4();
      req.startTime = Date.now();
      req.timerId = logger.startTimer(`request_${req.method}_${req.path}`);
      req.logger = logger;

      // Add request ID to response headers for debugging
      res.setHeader('X-Request-ID', req.requestId);

      // Extract request metadata
      const metadata: RequestMetadata = {
        user_agent: req.get('User-Agent'),
        ip_address: req.ip || req.connection.remoteAddress,
        user_id: req.headers['x-user-id'] as string,
        session_id: req.headers['x-session-id'] as string,
        api_key: req.headers['x-api-key'] as string,
        ai_service: req.headers['x-ai-service'] as string,
        request_size: JSON.stringify(req.body || {}).length,
      };

      // Log incoming request
      logger.info(`Incoming ${req.method} ${req.path}`, LogContext.API, {`
        request_id: req.requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        headers: LoggingMiddleware.sanitizeHeaders(req.headers),
        metadata,
        body_preview: LoggingMiddleware.sanitizeBody(req.body),
      });

      // Special handling for Sweet Athena requests
      if (LoggingMiddleware.isAthenaRequest(req)) {
        LoggingMiddleware.logAthenaRequestStart(req);
      }

      // Override res.json to capture response data
      const originalJson = res.json;
      res.json = function (body): any {
        const responseSize = JSON.stringify(body).length;
        metadata.response_size = responseSize;

        // Log response
        LoggingMiddleware.logResponse(req, res, body, metadata;

        return originalJson.call(this, body;
      };

      // Override res.send to capture non-JSON responses
      const originalSend = res.send;
      res.send = function (body): any {
        const responseSize = typeof body === 'string' ? body.length : JSON.stringify(body).length;
        metadata.response_size = responseSize;

        LoggingMiddleware.logResponse(req, res, body, metadata;

        return originalSend.call(this, body;
      };

      // Handle response finish event
      res.on('finish', () => {
        LoggingMiddleware.logRequestCompletion(req, res, metadata;
      });

      next();
    };
  }

  // Error logging middleware (should be last)
  static errorLogger() {
    return (err: Error, req: Request, res: Response, next): NextFunction => {
      const errorTracking = logger.trackError(err, LogContext.API, {
        request_id: req.requestId,
        method: req.method,
        path: req.path,
        user_id: req.headers['x-user-id'],
        session_id: req.headers['x-session-id'],
        request_body: LoggingMiddleware.sanitizeBody(req.body),
      });

      // Special handling for Sweet Athena errors
      if (LoggingMiddleware.isAthenaRequest(req)) {
        logger.error('Sweet Athena interaction failed', {
          error_tracking: errorTracking,
          interaction_data: LoggingMiddleware.extractAthenaData(req),
          user_impact: 'high', // Athena errors significantly impact user experience
        });
      }

      // End performance timer for failed requests
      if (req.timerId) {
        logger.endTimer(
          req.timerId,
          `request_${req.method}_${req.path}_ERROR`,
          LogContext.PERFORMANCE,
          {
            error: true,
            error_type: err.name,
            request_id: req.requestId,
          }
        );
      }

      next(err);
    };
  }

  // Database operation logging middleware
  static databaseLogger() {
    return (req: Request, res: Response, next): NextFunction => {
      // Add database operation tracking to request
      if (req.logger) {
        req.logger.logDatabaseOperation = (
          operation: string,
          table: string,
          duration: number,
          details?: Record<string, unknown>
        ) => {
          logger.logDatabaseOperation(operation, table, duration, {
            request_id: req.requestId,
            ...details,
          });
        };
      }

      next();
    };
  }

  // Memory operation logging middleware
  static memoryLogger() {
    return (req: Request, res: Response, next): NextFunction => {
      // Add memory operation tracking to request
      if (req.logger) {
        req.logger.logMemoryOperation = (operation: string, details: Record<string, unknown>) => {
          logger.logMemoryOperation(operation, {
            request_id: req.requestId,
            ...details,
          });
        };
      }

      next();
    };
  }

  // Sweet Athena conversation logging middleware
  static athenaConversationLogger() {
    return (req: Request, res: Response, next): NextFunction => {
      if (LoggingMiddleware.isAthenaRequest(req)) {
        // Add Athena-specific logging methods to request
        if (req.logger) {
          req.logger.logAthenaInteraction = (interaction) => {
            logger.logAthenaInteraction({
              ...interaction,
              session_id: (req.headers['x-session-id'] as string) || req.requestId || 'unknown',
            });
          };

          req.logger.logConversationTurn = (
            userInput: string,
            athenaResponse: string,
            sessionId?: string,
            metadata?: Record<string, unknown>
          ) => {
            logger.logConversationTurn(
              userInput,
              athenaResponse,
              sessionId || req.requestId || 'unknown',
              {
                request_id: req.requestId,
                ...metadata,
              }
            );
          };
        }
      }

      next();
    };
  }

  // Security event logging middleware
  static securityLogger() {
    return (req: Request, res: Response, next): NextFunction => {
      // Add security logging to request (without calling detectSuspiciousActivity to avoid recursion)
      if (req.logger) {
        req.logger.logSecurityEvent = (
          event: string,
          severity: 'low' | 'medium' | 'high' | 'critical',
          details: Record<string, unknown>
        ) => {
          logger.logSecurityEvent(event, severity, {
            request_id: req.requestId,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            ...details,
          });
        };
      }

      next();
    };
  }

  // Private helper methods
  private static logResponse(req: Request, res: Response, body: any, metadata: RequestMetadata {
    const isError = res.statusCode >= 400;
    const context = isError ? LogContext.API : LogContext.API;

    logger.info(`Response ${req.method} ${req.path} - ${res.statusCode}`, context, {`
      request_id: req.requestId,
      status_code: res.statusCode,
      response_size: metadata.response_size,
      response_preview: LoggingMiddleware.sanitizeBody(body),
      headers: LoggingMiddleware.sanitizeHeaders(res.getHeaders()),
      metadata,
    });

    // Log full response in debug mode for Athena requests
    if (process.env.NODE_ENV !== 'production' && LoggingMiddleware.isAthenaRequest(req)) {
      logger.debug(`Full Athena response`, LogContext.ATHENA, {`
        request_id: req.requestId,
        full_response: body,
      });
    }
  }

  private static logRequestCompletion(req: Request, res: Response, metadata: RequestMetadata {
    const duration = Date.now() - (req.startTime || Date.now());

    // End performance timer
    if (req.timerId) {
      logger.endTimer(req.timerId, `request_${req.method}_${req.path}`, LogContext.PERFORMANCE, {`
        status_code: res.statusCode,
        request_id: req.requestId,
        ...metadata,
      });
    }

    // Log API request with performance data
    logger.logAPIRequest(req.method, req.path, res.statusCode, duration, {
      request_id: req.requestId,
      ...metadata,
    });

    // Special completion logging for Sweet Athena
    if (LoggingMiddleware.isAthenaRequest(req)) {
      LoggingMiddleware.logAthenaRequestCompletion(req, res, duration;
    }
  }

  private static logAthenaRequestStart(req: Request {
    const athenaData = LoggingMiddleware.extractAthenaData(req);

    logger.info('Sweet Athena interaction started', LogContext.ATHENA, {
      request_id: req.requestId,
      interaction_data: athenaData,
      endpoint: req.path,
      user_session: req.headers['x-session-id'],
    });
  }

  private static logAthenaRequestCompletion(req: Request, res: Response, duration: number {
    const athenaData = LoggingMiddleware.extractAthenaData(req);

    logger.info('Sweet Athena interaction completed', LogContext.ATHENA, {
      request_id: req.requestId,
      duration_ms: duration,
      status_code: res.statusCode,
      success: res.statusCode < 400,
      interaction_data: athenaData,
      performance_category: LoggingMiddleware.categorizePerfomance(duration),
    });
  }

  private static isAthenaRequest(req: Request): boolean {
    return (;
      req.path.includes('/athena') ||
      req.path.includes('/assistant') ||
      req.path.includes('/conversation') ||
      req.headers['x-ai-service'] === 'sweet-athena'
    );
  }

  private static extractAthenaData(req: Request: SweetAthenaRequestData {
    return {
      interaction_type: req.body?.interaction_type || (req.query.interaction_type as string),
      personality_mood: req.body?.personality_mood || (req.query.personality_mood as string),
      sweetness_level:
        req.body?.sweetness_level ||
        (req.query.sweetness_level ? Number(req.query.sweetness_level) : undefined,
      user_input: req.body?.message || req.body?.user_input || req.body?.query,
    };
  }

  private static sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };

    // Remove sensitive headers
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

    // Remove sensitive fields
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

    // Truncate long strings for preview
    Object.keys(sanitized).forEach((key) => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 200) {
        sanitized[key] = `${sanitized[key].substring(0, 200)}... [TRUNCATED]`;
      }
    });

    return sanitized;
  }

  private static detectSuspiciousActivity(req: Request {
    // Rate limiting checks
    const userAgent = req.get('User-Agent');
    const ip = req.ip || req.connection.remoteAddress;

    // Check for bot-like behavior
    if (!userAgent || userAgent.length < 10) {
      logger.logSecurityEvent('Suspicious User Agent', 'medium', {
        ip_address: ip,
        user_agent: userAgent,
        path: req.path,
      });
    }

    // Check for SQL injection attempts
    const queryString = JSON.stringify(req.query);
    const bodyString = JSON.stringify(req.body);
    const sqlPatterns = /'.*union.*select|'.*or.*1=1|'.*drop.*table|'.*insert.*into/i;

    if (sqlPatterns.test(queryString) || sqlPatterns.test(bodyString)) {
      logger.logSecurityEvent('Potential SQL Injection Attempt', 'critical', {
        ip_address: ip,
        user_agent: userAgent,
        path: req.path,
        query: req.query,
        body_preview: LoggingMiddleware.sanitizeBody(req.body),
      });
    }

    // Check for XSS attempts
    const xssPatterns = /<script|javascript:|on\w+=/i;
    if (xssPatterns.test(queryString) || xssPatterns.test(bodyString)) {
      logger.logSecurityEvent('Potential XSS Attempt', 'high', {
        ip_address: ip,
        user_agent: userAgent,
        path: req.path,
      });
    }
  }

  private static categorizePerfomance(duration: number: string {
    if (duration < 100) return 'excellent';
    if (duration < 500) return 'good';
    if (duration < 1000) return 'acceptable';
    if (duration < 2000) return 'slow';
    return 'very_slow';
  }
}

export default LoggingMiddleware;
