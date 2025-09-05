#!/usr/bin/env node

/**
 * Comprehensive Functional Benchmark and Test Suite
 * Tests all major components of Universal AI Tools
 */

const axios = require('axios');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:9999';
const RESULTS = {
  passed: 0,
  failed: 0,
  benchmarks: {},
  errors: []
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const color = type === 'success' ? colors.green : 
                 type === 'error' ? colors.red : 
                 type === 'warning' ? colors.yellow :
                 type === 'benchmark' ? colors.cyan : colors.blue;
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

async function measurePerformance(name, fn) {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    RESULTS.benchmarks[name] = { duration, success: true };
    log(`✓ ${name}: ${duration.toFixed(2)}ms`, 'benchmark');
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    RESULTS.benchmarks[name] = { duration, success: false, error: error.message };
    log(`✗ ${name}: Failed after ${duration.toFixed(2)}ms - ${error.message}`, 'error');
    throw error;
  }
}

// Test 1: Basic Health Check
async function testHealthCheck() {
  return measurePerformance('Health Check', async () => {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.data.status !== 'healthy') {
      throw new Error('Health check failed');
    }
    RESULTS.passed++;
    return response.data;
  });
}

// Test 2: API Endpoints
async function testAPIEndpoints() {
  const endpoints = [
    { path: '/api/status', method: 'GET', name: 'Status Endpoint' },
    { path: '/api/models', method: 'GET', name: 'Models List' },
    { path: '/api/metrics', method: 'GET', name: 'Metrics Endpoint' },
    { path: '/api/monitoring/system', method: 'GET', name: 'System Monitoring' }
  ];

  for (const endpoint of endpoints) {
    try {
      await measurePerformance(endpoint.name, async () => {
        const response = await axios({
          method: endpoint.method,
          url: `${BASE_URL}${endpoint.path}`,
          timeout: 5000
        });
        RESULTS.passed++;
        return response.data;
      });
    } catch (error) {
      RESULTS.failed++;
      RESULTS.errors.push(`${endpoint.name}: ${error.message}`);
    }
  }
}

// Test 3: LLM Service Integration
async function testLLMServices() {
  const testPrompt = {
    prompt: "What is 2+2?",
    model: "llama3.2:3b",
    max_tokens: 50
  };

  try {
    await measurePerformance('LLM Inference', async () => {
      const response = await axios.post(`${BASE_URL}/api/chat/completions`, testPrompt, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      if (!response.data.choices || !response.data.choices[0]) {
        throw new Error('Invalid LLM response format');
      }
      
      RESULTS.passed++;
      return response.data;
    });
  } catch (error) {
    RESULTS.failed++;
    RESULTS.errors.push(`LLM Service: ${error.message}`);
  }
}

// Test 4: Memory Service
async function testMemoryService() {
  const memoryTests = [
    {
      name: 'Store Memory',
      method: 'POST',
      path: '/api/memory/store',
      data: {
        content: 'Test memory content',
        metadata: { test: true, timestamp: Date.now() }
      }
    },
    {
      name: 'Search Memory',
      method: 'POST',
      path: '/api/memory/search',
      data: {
        query: 'test',
        limit: 10
      }
    }
  ];

  for (const test of memoryTests) {
    try {
      await measurePerformance(test.name, async () => {
        const response = await axios({
          method: test.method,
          url: `${BASE_URL}${test.path}`,
          data: test.data,
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        });
        RESULTS.passed++;
        return response.data;
      });
    } catch (error) {
      RESULTS.failed++;
      RESULTS.errors.push(`${test.name}: ${error.message}`);
    }
  }
}

// Test 5: WebSocket Connections
async function testWebSockets() {
  const wsEndpoints = [
    { path: '/ws/athena', name: 'Athena WebSocket' },
    { path: '/ws/device-auth', name: 'Device Auth WebSocket' },
    { path: '/ws/voice', name: 'Voice WebSocket' }
  ];

  for (const endpoint of wsEndpoints) {
    await new Promise((resolve) => {
      const testName = endpoint.name;
      const start = performance.now();
      
      try {
        const ws = new WebSocket(`ws://localhost:9999${endpoint.path}`);
        
        ws.on('open', () => {
          const duration = performance.now() - start;
          RESULTS.benchmarks[testName] = { duration, success: true };
          log(`✓ ${testName}: Connected in ${duration.toFixed(2)}ms`, 'benchmark');
          RESULTS.passed++;
          
          // Send test message
          ws.send(JSON.stringify({ type: 'ping' }));
          
          setTimeout(() => {
            ws.close();
            resolve();
          }, 1000);
        });
        
        ws.on('error', (error) => {
          const duration = performance.now() - start;
          RESULTS.benchmarks[testName] = { duration, success: false, error: error.message };
          log(`✗ ${testName}: Failed - ${error.message}`, 'error');
          RESULTS.failed++;
          RESULTS.errors.push(`${testName}: ${error.message}`);
          resolve();
        });
        
        ws.on('close', () => {
          resolve();
        });
        
      } catch (error) {
        RESULTS.failed++;
        RESULTS.errors.push(`${testName}: ${error.message}`);
        resolve();
      }
    });
  }
}

// Test 6: Database Operations
async function testDatabaseOperations() {
  try {
    await measurePerformance('Database Health Check', async () => {
      const response = await axios.get(`${BASE_URL}/api/database/health`);
      if (response.data.status !== 'healthy') {
        throw new Error('Database not healthy');
      }
      RESULTS.passed++;
      return response.data;
    });
  } catch (error) {
    RESULTS.failed++;
    RESULTS.errors.push(`Database: ${error.message}`);
  }
}

// Test 7: Redis Cache Performance
async function testRedisCache() {
  const cacheTests = [
    {
      name: 'Cache Set',
      method: 'POST',
      path: '/api/cache/set',
      data: { key: 'test_key', value: 'test_value', ttl: 300 }
    },
    {
      name: 'Cache Get',
      method: 'GET',
      path: '/api/cache/get/test_key'
    }
  ];

  for (const test of cacheTests) {
    try {
      await measurePerformance(test.name, async () => {
        const response = await axios({
          method: test.method,
          url: `${BASE_URL}${test.path}`,
          data: test.data,
          timeout: 2000
        });
        RESULTS.passed++;
        return response.data;
      });
    } catch (error) {
      RESULTS.failed++;
      RESULTS.errors.push(`${test.name}: ${error.message}`);
    }
  }
}

// Test 8: Load Testing
async function testLoadPerformance() {
  const concurrentRequests = 10;
  const endpoint = '/api/status';
  
  log(`Starting load test with ${concurrentRequests} concurrent requests...`, 'info');
  
  const promises = [];
  const start = performance.now();
  
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(
      axios.get(`${BASE_URL}${endpoint}`)
        .then(() => ({ success: true }))
        .catch((error) => ({ success: false, error: error.message }))
    );
  }
  
  const results = await Promise.all(promises);
  const duration = performance.now() - start;
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  RESULTS.benchmarks['Load Test'] = {
    duration,
    totalRequests: concurrentRequests,
    successful,
    failed,
    avgResponseTime: duration / concurrentRequests
  };
  
  log(`Load Test: ${successful}/${concurrentRequests} successful, avg ${(duration/concurrentRequests).toFixed(2)}ms/req`, 'benchmark');
  
  if (successful === concurrentRequests) {
    RESULTS.passed++;
  } else {
    RESULTS.failed++;
    RESULTS.errors.push(`Load Test: ${failed} requests failed`);
  }
}

