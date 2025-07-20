/**
 * Enhanced Logging System for Universal AI Tools
 * 
 * Comprehensive logging infrastructure with structured logging, error tracking,
 * performance metrics, and specialized logging for Sweet Athena interactions
 */
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Performance } from 'perf_hooks';
import os from 'os';

// Define log levels and contexts
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug',
  VERBOSE = 'verbose'
}

export enum LogContext {
  SYSTEM = 'system',
  API = 'api',
  HTTP = 'http',
  GRAPHQL = 'graphql',
  ATHENA = 'athena',
  CONVERSATION = 'conversation',
  AVATAR = 'avatar',
  MEMORY = 'memory',
  DSPY = 'dspy',
  DATABASE = 'database',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  ERROR = 'error',
  TEST = 'test',
  CACHE = 'cache'
}

// Performance metrics interface
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  memory_used: number;
  cpu_usage?: number;
  context: LogContext;
  metadata?: Record<string, any>;
}

// Error tracking interface
export interface ErrorTracking {
  error_id: string;
  error_type: string;
  message: string;
  stack?: string;
  user_id?: string;
  session_id?: string;
  context: LogContext;
  metadata?: Record<string, any>;
}

// Sweet Athena specific logging interface
export interface AthenaInteraction {
  interaction_id: string;
  interaction_type: 'conversation' | 'avatar_animation' | 'mood_change' | 'teach_me' | 'memory_access';
  user_input?: string;
  athena_response?: string;
  personality_mood: string;
  sweetness_level: number;
  performance_metrics?: PerformanceMetrics;
  user_satisfaction?: number;
  session_id: string;
  timestamp: Date;
}

