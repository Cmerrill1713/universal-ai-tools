import axios from 'axios';
import { spawn } from 'child_process';

const BASE_URL = 'http://localhost:9999';
const API_KEY = process.env.DEV_API_KEY || '';

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

async function test(name, testFn) {
  console.log(`\nTesting: ${name}`);
  try {
    await testFn();
    console.log(`${colors.green}✅ PASSED${colors.reset}: ${name}`);
    testResults.passed++;
    testResults.details.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`${colors.red}❌ FAILED${colors.reset}: ${name}`);
    console.log(`   Error: ${error.message}`);
    testResults.failed++;
    testResults.details.push({ name, status: 'failed', error: error.message });
  }
}

async function warn(message) {
  console.log(`${colors.yellow}⚠️  WARNING${colors.reset}: ${message}`);
  testResults.warnings++;
}

async function waitForServer(maxAttempts = 30) {
  console.log('Waiting for server to be ready...');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(`${BASE_URL}/api/health`);
      console.log('Server is ready!');
      return true;
    } catch (error) {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Server failed to start within 30 seconds');
}

async function runTests() {
  console.log('🧪 Universal AI Tools - Comprehensive Fix Verification\n');
  
  if (!API_KEY) {
    warn('DEV_API_KEY not set in environment - authentication tests may fail');
  }

  // Test 1: Server Health
  await test('Server Health Check', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`);
    if (response.data.status !== 'healthy') {
      throw new Error('Server not healthy');
    }
  });

  // Test 2: Authentication (no more local-dev-key)
  await test('Authentication with Environment Variable', async () => {
    if (!API_KEY) {
      throw new Error('DEV_API_KEY not set - cannot test authentication');
    }
    
    const response = await axios.get(`${BASE_URL}/api/stats`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    if (!response.data.success) {
      throw new Error('Authentication failed with environment API key');
    }
  });

  await test('Authentication Rejection with Invalid Key', async () => {
    try {
      await axios.get(`${BASE_URL}/api/memory`, {
        headers: { 'X-API-Key': 'local-dev-key' } // Old hardcoded key should fail
      });
      throw new Error('Hardcoded local-dev-key was accepted!');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401, got ${error.response?.status}`);
      }
    }
  });

  // Test 3: CORS Configuration
  await test('CORS Headers Present', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`, {
      headers: {
        'Origin': 'http://localhost:3000',
        'X-API-Key': API_KEY
      }
    });
    
    const corsHeaders = response.headers['access-control-allow-origin'];
    if (!corsHeaders) {
      throw new Error('CORS headers not present');
    }
  });

  await test('CORS Preflight Request', async () => {
    const response = await axios.options(`${BASE_URL}/api/memory`, {
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-api-key'
      }
    });
    
    if (!response.headers['access-control-allow-methods']) {
      throw new Error('CORS preflight failed');
    }
  });

  // Test 4: Security Headers (CSP, etc)
  await test('Security Headers (Helmet)', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ];
    
    for (const header of requiredHeaders) {
      if (!response.headers[header]) {
        throw new Error(`Missing security header: ${header}`);
      }
    }
  });

  // Test 5: GraphQL Endpoint
  await test('GraphQL Endpoint Available', async () => {
    const response = await axios.post(`${BASE_URL}/graphql`, {
      query: '{ __schema { queryType { name } } }'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.data.data?.__schema?.queryType) {
      throw new Error('GraphQL introspection failed');
    }
  });

  await test('GraphQL Health Check', async () => {
    const response = await axios.get(`${BASE_URL}/api/graphql/health`);
    if (response.data.status !== 'healthy') {
      throw new Error('GraphQL health check failed');
    }
  });

  // Test 6: Performance Middleware
  await test('Performance Metrics Endpoint', async () => {
    const response = await axios.get(`${BASE_URL}/api/performance/metrics`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    if (!response.data.success || !response.data.metrics) {
      throw new Error('Performance metrics not available');
    }
  });

  await test('Performance Report Endpoint', async () => {
    const response = await axios.get(`${BASE_URL}/api/performance/report`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    if (!response.data.success || !response.data.report) {
      throw new Error('Performance report not available');
    }
  });

  // Test 7: Security Hardening Service
  await test('Security Audit Endpoint', async () => {
    const response = await axios.get(`${BASE_URL}/api/security/audit`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    if (!response.data.success) {
      throw new Error('Security audit endpoint not working');
    }
  });

  // Test 8: Agent Execution (with mock if Ollama not running)
  await test('Agent Execution Endpoint Available', async () => {
    // First create a test agent
    const createResponse = await axios.post(`${BASE_URL}/api/agents`, {
      name: 'Test Agent',
      description: 'Test agent for verification',
      instructions: 'You are a test agent. Respond with "Test successful".',
      capabilities: ['test'],
      model: 'llama3.2:3b'
    }, {
      headers: { 
        'X-API-Key': API_KEY,
        'X-AI-Service': 'test-service'
      }
    });
    
    if (!createResponse.data.success) {
      throw new Error('Failed to create test agent');
    }
    
    const agentId = createResponse.data.agent.id;
    
    // Try to execute the agent
    try {
      const execResponse = await axios.post(`${BASE_URL}/api/agents/${agentId}/execute`, {
        input: 'Hello',
        context: { test: true }
      }, {
        headers: { 
          'X-API-Key': API_KEY,
          'X-AI-Service': 'test-service'
        }
      });
      
      if (!execResponse.data.success) {
        throw new Error('Agent execution failed');
      }
      console.log('   Agent execution successful!');
    } catch (error) {
      if (error.response?.status === 503) {
        warn('Ollama not running - agent execution returned 503 as expected');
      } else {
        throw error;
      }
    }
    
    // Clean up - delete test agent
    await axios.delete(`${BASE_URL}/api/agents/${agentId}`, {
      headers: { 
        'X-API-Key': API_KEY,
        'X-AI-Service': 'test-service'
      }
    });
  });

  // Test 9: Port Integration Service
  await test('Port Status Endpoint', async () => {
    const response = await axios.get(`${BASE_URL}/api/ports/status`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    if (!response.data.success) {
      throw new Error('Port status endpoint failed');
    }
    
    // Check if service is initialized or properly reports not initialized
    if (response.data.status.message && 
        response.data.status.message.includes('not initialized')) {
      warn('Port integration service not initialized (this is OK if it timed out)');
    }
  });

  await test('Port Report Endpoint', async () => {
    const response = await axios.get(`${BASE_URL}/api/ports/report`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    if (!response.data.success) {
      throw new Error('Port report endpoint failed');
    }
  });

  // Test 10: Rate Limiting Headers
  await test('Rate Limiting Headers', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    // Check for rate limit headers (might not be present in all endpoints)
    if (response.headers['x-ratelimit-limit']) {
      console.log(`   Rate limit: ${response.headers['x-ratelimit-limit']}`);
      console.log(`   Remaining: ${response.headers['x-ratelimit-remaining']}`);
    } else {
      warn('Rate limit headers not present on /api/health');
    }
  });

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${testResults.warnings}${colors.reset}`);
  
  if (testResults.failed > 0) {
    console.log('\nFailed tests:');
    testResults.details
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }
  
  console.log('\n' + (testResults.failed === 0 ? 
    `${colors.green}✅ All critical tests passed!${colors.reset}` : 
    `${colors.red}❌ Some tests failed - fixes may not be working properly${colors.reset}`));
}

// Check if server is running
async function main() {
  try {
    await waitForServer();
    await runTests();
  } catch (error) {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
main();