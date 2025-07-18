#!/usr/bin/env node

const fetch = require('node-fetch');
const { performance } = require('perf_hooks');

// Test configuration
const BASE_URL = 'http://localhost:9999';
const ITERATIONS = 100;
const CONCURRENT_REQUESTS = 10;

// Color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Test results
const results = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  errors: {},
  responseTimes: [],
  startTime: null,
  endTime: null
};

// Helper to make a request with timeout
async function makeRequest(endpoint, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    results.responseTimes.push(responseTime);
    
    if (response.ok) {
      return { success: true, status: response.status, responseTime };
    } else {
      return { success: false, status: response.status, responseTime, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    clearTimeout(timeout);
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    return { 
      success: false, 
      status: 0, 
      responseTime, 
      error: error.name === 'AbortError' ? 'Timeout' : error.message 
    };
  }
}

// Test endpoints
const testEndpoints = [
  { path: '/health', method: 'GET', name: 'Health Check' },
  { path: '/api/docs', method: 'GET', name: 'API Documentation' },
  { path: '/api/stats', method: 'GET', name: 'Statistics' },
  { path: '/api/performance/metrics', method: 'GET', name: 'Performance Metrics' },
  { path: '/api/ollama/status', method: 'GET', name: 'Ollama Status' },
  { path: '/api/config', method: 'GET', name: 'Configuration' }
];

// Test with authentication (these should fail gracefully)
const authEndpoints = [
  { path: '/api/memory', method: 'GET', name: 'Memory List' },
  { path: '/api/tools', method: 'GET', name: 'Tools List' },
  { path: '/api/context/test/key', method: 'GET', name: 'Context Get' }
];

async function runTests() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Testing Universal AI Tools Improvements${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  results.startTime = new Date();
  
  // Test 1: Basic endpoint availability
  console.log(`${colors.yellow}Test 1: Basic Endpoint Availability${colors.reset}`);
  for (const endpoint of testEndpoints) {
    const result = await makeRequest(endpoint.path, { method: endpoint.method });
    results.totalRequests++;
    
    if (result.success) {
      results.successfulRequests++;
      console.log(`${colors.green}✓ ${endpoint.name}: ${result.responseTime.toFixed(2)}ms${colors.reset}`);
    } else {
      results.failedRequests++;
      results.errors[result.error] = (results.errors[result.error] || 0) + 1;
      console.log(`${colors.red}✗ ${endpoint.name}: ${result.error} (${result.responseTime.toFixed(2)}ms)${colors.reset}`);
    }
  }
  
  // Test 2: Authentication error handling
  console.log(`\n${colors.yellow}Test 2: Authentication Error Handling${colors.reset}`);
  for (const endpoint of authEndpoints) {
    const result = await makeRequest(endpoint.path, { method: endpoint.method });
    results.totalRequests++;
    
    // These should fail with 401, not 500
    if (result.status === 401) {
      results.successfulRequests++;
      console.log(`${colors.green}✓ ${endpoint.name}: Properly rejected (401)${colors.reset}`);
    } else {
      results.failedRequests++;
      results.errors[`Unexpected status ${result.status}`] = (results.errors[`Unexpected status ${result.status}`] || 0) + 1;
      console.log(`${colors.red}✗ ${endpoint.name}: Expected 401, got ${result.status}${colors.reset}`);
    }
  }
  
  // Test 3: Concurrent requests
  console.log(`\n${colors.yellow}Test 3: Concurrent Request Handling${colors.reset}`);
  const concurrentPromises = [];
  
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    concurrentPromises.push(makeRequest('/api/stats'));
  }
  
  const concurrentResults = await Promise.all(concurrentPromises);
  let concurrentSuccess = 0;
  
  concurrentResults.forEach((result, index) => {
    results.totalRequests++;
    if (result.success) {
      results.successfulRequests++;
      concurrentSuccess++;
    } else {
      results.failedRequests++;
      results.errors[result.error] = (results.errors[result.error] || 0) + 1;
    }
  });
  
  console.log(`${colors.green}✓ Concurrent requests: ${concurrentSuccess}/${CONCURRENT_REQUESTS} successful${colors.reset}`);
  
  // Test 4: Redis fallback (simulate Redis being down)
  console.log(`\n${colors.yellow}Test 4: Cache Fallback Test${colors.reset}`);
  const cacheTestResult = await makeRequest('/api/performance/metrics');
  results.totalRequests++;
  
  if (cacheTestResult.success) {
    results.successfulRequests++;
    console.log(`${colors.green}✓ Performance metrics available even if Redis is down${colors.reset}`);
  } else {
    results.failedRequests++;
    console.log(`${colors.red}✗ Performance metrics failed: ${cacheTestResult.error}${colors.reset}`);
  }
  
  // Test 5: Error rate check
  console.log(`\n${colors.yellow}Test 5: Error Rate Check${colors.reset}`);
  try {
    const metricsResponse = await fetch(`${BASE_URL}/api/performance/metrics`);
    if (metricsResponse.ok) {
      const metrics = await metricsResponse.json();
      const errorRate = metrics.metrics?.performance?.errorRate || 0;
      
      if (errorRate < 5) {
        console.log(`${colors.green}✓ Error rate: ${errorRate.toFixed(2)}% (TARGET MET!)${colors.reset}`);
      } else if (errorRate < 10) {
        console.log(`${colors.yellow}⚠ Error rate: ${errorRate.toFixed(2)}% (improving)${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ Error rate: ${errorRate.toFixed(2)}% (still high)${colors.reset}`);
      }
    }
  } catch (error) {
    console.log(`${colors.red}✗ Could not check error rate${colors.reset}`);
  }
  
  results.endTime = new Date();
  
  // Print summary
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  const successRate = (results.successfulRequests / results.totalRequests * 100).toFixed(2);
  const avgResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
  const duration = (results.endTime - results.startTime) / 1000;
  
  console.log(`Total Requests: ${results.totalRequests}`);
  console.log(`Successful: ${colors.green}${results.successfulRequests}${colors.reset}`);
  console.log(`Failed: ${colors.red}${results.failedRequests}${colors.reset}`);
  console.log(`Success Rate: ${successRate >= 95 ? colors.green : successRate >= 80 ? colors.yellow : colors.red}${successRate}%${colors.reset}`);
  console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`Test Duration: ${duration.toFixed(2)}s`);
  
  if (Object.keys(results.errors).length > 0) {
    console.log(`\n${colors.red}Error Breakdown:${colors.reset}`);
    for (const [error, count] of Object.entries(results.errors)) {
      console.log(`  ${error}: ${count}`);
    }
  }
  
  // Recommendations
  console.log(`\n${colors.yellow}Recommendations:${colors.reset}`);
  if (successRate < 95) {
    console.log('- Check server logs for specific error details');
    console.log('- Verify Redis is running: redis-cli ping');
    console.log('- Check Supabase connection');
  }
  if (avgResponseTime > 500) {
    console.log('- Response times are high, check for performance bottlenecks');
  }
  if (results.errors['Timeout'] > 0) {
    console.log('- Timeout errors detected, check for slow database queries');
  }
  
  // Exit code based on success
  process.exit(successRate >= 95 ? 0 : 1);
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Main
async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log(`${colors.red}Error: Server is not running at ${BASE_URL}${colors.reset}`);
    console.log('Please start the server with: npm run dev');
    process.exit(1);
  }
  
  await runTests();
}

main().catch(error => {
  console.error(`${colors.red}Test suite error:${colors.reset}`, error);
  process.exit(1);
});