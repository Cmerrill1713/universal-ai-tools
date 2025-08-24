/**
 * Distributed Tracing Service
 * Request tracing across services for performance analysis and debugging
 */

import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';
import EventEmitter from 'events';

import { log, LogContext } from '../../utils/logger';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'ok' | 'error' | 'cancelled';
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    fields?: Record<string, any>;
  }>;
  error?: Error;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

export interface TraceHeader {
  'x-trace-id': string;
  'x-span-id': string;
  'x-parent-span-id'?: string;
}

export class DistributedTracingService extends EventEmitter {
  private spans = new Map<string, TraceSpan>();
  private activeTraces = new Map<string, TraceSpan[]>();
  private readonly asyncStorage = new AsyncLocalStorage<TraceContext>();
  
  private readonly MAX_SPANS = 10000;
  private readonly MAX_TRACE_DURATION = 3600000; // 1 hour
  
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor() {
    super();
    this.startCleanup();
  }

  /**
   * Start a new trace
   */
  startTrace(operationName: string, parentContext?: TraceContext): TraceSpan {
    const traceId = parentContext?.traceId || this.generateId();
    const spanId = this.generateId();
    const parentSpanId = parentContext?.spanId;

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      serviceName: 'universal-ai-tools',
      startTime: Date.now(),
      status: 'ok',
      tags: {},
      logs: []
    };

    this.spans.set(spanId, span);
    
    // Add to active traces
    if (!this.activeTraces.has(traceId)) {
      this.activeTraces.set(traceId, []);
    }
    this.activeTraces.get(traceId)!.push(span);

