#!/usr/bin/env tsx

import express from 'express';
import helmet from 'helmet';
import { initializeConfig, config } from './src/config/index';
import { SecurityMiddleware } from './src/middleware/security';
import { logger } from './src/utils/enhanced-logger';

// Initialize configuration
initializeConfig();

const app = express();
const port = 9998;

process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔍 Debug Info:');
console.log('- Environment:', config.server.env);
console.log('- isDevelopment:', config.server.isDevelopment);
console.log('- isProduction:', config.server.isProduction);
console.log('- Supabase URL:', config.database.supabaseUrl);

// Test 1: Direct Helmet application
console.log('\n🧪 Test 1: Direct Helmet middleware');
const app1 = express();
app1.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'http://localhost:11434'],
      },
      reportOnly: false, // Force enabled
    },
    hsts: false, // Disable HSTS for testing
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app1.get('/test1', (req, res) => {
  res.json({ test: 'Direct Helmet test' });
});

app1.listen(port, () => {
  console.log(`✅ Test 1 server running on http://localhost:${port}/test1`);
});

// Test 2: SecurityMiddleware class
console.log('\n🧪 Test 2: SecurityMiddleware class');
const app2 = express();
const securityInstance = new SecurityMiddleware({
  enableHelmet: true,
  enableCSP: true,
  enableCors: true,
  enableRateLimit: false, // Disable to simplify
});

app2.use(securityInstance.getHelmetMiddleware());

app2.get('/test2', (req, res) => {
  res.json({ test: 'SecurityMiddleware test' });
});

const port2 = 9997;
app2.listen(port2, () => {
  console.log(`✅ Test 2 server running on http://localhost:${port2}/test2`);
});

console.log('\n🔍 Test both endpoints:');
console.log(`curl -I http://localhost:${port}/test1`);
console.log(`curl -I http://localhost:${port2}/test2`);
