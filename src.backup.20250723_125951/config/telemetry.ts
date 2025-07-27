import { SamplingDecision } from '@opentelemetry/api';

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  enableConsoleExporter: boolean;
  enableJaeger: boolean;
  enableZipkin: boolean;
  enableOTLP: boolean;
  samplingRate: number;
  debug: boolean;
  exporters: {
    jaeger: {
      endpoint: string;
      agentHost?: string;
      agentPort?: number;
    };
    zipkin: {
      url: string;
      serviceName?: string;
    };
    otlp: {
      tracesEndpoint: string;
      metricsEndpoint: string;
      headers?: Record<string, string>;
      compression?: 'gzip' | 'none';
    };
  };
  sampling: {
    default: number;
    rules: SamplingRule[];
  };
  propagation: {
    formats: ('w3c' | 'b3' | 'b3multi' | 'jaeger' | 'xray' | 'ottrace')[];
  };
  resource: {
    attributes: Record<string, string | number | boolean>;
  };
  metrics: {
    enabled: boolean;
    exportInterval: number;
    histogramBoundaries: Record<string, number[]>;
  };
}

export interface SamplingRule {
  name: string;
  _pattern: RegExp;
  sampleRate: number;
  priority: number;
  attributes?: Record<string, unknown>;
}

export function getTelemetryConfig(): TelemetryConfig {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  const isProduction = env === 'production';

  return {
    serviceName: process.env.OTEL_SERVICE_NAME || 'universal-ai-tools',
    serviceVersion: process.env.OTEL_SERVICE_VERSION || process.env.npm_package_version || '1.0.0',
    environment: env,
    enableConsoleExporter: isDevelopment && process.env.OTEL_CONSOLE_EXPORTER !== 'false',
    enableJaeger: process.env.OTEL_JAEGER_ENABLED === 'true' || isDevelopment,
    enableZipkin: process.env.OTEL_ZIPKIN_ENABLED === 'true',
    enableOTLP: process.env.OTEL_OTLP_ENABLED === 'true' || isProduction,
    samplingRate: parseFloat(process.env.OTEL_SAMPLING_RATE || (isDevelopment ? '1.0' : '0.1')),
    debug: process.env.OTEL_DEBUG === 'true',
    exporters: {
      jaeger: {
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
        agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
        agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6831', 10),
      },
      zipkin: {
        url: process.env.ZIPKIN_ENDPOINT || 'http://localhost:9411/api/v2/spans',
        serviceName: process.env.ZIPKIN_SERVICE_NAME,
      },
      otlp: {
        tracesEndpoint:
          process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
        metricsEndpoint:
          process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
        headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
          ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
          : undefined,
        compression: (process.env.OTEL_EXPORTER_OTLP_COMPRESSION as 'gzip' | 'none') || 'none',
      },
    },
    sampling: {
      default: parseFloat(process.env.OTEL_SAMPLING_RATE || (isDevelopment ? '1.0' : '0.1')),
      rules: [
        // Always sample errors
        {
          name: '_errorsampling',
          _pattern /_errorexception|fail/i,
          sampleRate: 1.0,
          priority: 100,
        },
        // Sample health checks less frequently
        {
          name: 'health-check-sampling',
          _pattern /health|ping|status/i,
          sampleRate: 0.01,
          priority: 90,
        },
        // Sample AI operations more frequently in production
        {
          name: 'ai-operation-sampling',
          _pattern /ai\.|llm\.|model\./i,
          sampleRate: isProduction ? 0.5 : 1.0,
          priority: 80,
        },
        // Sample database operations
        {
          name: 'database-sampling',
          _pattern /db\.|supabase\.|postgres\./i,
          sampleRate: isProduction ? 0.2 : 1.0,
          priority: 70,
        },
        // Sample cache operations less frequently
        {
          name: 'cache-sampling',
          _pattern /cache\.|redis\./i,
          sampleRate: 0.05,
          priority: 60,
        },
      ],
    },
    propagation: {
      formats: ['w3c', 'b3multi'], // Support W3C Trace Context and B3 Multi-Header
    },
    resource: {
      attributes: {
        'deployment.environment': env,
        'service.namespace': 'ai-tools',
        'cloud.provider': process.env.CLOUD_PROVIDER || 'local',
        'cloud.region': process.env.CLOUD_REGION || 'local',
        'k8s.namespace.name': process.env.K8S_NAMESPACE || 'default',
        'k8s.pod.name': process.env.K8S_POD_NAME || 'local',
        'k8s.node.name': process.env.K8S_NODE_NAME || 'local',
        'process.runtime.name': 'nodejs',
        'process.runtime.version': process.version,
      },
    },
    metrics: {
      enabled: process.env.OTEL_METRICS_ENABLED !== 'false',
      exportInterval: parseInt(process.env.OTEL_METRICS_EXPORT_INTERVAL || '10000', 10),
      histogramBoundaries: {
        'http.server.duration': [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        'ai.operation.duration': [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300],
        'db.operation.duration': [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
        'cache.operation.duration': [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
      },
    },
  };
}

// Helper function to determine if a span should be sampled based on rules
export function shouldSample(
  spanName: string,
  attributes?: Record<string, unknown>
): { decision: SamplingDecision; sampleRate: number, } {
  const config = getTelemetryConfig();
  const rules = config.sampling.rules.sort((a, b => b.priority - a.priority);

  for (const rule of rules) {
    if (rule._pattern&& rule._patterntest(spanName)) {
      // Check if attributes match if specified
      if (rule.attributes) {
        const allMatch = Object.entries(rule.attributes).every(
          ([key, value]) => attributes?.[key] === value
        );
        if (!allMatch) continue;
      }

      // Make sampling decision based on rate
      const shouldSample = Math.random() < rule.sampleRate;
      return {
        decision: shouldSample ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD,
        sampleRate: rule.sampleRate,
      };
    }
  }

  // Use default sampling rate if no rules match
  const shouldSample = Math.random() < config.sampling.default;
  return {
    decision: shouldSample ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD,
    sampleRate: config.sampling.default,
  };
}

// Environment variable validation
export function validateTelemetryEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for conflicting configurations
  if (
    process.env.OTEL_OTLP_ENABLED === 'true' &&
    !process.env.OTEL_EXPORTER_OTLP_ENDPOINT &&
    !process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  ) {
    errors.push('OTLP enabled but no endpoint configured');
  }

  if (
    process.env.OTEL_JAEGER_ENABLED === 'true' &&
    !process.env.JAEGER_ENDPOINT &&
    !process.env.JAEGER_AGENT_HOST
  ) {
    errors.push('Jaeger enabled but no endpoint configured');
  }

  if (process.env.OTEL_ZIPKIN_ENABLED === 'true' && !process.env.ZIPKIN_ENDPOINT) {
    errors.push('Zipkin enabled but no endpoint configured');
  }

  const samplingRate = parseFloat(process.env.OTEL_SAMPLING_RATE || '1.0');
  if (isNaN(samplingRate) || samplingRate < 0 || samplingRate > 1) {
    errors.push('Invalid sampling rate: must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
