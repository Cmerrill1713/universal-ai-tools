#!/usr/bin/env node

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TEST_ENDPOINTS = [
  '/health',
  '/api/memory/search',
  '/api/memory/store',
  '/api/context/search',
  '/api/tools/list',
  '/api/orchestration/status',
];

const TEST_SCENARIOS = [
  {
    name: 'Valid DEV_API_KEY',
    headers: {
      'x-api-key': 'test-dev-key-12345',
      'x-ai-service': 'local-ui',
    },
    expectedResult: 'should allow access',
  },
  {
    name: 'Old hardcoded key',
    headers: {
      'x-api-key': 'local-dev-key',
      'x-ai-service': 'local-ui',
    },
    expectedResult: 'should deny access',
  },
  {
    name: 'No API key',
    headers: {
      'x-ai-service': 'local-ui',
    },
    expectedResult: 'should deny access',
  },
  {
    name: 'Invalid API key',
    headers: {
      'x-api-key': 'invalid-key-123',
      'x-ai-service': 'local-ui',
    },
    expectedResult: 'should deny access',
  },
];

async function testEndpoint(port, endpoint, headers) {
  try {
    const headerArgs = Object.entries(headers)
      .map(([key, value]) => `-H "${key}: ${value}"`)
      .join(' ');

    const { stdout, stderr } = await execAsync(
      `curl -s -w "\\nHTTP_CODE:%{http_code}\\n" ${headerArgs} http://localhost:${port}${endpoint}`,
      { timeout: 5000 }
    );

    const lines = stdout.trim().split('\n');
    const httpCodeLine = lines.find((line) => line.startsWith('HTTP_CODE:'));
    const httpCode = httpCodeLine ? parseInt(httpCodeLine.split(':')[1]) : 0;

    const response = lines.filter((line) => !line.startsWith('HTTP_CODE:')).join('\n');

    return {
      success: true,
      httpCode,
      response: response.substring(0, 200), // Truncate long responses
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function scanForHardcodedKeys() {
  const results = {};

  try {
    // Search for hardcoded authentication bypasses in source files
    const { stdout } = await execAsync(
      'find src -name "*.ts" -o -name "*.js" | xargs grep -l "local-dev-key"'
    );

    const files = stdout
      .trim()
      .split('\n')
      .filter((f) => f.length > 0);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n');
        const matchingLines = lines
          .map((line, idx) => ({ line: line.trim(), number: idx + 1 }))
          .filter(({ line }) => line.includes('local-dev-key'));

        if (matchingLines.length > 0) {
          results[file] = matchingLines;
        }
      } catch (error) {
        console.warn(`Could not read file ${file}: ${error.message}`);
      }
    }
  } catch (error) {
    console.warn(`Search failed: ${error.message}`);
  }

  return results;
}

async function checkEnvironmentVariables() {
  const checks = {
    DEV_API_KEY: process.env.DEV_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  };

  return checks;
}

async function main() {
  console.log('🔐 Testing Authentication Bypass Removal Fixes');
  console.log('================================================\n');

  // Check environment variables
  console.log('1. Environment Variables Check:');
  const envVars = await checkEnvironmentVariables();
  Object.entries(envVars).forEach(([key, value]) => {
    console.log(`   ${key}: ${value || 'NOT SET'}`);
  });
  console.log();

  // Scan for hardcoded keys in source
  console.log('2. Scanning for hardcoded authentication bypasses:');
  const hardcodedKeys = await scanForHardcodedKeys();

  if (Object.keys(hardcodedKeys).length === 0) {
    console.log('   ✅ No hardcoded "local-dev-key" found in source files');
  } else {
    console.log('   ❌ Found hardcoded authentication bypasses:');
    Object.entries(hardcodedKeys).forEach(([file, matches]) => {
      console.log(`     ${file}:`);
      matches.forEach(({ line, number }) => {
        console.log(`       Line ${number}: ${line}`);
      });
    });
  }
  console.log();

  // Test endpoints
  console.log('3. Testing Authentication on Endpoints:');
  const ports = [9999, 3000, 3001, 8000];

  for (const port of ports) {
    console.log(`\n   Testing port ${port}:`);

    // Test health endpoint first to see if server is running
    const healthTest = await testEndpoint(port, '/health', {});
    if (!healthTest.success || healthTest.httpCode >= 500) {
      console.log(`     ⚠️  Server not responding on port ${port}`);
      continue;
    }

    console.log(`     ✅ Server responding on port ${port}`);

    for (const endpoint of TEST_ENDPOINTS) {
      console.log(`\n     Endpoint: ${endpoint}`);

      for (const scenario of TEST_SCENARIOS) {
        const result = await testEndpoint(port, endpoint, scenario.headers);

        if (result.success) {
          const status = result.httpCode < 400 ? '✅ ALLOWED' : '❌ DENIED';
          const expectation = scenario.expectedResult.includes('allow') ? 'ALLOW' : 'DENY';
          const correct = result.httpCode < 400 === expectation.includes('ALLOW') ? '✓' : '✗';

          console.log(`       ${scenario.name}: ${status} (${result.httpCode}) ${correct}`);

          if (scenario.name === 'Old hardcoded key' && result.httpCode < 400) {
            console.log(`         🚨 SECURITY ISSUE: Hardcoded key still accepted!`);
          }
        } else {
          console.log(`       ${scenario.name}: ERROR - ${result.error}`);
        }
      }
    }
  }

  console.log('\n4. Summary:');
  console.log('   - Check for remaining hardcoded keys in source files');
  console.log('   - Verify DEV_API_KEY environment variable is set');
  console.log('   - Test that old "local-dev-key" is rejected');
  console.log('   - Confirm valid DEV_API_KEY is accepted');
  console.log('\n================================================');
}

main().catch(console.error);