// Test 9: Agent Orchestration
async function testAgentOrchestration() {
  try {
    await measurePerformance('Agent Orchestration', async () => {
      const response = await axios.post(`${BASE_URL}/api/agents/execute`, {
        task: "What is the weather today?",
        agents: ["search", "synthesis"],
        maxIterations: 3
      }, {
        timeout: 10000
      });
      
      RESULTS.passed++;
      return response.data;
    });
  } catch (error) {
    RESULTS.failed++;
    RESULTS.errors.push(`Agent Orchestration: ${error.message}`);
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  log('UNIVERSAL AI TOOLS - FUNCTIONAL BENCHMARK TEST', 'info');
  console.log('='.repeat(60) + '\n');
  
  const startTime = performance.now();
  
  // Run all tests
  const tests = [
    { name: '1. Health Check', fn: testHealthCheck },
    { name: '2. API Endpoints', fn: testAPIEndpoints },
    { name: '3. LLM Services', fn: testLLMServices },
    { name: '4. Memory Service', fn: testMemoryService },
    { name: '5. WebSocket Connections', fn: testWebSockets },
    { name: '6. Database Operations', fn: testDatabaseOperations },
    { name: '7. Redis Cache', fn: testRedisCache },
    { name: '8. Load Performance', fn: testLoadPerformance },
    { name: '9. Agent Orchestration', fn: testAgentOrchestration }
  ];
  
  for (const test of tests) {
    console.log(`\n${colors.cyan}Running ${test.name}...${colors.reset}`);
    try {
      await test.fn();
    } catch (error) {
      log(`Test suite ${test.name} encountered critical error: ${error.message}`, 'error');
    }
  }
  
  const totalDuration = performance.now() - startTime;
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  log('TEST RESULTS SUMMARY', 'info');
  console.log('='.repeat(60));
  
  console.log(`\n${colors.green}✓ Passed: ${RESULTS.passed}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${RESULTS.failed}${colors.reset}`);
  console.log(`${colors.cyan}⏱ Total Time: ${totalDuration.toFixed(2)}ms${colors.reset}`);
  
  // Performance benchmarks
  console.log(`\n${colors.cyan}Performance Benchmarks:${colors.reset}`);
  for (const [name, data] of Object.entries(RESULTS.benchmarks)) {
    if (data.success) {
      console.log(`  ${colors.green}✓${colors.reset} ${name}: ${data.duration?.toFixed(2)}ms`);
    } else {
      console.log(`  ${colors.red}✗${colors.reset} ${name}: Failed`);
    }
  }
  
  // Errors summary
  if (RESULTS.errors.length > 0) {
    console.log(`\n${colors.red}Errors:${colors.reset}`);
    RESULTS.errors.forEach(error => {
      console.log(`  ${colors.red}•${colors.reset} ${error}`);
    });
  }
  
  // Overall status
  const successRate = (RESULTS.passed / (RESULTS.passed + RESULTS.failed) * 100).toFixed(1);
  console.log(`\n${colors.cyan}Success Rate: ${successRate}%${colors.reset}`);
  
  if (RESULTS.failed === 0) {
    console.log(`\n${colors.green}🎉 ALL TESTS PASSED!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.yellow}⚠️  Some tests failed. Review errors above.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});