// Custom log formats
const createCustomFormat = (service: string) => {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, context, ...meta }: any) => {
      const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${service}] ${level.toUpperCase()} [${context || 'SYSTEM'}]: ${message} ${metaString}`;
    })
  );
};

const createJSONFormat = (service: string) => {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info: any) => {
      return JSON.stringify({
        timestamp: info.timestamp,
        service,
        level: info.level,
        context: info.context || 'SYSTEM',
        message: info.message,
        ...info
      });
    })
  );
};

// Enhanced Logger Class
export class EnhancedLogger {
  private logger: winston.Logger;
  private performanceTimers: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private service: string;

  constructor(service = 'universal-ai-tools') {
    this.service = service;
    
    // Create transports based on environment
    const transports: winston.transport[] = [
      // Console transport with colored output for development
      new winston.transports.Console({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: process.env.NODE_ENV === 'production' 
          ? createJSONFormat(service)
          : winston.format.combine(
              winston.format.colorize(),
              createCustomFormat(service)
            )
      }),

      // Daily rotating file for all logs
      new DailyRotateFile({
        filename: `logs/${service}-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        level: 'debug',
        format: createJSONFormat(service)
      }),

      // Separate error log file
      new DailyRotateFile({
        filename: `logs/${service}-error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: createJSONFormat(service)
      }),

      // Performance logs
      new DailyRotateFile({
        filename: `logs/${service}-performance-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '7d',
        level: 'info',
        format: createJSONFormat(service),
        // Only log performance-related entries
        // Note: Using custom format to filter performance logs
      })
    ];

    // Add Athena-specific logs in development
    if (process.env.NODE_ENV !== 'production') {
      transports.push(
        new DailyRotateFile({
          filename: `logs/sweet-athena-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '7d',
          level: 'debug',
          format: createJSONFormat('sweet-athena'),
          // Note: Using custom format to filter Athena logs
        })
      );
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      defaultMeta: { 
        service,
        pid: process.pid,
        hostname: os.hostname(),
        node_version: process.version
      },
      transports,
      exitOnError: false
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new DailyRotateFile({
        filename: `logs/${service}-exceptions-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '30d'
      })
    );

    this.logger.rejections.handle(
      new DailyRotateFile({
        filename: `logs/${service}-rejections-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '30d'
      })
    );
  }

  // Core logging methods
  error(message: string, context: LogContext = LogContext.SYSTEM, meta?: any) {
    this.incrementErrorCount(context);
    this.logger.error(message, { context, ...meta });
  }

  warn(message: string, context: LogContext = LogContext.SYSTEM, meta?: any) {
    this.logger.warn(message, { context, ...meta });
  }

  info(message: string, context: LogContext = LogContext.SYSTEM, meta?: any) {
    this.logger.info(message, { context, ...meta });
  }

  debug(message: string, context: LogContext = LogContext.SYSTEM, meta?: any) {
    this.logger.debug(message, { context, ...meta });
  }

  verbose(message: string, context: LogContext = LogContext.SYSTEM, meta?: any) {
    this.logger.verbose(message, { context, ...meta });
  }

  // Performance monitoring methods
  startTimer(operation: string): string {
    const timerId = `${operation}_${Date.now()}_${Math.random()}`;
    this.performanceTimers.set(timerId, performance.now());
    return timerId;
  }

  endTimer(timerId: string, operation: string, context: LogContext = LogContext.PERFORMANCE, metadata?: Record<string, any>): PerformanceMetrics {
    const startTime = this.performanceTimers.get(timerId);
    if (!startTime) {
      this.warn(`Timer ${timerId} not found for operation ${operation}`, LogContext.PERFORMANCE);
      return {
        operation,
        duration: -1,
        memory_used: process.memoryUsage().heapUsed,
        context,
        metadata
      };
    }

    const duration = performance.now() - startTime;
    const memoryUsage = process.memoryUsage();
    
    const metrics: PerformanceMetrics = {
      operation,
      duration,
      memory_used: memoryUsage.heapUsed,
      context,
      metadata
    };

    this.performanceTimers.delete(timerId);
    
    // Log performance metrics
    this.info(`Performance: ${operation} completed in ${duration.toFixed(2)}ms`, LogContext.PERFORMANCE, {
      metrics,
      memory_mb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      memory_total_mb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2)
    });

    return metrics;
  }

  // Error tracking with aggregation
  trackError(error: Error | string, context: LogContext, metadata?: Record<string, any>): ErrorTracking {
    const errorId = `${context}_${Date.now()}_${Math.random()}`;
    const errorType = error instanceof Error ? error.constructor.name : 'StringError';
    const message = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;

    const tracking: ErrorTracking = {
      error_id: errorId,
      error_type: errorType,
      message,
      stack,
      context,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      }
    };

    this.error(`Error tracked: ${message}`, context, {
      error_tracking: tracking,
      stack
    });

    return tracking;
  }

  // Sweet Athena specific logging
  logAthenaInteraction(interaction: AthenaInteraction) {
    this.info(`Sweet Athena Interaction: ${interaction.interaction_type}`, LogContext.ATHENA, {
      athena_interaction: interaction,
      performance_ms: interaction.performance_metrics?.duration,
      mood: interaction.personality_mood,
      sweetness: interaction.sweetness_level
    });
  }

  logConversationTurn(userInput: string, athenaResponse: string, sessionId: string, metadata?: Record<string, any>) {
    const interactionId = `conv_${sessionId}_${Date.now()}`;
    
    this.info('Conversation turn completed', LogContext.CONVERSATION, {
      interaction_id: interactionId,
      session_id: sessionId,
      user_input_length: userInput.length,
      athena_response_length: athenaResponse.length,
      timestamp: new Date().toISOString(),
      ...metadata
    });

    // In development, log full conversation for debugging
    if (process.env.NODE_ENV !== 'production') {
      this.debug('Full conversation turn', LogContext.CONVERSATION, {
        interaction_id: interactionId,
        user_input: userInput,
        athena_response: athenaResponse,
        session_id: sessionId
      });
    }
  }

  // API request/response logging
  logAPIRequest(method: string, url: string, statusCode: number, duration: number, metadata?: Record<string, any>) {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    
    this.logger.log(level, `API ${method} ${url} - ${statusCode}`, {
      context: LogContext.API,
      method,
      url,
      status_code: statusCode,
      duration_ms: duration,
      ...metadata
    });
  }

  // Memory system logging
  logMemoryOperation(operation: string, details: Record<string, any>) {
    this.info(`Memory operation: ${operation}`, LogContext.MEMORY, {
      operation,
      ...details
    });
  }

  // Database operation logging
  logDatabaseOperation(operation: string, table: string, duration: number, details?: Record<string, any>) {
    this.info(`Database: ${operation} on ${table}`, LogContext.DATABASE, {
      operation,
      table,
      duration_ms: duration,
      ...details
    });
  }

  // Security event logging
  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, any>) {
    const level = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    
    this.logger.log(level, `Security Event: ${event}`, {
      context: LogContext.SECURITY,
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // Test logging for debugging test failures
  logTestResult(testName: string, status: 'pass' | 'fail' | 'skip', duration: number, details?: Record<string, any>) {
    const level = status === 'fail' ? 'error' : 'info';
    
    this.logger.log(level, `Test: ${testName} - ${status}`, {
      context: LogContext.TEST,
      test_name: testName,
      status,
      duration_ms: duration,
      ...details
    });
  }

  // Get error statistics
  getErrorCounts(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  // Helper method to increment error counts
  private incrementErrorCount(context: LogContext) {
    const key = context.toString();
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  // Get current performance timers (for debugging)
  getActiveTimers(): string[] {
    return Array.from(this.performanceTimers.keys());
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

// Create singleton instance
export const enhancedLogger = new EnhancedLogger();

// Export convenience methods
export const logger = {
  error: (message: string, context?: LogContext, meta?: any) => enhancedLogger.error(message, context, meta),
  warn: (message: string, context?: LogContext, meta?: any) => enhancedLogger.warn(message, context, meta),
  info: (message: string, context?: LogContext, meta?: any) => enhancedLogger.info(message, context, meta),
  debug: (message: string, context?: LogContext, meta?: any) => enhancedLogger.debug(message, context, meta),
  verbose: (message: string, context?: LogContext, meta?: any) => enhancedLogger.verbose(message, context, meta),
  
  // Performance methods
  startTimer: (operation: string) => enhancedLogger.startTimer(operation),
  endTimer: (timerId: string, operation: string, context?: LogContext, metadata?: Record<string, any>) => 
    enhancedLogger.endTimer(timerId, operation, context, metadata),
  
  // Specialized logging
  trackError: (error: Error | string, context: LogContext, metadata?: Record<string, any>) => 
    enhancedLogger.trackError(error, context, metadata),
  logAthenaInteraction: (interaction: AthenaInteraction) => enhancedLogger.logAthenaInteraction(interaction),
  logConversationTurn: (userInput: string, athenaResponse: string, sessionId: string, metadata?: Record<string, any>) =>
    enhancedLogger.logConversationTurn(userInput, athenaResponse, sessionId, metadata),
  logAPIRequest: (method: string, url: string, statusCode: number, duration: number, metadata?: Record<string, any>) =>
    enhancedLogger.logAPIRequest(method, url, statusCode, duration, metadata),
  logMemoryOperation: (operation: string, details: Record<string, any>) =>
    enhancedLogger.logMemoryOperation(operation, details),
  logDatabaseOperation: (operation: string, table: string, duration: number, details?: Record<string, any>) =>
    enhancedLogger.logDatabaseOperation(operation, table, duration, details),
  logSecurityEvent: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, any>) =>
    enhancedLogger.logSecurityEvent(event, severity, details),
  logTestResult: (testName: string, status: 'pass' | 'fail' | 'skip', duration: number, details?: Record<string, any>) =>
    enhancedLogger.logTestResult(testName, status, duration, details),
  
  // Utility methods
  getErrorCounts: () => enhancedLogger.getErrorCounts(),
  getActiveTimers: () => enhancedLogger.getActiveTimers(),
  shutdown: () => enhancedLogger.shutdown()
};

export default logger;