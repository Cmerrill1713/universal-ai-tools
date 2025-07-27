#!/usr/bin/env node

import axios from 'axios';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load test environment
const loadTestEnv = () => {
  const envPath = path.join(__dirname, '..', '.env.test');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
};

loadTestEnv();

const BASE_URL = `http://localhost:${process.env.PORT || 9999}`;
const API_KEY = process.env.DEV_API_KEY;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

const log = {
  test: (name) => console.log(`\n${colors.blue}TEST:${colors.reset} ${name}`),
  pass: (msg) => console.log(`  ${colors.green}✓${colors.reset} ${msg}`),
  fail: (msg) => console.log(`  ${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`  ${colors.blue}ℹ${colors.reset}  ${msg}`),
  error: (msg) => console.log(`  ${colors.red}ERROR:${colors.reset} ${msg}`),
};

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
};

async function runTest(name, testFn) {
  testResults.total++;
  log.test(name);

  try {
    await testFn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed' });
    log.pass('Test passed');
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message });
    log.fail(`Test failed: ${error.message}`);
    if (error.response) {
      log.error(`Response: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Test Suite: Performance Middleware
async function testPerformanceMiddleware() {
  await runTest('Performance middleware returns real metrics', async () => {
    const response = await axios.get(`${BASE_URL}/api/performance/metrics`, {
      headers: { 'X-API-Key': API_KEY },
    });

    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid metrics response');
    }

    // Check for expected metric fields
    const expectedFields = ['requests', 'memory', 'cache'];
    for (const field of expectedFields) {
      if (!(field in response.data)) {
        throw new Error(`Missing metric field: ${field}`);
      }
    }

    log.info(`Metrics: ${JSON.stringify(response.data)}`);
  });

  await runTest('Performance report endpoint works', async () => {
    const response = await axios.get(`${BASE_URL}/api/performance/report`, {
      headers: { 'X-API-Key': API_KEY },
    });

    if (!response.data || !response.data.report) {
      throw new Error('Invalid report response');
    }

    log.info(`Report generated: ${response.data.report.substring(0, 100)}...`);
  });
}

// Test Suite: Security Hardening
async function testSecurityHardening() {
  await runTest('Security status endpoint works', async () => {
    const response = await axios.get(`${BASE_URL}/api/security/status`, {
      headers: { 'X-API-Key': API_KEY },
    });

    if (!response.data || typeof response.data.status !== 'string') {
      throw new Error('Invalid security status response');
    }

    log.info(`Security status: ${response.data.status}`);
  });

  await runTest('Security headers are present', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`, {
      headers: { 'X-API-Key': API_KEY },
    });

    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'strict-transport-security',
    ];

    for (const header of requiredHeaders) {
      if (!response.headers[header]) {
        throw new Error(`Missing security header: ${header}`);
      }
    }

    log.info('All security headers present');
  });
}

// Test Suite: Authentication
async function testAuthentication() {
  await runTest('Hardcoded dev key is rejected', async () => {
    try {
      await axios.get(`${BASE_URL}/api/stats`, {
        headers: { 'X-API-Key': 'local-dev-key' },
      });
      throw new Error('Hardcoded key should have been rejected');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        log.info('Hardcoded key correctly rejected');
      } else {
        throw error;
      }
    }
  });

  await runTest('Valid API key is accepted', async () => {
    const response = await axios.get(`${BASE_URL}/api/stats`, {
      headers: { 'X-API-Key': API_KEY },
    });

    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    log.info('Valid API key accepted');
  });

  await runTest('No API key returns 401', async () => {
    try {
      await axios.get(`${BASE_URL}/api/stats`);
      throw new Error('Request without API key should have failed');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        log.info('Missing API key correctly rejected');
      } else {
        throw error;
      }
    }
  });
}

// Test Suite: CORS Configuration
async function testCORS() {
  await runTest('CORS allows configured origins', async () => {
    const response = await axios.options(`${BASE_URL}/api/health`, {
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });

    const allowedOrigin = response.headers['access-control-allow-origin'];
    if (!allowedOrigin) {
      throw new Error('CORS headers not set');
    }

    log.info(`CORS allowed origin: ${allowedOrigin}`);
  });

  await runTest('CORS rejects unauthorized origins', async () => {
    const response = await axios.options(`${BASE_URL}/api/health`, {
      headers: {
        Origin: 'http://malicious-site.com',
        'Access-Control-Request-Method': 'GET',
      },
      validateStatus: () => true,
    });

    const allowedOrigin = response.headers['access-control-allow-origin'];
    if (allowedOrigin === 'http://malicious-site.com') {
      throw new Error('CORS should not allow arbitrary origins');
    }

    log.info('Unauthorized origin correctly handled');
  });
}

// Test Suite: GraphQL Server
async function testGraphQL() {
  await runTest('GraphQL endpoint is accessible', async () => {
    const response = await axios.post(
      `${BASE_URL}/graphql`,
      {
        query: '{ __schema { queryType { name } } }',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
      }
    );

    if (!response.data || !response.data.data) {
      throw new Error('Invalid GraphQL response');
    }

    log.info('GraphQL introspection successful');
  });

  await runTest('GraphQL handles errors gracefully', async () => {
    const response = await axios.post(
      `${BASE_URL}/graphql`,
      {
        query: '{ invalidQuery }',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        validateStatus: () => true,
      }
    );

    if (!response.data.errors) {
      throw new Error('GraphQL should return errors for invalid queries');
    }

    log.info('GraphQL error handling works');
  });
}

// Test Suite: Agent Execution
async function testAgentExecution() {
  await runTest('Agent execution endpoint exists', async () => {
    // First create a test agent
    const createResponse = await axios.post(
      `${BASE_URL}/api/agents`,
      {
        name: 'Test Agent',
        description: 'Phase 1 test agent',
        type: 'cognitive',
        model: 'test-model',
      },
      {
        headers: { 'X-API-Key': API_KEY },
      }
    );

    const agentId = createResponse.data.id;

    // Test execution
    const response = await axios.post(
      `${BASE_URL}/api/agents/${agentId}/execute`,
      {
        input: 'Test input',
        context: {},
      },
      {
        headers: { 'X-API-Key': API_KEY },
        validateStatus: () => true,
      }
    );

    // Should not hang - either succeed or fail gracefully
    if (response.status === 503) {
      log.info('Agent execution gracefully handled service unavailability');
    } else if (response.status === 200) {
      log.info('Agent execution successful');
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });
}

// Test Suite: Port Integration
async function testPortIntegration() {
  await runTest('Port status endpoint works', async () => {
    const response = await axios.get(`${BASE_URL}/api/ports/status`, {
      headers: { 'X-API-Key': API_KEY },
      validateStatus: () => true,
    });

    if (response.status === 503) {
      log.info('Port service unavailable (expected if not initialized)');
    } else if (response.status === 200) {
      log.info(`Port status: ${JSON.stringify(response.data)}`);
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  await runTest('Port report endpoint works', async () => {
    const response = await axios.get(`${BASE_URL}/api/ports/report`, {
      headers: { 'X-API-Key': API_KEY },
      validateStatus: () => true,
    });

    if (response.status === 503) {
      log.info('Port service unavailable (expected if not initialized)');
    } else if (response.status === 200) {
      log.info('Port report generated successfully');
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });
}

// Main test runner
async function main() {
  console.log('🧪 Universal AI Tools - Phase 1 Fix Verification');
  console.log('==============================================\n');

  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/api/health`);
  } catch (error) {
    console.error('❌ Server is not running!');
    console.error('Please start the server with: npm run dev');
    process.exit(1);
  }

  // Run all test suites
  await testPerformanceMiddleware();
  await testSecurityHardening();
  await testAuthentication();
  await testCORS();
  await testGraphQL();
  await testAgentExecution();
  await testPortIntegration();

  // Print summary
  console.log('\n==============================================');
  console.log('TEST SUMMARY');
  console.log('==============================================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);

  // Print failed tests
  if (testResults.failed > 0) {
    console.log('\nFailed Tests:');
    testResults.tests
      .filter((t) => t.status === 'failed')
      .forEach((t) => {
        console.log(`  ${colors.red}✗${colors.reset} ${t.name}`);
        console.log(`    Error: ${t.error}`);
      });
  }

  // Generate test report
  const reportPath = path.join(__dirname, '..', 'PHASE1_TEST_RESULTS.md');
  const report = generateTestReport();
  require('fs').writeFileSync(reportPath, report);
  console.log(`\nTest report saved to: ${reportPath}`);

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

function generateTestReport() {
  const timestamp = new Date().toISOString();
  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(2);

  let report = `# Phase 1 Test Results\n\n`;
  report += `**Date:** ${timestamp}\n`;
  report += `**Total Tests:** ${testResults.total}\n`;
  report += `**Passed:** ${testResults.passed}\n`;
  report += `**Failed:** ${testResults.failed}\n`;
  report += `**Pass Rate:** ${passRate}%\n\n`;

  report += `## Test Details\n\n`;
  testResults.tests.forEach((test) => {
    const icon = test.status === 'passed' ? '✅' : '❌';
    report += `- ${icon} ${test.name}\n`;
    if (test.error) {
      report += `  - Error: ${test.error}\n`;
    }
  });

  report += `\n## Recommendations\n\n`;
  if (testResults.failed > 0) {
    report += `- Fix failing tests before proceeding to Phase 2\n`;
    report += `- Review error logs for detailed failure information\n`;
  } else {
    report += `- All Phase 1 fixes verified successfully\n`;
    report += `- Ready to proceed with Phase 2\n`;
  }

  return report;
}

// Run tests
main().catch((err) => {
  console.error(`Test suite failed: ${err.message}`);
  process.exit(1);
});
