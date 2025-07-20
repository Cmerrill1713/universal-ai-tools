#!/usr/bin/env node

import { spawn } from 'child_process';
import axios from 'axios';
import chalk from 'chalk';

const PORT = process.env.PORT || 3456;
const BASE_URL = `http://localhost:${PORT}`;

console.log(chalk.blue('=== Universal AI Tools - Server Startup Test ===\n'));

// Start the server
console.log(chalk.yellow('Starting server...'));
const serverProcess = spawn('npm', ['run', 'dev'], {
  env: { ...process.env, NODE_ENV: 'testing', PORT },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
let serverReady = false;

// Capture server output
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  
  // Check if server is ready
  if (output.includes(`Server running on port ${PORT}`) || 
      output.includes('Ready to accept connections')) {
    serverReady = true;
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error(chalk.red('Server error:'), data.toString());
});

// Wait for server to be ready
async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (serverReady) {
      console.log(chalk.green('✓ Server started successfully'));
      return true;
    }
    
    // Also try a health check
    try {
      await axios.get(`${BASE_URL}/health`, { timeout: 1000 });
      console.log(chalk.green('✓ Server responding to health checks'));
      return true;
    } catch (error) {
      // Server not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  
  console.log(chalk.red('\n✗ Server failed to start'));
  console.log('Server output:', serverOutput);
  return false;
}

// Test endpoints
async function testEndpoints() {
  const endpoints = [
    { method: 'GET', path: '/health', expected: 200 },
    { method: 'GET', path: '/api/v1/agents', expected: 200 },
    { method: 'GET', path: '/api/v1/memory/status', expected: 200 },
    { method: 'GET', path: '/api/v1/knowledge/status', expected: 200 },
    { method: 'GET', path: '/api/docs', expected: 200 },
    { method: 'GET', path: '/metrics', expected: 200 }
  ];
  
  console.log(chalk.yellow('\nTesting endpoints...'));
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${BASE_URL}${endpoint.path}`,
        timeout: 5000,
        validateStatus: () => true // Don't throw on any status
      });
      
      const success = response.status === endpoint.expected;
      results.push({ endpoint, success, status: response.status });
      
      if (success) {
        console.log(chalk.green(`✓ ${endpoint.method} ${endpoint.path} - ${response.status}`));
      } else {
        console.log(chalk.red(`✗ ${endpoint.method} ${endpoint.path} - ${response.status} (expected ${endpoint.expected})`));
      }
    } catch (error) {
      results.push({ endpoint, success: false, error: error.message });
      console.log(chalk.red(`✗ ${endpoint.method} ${endpoint.path} - ${error.message}`));
    }
  }
  
  return results;
}

// Test WebSocket connection
async function testWebSocket() {
  console.log(chalk.yellow('\nTesting WebSocket...'));
  
  try {
    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    
    return new Promise((resolve) => {
      ws.on('open', () => {
        console.log(chalk.green('✓ WebSocket connection established'));
        ws.close();
        resolve(true);
      });
      
      ws.on('error', (error) => {
        console.log(chalk.red(`✗ WebSocket error: ${error.message}`));
        resolve(false);
      });
      
      setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    console.log(chalk.red(`✗ WebSocket test failed: ${error.message}`));
    return false;
  }
}

// Generate status report
function generateReport(endpointResults, wsResult, duration) {
  console.log(chalk.blue('\n=== Test Summary ==='));
  
  const totalTests = endpointResults.length + 1;
  const passedTests = endpointResults.filter(r => r.success).length + (wsResult ? 1 : 0);
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${chalk.green(passedTests)}`);
  console.log(`Failed: ${chalk.red(totalTests - passedTests)}`);
  console.log(`Pass rate: ${passRate >= 80 ? chalk.green(passRate + '%') : chalk.red(passRate + '%')}`);
  console.log(`Duration: ${duration}ms`);
  
  if (passRate < 80) {
    console.log(chalk.yellow('\n⚠️  Server is partially operational but needs attention'));
  } else {
    console.log(chalk.green('\n✓ Server is operational and ready for development'));
  }
  
  // Write detailed report
  const report = {
    timestamp: new Date().toISOString(),
    duration,
    passRate,
    endpoints: endpointResults,
    webSocket: wsResult,
    serverOutput: serverOutput.slice(-1000) // Last 1000 chars
  };
  
  require('fs').writeFileSync(
    'test-server-startup-report.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log(chalk.gray('\nDetailed report saved to test-server-startup-report.json'));
}

// Main test flow
async function runTest() {
  const startTime = Date.now();
  
  try {
    // Wait for server to start
    const serverStarted = await waitForServer();
    
    if (!serverStarted) {
      serverProcess.kill();
      process.exit(1);
    }
    
    // Test endpoints
    const endpointResults = await testEndpoints();
    
    // Test WebSocket
    const wsResult = await testWebSocket();
    
    // Generate report
    const duration = Date.now() - startTime;
    generateReport(endpointResults, wsResult, duration);
    
  } catch (error) {
    console.error(chalk.red('Test failed:'), error);
  } finally {
    // Clean up
    console.log(chalk.gray('\nShutting down server...'));
    serverProcess.kill();
    
    // Give it time to clean up
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nInterrupted, cleaning up...'));
  serverProcess.kill();
  process.exit(1);
});

// Run the test
runTest();