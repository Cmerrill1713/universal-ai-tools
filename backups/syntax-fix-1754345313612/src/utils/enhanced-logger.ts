/**
 * Enhanced Logger Utility;
 * Advanced logging with correlation IDs, structured outputs, and comprehensive context management;
 * Extends the existing Universal AI Tools logging system with enterprise features;
 */

import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { LogContext } from './logger';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: LogContext;
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  requestId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, any>;
  tags?: string[];
  stack?: string;
  performance?: PerformanceMetrics;
}

export interface PerformanceMetrics {
  memoryUsage: NodeJS?.MemoryUsage;
  cpuUsage?: NodeJS?.CpuUsage;
  duration?: number;
  operationCount?: number;
}

export interface LoggingContext {
  correlationId: string;
  sessionId?: string;
  userId?: string;
  requestId?: string;
  component?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface EnhancedLoggerConfig {
  enableCorrelationId: boolean;
  enablePerformanceMetrics: boolean;
  enableStructuredOutput: boolean;
  enableAsyncContext: boolean;
  bufferSize: number;
  flushInterval: number; // milliseconds;
  retentionPeriod: number; // milliseconds;
  logLevel: string;
  outputs: LogOutput[];
  filters: LogFilter[];
}

export interface LogOutput {
  type: 'console' | 'file' | 'elasticsearch' | 'webhook' | 'supabase';
  config: Record<string, any>;
  enabled: boolean;
  levels?: string[];
}

export interface LogFilter {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'range';
  value: any;
  action: 'include' | 'exclude';
}

export interface LogQuery {
  level?: string;
  context?: LogContext;
  correlationId?: string;
  timeRange?: { start: Date; end: Date };
  components?: string[];
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Enhanced Logger with enterprise-grade features;
 */
export class EnhancedLogger extends EventEmitter {
  private config: EnhancedLoggerConfig;
  private logger!: winston?.Logger;
  private asyncContext: AsyncLocalStorage<LoggingContext>;
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS?.Timeout;
  private performanceStartTimes: Map<string, number> = new Map();
  private logHistory: LogEntry[] = [];

  constructor(config: Partial<EnhancedLoggerConfig> = {}) {
    super();

    this?.config = {
      enableCorrelationId: true,
      enablePerformanceMetrics: true,
      enableStructuredOutput: true,
      enableAsyncContext: true,
      bufferSize: 1000,
      flushInterval: 5000, // 5 seconds;
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours;
      logLevel: process?.env?.LOG_LEVEL || 'info',
      outputs: [
        {
          type: 'console',
          config: { colorize: true },
          enabled: true,
        },
      ],
      filters: [],
      ...config,
    };

    this?.asyncContext = new AsyncLocalStorage();
    this?.initializeLogger();
    this?.startFlushTimer();
  }

  /**
   * Initialize Winston logger with enhanced configuration;
   */
  private initializeLogger(): void {
    const transports: winston?.transport[] = [];

    // Configure outputs;
    for (const output of this?.config?.outputs) {
      if (!output?.enabled) continue;

      switch (output?.type) {
        case 'console':
          transports?.push(
            new winston?.transports?.Console({
              format: winston?.format?.combine(
                winston?.format?.timestamp(),
                winston?.format?.errors({ stack: true }),
                this?.config?.enableStructuredOutput;
                  ? winston?.format?.json()
                  : winston?.format?.simple(),
                winston?.format?.colorize({ all: output?.config?.colorize })
              ),
            })
          );
          break;

        case 'file':
          transports?.push(
            new winston?.transports?.File({
              filename: output?.config?.filename || 'logs/enhanced?.log',
              maxsize: output?.config?.maxsize || 10485760, // 10MB;
              maxFiles: output?.config?.maxFiles || 10,
              format: winston?.format?.combine(
                winston?.format?.timestamp(),
                winston?.format?.json()
              ),
            })
          );
          break;
      }
    }

    this?.logger = winston?.createLogger({
      level: this?.config?.logLevel,
      format: winston?.format?.combine(
        winston?.format?.timestamp(),
        winston?.format?.errors({ stack: true }),
        winston?.format?.json()
      ),
      transports,
    });
  }

  /**
   * Create logging context for async operations;
   */
  createContext(context: Partial<LoggingContext> = {}): LoggingContext {
    return {
      correlationId: uuidv4(),
      ...context,
    };
  }

  /**
   * Run function with logging context;
   */
  withContext<T>(context: LoggingContext, fn: () => T): T {
    if (!this?.config?.enableAsyncContext) {
      return fn();
    }

    return this?.asyncContext?.run(context, fn);
  }

  /**
   * Run async function with logging context;
   */
  async withContextAsync<T>(context: LoggingContext, fn: () => Promise<T>): Promise<T> {
    if (!this?.config?.enableAsyncContext) {
      return fn();
    }

    return this?.asyncContext?.run(context, fn);
  }

  /**
   * Get current logging context;
   */
  getContext(): LoggingContext | undefined {
    return this?.asyncContext?.getStore();
  }

