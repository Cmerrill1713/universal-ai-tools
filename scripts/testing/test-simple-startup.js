#!/usr/bin/env node

import { spawn } from 'child_process';
import axios from 'axios';
import chalk from 'chalk';

const PORT = 3456;
const BASE_URL = `http://localhost:${PORT}`;

process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(chalk.blue('=== Simple Server Startup Test ===\n'));

// Start the server with minimal configuration
console.log(chalk.yellow('Starting server...'));
const serverProcess = spawn('npm', ['run', 'dev'], {
  env: {
    ...process.env,
    NODE_ENV: 'testing',
    PORT,
    ENABLE_DSPY_MOCK: 'true',
    LOG_LEVEL: 'info',
    PERFORMANCE_MONITORING_ENABLED: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverReady = false;
let startTime = Date.now();

// Capture server output
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(chalk.gray(output.trim()));

  // Check if server is ready - look for specific ready messages
  if (
    output.includes(`Server running on port ${PORT}`) ||
    output.includes('HTTP server listening') ||
    output.includes('Ready to accept connections') ||
    output.includes('Server started successfully')
  ) {
    serverReady = true;
    console.log(chalk.green('\n✓ Server appears to be ready!'));
  }
});

serverProcess.stderr.on('data', (data) => {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(chalk.red('Server error:'), data.toString());
});

// Simple health check function
async function healthCheck() {
  try {
    const response = await axios.get(`${BASE_URL}/health`, {
      timeout: 2000,
      validateStatus: () => true,
    });

    console.log(chalk.green(`✓ Health check successful - Status: ${response.status}`));
    if (response.data) {
      console.log(chalk.gray('Response:', JSON.stringify(response.data, null, 2)));
    }
    return true;
  } catch (error) {
    console.log(chalk.yellow(`Health check failed: ${error.message}`));
    return false;
  }
}

// Wait for server and test
async function runTest() {
  console.log('\nWaiting for server to start...');

  // Wait up to 45 seconds for server to be ready
  for (let i = 0; i < 45; i++) {
    if (serverReady) {
      console.log(chalk.green("Server indicated it's ready!"));
      break;
    }

    // Try health check every 3 seconds after the 10th second
    if (i >= 10 && i % 3 === 0) {
      console.log(chalk.gray('Attempting health check...'));
      const healthy = await healthCheck();
      if (healthy) {
        serverReady = true;
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }

  if (!serverReady) {
    console.log(chalk.red('\n✗ Server failed to start within 45 seconds'));
    return false;
  }

  // Give it a moment and try a final health check
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const finalCheck = await healthCheck();

  console.log(chalk.blue(`\nTest completed in ${Date.now() - startTime}ms`));
  return finalCheck;
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nInterrupted, cleaning up...'));
  serverProcess.kill();
  process.exit(1);
});

// Run the test
runTest()
  .then((success) => {
    console.log(
      success
        ? chalk.green('\n✓ SUCCESS: Server is operational')
        : chalk.red('\n✗ FAILED: Server not responding')
    );

    // Clean up
    console.log(chalk.gray('Shutting down server...'));
    serverProcess.kill();

    setTimeout(() => {
      process.exit(success ? 0 : 1);
    }, 2000);
  })
  .catch((error) => {
    console.error(chalk.red('Test error:'), error);
    serverProcess.kill();
    process.exit(1);
  });