    // Set async context
    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
      baggage: parentContext?.baggage
    };

    this.asyncStorage.enterWith(context);

    this.emit('spanStart', span);
    
    log.debug('Started trace span', LogContext.MONITORING, {
      traceId,
      spanId,
      operationName,
      parentSpanId
    });

    return span;
  }

  /**
   * Finish a span
   */
  finishSpan(spanId: string, error?: Error): void {
    const span = this.spans.get(spanId);
    if (!span) {
      log.warn('Attempted to finish non-existent span', LogContext.MONITORING, { spanId });
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    
    if (error) {
      span.status = 'error';
      span.error = error;
      span.tags.error = true;
      span.tags.errorMessage = error.message;
      span.tags.errorStack = error.stack;
    }

    this.emit('spanFinish', span);

    log.debug('Finished trace span', LogContext.MONITORING, {
      traceId: span.traceId,
      spanId: span.spanId,
      duration: span.duration,
      status: span.status,
      operationName: span.operationName
    });

    // Check if this completes a trace
    this.checkTraceCompletion(span.traceId);
  }

  /**
   * Get current trace context
   */
  getCurrentContext(): TraceContext | undefined {
    return this.asyncStorage.getStore();
  }

  /**
   * Create child span from current context
   */
  createChildSpan(operationName: string, tags?: Record<string, any>): TraceSpan {
    const parentContext = this.getCurrentContext();
    const span = this.startTrace(operationName, parentContext);
    
    if (tags) {
      Object.assign(span.tags, tags);
    }

    return span;
  }

  /**
   * Add tags to current span
   */
  setSpanTags(tags: Record<string, any>): void {
    const context = this.getCurrentContext();
    if (!context) {return;}

    const span = this.spans.get(context.spanId);
    if (!span) {return;}

    Object.assign(span.tags, tags);
  }

  /**
   * Add log entry to current span
   */
  logToSpan(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    fields?: Record<string, any>
  ): void {
    const context = this.getCurrentContext();
    if (!context) {return;}

    const span = this.spans.get(context.spanId);
    if (!span) {return;}

    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      fields
    });
  }

  /**
   * Extract trace context from HTTP headers
   */
  extractFromHeaders(headers: Record<string, string | string[] | undefined>): TraceContext | null {
    const traceId = this.getHeaderValue(headers['x-trace-id']);
    const spanId = this.getHeaderValue(headers['x-span-id']);
    const parentSpanId = this.getHeaderValue(headers['x-parent-span-id']);

    if (!traceId || !spanId) {
      return null;
    }

    return {
      traceId,
      spanId,
      parentSpanId,
      baggage: {}
    };
  }

  /**
   * Inject trace context into HTTP headers
   */
  injectIntoHeaders(context?: TraceContext): TraceHeader {
    const currentContext = context || this.getCurrentContext();
    
    if (!currentContext) {
      // Create new trace for outbound request
      const traceId = this.generateId();
      const spanId = this.generateId();
      
      return {
        'x-trace-id': traceId,
        'x-span-id': spanId
      };
    }

    const headers: TraceHeader = {
      'x-trace-id': currentContext.traceId,
      'x-span-id': currentContext.spanId
    };

    if (currentContext.parentSpanId) {
      headers['x-parent-span-id'] = currentContext.parentSpanId;
    }

    return headers;
  }

  /**
   * Get complete trace by ID
   */
  getTrace(traceId: string): TraceSpan[] | undefined {
    return this.activeTraces.get(traceId);
  }

  /**
   * Get span by ID
   */
  getSpan(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get all active traces
   */
  getActiveTraces(): Map<string, TraceSpan[]> {
    return new Map(this.activeTraces);
  }

  /**
   * Get traces with performance issues
   */
  getSlowTraces(durationThreshold = 5000): TraceSpan[] {
    const slowSpans: TraceSpan[] = [];
    
    for (const span of this.spans.values()) {
      if (span.duration && span.duration > durationThreshold) {
        slowSpans.push(span);
      }
    }

    return slowSpans.sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }

  /**
   * Get error traces
   */
  getErrorTraces(): TraceSpan[] {
    const errorSpans: TraceSpan[] = [];
    
    for (const span of this.spans.values()) {
      if (span.status === 'error') {
        errorSpans.push(span);
      }
    }

    return errorSpans.sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get trace statistics
   */
  getTraceStats(): {
    totalTraces: number;
    activeTraces: number;
    totalSpans: number;
    errorRate: number;
    avgDuration: number;
    p95Duration: number;
  } {
    const allSpans = Array.from(this.spans.values());
    const completedSpans = allSpans.filter(s => s.duration !== undefined);
    const errorSpans = allSpans.filter(s => s.status === 'error');
    
    const durations = completedSpans
      .map(s => s.duration!)
      .sort((a, b) => a - b);
    
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;
    
    const p95Index = Math.floor(durations.length * 0.95);
    const p95Duration = durations[p95Index] || 0;

    return {
      totalTraces: this.activeTraces.size,
      activeTraces: Array.from(this.activeTraces.values())
        .filter(spans => spans.some(s => !s.endTime)).length,
      totalSpans: this.spans.size,
      errorRate: allSpans.length > 0 ? (errorSpans.length / allSpans.length) * 100 : 0,
      avgDuration,
      p95Duration
    };
  }

  /**
   * Export traces in Jaeger format
   */
  exportJaegerFormat(): any {
    const traces = [];
    
    for (const [traceId, spans] of this.activeTraces.entries()) {
      const processes = new Map();
      const jaegerSpans = [];

      for (const span of spans) {
        const processKey = span.serviceName;
        if (!processes.has(processKey)) {
          processes.set(processKey, {
            serviceName: span.serviceName,
            tags: []
          });
        }

        jaegerSpans.push({
          traceID: span.traceId,
          spanID: span.spanId,
          parentSpanID: span.parentSpanId || '',
          operationName: span.operationName,
          startTime: span.startTime * 1000, // microseconds
          duration: (span.duration || 0) * 1000, // microseconds
          tags: Object.entries(span.tags).map(([key, value]) => ({
            key,
            type: typeof value === 'string' ? 'string' : 'number',
            value: String(value)
          })),
          logs: span.logs.map(log => ({
            timestamp: log.timestamp * 1000,
            fields: [
              { key: 'level', value: log.level },
              { key: 'message', value: log.message },
              ...(log.fields ? Object.entries(log.fields).map(([k, v]) => ({
                key: k,
                value: String(v)
              })) : [])
            ]
          })),
          processID: processKey
        });
      }

      traces.push({
        traceID: traceId,
        spans: jaegerSpans,
        processes: Object.fromEntries(
          Array.from(processes.entries()).map(([key, value]) => [key, value])
        )
      });
    }

    return { data: traces };
  }

  /**
   * Create middleware for Express.js
   */
  createExpressMiddleware() {
    return (req: any, res: any, next: any) => {
      // Extract trace context from headers
      const parentContext = this.extractFromHeaders(req.headers);
      
      // Start new span for this request
      const span = this.startTrace(`${req.method} ${req.path}`, parentContext || undefined);
      
      // Add request tags
      span.tags = {
        'http.method': req.method,
        'http.url': req.originalUrl || req.url,
        'http.user_agent': req.get('User-Agent'),
        'http.remote_addr': req.ip || req.connection.remoteAddress,
        'http.request_size': req.get('Content-Length') || 0
      };

      // Store span in request for later access
      req.traceSpan = span;
      req.traceContext = this.getCurrentContext();

      // Hook into response to finish span
      const originalSend = res.send;
      res.send = function(body: any) {
        span.tags['http.status_code'] = res.statusCode;
        span.tags['http.response_size'] = Buffer.byteLength(body || '', 'utf8');
        
        if (res.statusCode >= 400) {
          span.status = 'error';
          span.tags.error = true;
          span.tags.errorMessage = `HTTP ${res.statusCode}`;
        }

        this.finishSpan(span.spanId);
        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Automatically instrument common operations
   */
  instrument<T>(
    operationName: string,
    operation: () => Promise<T> | T,
    tags?: Record<string, any>
  ): Promise<T> {
    const span = this.createChildSpan(operationName, tags);
    
    try {
      const result = operation();
      
      if (result instanceof Promise) {
        return result
          .then(value => {
            this.finishSpan(span.spanId);
            return value;
          })
          .catch(error => {
            this.finishSpan(span.spanId, error);
            throw error;
          });
      } else {
        this.finishSpan(span.spanId);
        return Promise.resolve(result);
      }
    } catch (error) {
      this.finishSpan(span.spanId, error as Error);
      throw error;
    }
  }

  /**
   * Clean up old traces and spans
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000); // 5 minutes
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.MAX_TRACE_DURATION;
    
    // Clean up old spans
    for (const [spanId, span] of this.spans.entries()) {
      if (span.startTime < cutoff) {
        this.spans.delete(spanId);
      }
    }

    // Clean up completed traces
    for (const [traceId, spans] of this.activeTraces.entries()) {
      const allCompleted = spans.every(span => span.endTime !== undefined);
      const isOld = spans.every(span => span.startTime < cutoff);
      
      if (allCompleted || isOld) {
        this.activeTraces.delete(traceId);
      }
    }

    // Enforce max spans limit
    if (this.spans.size > this.MAX_SPANS) {
      const sortedSpans = Array.from(this.spans.entries())
        .sort(([, a], [, b]) => a.startTime - b.startTime);
      
      const toRemove = sortedSpans.slice(0, this.spans.size - this.MAX_SPANS);
      for (const [spanId] of toRemove) {
        this.spans.delete(spanId);
      }
    }

    log.debug('Cleaned up old traces', LogContext.MONITORING, {
      totalSpans: this.spans.size,
      activeTraces: this.activeTraces.size
    });
  }

  private checkTraceCompletion(traceId: string): void {
    const spans = this.activeTraces.get(traceId);
    if (!spans) {return;}

    const allCompleted = spans.every(span => span.endTime !== undefined);
    if (allCompleted) {
      const duration = Math.max(...spans.map(s => s.endTime!)) - Math.min(...spans.map(s => s.startTime));
      
      this.emit('traceComplete', {
        traceId,
        spans,
        duration,
        spanCount: spans.length,
        hasErrors: spans.some(s => s.status === 'error')
      });
    }
  }

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private getHeaderValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  /**
   * Stop the service and cleanup
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval as NodeJS.Timeout);
      this.cleanupInterval = null;
    }
    
    this.spans.clear();
    this.activeTraces.clear();
    
    log.info('Distributed tracing service stopped', LogContext.MONITORING);
  }
}

// Singleton instance
export const distributedTracingService = new DistributedTracingService();