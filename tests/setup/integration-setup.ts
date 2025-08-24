/**
 * Integration Test Setup
 * Global setup for distributed system integration tests
 */

import { beforeAll, afterAll, jest } from '@jest/globals';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

// Global test state
declare global {
  var testServices: {
    rustAiCore?: ChildProcess;
    goWebSocket?: ChildProcess;
    processes: ChildProcess[];
  };
  var testConfig: {
    skipServiceStart: boolean;
    useExternalServices: boolean;
  };
}

// Initialize global test configuration
globalThis.testConfig = {
  skipServiceStart: process.env.SKIP_SERVICE_START === 'true',
  useExternalServices: process.env.USE_EXTERNAL_SERVICES === 'true',
};

globalThis.testServices = {
  processes: [],
};

beforeAll(async () => {
  console.log('🚀 Setting up integration test environment...');
  
  // Set longer timeouts for integration tests
  jest.setTimeout(60000);
  
  // Setup test logging
  setupTestLogging();
  
  // Check prerequisites
  await checkPrerequisites();
  
  // Start services if not skipped
  if (!globalThis.testConfig.skipServiceStart && !globalThis.testConfig.useExternalServices) {
    await startTestServices();
  }
  
  // Validate service availability
  await validateServices();
  
  console.log('✅ Integration test environment ready');
}, 120000); // 2 minute timeout for setup

afterAll(async () => {
  console.log('🛑 Tearing down integration test environment...');
  
  // Stop all test services
  await stopAllTestServices();
  
  // Clean up test artifacts
  await cleanupTestArtifacts();
  
  console.log('✅ Integration test environment cleaned up');
}, 30000);

async function setupTestLogging(): Promise<void> {
  // Create test logs directory
  const logsDir = path.join(__dirname, '../../test-logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Setup console override for test logging
  const originalConsole = console.log;
  console.log = (...args: any[]) => {
    const timestamp = new Date().toISOString();
    originalConsole(`[${timestamp}]`, ...args);
  };
}

async function checkPrerequisites(): Promise<void> {
  console.log('🔍 Checking prerequisites...');
  
  const projectRoot = path.resolve(__dirname, '../../');
  
  // Check if Rust AI Core binary exists
  const rustBinary = path.join(projectRoot, 'rust-services/llm-router/target/release/llm-router');
  if (!globalThis.testConfig.useExternalServices && !fs.existsSync(rustBinary)) {
    console.warn('⚠️ Rust AI Core binary not found, building...');
    await buildRustServices();
  }
  
  // Check if Go WebSocket service exists
  const goServiceDir = path.join(projectRoot, 'rust-services/go-websocket');
  if (!globalThis.testConfig.useExternalServices && !fs.existsSync(path.join(goServiceDir, 'main.go'))) {
    throw new Error('Go WebSocket service not found at expected location');
  }
  
  // Check Node.js dependencies
  const packageJson = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJson)) {
    throw new Error('package.json not found - run npm install');
  }
  
  console.log('✅ Prerequisites check passed');
}

async function buildRustServices(): Promise<void> {
  console.log('🦀 Building Rust services...');
  
  const projectRoot = path.resolve(__dirname, '../../');
  const rustServiceDir = path.join(projectRoot, 'rust-services/llm-router');
  
  return new Promise((resolve, reject) => {
    const buildProcess = spawn('cargo', ['build', '--release'], {
      cwd: rustServiceDir,
      stdio: 'pipe',
    });
    
    let output = '';
    buildProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    buildProcess.stderr?.on('data', (data) => {
      output += data.toString();
    });
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Rust services built successfully');
        resolve();
      } else {
        console.error('❌ Rust build failed:', output);
        reject(new Error(`Rust build failed with code ${code}`));
      }
    });
    
    // 5 minute timeout for building
    setTimeout(() => {
      buildProcess.kill('SIGKILL');
      reject(new Error('Rust build timed out'));
    }, 300000);
  });
}

