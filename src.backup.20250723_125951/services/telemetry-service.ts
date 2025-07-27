/**
 * Enhanced OpenTelemetry Distributed Tracing Service
 *
 * Comprehensive telemetry service for Universal AI Tools with:
 * - Distributed tracing across all services
 * - Metrics collection and export
 * - Custom span instrumentation
 * - Performance monitoring
 * - Error tracking and correlation
 * - Service mesh visibility
 * - Sweet Athena specific tracing
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import type { Context, Span, Tracer } from '@opentelemetry/api';
import { SpanKind, SpanStatusCode, context, metrics, propagation, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { W3CBaggagePropagator } from '@opentelemetry/core';
import { CompositePropagator } from '@opentelemetry/core';
import {
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { EventEmitter } from 'events';
import { LogContext, logger } from '../utils/enhanced-logger';
import { getTelemetryConfig } from '../config/telemetry';

export interface TelemetryServiceOptions {
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  enableConsoleExporter?: boolean;
  enableJaeger?: boolean;
  enableZipkin?: boolean;
  enableOTLP?: boolean;
  enablePrometheus?: boolean;
  prometheusPort?: number;
  samplingRate?: number;
  debug?: boolean;
  metricsInterval?: number;
}

export interface CustomSpanData {
  name: string;
  attributes?: Record<string, unknown>;
  spanKind?: SpanKind;
  parentSpan?: Span;
}

export interface TraceMetadata {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  duration: number;
  status: 'success' | '_error | 'timeout';
  attributes: Record<string, unknown>;
  timestamp: Date;
}

export interface PerformanceTrace {
  operation: string;
  component: string;
  duration: number;
  success: boolean;
  metadata: Record<string, unknown>;
  traceId: string;
  timestamp: Date;
}

export class TelemetryService extends EventEmitter {
  private sdk: NodeSDK | null = null;
  private tracer: Tracer | null = null;
  private meter: any = null;
  private isInitialized = false;
  private activeSpans: Map<string, Span> = new Map();
  private performanceTraces: PerformanceTrace[] = [];
  private spanProcessors: SpanProcessor[] = [];
  private metricReaders: any[] = [];

  constructor() {
    super();

    // Setup_errorhandling
    this.on('_error, (error => {
      logger.error('Telemetry , LogContext.TELEMETRY, { error});
    });
  }

  async initialize(options: TelemetryServiceOptions = {}))): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Telemetry service already initialized', LogContext.SYSTEM);
      return;
    }

    const config = getTelemetryConfig();
    const mergedOptions = { ...config, ...options };

    // Enable debug logging if requested
    if (mergedOptions.debug) {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }

    try {
      // Create resource with service information
      const resource = Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]:
            mergedOptions.serviceName || 'universal-ai-tools',
          [SemanticResourceAttributes.SERVICE_VERSION]:
            mergedOptions.serviceVersion || process.env.npm_package_version || '1.0.0',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
            mergedOptions.environment || process.env.NODE_ENV || 'development',
          'service.instance.id': process.env.INSTANCE_ID || `instance-${Date.now()}`,
          'service.namespace': 'ai-tools',
        })
      );

      // Configure span processors
      const spanProcessors: SpanProcessor[] = [];

      if (mergedOptions.enableConsoleExporter) {
        spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
      }

      if (mergedOptions.enableJaeger) {
        const jaegerExporter = new JaegerExporter({
          endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
        });
        spanProcessors.push(new BatchSpanProcessor(jaegerExporter));
      }

      if (mergedOptions.enableZipkin) {
        const zipkinExporter = new ZipkinExporter({
          url: process.env.ZIPKIN_ENDPOINT || 'http://localhost:9411/api/v2/spans',
        });
        spanProcessors.push(new BatchSpanProcessor(zipkinExporter));
      }

      if (mergedOptions.enableOTLP) {
        const otlpExporter = new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
          headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
            ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
            : {},
        });
        spanProcessors.push(new BatchSpanProcessor(otlpExporter));
      }

      // Configure metrics
      this.metricReaders = [];

      if (mergedOptions.enablePrometheus) {
        const prometheusExporter = new PrometheusExporter({
          port: mergedOptions.prometheusPort || 9464,
          endpoint: '/metrics',
        });
        this.metricReaders.push(
          new PeriodicExportingMetricReader({
            exporter: prometheusExporter,
            exportIntervalMillis: mergedOptions.metricsInterval || 15000,
          })
        );
      }

      if (mergedOptions.enableConsoleExporter) {
        this.metricReaders.push(
          new PeriodicExportingMetricReader({
            exporter: new ConsoleMetricExporter(),
            exportIntervalMillis: mergedOptions.metricsInterval || 10000,
          })
        );
      }

      if (mergedOptions.enableOTLP) {
        this.metricReaders.push(
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url:
                process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
                'http://localhost:4318/v1/metrics',
              headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
                ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
                : {},
            }),
            exportIntervalMillis: mergedOptions.metricsInterval || 10000,
          })
        );
      }

      // Configure sampler
      const samplingRate = mergedOptions.samplingRate ?? 1.0;
      const sampler =;
        samplingRate === 1.0
          ? new AlwaysOnSampler()
          : new ParentBasedSampler({
              root: new TraceIdRatioBasedSampler(samplingRate),
            });

      // Configure propagators
      const propagators = new CompositePropagator({
        propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
      });
      propagation.setGlobalPropagator(propagators);

      // Store span processors for later use
      this.spanProcessors = spanProcessors;

      // Create and configure SDK
      this.sdk = new NodeSDK({
        resource,
        spanProcessors: this.spanProcessors as any,
        metricReader: this.metricReaders[0] as any,
        sampler,
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Disable fs instrumentation to reduce noise
            },
            '@opentelemetry/instrumentation-http': {
              enabled: true,
              requestHook: (span, request => {
                if ('headers' in request {
                  span.setAttributes({
                    'http.requestbody.size': requestheaders['content.length'] || 0,
                    'http.user_agent': requestheaders['user-agent'] || '',
                    'ai.service': requestheaders['x-ai-service'] || 'unknown',
                  });
                }
              },
              responseHook: (span, response => {
                if ('headers' in: response {
                  span.setAttributes({
                    'http.response.body.size': response.headers['content.length'] || 0,
                    'http.response.content_type': response.headers['content.type'] || '',
                  });
                }
              },
            },
            '@opentelemetry/instrumentation-express': { enabled: true, },
            '@opentelemetry/instrumentation-pg': { enabled: true, },
            '@opentelemetry/instrumentation-redis': { enabled: true, },
          }),
        ],
      });

      // Start the SDK
      await this.sdk.start();
      this.tracer = trace.getTracer(
        mergedOptions.serviceName || 'universal-ai-tools',
        mergedOptions.serviceVersion || '1.0.0'
      );
      this.meter = metrics.getMeter(
        mergedOptions.serviceName || 'universal-ai-tools',
        mergedOptions.serviceVersion || '1.0.0'
      );
      this.isInitialized = true;

      logger.info('Telemetry service initialized successfully', LogContext.SYSTEM, {
        serviceName: mergedOptions.serviceName,
        environment: mergedOptions.environment,
        exporters: {
          console: mergedOptions.enableConsoleExporter,
          jaeger: mergedOptions.enableJaeger,
          zipkin: mergedOptions.enableZipkin,
          otlp: mergedOptions.enableOTLP,
        },
        samplingRate,
      });
    } catch (error) {
      logger.error('Failed to initialize telemetry , LogContext.SYSTEM, { error});
      throw error;
    }
  }

  async shutdown())): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.isInitialized = false;
        this.tracer = null;
        this.activeSpans.clear();
        logger.info('Telemetry service shut down successfully', LogContext.SYSTEM);
      } catch (error) {
        logger.error('Error shutting down telemetry , LogContext.SYSTEM, { error});
      }
    }
  }

  getTracer(): Tracer {
    if (!this.tracer) {
      throw new Error('Telemetry service not initialized');
    }
    return this.tracer;
  }

  // Custom span creation for AI operations
  startAIOperation(operationName: string, attributes?: Record<string, unknown>): Span {
    const tracer = this.getTracer();
    const span = tracer.startSpan(operationName, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'ai.operation.type': operationName,
        'ai.timestamp': new Date().toISOString(),
        ...attributes,
      },
    });

    this.activeSpans.set(operationName, span;
    return span;
  }

  endAIOperation(operationName: string, status?: { code: SpanStatusCode; message?: string })): void {
    const span = this.activeSpans.get(operationName);
    if (span) {
      if (status) {
        span.setStatus(status);
      }
      span.end();
      this.activeSpans.delete(operationName);
    }
  }

  // Baggage propagation helpers
  setBaggage(key: string, value: string): void {
    const baggage = propagation.getBaggage(context.active()) || propagation.createBaggage();
    const updatedBaggage = baggage.setEntry(key, { value });
    propagation.setBaggage(context.active(), updatedBaggage);
  }

  getBaggage(key: string | undefined {
    const baggage = propagation.getBaggage(context.active());
    return baggage?.getEntry(key)?.value;
  }

  // Context propagation helpers
  extractContext(headers: Record<string, string | string[] | undefined>): Context {
    return propagation.extract(context.active(), headers);
  }

  injectContext(headers: Record<string, string>)): void {
    propagation.inject(context.active(), headers);
  }

  // Utility method to run function with span
  async withSpan<T>(
    spanName: string,
    fn: (span: Span => Promise<T>,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, unknown>;
    }
  ): Promise<T> {
    const tracer = this.getTracer();
    const span = tracer.startSpan(spanName, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  // Add custom attributes to current span
  addAttributesToCurrentSpan(attributes: Record<string, unknown>)): void {
    const span = trace.getActiveSpan();
    if (span) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value;
      });
    }
  }

  // Record an event in the current span
  recordEvent(name: string, attributes?: Record<string, unknown>)): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes;
    }
  }

  // Get current trace ID
  getCurrentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().traceId;
  }

  // Get current span ID
  getCurrentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().spanId;
  }

  /**
   * Create a custom span for operation tracking
   */
  createSpan(spanData: CustomSpanData: Span | null {
    if (!this.tracer) {
      return null;
    }

    try {
      const { name, attributes = {}, spanKind = SpanKind.INTERNAL, parentSpan } = spanData;

      const span = parentSpan;
        ? this.tracer.startSpan(name, { kind: spanKind, parent: parentSpan, }, context.active())
        : this.tracer.startSpan(name, { kind: spanKind, });

      // Add standard attributes
      span.setAttributes({
        'service.name': 'universal-ai-tools',
        'service.version': '1.0.0',
        ...attributes,
      });

      // Track active span
      const spanContext = span.spanContext();
      this.activeSpans.set(spanContext.spanId, span;

      logger.debug('Created custom span', LogContext.TELEMETRY, {
        span_name: name,
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
        attributes,
      });

      return span;
    } catch (error) {
      logger.error('Failed to create custom , LogContext.TELEMETRY, {
        _error
        span_name: spanData.name,
      });
      return null;
    }
  }

  /**
   * End a span with optional metadata
   */
  endSpan(
    span: Span,
    metadata?: { success?: boolean; error: Error; attributes?: Record<string, unknown> }
  )): void {
    if (!span) return;

    try {
      const spanContext = span.spanContext();

      if (metadata) {
        const { success = true, error attributes = {} } = metadata;

        // Set status
        if (_error: {
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.setAttributes({
            _error true,
            'error.name': error.name,
            'error.message': error.message,
            'error.stack': error.stack,
          });
        } else if (success) {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        // Add additional attributes
        if (Object.keys(attributes).length > 0) {
          span.setAttributes(attributes);
        }
      }

      span.end();
      this.activeSpans.delete(spanContext.spanId);

      logger.debug('Ended span', LogContext.TELEMETRY, {
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
        success: !metadata?._error
      });
    } catch (error) {
      logger.error('Failed to end , LogContext.TELEMETRY, { error});
    }
  }

  /**
   * Trace an async operation
   */
  async traceOperation<T>(
    operationName: string,
    operation: (span: Span => Promise<T>,
    options?: {
      attributes?: Record<string, unknown>;
      spanKind?: SpanKind;
      parentSpan?: Span;
    }
  ): Promise<T> {
    const span = this.createSpan({
      name: operationName,
      attributes: options?.attributes,
      spanKind: options?.spanKind,
      parentSpan: options?.parentSpan,
    });

    if (!span) {
      // If span creation failed, still execute operation
      return operation(null as any);
    }

    const startTime = Date.now();

    try {
      const result = await operation(span);

      const duration = Date.now() - startTime;
      this.recordPerformanceTrace({
        operation: operationName,
        component: 'universal-ai-tools',
        duration,
        success: true,
        metadata: options?.attributes || {},
        traceId: span.spanContext().traceId,
        timestamp: new Date(),
      });

      this.endSpan(span, { success: true, attributes: { 'operation.duration_ms': duration } });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformanceTrace({
        operation: operationName,
        component: 'universal-ai-tools',
        duration,
        success: false,
        metadata: { _error error instanceof Error ? error.message : String(_error },
        traceId: span.spanContext().traceId,
        timestamp: new Date(),
      });

      this.endSpan(span, {
        success: false,
        _error error instanceof Error ? error: new Error(String(_error),
        attributes: { 'operation.duration_ms': duration },
      });
      throw error;
    }
  }

  /**
   * Trace Sweet Athena specific operations
   */
  async traceAthenaOperation<T>(
    operationType: string,
    personalityMood: string,
    operation: (span: Span => Promise<T>,
    sessionId?: string
  ): Promise<T> {
    return this.traceOperation(`athena.${operationType}`, operation, {`
      attributes: {
        'athena.personality_mood': personalityMood,
        'athena.session_id': sessionId || 'unknown',
        'athena.operation_type': operationType,
        'ai.service': 'sweet-athena',
      },
      spanKind: SpanKind.SERVER,
    });
  }

  /**
   * Trace database operations with enhanced metadata
   */
  async traceDatabaseOperation<T>(
    table: string,
    operation: string,
    dbOperation: (span: Span => Promise<T>,
    queryMetadata?: Record<string, unknown>
  ): Promise<T> {
    return this.traceOperation(`db.${operation}`, dbOperation, {`
      attributes: {
        'db.table': table,
        'db.operation': operation,
        'db.system': 'postgresql',
        ...queryMetadata,
      },
      spanKind: SpanKind.CLIENT,
    });
  }

  /**
   * Get current trace context
   */
  getCurrentTraceContext(): { traceId: string; spanId: string, } | null {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) return null;

    const spanContext = activeSpan.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
    };
  }

  /**
   * Get performance traces
   */
  getPerformanceTraces(limit = 100): PerformanceTrace[] {
    return this.performanceTraces.slice(-limit);
  }

  /**
   * Clear performance traces
   */
  clearPerformanceTraces()): void {
    this.performanceTraces = [];
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(): {
    activeSpans: number;
    totalTraces: number;
    averageResponseTime: number;
    errorRate: number;
  } {
    const totalTraces = this.performanceTraces.length;
    const successfulTraces = this.performanceTraces.filter((t) => t.success).length;
    const averageResponseTime =;
      totalTraces > 0
        ? this.performanceTraces.reduce((sum, t) => sum + t.duration, 0) / totalTraces
        : 0;
    const errorRate = totalTraces > 0 ? ((totalTraces - successfulTraces) / totalTraces) * 100 : 0;

    return {
      activeSpans: this.activeSpans.size,
      totalTraces,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  /**
   * Record performance trace
   */
  private recordPerformanceTrace(trace: PerformanceTrace): void {
    this.performanceTraces.push(trace);

    // Keep only last 1000 traces
    if (this.performanceTraces.length > 1000) {
      this.performanceTraces = this.performanceTraces.slice(-1000);
    }

    this.emit('performanceTrace', trace);
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring()): void {
    setInterval(() => {
      const metrics = this.getServiceMetrics();

      logger.debug('Telemetry performance metrics', LogContext.TELEMETRY, metrics;
      this.emit('performanceMetrics', metrics);

      // Clean up old traces (older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      this.performanceTraces = this.performanceTraces.filter((t) => t.timestamp > oneHourAgo);
    }, 60000); // Every minute
  }
}

// Export singleton instance
export const telemetryService = new TelemetryService();

// Export types and utilities
export type { SpanStatusCode, SpanKind, Context };
export type { Span, Tracer };
