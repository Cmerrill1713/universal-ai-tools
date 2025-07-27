#!/usr/bin/env node

import fetch from 'node-fetch';

const API_URL = 'http://localhost:9999';
const API_KEY = 'test-key-123';
const SERVICE_ID = 'test-service';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  process.stdout.write(`${colors.blue}Testing${colors.reset} ${name}... `);
  try {
    await fn();
    console.log(`${colors.green}✓ PASSED${colors.reset}`);
    passedTests++;
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset}`);
    console.log(`  ${colors.gray}${error.message}${colors.reset}`);
    failedTests++;
  }
}

async function makeRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      'X-AI-Service': SERVICE_ID,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok && !options.expectError) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return { response, data };
}

async function runTests() {
  console.log(`\n${colors.yellow}=== Universal AI Tools API Test Suite ===${colors.reset}\n`);

  // Health Check Tests
  await test('Health check endpoint', async () => {
    const { data } = await makeRequest('/api/health');
    if (data.status !== 'healthy') throw new Error('Service not healthy');
  });

  await test('API documentation endpoint', async () => {
    const { data } = await makeRequest('/api/docs');
    if (!data.version || !data.endpoints) throw new Error('Invalid API docs');
  });

  // Authentication Tests
  await test('Request without authentication (should fail)', async () => {
    const response = await fetch(`${API_URL}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'test' }),
    });

    if (response.ok) throw new Error('Should have failed without auth');
  });

  await test('Request with invalid API key (should fail)', async () => {
    const { response } = await makeRequest('/api/memory', {
      method: 'POST',
      body: JSON.stringify({ content: 'test' }),
      expectError: true,
    });

    if (response.ok) throw new Error('Should have failed with invalid API key');
  });

  // Performance Monitoring Tests
  await test('Performance metrics endpoint', async () => {
    const { data } = await makeRequest('/api/performance/metrics');
    if (!data.success || !data.metrics) throw new Error('Invalid performance metrics');
  });

  await test('Performance report endpoint', async () => {
    const { data } = await makeRequest('/api/performance/report');
    if (!data.performance || !data.summary) throw new Error('Invalid performance report');
  });

  // Cache Health Check
  await test('Cache health check', async () => {
    const { data } = await makeRequest('/api/performance/cache-health');
    if (data.healthy === undefined) throw new Error('Invalid cache health response');
  });

  // Database Health Check
  await test('Database query test', async () => {
    const { data } = await makeRequest('/api/performance/db-test');
    if (!data.results) throw new Error('Invalid database test response');
  });

  // CORS Headers Test
  await test('CORS headers present', async () => {
    const response = await fetch(`${API_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
    });

    const corsHeader = response.headers.get('access-control-allow-origin');
    if (!corsHeader) throw new Error('CORS headers not present');
  });

  // Security Headers Test
  await test('Security headers present', async () => {
    const response = await fetch(`${API_URL}/api/health`);

    const securityHeaders = ['x-content-type-options', 'x-frame-options', 'x-xss-protection'];

    for (const header of securityHeaders) {
      if (!response.headers.get(header)) {
        throw new Error(`Missing security header: ${header}`);
      }
    }
  });

  // Rate Limiting Test
  await test('Rate limiting active', async () => {
    const response = await fetch(`${API_URL}/api/health`);
    const rateLimitHeader = response.headers.get('x-ratelimit-limit');
    if (!rateLimitHeader) throw new Error('Rate limit headers not present');
  });

  console.log(`\n${colors.yellow}=== Test Summary ===${colors.reset}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`${colors.blue}Total:  ${passedTests + failedTests}${colors.reset}\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error(`\n${colors.red}Test suite failed:${colors.reset}`, error);
  process.exit(1);
});
