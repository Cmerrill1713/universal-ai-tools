import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Minimal test server is running'
  });
});

// Test endpoint for critical services
app.get('/test/services', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    services: {}
  };

  try {
    // Test Supabase service (if available)
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error } = await supabase.from('memories').select('count').limit(1);
        results.services.supabase = error ? 'error: ' + error.message : 'connected';
      } else {
        results.services.supabase = 'missing credentials';
      }
    } catch (e) {
      results.services.supabase = 'failed: ' + e.message;
    }

    // Test Ollama service (if available)
    try {
      const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
      const { default: fetch } = await import('node-fetch');
      const response = await fetch(`${ollamaEndpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      results.services.ollama = response.ok ? 'connected' : 'not available';
    } catch (e) {
      results.services.ollama = 'failed: ' + e.message;
    }

    // Test Redis (if available)
    try {
      const { default: redis } = await import('redis');
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const client = redis.createClient({ url: redisUrl });
      
      await client.connect();
      await client.ping();
      await client.disconnect();
      
      results.services.redis = 'connected';
    } catch (e) {
      results.services.redis = 'failed: ' + e.message;
    }

  } catch (error) {
    results.error = error.message;
  }

  res.json(results);
});

// Test individual fixed services
app.get('/test/fixed/:service', async (req, res) => {
  const { service } = req.params;
  const results = {
    service,
    timestamp: new Date().toISOString(),
    status: 'unknown'
  };

  try {
    switch (service) {
      case 'enhanced-logger':
        try {
          const { EnhancedLogger } = await import('./src/utils/enhanced-logger.ts');
          const logger = new EnhancedLogger('test');
          logger.info('Test log message');
          results.status = 'working';
          results.message = 'Logger initialized successfully';
        } catch (e) {
          results.status = 'error';
          results.error = e.message;
        }
        break;

      case 'port-manager':
        try {
          const { SmartPortManager } = await import('./src/utils/smart-port-manager.ts');
          const portManager = SmartPortManager.getInstance();
          const testPort = await portManager.findAvailablePort(8000);
          results.status = 'working';
          results.availablePort = testPort;
        } catch (e) {
          results.status = 'error';
          results.error = e.message;
        }
        break;

      case 'prometheus':
        try {
          const { PrometheusMetrics } = await import('./src/utils/prometheus-metrics.ts');
          const metrics = PrometheusMetrics.getInstance();
          results.status = 'working';
          results.message = 'Prometheus metrics initialized';
        } catch (e) {
          results.status = 'error';
          results.error = e.message;
        }
        break;

      case 'config':
        try {
          const config = await import('./src/config/environment.ts');
          results.status = 'working';
          results.environment = process.env.NODE_ENV || 'development';
          results.configLoaded = true;
        } catch (e) {
          results.status = 'error';
          results.error = e.message;
        }
        break;

      default:
        results.status = 'not_found';
        results.error = `Service ${service} not recognized`;
    }
  } catch (error) {
    results.status = 'error';
    results.error = error.message;
  }

  res.json(results);
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
========================================
Minimal Test Server
========================================
Port: ${PORT}
Environment: ${process.env.NODE_ENV || 'development'}
Time: ${new Date().toISOString()}

Available endpoints:
- GET /health - Basic health check
- GET /test/services - Test all services
- GET /test/fixed/:service - Test specific fixed service
  - enhanced-logger
  - port-manager
  - prometheus
  - config

This server bypasses initialization issues
to test Phase 1 fixes independently.
========================================
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});