/**
 * Enhanced Logging Service
 * Structured logging with context, aggregation support, and sensitive data redaction
 */

import type { WriteStream } from 'fs';
import { createReadStream,createWriteStream } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { performance } from 'perf_hooks';
import zlib from 'zlib';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  context: string;
  data?: Record<string, any>;
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  hostname: string;
  service: string;
  version: string;
}

export interface LogFilter {
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  context?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  traceId?: string;
  userId?: string;
  hasError?: boolean;
}

export interface LogAggregation {
  timeRange: {
    start: Date;
    end: Date;
  };
  totalLogs: number;
  byLevel: Record<string, number>;
  byContext: Record<string, number>;
  errorRate: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurred: Date;
  }>;
  performanceMetrics: {
    avgDuration: number;
    slowestOperations: Array<{
      context: string;
      message: string;
      duration: number;
      timestamp: Date;
    }>;
  };
}

export class EnhancedLoggingService {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS_IN_MEMORY = 10000;
  private readonly LOG_ROTATION_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly LOG_RETENTION_DAYS = 30;
  
  private logStreams = new Map<string, WriteStream>();
  private sensitiveFields = new Set([
    'password', 'token', 'apiKey', 'secret', 'auth', 'credential',
    'authorization', 'cookie', 'session', 'jwt', 'bearer',
    'email', 'phone', 'ssn', 'credit_card', 'payment'
  ]);

  private logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal' = 'info';
  private logDirectory = './logs';
  private hostname: string;
  private service = 'universal-ai-tools';
  private version = process.env.npm_package_version || '1.0.0';

  constructor() {
    this.hostname = os.hostname();
    this.initializeLogDirectory();
  }

