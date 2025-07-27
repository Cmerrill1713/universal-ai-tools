#!/usr/bin/env node

/**
 * Test Telemetry Data Generator
 * Generates test traces and metrics to validate monitoring systems
 */

import express from 'express';
import { telemetryService } from '../src/services/telemetry-service.js';
import { metricsCollector } from '../src/utils/prometheus-metrics.js';
import { SpanStatusCode } from '@opentelemetry/api';

const app = express();
const PORT = process.env.PORT || 9999;

// Initialize telemetry
await telemetryService.initialize({
  serviceName: 'universal-ai-tools-test',
  enableConsoleExporter: true,
  enableJaeger: true,
  enableOTLP: true,
  samplingRate: 1.0,
});

// Middleware to generate traces
app.use((req, res, next) => {
  const span = telemetryService.getTracer().startSpan(`HTTP ${req.method} ${req.path}`);

  // Record HTTP metrics
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Record metrics
    metricsCollector.recordHttpRequest(
      req.method,
      req.path,
      res.statusCode,
      duration,
      parseInt(req.headers['content-length'] || '0'),
      parseInt(res.get('content-length') || '0'),
      'test-service'
    );

    // Complete span
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  });

  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'universal-ai-tools-test',
    version: '1.0.0',
  });
});

// Detailed health check
app.get('/api/health/detailed', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      telemetry: { status: 'healthy', message: 'Telemetry active' },
      metrics: { status: 'healthy', message: 'Metrics collection active' },
      tracing: { status: 'healthy', message: 'Tracing active' },
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Readiness check
app.get('/api/health/ready', (req, res) => {
  res.json({ ready: true, timestamp: new Date().toISOString() });
});

// Liveness check
app.get('/api/health/live', (req, res) => {
  res.json({ alive: true, timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(await metricsCollector.getMetrics());
});

// Sweet Athena interaction simulation
app.post('/api/sweet-athena/interact', (req, res) => {
  const interactionType = 'test-interaction';
  const mood = 'sweet';
  const userId = 'test-user';
  const sessionId = 'test-session';
  const responseTime = Math.random() * 1000 + 100;
  const sweetnessLevel = Math.floor(Math.random() * 10) + 1;

  // Record metrics
  metricsCollector.recordAthenaInteraction(
    interactionType,
    mood,
    userId,
    sessionId,
    responseTime,
    sweetnessLevel,
    'test-model'
  );

  res.json({
    response: `Sweet Athena says hello! (Sweetness: ${sweetnessLevel})`,
    interactionType,
    mood,
    responseTime: responseTime + 'ms',
  });
});

// Memory operation simulation
app.post('/api/memory/query', express.json(), (req, res) => {
  const operationType = 'query';
  const memoryType = 'episodic';
  const duration = Math.random() * 500 + 50;
  const accuracy = Math.random();

  // Record metrics
  metricsCollector.recordMemoryOperation(
    operationType,
    memoryType,
    'test-service',
    duration,
    accuracy
  );

  res.json({
    results: ['Test memory result 1', 'Test memory result 2'],
    accuracy: accuracy.toFixed(3),
    duration: duration + 'ms',
  });
});

// LLM chat simulation
app.post('/api/llm/chat', express.json(), (req, res) => {
  const modelName = 'test-model';
  const modelType = 'llm';
  const taskType = 'chat';
  const inferenceTime = Math.random() * 2000 + 200;
  const inputTokens = Math.floor(Math.random() * 100) + 10;
  const outputTokens = Math.floor(Math.random() * 200) + 20;

  // Record metrics
  metricsCollector.recordAiModelInference(
    modelName,
    modelType,
    taskType,
    inferenceTime,
    inputTokens,
    outputTokens
  );

  res.json({
    response: 'This is a test response from the AI model.',
    model: modelName,
    inputTokens,
    outputTokens,
    inferenceTime: inferenceTime + 'ms',
  });
});

// Error simulation endpoint
app.get('/api/test/error', (req, res) => {
  const span = telemetryService.getTracer().startSpan('Test Error');

  try {
    throw new Error('Test error for monitoring validation');
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    res.status(500).json({ error: 'Test error generated', message: error.message });
  } finally {
    span.end();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🧪 Test telemetry server running on port ${PORT}`);
  console.log(`📊 Metrics available at: http://localhost:${PORT}/metrics`);
  console.log(`🏥 Health check at: http://localhost:${PORT}/api/health`);
  console.log(`🔍 Jaeger UI: http://localhost:16686`);
  console.log(`📈 Prometheus: http://localhost:9090`);
  console.log(`📊 Grafana: http://localhost:3003`);

  // Generate some initial test data
  generateTestTraffic();
});

// Generate test traffic
function generateTestTraffic() {
  const endpoints = [
    '/api/health',
    '/api/health/detailed',
    '/api/sweet-athena/interact',
    '/api/memory/query',
    '/api/llm/chat',
  ];

  setInterval(() => {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const method =
      endpoint.includes('interact') || endpoint.includes('query') || endpoint.includes('chat')
        ? 'POST'
        : 'GET';

    import('axios').then((axios) => {
      const config = {
        method,
        url: `http://localhost:${PORT}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Traffic': 'true',
        },
      };

      if (method === 'POST') {
        config.data = { test: true, message: 'Test request' };
      }

      axios.default(config).catch(() => {}); // Ignore errors for test traffic
    });
  }, 2000); // Generate request every 2 seconds
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down test server...');
  await telemetryService.shutdown();
  process.exit(0);
});
