import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
const serviceName = process.env.OTEL_SERVICE_NAME || 'universal-ai-tools';
const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0';
const traceExporter = new OTLPTraceExporter({});
const metricExporter = new OTLPMetricExporter({});
const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
});
const sdk = new NodeSDK({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    }),
    traceExporter,
    metricReader: metricReader,
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
    ],
});
try {
    void sdk.start();
}
catch {
}
process.once('SIGTERM', () => {
    sdk
        .shutdown()
        .catch(() => { })
        .finally(() => process.exit(0));
});
//# sourceMappingURL=otel.js.map