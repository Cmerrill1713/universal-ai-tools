import type { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

// Create a Registry to register the metrics
export const metricsRegistry = new client.Registry();

// Default metrics (process, event loop, memory, etc.)
client.collectDefaultMetrics({ register: metricsRegistry, prefix: 'universal_ai_' });

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [5, 10, 20, 50, 100, 200, 500, 1000, 2000],
  registers: [metricsRegistry],
});

// In-flight requests gauge
const httpRequestsInFlight = new client.Gauge({
  name: 'http_requests_in_flight',
  help: 'In-flight HTTP requests',
  labelNames: ['route'] as const,
  registers: [metricsRegistry],
});

// Total requests counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

// Error counter (5xx)
const httpRequestErrorsTotal = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP 5xx errors',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const route = (req.route?.path || req.path || 'unknown')
      .replace(/\d+/g, ':id')
      .replace(/[0-9a-f-]{36}/gi, ':uuid');

    httpRequestsInFlight.labels(route).inc();
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      httpRequestDuration.labels(req.method, route, String(res.statusCode)).observe(durationMs);
      httpRequestsInFlight.labels(route).dec();

      httpRequestsTotal.labels(req.method, route, String(res.statusCode)).inc();
      if (res.statusCode >= 500) {
        httpRequestErrorsTotal.labels(req.method, route, String(res.statusCode)).inc();
      }
    });

    next();
  };
}

export async function getMetricsText(): Promise<string> {
  return metricsRegistry.metrics();
}

export default metricsMiddleware;