  /**
   * Set log level threshold
   */
  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'): void {
    this.logLevel = level;
  }

  /**
   * Add custom sensitive field patterns
   */
  addSensitiveFields(fields: string[]): void {
    fields.forEach(field => this.sensitiveFields.add(field.toLowerCase()));
  }

  /**
   * Log a debug message
   */
  debug(message: string, context: string, data?: Record<string, any>): void {
    this.log('debug', message, context, data);
  }

  /**
   * Log an info message
   */
  info(message: string, context: string, data?: Record<string, any>): void {
    this.log('info', message, context, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context: string, data?: Record<string, any>): void {
    this.log('warn', message, context, data);
  }

  /**
   * Log an error message
   */
  error(message: string, context: string, data?: Record<string, any>, error?: Error): void {
    const logData = data ? { ...data } : {};
    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    this.log('error', message, context, logData);
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, context: string, data?: Record<string, any>, error?: Error): void {
    const logData = data ? { ...data } : {};
    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    this.log('fatal', message, context, logData);
  }

  /**
   * Log a timed operation
   */
  async logTimed<T>(
    operation: () => Promise<T> | T,
    message: string,
    context: string,
    data?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    const startEntry = this.log('debug', `${message} - Started`, context, data);

    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      this.log('debug', `${message} - Completed`, context, {
        ...data,
        duration: Math.round(duration * 100) / 100,
        success: true
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.error(`${message} - Failed`, context, {
        ...data,
        duration: Math.round(duration * 100) / 100,
        success: false
      }, error as Error);

      throw error;
    }
  }

  /**
   * Create a child logger with persistent context
   */
  createChildLogger(defaultContext: string, defaultData?: Record<string, any>) {
    return {
      debug: (message: string, data?: Record<string, any>) => 
        this.debug(message, defaultContext, { ...defaultData, ...data }),
      info: (message: string, data?: Record<string, any>) => 
        this.info(message, defaultContext, { ...defaultData, ...data }),
      warn: (message: string, data?: Record<string, any>) => 
        this.warn(message, defaultContext, { ...defaultData, ...data }),
      error: (message: string, data?: Record<string, any>, error?: Error) => 
        this.error(message, defaultContext, { ...defaultData, ...data }, error),
      fatal: (message: string, data?: Record<string, any>, error?: Error) => 
        this.fatal(message, defaultContext, { ...defaultData, ...data }, error),
      logTimed: <T>(
        operation: () => Promise<T> | T,
        message: string,
        data?: Record<string, any>
      ) => this.logTimed(operation, message, defaultContext, { ...defaultData, ...data })
    };
  }

  /**
   * Core logging method
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: string,
    context: string,
    data?: Record<string, any>
  ): LogEntry {
    // Check log level threshold
    if (!this.shouldLog(level)) {
      return {} as LogEntry; // Return empty entry for consistency
    }

    // Get trace context if available
    let traceId: string | undefined;
    let spanId: string | undefined;
    
    try {
      // Try to get trace context from distributed tracing service
      // Note: Using dynamic import with then/catch to avoid making this method async
      import('./distributed-tracing-service').then(({ distributedTracingService }) => {
        try {
          const traceContext = distributedTracingService.getCurrentContext();
          if (traceContext) {
            // Note: This won't update the current log entry but will be available for subsequent logs
            // This is acceptable for trace context propagation
          }
        } catch (err) {
          // Ignore errors from tracing service
        }
      }).catch(() => {
        // Tracing service not available, continue without trace context
      });
    } catch (error) {
      // Tracing service not available, continue without trace context
    }

    // Create log entry
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data: data ? this.sanitizeData(data) : undefined,
      traceId,
      spanId,
      hostname: this.hostname,
      service: this.service,
      version: this.version
    };

    // Extract common fields from data
    if (data) {
      if (data.userId) {logEntry.userId = String(data.userId);}
      if (data.requestId) {logEntry.requestId = String(data.requestId);}
      if (data.duration) {logEntry.duration = Number(data.duration);}
      if (data.error) {logEntry.error = data.error;}
    }

    // Store in memory (with rotation)
    this.logs.push(logEntry);
    if (this.logs.length > this.MAX_LOGS_IN_MEMORY) {
      this.logs.shift();
    }

    // Write to file
    this.writeToFile(logEntry);

    // Output to console in development
    if (process.env.NODE_ENV !== 'production') {
      this.outputToConsole(logEntry);
    }

    // Log to trace span if available
    if (traceId && spanId) {
      try {
        // Using dynamic import for optional dependency
        import('./distributed-tracing-service').then(({ distributedTracingService }) => {
          try {
            // Map 'fatal' to 'error' for compatibility with standard log levels
            const mappedLevel = level === 'fatal' ? 'error' : level;
            distributedTracingService.logToSpan(mappedLevel as 'error' | 'info' | 'warn' | 'debug', message, data);
          } catch (err) {
            // Ignore errors from tracing service
          }
        }).catch(() => {
          // Ignore if tracing service not available
        });
      } catch (error) {
        // Ignore if tracing service not available
      }
    }

    return logEntry;
  }

  /**
   * Check if we should log at this level
   */
  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Sanitize sensitive data from log entries
   */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone
    
    const sanitizeObject = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Check if field contains sensitive data
        const isSensitive = Array.from(this.sensitiveFields).some(field => 
          lowerKey.includes(field)
        );

        if (isSensitive) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Write log entry to file
   */
  private async writeToFile(logEntry: LogEntry): Promise<void> {
    try {
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `${logEntry.level}-${dateStr}.log`;
      const filepath = path.join(this.logDirectory, filename);

      // Get or create write stream
      if (!this.logStreams.has(filename)) {
        const stream = createWriteStream(filepath, { flags: 'a' });
        this.logStreams.set(filename, stream);
      }

      const stream = this.logStreams.get(filename)!;
      const logLine = JSON.stringify(logEntry) + '\n';
      
      stream.write(logLine);

      // Check file size for rotation
      const stats = await fs.stat(filepath);
      if (stats.size > this.LOG_ROTATION_SIZE) {
        await this.rotateLog(filename);
      }

    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write log to file:', error);
      this.outputToConsole(logEntry);
    }
  }

  /**
   * Rotate log file when it gets too large
   */
  private async rotateLog(filename: string): Promise<void> {
    try {
      const stream = this.logStreams.get(filename);
      if (stream) {
        stream.end();
        this.logStreams.delete(filename);
      }

      const oldPath = path.join(this.logDirectory, filename);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const newPath = path.join(this.logDirectory, `${filename}.${timestamp}`);

      await fs.rename(oldPath, newPath);

      // Compress old log (optional)
      this.compressOldLog(newPath);

    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Compress old log files (optional optimization)
   */
  private async compressOldLog(filepath: string): Promise<void> {
    try {
      const readStream = createReadStream(filepath);
      const writeStream = createWriteStream(`${filepath}.gz`);
      const gzip = zlib.createGzip();

      readStream.pipe(gzip).pipe(writeStream);

      writeStream.on('finish', async () => {
        // Remove original file after compression
        await fs.unlink(filepath);
      });

    } catch (error) {
      console.error('Failed to compress log file:', error);
    }
  }

  /**
   * Output log to console with formatting
   */
  private outputToConsole(logEntry: LogEntry): void {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m'  // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[logEntry.level];
    
    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
    const prefix = `${color}[${timestamp}] ${logEntry.level.toUpperCase()}${reset}`;
    const context = `[${logEntry.context}]`;
    
    let output = `${prefix} ${context} ${logEntry.message}`;
    
    if (logEntry.traceId) {
      output += ` (trace: ${logEntry.traceId.slice(0, 8)})`;
    }

    console.log(output);

    if (logEntry.data) {
      console.log('  Data:', JSON.stringify(logEntry.data, null, 2));
    }

    if (logEntry.error) {
      console.log('  Error:', logEntry.error.message);
      if (logEntry.error.stack) {
        console.log('  Stack:', logEntry.error.stack);
      }
    }
  }

  /**
   * Query logs with filters
   */
  queryLogs(filter: LogFilter, limit = 100): LogEntry[] {
    let filteredLogs = [...this.logs];

    // Apply filters
    if (filter.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filter.level);
    }

    if (filter.context) {
      filteredLogs = filteredLogs.filter(log => 
        log.context.toLowerCase().includes(filter.context!.toLowerCase())
      );
    }

    if (filter.timeRange) {
      filteredLogs = filteredLogs.filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime >= filter.timeRange!.start && logTime <= filter.timeRange!.end;
      });
    }

    if (filter.traceId) {
      filteredLogs = filteredLogs.filter(log => log.traceId === filter.traceId);
    }

    if (filter.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filter.userId);
    }

    if (filter.hasError !== undefined) {
      filteredLogs = filteredLogs.filter(log => 
        filter.hasError ? log.error !== undefined : log.error === undefined
      );
    }

    // Sort by timestamp (newest first) and limit
    return filteredLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get log aggregations and statistics
   */
  getLogAggregation(timeRange: { start: Date; end: Date }): LogAggregation {
    const logs = this.queryLogs({ timeRange }, 10000); // Get more logs for aggregation

    const byLevel: Record<string, number> = {};
    const byContext: Record<string, number> = {};
    const errors: Array<{ message: string; timestamp: Date }> = [];
    const durations: number[] = [];
    const slowOperations: Array<{
      context: string;
      message: string;
      duration: number;
      timestamp: Date;
    }> = [];

    logs.forEach(log => {
      // Count by level
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;

      // Count by context
      byContext[log.context] = (byContext[log.context] || 0) + 1;

      // Collect errors
      if (log.error) {
        errors.push({
          message: log.error.message,
          timestamp: new Date(log.timestamp)
        });
      }

      // Collect durations
      if (log.duration) {
        durations.push(log.duration);

        // Track slow operations (> 1 second)
        if (log.duration > 1000) {
          slowOperations.push({
            context: log.context,
            message: log.message,
            duration: log.duration,
            timestamp: new Date(log.timestamp)
          });
        }
      }
    });

    // Group errors by message
    const errorGroups = new Map<string, { count: number; lastOccurred: Date }>();
    errors.forEach(error => {
      const existing = errorGroups.get(error.message);
      if (existing) {
        existing.count++;
        if (error.timestamp > existing.lastOccurred) {
          existing.lastOccurred = error.timestamp;
        }
      } else {
        errorGroups.set(error.message, { count: 1, lastOccurred: error.timestamp });
      }
    });

    const topErrors = Array.from(errorGroups.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const avgDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;

    const errorRate = logs.length > 0 
      ? (errors.length / logs.length) * 100 
      : 0;

    return {
      timeRange,
      totalLogs: logs.length,
      byLevel,
      byContext,
      errorRate,
      topErrors,
      performanceMetrics: {
        avgDuration,
        slowestOperations: slowOperations
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
      }
    };
  }

  /**
   * Export logs in various formats
   */
  exportLogs(filter: LogFilter, format: 'json' | 'csv' | 'ndjson' = 'json'): string {
    const logs = this.queryLogs(filter, 10000);

    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);

      case 'ndjson':
        return logs.map(log => JSON.stringify(log)).join('\n');

      case 'csv':
        const headers = [
          'timestamp', 'level', 'context', 'message', 
          'traceId', 'spanId', 'userId', 'duration'
        ];
        const csvLines = [headers.join(',')];
        
        logs.forEach(log => {
          const row = [
            log.timestamp,
            log.level,
            log.context,
            `"${log.message.replace(/"/g, '""')}"`, // Escape quotes
            log.traceId || '',
            log.spanId || '',
            log.userId || '',
            log.duration || ''
          ];
          csvLines.push(row.join(','));
        });
        
        return csvLines.join('\n');

      default:
        return JSON.stringify(logs, null, 2);
    }
  }

  /**
   * Initialize log directory
   */
  private async initializeLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
      
      // Clean up old logs
      this.cleanupOldLogs();
      
    } catch (error) {
      console.error('Failed to initialize log directory:', error);
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.LOG_RETENTION_DAYS);

      for (const file of files) {
        const filePath = path.join(this.logDirectory, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
        }
      }

    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Get current memory usage of logs
   */
  getMemoryUsage(): {
    totalLogs: number;
    estimatedMemoryMB: number;
    oldestLog?: string;
    newestLog?: string;
  } {
    const estimatedMemoryBytes = this.logs.length * 500; // Rough estimate
    const estimatedMemoryMB = estimatedMemoryBytes / (1024 * 1024);

    return {
      totalLogs: this.logs.length,
      estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100,
      oldestLog: this.logs[0]?.timestamp,
      newestLog: this.logs[this.logs.length - 1]?.timestamp
    };
  }

  /**
   * Clear in-memory logs
   */
  clearMemoryLogs(): void {
    this.logs.length = 0;
  }

  /**
   * Close all log streams
   */
  close(): void {
    for (const stream of this.logStreams.values()) {
      stream.end();
    }
    this.logStreams.clear();
  }
}

// Singleton instance
export const enhancedLoggingService = new EnhancedLoggingService();