import express from 'express';
import request from 'supertest';

import { getMetricsText, metricsMiddleware } from '../../src/middleware/metrics';

describe('Metrics Middleware', () => {
  test('should expose Prometheus metrics at /metrics', async () => {
    const app = express();
    app.use(metricsMiddleware());

    app.get('/metrics', async (_req, res) => {
      const metrics = await getMetricsText();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metrics);
    });

    // Make a sample request to generate some metrics
    app.get('/ping', (_req, res) => res.send('pong'));
    await request(app).get('/ping').expect(200);

    const resMetrics = await request(app).get('/metrics').expect(200);
    expect(resMetrics.text).toContain('http_requests_total');
    expect(resMetrics.text).toContain('http_request_duration_ms');
  });
});
