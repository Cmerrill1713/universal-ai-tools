#!/usr/bin/env node

/**
 * Simple Test Server for Telemetry Validation
 * Basic Express server to validate monitoring systems
 */

import express from 'express';
import { register, Counter, Histogram, Gauge } from 'prom-client';

const app = express();
const PORT = process.env.PORT || 9999;

// Simple metrics
const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const systemHealth = new Gauge({
  name: 'system_health_score',
  help: 'System health score (0-100)',
  labelNames: ['component']
});

// Middleware to track metrics
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    httpRequests.inc({ method: req.method, route: req.path, status_code: res.statusCode });
    httpDuration.observe({ method: req.method, route: req.path }, duration);
  });
  
  next();
});

app.use(express.json());

// Health endpoints
app.get('/api/health', (req, res) => {
  systemHealth.set({ component: 'overall' }, 100);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'universal-ai-tools-test',
    version: '1.0.0'
  });
});

app.get('/api/health/detailed', (req, res) => {
  const services = {
    api: { status: 'healthy', message: 'API responding' },
    metrics: { status: 'healthy', message: 'Metrics active' },
    database: { status: 'healthy', message: 'Database connected' }
  };
  
  Object.keys(services).forEach(service => {
    systemHealth.set({ component: service }, 100);
  });
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get('/api/health/ready', (req, res) => {
  res.json({ ready: true, timestamp: new Date().toISOString() });
});

app.get('/api/health/live', (req, res) => {
  res.json({ alive: true, timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(await register.metrics());
});

// Test endpoints to generate data
app.post('/api/sweet-athena/interact', (req, res) => {
  const sweetnessLevel = Math.floor(Math.random() * 10) + 1;
  const responseTime = Math.random() * 1000 + 100;
  
  setTimeout(() => {
    res.json({
      response: `Sweet Athena says hello! (Sweetness: ${sweetnessLevel})`,
      interactionType: 'greeting',
      mood: 'sweet',
      responseTime: responseTime + 'ms'
    });
  }, Math.floor(responseTime));
});

app.post('/api/memory/query', (req, res) => {
  const duration = Math.random() * 500 + 50;
  
  setTimeout(() => {
    res.json({
      results: ['Memory result 1', 'Memory result 2'],
      accuracy: (Math.random()).toFixed(3),
      duration: duration + 'ms'
    });
  }, Math.floor(duration));
});

app.post('/api/llm/chat', (req, res) => {
  const inferenceTime = Math.random() * 2000 + 200;
  
  setTimeout(() => {
    res.json({
      response: 'Test response from AI model',
      model: 'test-model',
      inferenceTime: inferenceTime + 'ms'
    });
  }, Math.floor(inferenceTime));
});

// Error endpoint
app.get('/api/test/error', (req, res) => {
  systemHealth.set({ component: 'error_test' }, 0);
  res.status(500).json({ 
    error: 'Test error generated',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🧪 Test server running on port ${PORT}`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  
  // Set initial health scores
  systemHealth.set({ component: 'overall' }, 100);
  systemHealth.set({ component: 'api' }, 100);
  systemHealth.set({ component: 'metrics' }, 100);
  
  // Generate test traffic
  generateTestTraffic();
});

function generateTestTraffic() {
  const endpoints = [
    { path: '/api/health', method: 'GET' },
    { path: '/api/health/detailed', method: 'GET' },
    { path: '/api/sweet-athena/interact', method: 'POST', data: { message: 'Hello' } },
    { path: '/api/memory/query', method: 'POST', data: { query: 'test' } },
    { path: '/api/llm/chat', method: 'POST', data: { message: 'test' } }
  ];
  
  setInterval(async () => {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    
    try {
      const axios = (await import('axios')).default;
      
      const config = {
        method: endpoint.method,
        url: `http://localhost:${PORT}${endpoint.path}`,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (endpoint.data) {
        config.data = endpoint.data;
      }
      
      await axios(config);
    } catch (error) {
      // Ignore errors for test traffic
    }
  }, 3000);
}