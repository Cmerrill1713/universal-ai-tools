/**
 * OpenTelemetry Distributed Tracing Setup
 * Provides end-to-end request tracking across all services
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import * as api from '@opentelemetry/api';
import { LogContext, log } from './logger';

// Create resource identifying the service
const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'universal-ai-tools',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  })
);

// Configure OTLP exporter - can be configured to send to Jaeger, Zipkin, etc.
function parseOTLPHeaders(): Record<string, string> {
  const headersEnv = process.env.OTEL_EXPORTER_OTLP_HEADERS;
  if (!headersEnv) return {};
  
  try {
    const parsed = JSON.parse(headersEnv);
    // Validate that parsed result is an object with string values
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      log.warn('Invalid OTEL_EXPORTER_OTLP_HEADERS format, using empty headers', LogContext.SYSTEM);
      return {};
    }
    
    // Ensure all values are strings
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === 'string' && typeof value === 'string') {
        headers[key] = value;
      }
    }
    
    return headers;
  } catch (error) {
    log.warn('Failed to parse OTEL_EXPORTER_OTLP_HEADERS, using empty headers', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  headers: parseOTLPHeaders(),
  timeoutMillis: 30000, // 30 second timeout for exports
});

// Create SDK with auto-instrumentation
const sdk = new NodeSDK({
  resource,
  spanProcessor: new BatchSpanProcessor(traceExporter),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable fs instrumentation to reduce noise
      },
    }),
  ],
  metricReader: new PeriodicExportingMetricReader({
    exporter: new ConsoleMetricExporter(),
    exportIntervalMillis: 60000, // Export metrics every minute
  }),
});

// Initialize the SDK
export async function initializeTracing(): Promise<void> {
  try {
    await sdk.start();
    log.info('🔭 OpenTelemetry tracing initialized', LogContext.SYSTEM, {
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      serviceName: 'universal-ai-tools',
    });
  } catch (error) {
    log.error('❌ Failed to initialize OpenTelemetry', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Graceful shutdown
export async function shutdownTracing(): Promise<void> {
  try {
    await sdk.shutdown();
    log.info('🛑 OpenTelemetry tracing shut down', LogContext.SYSTEM);
  } catch (error) {
    log.error('❌ Error shutting down OpenTelemetry', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Get the configured tracer
export function getTracer(name = 'universal-ai-tools'): api.Tracer {
  return api.trace.getTracer(name);
}

// Helper to create a span with automatic error handling
export function createSpan(
  name: string,
  options?: api.SpanOptions
): api.Span {
  const tracer = getTracer();
  return tracer.startSpan(name, options);
}

// Helper to trace async functions
export async function traceAsync<T>(
  name: string,
  fn: (span: api.Span) => Promise<T>,
  options?: api.SpanOptions
): Promise<T> {
  const span = createSpan(name, options);
  
  try {
    const result = await fn(span);
    span.setStatus({ code: api.SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({ 
      code: api.SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

// Helper to add correlation ID to spans
export function addCorrelationId(span: api.Span, correlationId: string): void {
  span.setAttribute('correlation_id', correlationId);
}

// Get current span
export function getCurrentSpan(): api.Span | undefined {
  return api.trace.getActiveSpan();
}

// Extract trace context for propagation
export function extractTraceContext(): api.Context {
  return api.context.active();
}

// Inject trace context for propagation
export function injectTraceContext(carrier: Record<string, string>): void {
  api.propagation.inject(api.context.active(), carrier);
}