  /**
   * Start performance measurement;
   */
  startPerformance(operationId: string): void {
    if (!this?.config?.enablePerformanceMetrics) return;

    this?.performanceStartTimes?.set(operationId, performance?.now());
  }

  /**
   * End performance measurement and get metrics;
   */
  endPerformance(operationId: string): PerformanceMetrics | undefined {
    if (!this?.config?.enablePerformanceMetrics) return;

    const startTime = this?.performanceStartTimes?.get(operationId);
    if (!startTime) return;

    this?.performanceStartTimes?.delete(operationId);

    return {
      memoryUsage: process?.memoryUsage(),
      duration: performance?.now() - startTime,
    };
  }

  /**
   * Enhanced info logging;
   */
  info(
    message: string,
    context?: LogContext,
    metadata?: Record<string, any>,
    options?: {
      component?: string;
      operation?: string;
      tags?: string[];
      correlationId?: string;
    }
  ): void {
    this?.log('info', message, context, metadata, options);
  }

  /**
   * Enhanced error logging;
   */
  error(
    message: string,
    context?: LogContext,
    metadata?: Record<string, any>,
    options?: {
      component?: string;
      operation?: string;
      tags?: string[];
      correlationId?: string;
      error?: Error;
    }
  ): void {
    this?.log('error', message, context, metadata, options);
  }

  /**
   * Enhanced warn logging;
   */
  warn(
    message: string,
    context?: LogContext,
    metadata?: Record<string, any>,
    options?: {
      component?: string;
      operation?: string;
      tags?: string[];
      correlationId?: string;
    }
  ): void {
    this?.log('warn', message, context, metadata, options);
  }

  /**
   * Enhanced debug logging;
   */
  debug(
    message: string,
    context?: LogContext,
    metadata?: Record<string, any>,
    options?: {
      component?: string;
      operation?: string;
      tags?: string[];
      correlationId?: string;
    }
  ): void {
    this?.log('debug', message, context, metadata, options);
  }

  /**
   * Core logging method with full enhancement features;
   */
  private log(
    level: string,
    message: string,
    context?: LogContext,
    metadata?: Record<string, any>,
    options?: {
      component?: string;
      operation?: string;
      tags?: string[];
      correlationId?: string;
      error?: Error;
    }
  ): void {
    // Get current async context;
    const asyncContext = this?.getContext();

    // Build enhanced log entry;
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context || LogContext?.SYSTEM,
      correlationId:
        options?.correlationId ||
        asyncContext?.correlationId ||
        (this?.config?.enableCorrelationId ? uuidv4() : undefined),
      sessionId: asyncContext?.sessionId,
      userId: asyncContext?.userId,
      requestId: asyncContext?.requestId,
      component: options?.component || asyncContext?.component,
      operation: options?.operation,
      metadata: {
        ...asyncContext?.metadata,
        ...metadata,
      },
      tags: [
        ...(asyncContext?.tags || []),
        ...(options?.tags || []),
      ],
      stack: options?.error?.stack,
    };

    // Add performance metrics if available;
    if (this?.config?.enablePerformanceMetrics && options?.operation) {
      logEntry?.performance = this?.endPerformance(options?.operation);
    }

    // Apply filters;
    if (!this?.shouldLog(logEntry)) {
      return;
    }

    // Add to buffer;
    this?.logBuffer?.push(logEntry);
    this?.logHistory?.push(logEntry);

    // Clean old entries;
    this?.cleanupHistory();

    // Log immediately if buffer is full;
    if (this?.logBuffer?.length >= this?.config?.bufferSize) {
      this?.flush();
    }

    // Emit event for real-time processing;
    this?.emit('log', logEntry);

    // Also log to Winston for immediate output;
    this?.logger?.log(level, message, {
      context,
      correlationId: logEntry?.correlationId,
      component: logEntry?.component,
      ...metadata,
    });
  }