async function startTestServices(): Promise<void> {
  console.log('🚀 Starting test services...');
  
  const projectRoot = path.resolve(__dirname, '../../');
  
  try {
    // Start Rust AI Core service
    console.log('🦀 Starting Rust AI Core service...');
    const rustBinary = path.join(projectRoot, 'rust-services/llm-router/target/release/llm-router');
    const rustProcess = spawn(rustBinary, [], {
      env: {
        ...process.env,
        PORT: '8003',
        RUST_LOG: 'info',
        DATABASE_URL: process.env.DATABASE_URL || 'sqlite://test.db',
      },
      cwd: path.join(projectRoot, 'rust-services/llm-router'),
      stdio: 'pipe',
    });
    
    globalThis.testServices.rustAiCore = rustProcess;
    globalThis.testServices.processes.push(rustProcess);
    
    // Capture logs
    rustProcess.stdout?.on('data', (data) => {
      if (process.env.VERBOSE_LOGS) {
        console.log('🦀 [Rust AI Core]:', data.toString().trim());
      }
    });
    
    rustProcess.stderr?.on('data', (data) => {
      if (process.env.VERBOSE_LOGS) {
        console.error('🦀 [Rust AI Core Error]:', data.toString().trim());
      }
    });
    
    // Start Go WebSocket service
    console.log('🐹 Starting Go WebSocket service...');
    const goProcess = spawn('go', ['run', '.'], {
      env: {
        ...process.env,
        WEBSOCKET_PORT: '8080',
        REQUIRE_AUTH: 'false', // Disable auth for testing
        REDIS_URL: 'localhost:6379',
      },
      cwd: path.join(projectRoot, 'rust-services/go-websocket'),
      stdio: 'pipe',
    });
    
    globalThis.testServices.goWebSocket = goProcess;
    globalThis.testServices.processes.push(goProcess);
    
    // Capture logs
    goProcess.stdout?.on('data', (data) => {
      if (process.env.VERBOSE_LOGS) {
        console.log('🐹 [Go WebSocket]:', data.toString().trim());
      }
    });
    
    goProcess.stderr?.on('data', (data) => {
      if (process.env.VERBOSE_LOGS) {
        console.error('🐹 [Go WebSocket Error]:', data.toString().trim());
      }
    });
    
    // Wait for services to start
    console.log('⏳ Waiting for services to initialize...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Test services started');
  } catch (error) {
    console.error('❌ Failed to start test services:', error);
    await stopAllTestServices();
    throw error;
  }
}

async function validateServices(): Promise<void> {
  console.log('🔍 Validating service availability...');
  
  const services = [
    { name: 'Rust AI Core', url: 'http://localhost:8003/health' },
    { name: 'Go WebSocket', url: 'http://localhost:8080/health' },
  ];
  
  const maxAttempts = 30;
  const delayMs = 1000;
  
  for (const service of services) {
    if (globalThis.testConfig.useExternalServices) {
      console.log(`⏳ Checking external ${service.name}...`);
    }
    
    let success = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(service.url, { timeout: 3000 });
        if (response.status === 200) {
          console.log(`✅ ${service.name} is available`);
          success = true;
          break;
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          console.error(`❌ ${service.name} failed to start:`, error);
        } else {
          console.log(`⏳ ${service.name} not ready (attempt ${attempt}/${maxAttempts})`);
        }
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    if (!success) {
      throw new Error(`${service.name} is not available after ${maxAttempts} attempts`);
    }
  }
  
  console.log('✅ All services validated');
}

async function stopAllTestServices(): Promise<void> {
  console.log('🛑 Stopping all test services...');
  
  const killPromises = globalThis.testServices.processes.map((process, index) => {
    return new Promise<void>((resolve) => {
      const serviceName = index === 0 ? 'Rust AI Core' : 'Go WebSocket';
      
      if (process.killed || process.exitCode !== null) {
        console.log(`✅ ${serviceName} already stopped`);
        resolve();
        return;
      }
      
      process.on('exit', () => {
        console.log(`✅ ${serviceName} stopped`);
        resolve();
      });
      
      process.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!process.killed && process.exitCode === null) {
          console.log(`⚠️ Force killing ${serviceName}`);
          process.kill('SIGKILL');
        }
      }, 5000);
      
      // Resolve anyway after 10 seconds
      setTimeout(() => {
        resolve();
      }, 10000);
    });
  });
  
  await Promise.all(killPromises);
  globalThis.testServices.processes = [];
  console.log('✅ All test services stopped');
}

async function cleanupTestArtifacts(): Promise<void> {
  console.log('🧹 Cleaning up test artifacts...');
  
  try {
    // Clean up test databases
    const testDb = path.join(__dirname, '../../test.db');
    if (fs.existsSync(testDb)) {
      fs.unlinkSync(testDb);
    }
    
    // Clean up temp files
    const tempDir = path.join(__dirname, '../../temp-test');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    console.log('✅ Test artifacts cleaned up');
  } catch (error) {
    console.warn('⚠️ Failed to clean up some test artifacts:', error);
  }
}

// Export utilities for tests
export {
  checkPrerequisites,
  validateServices,
  startTestServices,
  stopAllTestServices,
};