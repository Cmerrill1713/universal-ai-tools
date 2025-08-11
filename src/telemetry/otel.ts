import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import type { MetricReader } from '@opentelemetry/sdk-metrics';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Initialize OpenTelemetry Node SDK with auto-instrumentations.
// This module is imported for its side effects and should be loaded as early as possible.

const serviceName = process.env.OTEL_SERVICE_NAME || 'universal-ai-tools';
const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0';

const traceExporter = new OTLPTraceExporter({
  // Defaults to OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
});

const metricExporter = new OTLPMetricExporter({});
const metricReader: MetricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
}) as unknown as MetricReader;

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
  }),
  traceExporter,
  metricReader: metricReader as any,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

// Start immediately; failures should not crash the app.
// Some SDK versions may not return a Promise from start(), so avoid chaining .catch directly.
try {
  void sdk.start();
} catch {
  // noop: telemetry is best-effort
}

// Graceful shutdown hooks in case the process exits
process.once('SIGTERM', () => {
  sdk
    .shutdown()
    .catch(() => {})
    .finally(() => process.exit(0));
});

export {}; // keep as a module
