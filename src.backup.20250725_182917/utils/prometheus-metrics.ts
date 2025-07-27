 
/**;
 * Prometheus Metrics Collector for Universal AI Tools
 *
 * Comprehensive metrics collection for Sweet Athena interactions,
 * system performance, API usage, and application health
 */
import createPrometheusMetrics from 'prometheus-api-metrics';
import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from 'prom-client';

// Lazy initialization flag to prevent blocking during startup
let defaultMetricsInitialized = false;
let defaultMetricsInitializing = false;

// API Metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'ai_service'],
});

export const httpRequestDuration = new Histogram({
  name: 'httprequestduration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'ai_service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const httpRequestSize = new Histogram({
  name: 'httprequestsize_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route', 'ai_service'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

export const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code', 'ai_service'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

// Sweet Athena Specific Metrics
export const athenaInteractionsTotal = new Counter({
  name: 'athena_interactions_total',
  help: 'Total number of Sweet Athena interactions',
  labelNames: ['interaction_type', 'personality_mood', 'user_id', 'session_id'],
});

export const athenaResponseTime = new Histogram({
  name: 'athena_response_time_seconds',
  help: 'Sweet Athena response time in seconds',
  labelNames: ['interaction_type', 'personality_mood', 'model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export const athenaConversationLength = new Histogram({
  name: 'athena_conversation_length',
  help: 'Length of Sweet Athena conversations (number of turns)',
  labelNames: ['session_id', 'personality_mood'],
  buckets: [1, 5, 10, 20, 50, 100],
});

export const athenaSweetnessLevel = new Gauge({
  name: 'athena_sweetness_level',
  help: 'Current Sweet Athena sweetness level (1-10)',
  labelNames: ['session_id', 'personality_mood'],
});

export const athenaUserSatisfaction = new Histogram({
  name: 'athena_user_satisfaction',
  help: 'User satisfaction score for Sweet Athena interactions',
  labelNames: ['interaction_type', 'personality_mood'],
  buckets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
});

export const athenaAnimationFrameRate = new Gauge({
  name: 'athena_animation_frame_rate',
  help: 'Sweet Athena avatar animation frame rate',
  labelNames: ['animation_type', 'mood'],
});

export const athenaAvatarRenderTime = new Histogram({
  name: 'athena_avatar_render_time_ms',
  help: 'Sweet Athena avatar rendering time in milliseconds',
  labelNames: ['animation_type', 'mood', 'device_type'],
  buckets: [1, 5, 10, 20, 50, 100, 200, 500],
});

// Memory System Metrics
export const memoryOperationsTotal = new Counter({
  name: 'memory_operations_total',
  help: 'Total number of memory operations',
  labelNames: ['operation_type', 'memory_type', 'ai_service'],
});

export const memoryQueryTime = new Histogram({
  name: 'memory_query_time_seconds',
  help: 'Memory query execution time',
  labelNames: ['operation_type', 'memory_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const memoryStorageSize = new Gauge({
  name: 'memory_storage_size_bytes',
  help: 'Total memory storage size in bytes',
  labelNames: ['memory_type', 'ai_service'],
});

export const memorySearchAccuracy = new Histogram({
  name: 'memory_search_accuracy',
  help: 'Memory search accuracy score (0-1)',
  labelNames: ['memory_type', 'query_type'],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
});

// Database Metrics
export const databaseConnectionsActive = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
});

export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['table', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const databaseErrors = new Counter({
  name: 'database_errors_total',
  help: 'Total number of database errors',
  labelNames: ['table', 'operation', 'error_type'],
});

// AI Model Metrics
export const aiModelInferenceTime = new Histogram({
  name: 'ai_model_inference_time_seconds',
  help: 'AI model inference time in seconds',
  labelNames: ['model_name', 'model_type', 'task_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});

export const aiModelTokensProcessed = new Counter({
  name: 'ai_model_tokens_processed_total',
  help: 'Total number of tokens processed by AI models',
  labelNames: ['model_name', 'model_type', 'direction'],
});

export const aiModelMemoryUsage = new Gauge({
  name: 'ai_model_memory_usage_bytes',
  help: 'AI model memory usage in bytes',
  labelNames: ['model_name', 'model_type'],
});

export const aiModelGpuUtilization = new Gauge({
  name: 'ai_model_gpu_utilization_percent',
  help: 'AI model GPU utilization percentage',
  labelNames: ['model_name', 'gpu_id'],
});

// System Health Metrics
export const systemHealthScore = new Gauge({
  name: 'system_health_score',
  help: 'Overall system health score (0-100)',
  labelNames: ['component'],
});

export const errorRate = new Gauge({
  name: 'error_rate_percent',
  help: 'Error rate percentage over last 5 minutes',
  labelNames: ['component', 'error_type'],
});

export const serviceUptime = new Gauge({
  name: 'service_uptime_seconds',
  help: 'Service uptime in seconds',
  labelNames: ['service_name'],
});

// Security Metrics
export const securityEvents = new Counter({
  name: 'security_events_total',
  help: 'Total number of security events',
  labelNames: ['event_type', 'severity', 'source_ip'],
});

export const authenticationAttempts = new Counter({
  name: 'authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status', 'ai_service', 'source_ip'],
});

export const rateLimitHits = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'ai_service', 'source_ip'],
});

// Performance Metrics
export const cpuUsagePercent = new Gauge({
  name: 'cpu_usage_percent',
  help: 'CPU usage percentage',
});

export const memoryUsageBytes = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'], // heap_used', heap_total, external, rss;
});

export const diskUsageBytes = new Gauge({
  name: 'disk_usage_bytes',
  help: 'Disk usage in bytes',
  labelNames: ['mount_point', 'device'],
});

export const networkBytesTotal = new Counter({
  name: 'network_bytes_total',
  help: 'Total network bytes',
  labelNames: ['direction', 'interface'], // in/out, eth0/wlan0;
});

// Test Metrics
export const testExecutionsTotal = new Counter({
  name: 'test_executions_total',
  help: 'Total number of test executions',
  labelNames: ['test_suite', 'test_type', 'status'],
});

export const testDuration = new Histogram({
  name: 'test_duration_seconds',
  help: 'Test execution duration in seconds',
  labelNames: ['test_suite', 'test_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});

export const testCoverage = new Gauge({
  name: 'test_coverage_percent',
  help: 'Test coverage percentage',
  labelNames: ['coverage_type', 'component'], // lines, functions, branches, statements;
});

// Custom Metrics Collector Class
export class PrometheusMetricsCollector {
  private collectionInterval: NodeJS.Timeout | null = null;
  private initialized = false;
  private initializing = false;

  constructor() {
    // No longer start collection in constructor to prevent blocking
    // Use lazy initialization pattern instead
  }

  // Lazy initialization with timeout protection
  async initialize(timeoutMs = 5000): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    if (this.initializing) {
      // Wait for ongoing initialization
      while (this.initializing && !this.initialized) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.initialized;
    }

    this.initializing = true;

    try {
      // Initialize default metrics with timeout protection
      await Promise.race([
        this.initializeDefaultMetrics(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Prometheus initialization timeout')), timeoutMs)
        ),
      ]);

      // Start automatic collection
      this.startCollection();
      this.initialized = true;
      return true;
    } catch (error) {
      console.warn(
        'Prometheus metrics initialization failed:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    } finally {
      this.initializing = false;
    }
  }

  // Initialize default metrics (can be slow)
  private async initializeDefaultMetrics(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!defaultMetricsInitialized && !defaultMetricsInitializing) {
          defaultMetricsInitializing = true;
          collectDefaultMetrics({ register });
          defaultMetricsInitialized = true;
        }
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        defaultMetricsInitializing = false;
      }
    });
  }

  // Start automatic collection of system metrics
  startCollection() {
    if (this.collectionInterval) {
      return; // Already collecting
    }

    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 15000); // Collect every 15 seconds
  }

  // Stop automatic collection
  stopCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  // Collect system performance metrics
  private collectSystemMetrics() {
    // Memory usage
    const memUsage = process.memoryUsage();
    memoryUsageBytes.set({ type: 'heap_used' }, memUsage.heapUsed);
    memoryUsageBytes.set({ type: 'heap_total' }, memUsage.heapTotal);
    memoryUsageBytes.set({ type: 'external' }, memUsage.external);
    memoryUsageBytes.set({ type: 'rss' }, memUsage.rss);

    // Service uptime
    serviceUptime.set({ service_name: 'universal-ai-tools' }, process.uptime());

    // CPU usage (simplified - would need more complex implementation for accurate CPU usage)
    const cpuUsage = process.cpuUsage();
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    cpuUsagePercent.set(totalCpuTime / 1000000); // Convert microseconds to seconds
  }

  // Record Sweet Athena interaction
  recordAthenaInteraction(
    interactionType: string,
    personalityMood: string,
    userId: string,
    sessionId: string,
    responseTimeMs: number,
    sweetnessLevel: number,
    model?: string
  ) {
    // Initialize lazily if not already done
    if (!this.initialized) {
      this.initialize().catch(() => {});
    }

    athenaInteractionsTotal.inc({
      interaction_type: interactionType,
      personality_mood: personalityMood,
      user_id: userId,
      session_id: sessionId,
    });

    athenaResponseTime.observe(
      {
        interaction_type: interactionType,
        personality_mood: personalityMood,
        model: model || 'default',
      },
      responseTimeMs / 1000
    );

    athenaSweetnessLevel.set(
      {
        session_id: sessionId,
        personality_mood: personalityMood,
      },
      sweetnessLevel
    );
  }

  // Record HTTP request metrics
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
    requestSize: number,
    responseSize: number,
    aiService: string
  ) {
    // Initialize lazily if not already done
    if (!this.initialized) {
      this.initialize().catch(() => {});
    }

    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
      ai_service: aiService,
    });

    httpRequestDuration.observe(
      {
        method,
        route,
        status_code: statusCode.toString(),
        ai_service: aiService,
      },
      durationMs / 1000
    );

    httpRequestSize.observe(
      {
        method,
        route,
        ai_service: aiService,
      },
      requestSize
    );

    httpResponseSize.observe(
      {
        method,
        route,
        status_code: statusCode.toString(),
        ai_service: aiService,
      },
      responseSize
    );
  }

  // Record memory operation
  recordMemoryOperation(
    operationType: string,
    memoryType: string,
    aiService: string,
    durationMs: number,
    accuracy?: number
  ) {
    // Initialize lazily if not already done
    if (!this.initialized) {
      this.initialize().catch(() => {});
    }

    memoryOperationsTotal.inc({
      operation_type: operationType,
      memory_type: memoryType,
      ai_service: aiService,
    });

    memoryQueryTime.observe(
      {
        operation_type: operationType,
        memory_type: memoryType,
      },
      durationMs / 1000
    );

    if (accuracy !== undefined) {
      memorySearchAccuracy.observe(
        {
          memory_type: memoryType,
          query_type: operationType,
        },
        accuracy
      );
    }
  }

  // Record database operation
  recordDatabaseOperation(table: string, operation: string, durationMs: number, error?: string) {
    // Initialize lazily if not already done
    if (!this.initialized) {
      this.initialize().catch(() => {});
    }

    databaseQueryDuration.observe(
      {
        table,
        operation,
      },
      durationMs / 1000
    );

    if (error) {
      databaseErrors.inc({
        table,
        operation,
        error_type: error
      });
    }
  }

  // Record AI model inference
  recordAiModelInference(
    modelName: string,
    modelType: string,
    taskType: string,
    inferenceTimeMs: number,
    inputTokens: number,
    outputTokens: number
  ) {
    // Initialize lazily if not already done
    if (!this.initialized) {
      this.initialize().catch(() => {});
    }

    aiModelInferenceTime.observe(
      {
        model_name: modelName,
        model_type: modelType,
        task_type: taskType,
      },
      inferenceTimeMs / 1000
    );

    aiModelTokensProcessed.inc(
      {
        model_name: modelName,
        model_type: modelType,
        direction: 'input',
      },
      inputTokens
    );

    aiModelTokensProcessed.inc(
      {
        model_name: modelName,
        model_type: modelType,
        direction: 'output',
      },
      outputTokens
    );
  }

  // Record security event
  recordSecurityEvent(eventType: string, severity: string, sourceIp: string) {
    // Initialize lazily if not already done
    if (!this.initialized) {
      this.initialize().catch(() => {});
    }

    securityEvents.inc({
      event_type: eventType,
      severity,
      source_ip: sourceIp,
    });
  }

  // Record test execution
  recordTestExecution(testSuite: string, testType: string, status: string, durationMs: number) {
    // Initialize lazily if not already done
    if (!this.initialized) {
      this.initialize().catch(() => {});
    }

    testExecutionsTotal.inc({
      test_suite: testSuite,
      test_type: testType,
      status,
    });

    testDuration.observe(
      {
        test_suite: testSuite,
        test_type: testType,
      },
      durationMs / 1000
    );
  }

  // Get all metrics in Prometheus format
  async getMetrics(): Promise<string> {
    // Ensure initialization before getting metrics
    if (!this.initialized) {
      await this.initialize();
    }
    return register.metrics();
  }

  // Get metrics registry
  getRegistry() {
    return register;
  }
}

// Create singleton instance
export const metricsCollector = new PrometheusMetricsCollector();

// Export registry for middleware use
export { register };

export default metricsCollector;
