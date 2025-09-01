/**
 * Test setup utilities for Go-Rust integration tests
 */

import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import { promisify } from 'util';

const wait = promisify(setTimeout);

export interface TestService {
  name: string;
  process?: ChildProcess;
  url: string;
  healthEndpoint: string;
  startCommand: string[];
  workingDir?: string;
  env?: Record<string, string>;
}

export class TestEnvironment {
  private services: Map<string, TestService> = new Map();
  private isSetup = false;

  constructor() {
    // Define all test services
    this.services.set('shared-memory', {
      name: 'shared-memory',
      url: 'http://localhost:8089',
      healthEndpoint: '/health',
      startCommand: ['go', 'run', 'main.go'],
      workingDir: './go-services/shared-memory',
      env: { PORT: '8089' }
    });

    this.services.set('ml-go', {
      name: 'ml-go',
      url: 'http://localhost:8086',
      healthEndpoint: '/health',
      startCommand: ['go', 'run', 'main.go'],
      workingDir: './go-services/ml-inference',
      env: { PORT: '8086' }
    });

    this.services.set('ml-rust', {
      name: 'ml-rust',
      url: 'http://localhost:8087',
      healthEndpoint: '/health',
      startCommand: ['cargo', 'run'],
      workingDir: './rust-services/ml-inference-service',
      env: { PORT: '8087' }
    });

    this.services.set('tracing', {
      name: 'tracing',
      url: 'http://localhost:8090',
      healthEndpoint: '/health',
      startCommand: ['go', 'run', 'main.go'],
      workingDir: './go-services/tracing',
      env: { PORT: '8090' }
    });
  }

  async setupAll(): Promise<void> {
    if (this.isSetup) return;

    console.log('🚀 Setting up test environment...');
    
    // Build Rust services first
    await this.buildRustServices();
    
    // Start services in dependency order
    const serviceOrder = ['shared-memory', 'tracing', 'ml-go', 'ml-rust'];
    
    for (const serviceName of serviceOrder) {
      await this.startService(serviceName);
    }

    this.isSetup = true;
    console.log('✅ Test environment ready');
  }

  async teardownAll(): Promise<void> {
    if (!this.isSetup) return;

    console.log('🧹 Tearing down test environment...');
    
    const stopPromises = Array.from(this.services.values()).map(async (service) => {
      if (service.process) {
        service.process.kill('SIGTERM');
        // Give process time to cleanup
        await wait(2000);
        if (!service.process.killed) {
          service.process.kill('SIGKILL');
        }
      }
    });

    await Promise.all(stopPromises);
    this.isSetup = false;
    console.log('✅ Test environment cleaned up');
  }

  private async buildRustServices(): Promise<void> {
    console.log('📦 Building Rust services...');
    
    const rustProjects = [
      './rust-services/ffi-bridge',
      './rust-services/ml-inference-service'
    ];

    for (const project of rustProjects) {
      await new Promise<void>((resolve, reject) => {
        const build = spawn('cargo', ['build', '--release'], {
          cwd: project,
          stdio: 'inherit'
        });
        
        build.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Failed to build ${project}: exit code ${code}`));
          }
        });
      });
    }
  }

  private async startService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    console.log(`🔧 Starting ${service.name}...`);

    // Start the process
    service.process = spawn(service.startCommand[0], service.startCommand.slice(1), {
      cwd: service.workingDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...service.env }
    });

    // Handle process errors
    service.process.on('error', (error) => {
      console.error(`❌ Failed to start ${service.name}:`, error);
    });

    // Wait for service to be ready
    await this.waitForService(service);
    console.log(`✅ ${service.name} ready`);
  }

  private async waitForService(service: TestService, maxRetries = 30): Promise<void> {
    let retries = maxRetries;
    
    while (retries > 0) {
      try {
        const response = await axios.get(`${service.url}${service.healthEndpoint}`, {
          timeout: 1000
        });
        
        if (response.status === 200) {
          return; // Service is ready
        }
      } catch (error) {
        // Service not ready yet
      }

      retries--;
      if (retries === 0) {
        throw new Error(`Service ${service.name} failed to become ready after ${maxRetries} attempts`);
      }
      
      await wait(1000);
    }
  }

  getServiceUrl(serviceName: string): string {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Unknown service: ${serviceName}`);
    }
    return service.url;
  }

  isServiceRunning(serviceName: string): boolean {
    const service = this.services.get(serviceName);
    return service?.process !== undefined && !service.process.killed;
  }

  async getServiceHealth(serviceName: string): Promise<any> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    try {
      const response = await axios.get(`${service.url}${service.healthEndpoint}`);
      return response.data;
    } catch (error) {
      return { status: 'unhealthy', error: String(error) };
    }
  }
}

// Global test environment instance
export const testEnv = new TestEnvironment();

// Jest setup hooks
export const setupIntegrationTests = async (): Promise<void> => {
  await testEnv.setupAll();
};

export const teardownIntegrationTests = async (): Promise<void> => {
  await testEnv.teardownAll();
};

// Utility functions for tests
export const waitForCondition = async (
  condition: () => Promise<boolean>,
  timeoutMs = 10000,
  intervalMs = 100
): Promise<void> => {
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    if (await condition()) {
      return;
    }
    await wait(intervalMs);
  }
  
  throw new Error(`Condition not met within ${timeoutMs}ms`);
};

export const generateTestData = (size: number): Buffer => {
  const data = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    data[i] = i % 256;
  }
  return data;
};

export const measureLatency = async <T>(fn: () => Promise<T>): Promise<{ result: T; latency: number }> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, latency: end - start };
};

export const runConcurrently = async <T>(
  tasks: (() => Promise<T>)[],
  concurrency = 10
): Promise<T[]> => {
  const results: T[] = [];
  const errors: Error[] = [];
  
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(task => task()));
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push(result.reason);
      }
    });
  }
  
  if (errors.length > 0) {
    throw new Error(`${errors.length} tasks failed: ${errors[0].message}`);
  }
  
  return results;
};