  /**
   * Check if log entry should be logged based on filters;
   */
  private shouldLog(entry: LogEntry): boolean {
    for (const filter of this?.config?.filters) {
      const fieldValue = this?.getFieldValue(entry, filter?.field);
      const matches = this?.matchesFilter(fieldValue, filter);

      if (filter?.action === 'exclude' && matches) {
        return false;
      }
      if (filter?.action === 'include' && !matches) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get field value from log entry;
   */
  private getFieldValue(entry: LogEntry, field: string): any {
    const parts = field?.split('.');
    let value: any = entry;

    for (const part of parts) {
      value = value.[part];
    }

    return value;
  }

  /**
   * Check if value matches filter;
   */
  private matchesFilter(value: any, filter: LogFilter): boolean {
    switch (filter?.operator) {
      case 'equals':
        return value === filter?.value;
      case 'contains':
        return String(value).includes(String(filter?.value));
      case 'regex':
        return new RegExp(filter?.value).test(String(value));
      case 'range':
        return value >= filter?.value?.min && value <= filter?.value?.max;
      default:
        return false;
    }
  }

  /**
   * Flush log buffer;
   */
  flush(): void {
    if (this?.logBuffer?.length === 0) return;

    const entries = [...this?.logBuffer];
    this?.logBuffer = [];

    this?.emit('flush', entries);

    // Process buffered entries;
    for (const entry of entries) {
      this?.processLogEntry(entry);
    }
  }

  /**
   * Process individual log entry for custom outputs;
   */
  private processLogEntry(entry: LogEntry): void {
    // Custom processing for different outputs;
    for (const output of this?.config?.outputs) {
      if (!output?.enabled) continue;

      switch (output?.type) {
        case 'webhook':
          this?.sendToWebhook(entry, output?.config);
          break;
        case 'elasticsearch':
          this?.sendToElasticsearch(entry, output?.config);
          break;
        case 'supabase':
          this?.sendToSupabase(entry, output?.config);
          break;
      }
    }
  }

  /**
   * Send log entry to webhook;
   */
  private async sendToWebhook(entry: LogEntry, config: any): Promise<void> {
    try {
      const response = await fetch(config?.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config?.headers,
        },
        body: JSON?.stringify(entry),
      });

      if (!response?.ok) {
        console?.error('Failed to send log to webhook:', response?.statusText);
      }
    } catch (error) {
      console?.error('Error sending log to webhook:', error);
    }
  }

  /**
   * Send log entry to Elasticsearch;
   */
  private async sendToElasticsearch(entry: LogEntry, config: any): Promise<void> {
    // Placeholder for Elasticsearch integration;
    console?.debug('Would send to Elasticsearch:', entry);
  }

  /**
   * Send log entry to Supabase;
   */
  private async sendToSupabase(entry: LogEntry, config: any): Promise<void> {
    // Placeholder for Supabase integration;
    console?.debug('Would send to Supabase:', entry);
  }

  /**
   * Query logs;
   */
  queryLogs(query: LogQuery): LogEntry[] {
    let results = [...this?.logHistory];

    // Apply filters;
    if (query?.level) {
      results = results?.filter(entry => entry?.level === query?.level);
    }

    if (query?.context) {
      results = results?.filter(entry => entry?.context === query?.context);
    }

    if (query?.correlationId) {
      results = results?.filter(entry => entry?.correlationId === query?.correlationId);
    }

    if (query?.timeRange) {
      results = results?.filter(entry => {
        const timestamp = new Date(entry?.timestamp);
        return timestamp >= query?.timeRange!.start && timestamp <= query?.timeRange!.end;
      });
    }

    if (query?.components) {
      results = results?.filter(entry => 
        entry?.component && query?.components!.includes(entry?.component)
      );
    }

    if (query?.tags) {
      results = results?.filter(entry =>
        entry?.tags && entry?.tags?.some(tag => query?.tags!.includes(tag))
      );
    }

    // Apply pagination;
    const offset = query?.offset || 0,
    const limit = query?.limit || 100,

    return results?.slice(offset, offset + limit);
  }

  /**
   * Get logging statistics;
   */
  getStats(): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    logsByContext: Record<string, number>;
    averageLogsPerMinute: number;
    bufferSize: number;
  } {
    const now = Date?.now();
    const oneMinuteAgo = now - 60000,

    const recentLogs = this?.logHistory?.filter(
      entry => new Date(entry?.timestamp).getTime() > oneMinuteAgo;
    );

    const logsByLevel: Record<string, number> = {};
    const logsByContext: Record<string, number> = {};

    for (const entry of this?.logHistory) {
      logsByLevel[entry?.level] = (logsByLevel[entry?.level] || 0) + 1;
      logsByContext[entry?.context] = (logsByContext[entry?.context] || 0) + 1;
    }

    return {
      totalLogs: this?.logHistory?.length,
      logsByLevel,
      logsByContext,
      averageLogsPerMinute: recentLogs?.length,
      bufferSize: this?.logBuffer?.length,
    };
  }

  /**
   * Start flush timer;
   */
  private startFlushTimer(): void {
    if (this?.flushTimer) {
      clearInterval(this?.flushTimer);
    }

    this?.flushTimer = setInterval(() => {
      this?.flush();
    }, this?.config?.flushInterval);
  }

  /**
   * Clean up old log entries;
   */
  private cleanupHistory(): void {
    const cutoff = Date?.now() - this?.config?.retentionPeriod;
    
    this?.logHistory = this?.logHistory?.filter(
      entry => new Date(entry?.timestamp).getTime() > cutoff;
    );
  }

  /**
   * Shutdown logger;
   */
  async shutdown(): Promise<void> {
    if (this?.flushTimer) {
      clearInterval(this?.flushTimer);
      this?.flushTimer = undefined;
    }

    // Final flush;
    this?.flush();

    // Close Winston transports;
    this?.logger?.close();

    this?.emit('shutdown');
  }
}

// Export utility functions for backward compatibility;
export function enhancedLoggerHelper(input: LoggingContext): EnhancedLogger {
  const logger = new EnhancedLogger();
  return logger;
}

// Export singleton instance;
export const enhancedLogger = new EnhancedLogger();

export default EnhancedLogger;
