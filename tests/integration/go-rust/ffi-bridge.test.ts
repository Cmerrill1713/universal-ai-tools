/**
 * Integration tests for Go-Rust FFI Bridge
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import WebSocket from 'ws';

const wait = promisify(setTimeout);

describe('Go-Rust FFI Bridge Integration', () => {
  let sharedMemoryService: ChildProcess;
  let rustBridge: ChildProcess;
  
  const SHARED_MEMORY_URL = 'http://localhost:8089';
  const TEST_TIMEOUT = 30000;

  beforeAll(async () => {
    console.log('🚀 Starting Go-Rust FFI Bridge integration tests...');
    
    // Start Rust FFI bridge (compile first)
    console.log('📦 Building Rust FFI bridge...');
    await new Promise((resolve, reject) => {
      const build = spawn('cargo', ['build', '--release'], {
        cwd: './rust-services/ffi-bridge',
        stdio: 'inherit'
      });
      build.on('close', (code) => code === 0 ? resolve(void 0) : reject(new Error(`Build failed: ${code}`)));
    });

    // Start shared memory service
    console.log('🔧 Starting Go shared memory service...');
    sharedMemoryService = spawn('go', ['run', 'main.go'], {
      cwd: './go-services/shared-memory',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '8089' }
    });

    // Wait for services to be ready
    await wait(5000);
    
    // Health check
    let retries = 10;
    while (retries > 0) {
      try {
        await axios.get(`${SHARED_MEMORY_URL}/health`);
        console.log('✅ Shared memory service ready');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw new Error('Shared memory service failed to start');
        await wait(1000);
      }
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    console.log('🧹 Cleaning up services...');
    if (sharedMemoryService) {
      sharedMemoryService.kill('SIGTERM');
      await wait(2000);
    }
    if (rustBridge) {
      rustBridge.kill('SIGTERM');
      await wait(2000);  
    }
  });

  describe('FFI Function Calls', () => {
    it('should call Rust echo function via FFI', async () => {
      const testData = 'Hello from Go to Rust!';
      
      const response = await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/call`, {
        operation: 'echo',
        data: Buffer.from(testData).toString('base64')
      });

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      
      // Decode response
      const result = Buffer.from(response.data, 'base64').toString();
      expect(result).toBe(testData);
    });

    it('should call Rust transform function', async () => {
      const testData = 'transform_me';
      
      const response = await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/call`, {
        operation: 'transform',
        data: Buffer.from(testData)
      });

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    it('should handle analyze operation', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      
      const response = await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/call`, {
        operation: 'analyze',
        data: Array.from(testData)
      });

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      
      // Should return analysis string
      const result = Buffer.from(response.data, 'base64').toString();
      expect(result).toContain('Data length: 5');
      expect(result).toContain('checksum:');
    });

    it('should handle ML inference call', async () => {
      const response = await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/ml/inference`, {
        model_id: 'test-model',
        input: Buffer.from('test input data'),
        parameters: '{"temperature": 0.7}'
      });

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    it('should handle vision processing call', async () => {
      // Create fake image data
      const fakeImageData = Buffer.alloc(1024, 0xFF);
      
      const response = await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/call`, {
        operation: 'vision_process',
        data: Array.from(fakeImageData)
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Shared Memory Operations', () => {
    it('should create a shared buffer', async () => {
      const response = await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/buffer`, {
        name: 'test_buffer',
        size: 1024
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('created');
      expect(response.data.name).toBe('test_buffer');
    });

    it('should write to shared buffer', async () => {
      const testData = 'Hello shared memory!';
      
      const response = await axios.put(
        `${SHARED_MEMORY_URL}/api/v1/ipc/buffer/test_buffer`,
        Buffer.from(testData),
        { headers: { 'Content-Type': 'application/octet-stream' } }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('written');
      expect(response.data.bytes).toBe(testData.length);
    });

    it('should read from shared buffer', async () => {
      const response = await axios.get(`${SHARED_MEMORY_URL}/api/v1/ipc/buffer/test_buffer`);

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      
      const result = response.data.toString();
      expect(result).toBe('Hello shared memory!');
    });

    it('should handle large shared buffer operations', async () => {
      // Create large buffer
      await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/buffer`, {
        name: 'large_buffer',
        size: 10 * 1024 * 1024 // 10MB
      });

      // Write large data
      const largeData = Buffer.alloc(1024 * 1024, 'A'); // 1MB of 'A's
      
      const writeResponse = await axios.put(
        `${SHARED_MEMORY_URL}/api/v1/ipc/buffer/large_buffer`,
        largeData,
        { 
          headers: { 'Content-Type': 'application/octet-stream' },
          maxContentLength: 10 * 1024 * 1024
        }
      );

      expect(writeResponse.status).toBe(200);
      expect(writeResponse.data.bytes).toBe(1024 * 1024);
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid FFI calls', async () => {
      const promises = [];
      const callCount = 100;
      
      for (let i = 0; i < callCount; i++) {
        promises.push(
          axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/call`, {
            operation: 'echo',
            data: Buffer.from(`message_${i}`).toString('base64')
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(callCount);
      
      // All should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
      });
    });

    it('should measure FFI call latency', async () => {
      const iterations = 50;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/call`, {
          operation: 'echo',
          data: Buffer.from('latency_test').toString('base64')
        });

        const end = performance.now();
        latencies.push(end - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      console.log(`📊 FFI Call Performance:`);
      console.log(`   Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`   Min: ${minLatency.toFixed(2)}ms`);
      console.log(`   Max: ${maxLatency.toFixed(2)}ms`);

      // Performance assertions
      expect(avgLatency).toBeLessThan(50); // Should be under 50ms on average
      expect(maxLatency).toBeLessThan(200); // Max should be under 200ms
    });

    it('should handle concurrent shared memory access', async () => {
      const bufferName = 'concurrent_test';
      const concurrentWrites = 10;

      // Create buffer
      await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/buffer`, {
        name: bufferName,
        size: 4096
      });

      // Concurrent writes
      const writePromises = [];
      for (let i = 0; i < concurrentWrites; i++) {
        writePromises.push(
          axios.put(
            `${SHARED_MEMORY_URL}/api/v1/ipc/buffer/${bufferName}`,
            Buffer.from(`concurrent_data_${i}`),
            { headers: { 'Content-Type': 'application/octet-stream' } }
          )
        );
        // Small delay to interleave requests
        await wait(10);
      }

      const results = await Promise.allSettled(writePromises);
      
      // At least some should succeed (last writer wins scenario)
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operations gracefully', async () => {
      try {
        await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/call`, {
          operation: 'invalid_operation',
          data: Buffer.from('test').toString('base64')
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.error).toContain('Unknown operation');
      }
    });

    it('should handle buffer overflow gracefully', async () => {
      // Create small buffer
      await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/buffer`, {
        name: 'small_buffer',
        size: 10
      });

      try {
        // Try to write more data than buffer can hold
        const largeData = Buffer.alloc(100, 'X');
        await axios.put(
          `${SHARED_MEMORY_URL}/api/v1/ipc/buffer/small_buffer`,
          largeData,
          { headers: { 'Content-Type': 'application/octet-stream' } }
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.error).toContain('exceeds buffer size');
      }
    });

    it('should handle missing buffer gracefully', async () => {
      try {
        await axios.get(`${SHARED_MEMORY_URL}/api/v1/ipc/buffer/nonexistent_buffer`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.error).toContain('not found');
      }
    });
  });

  describe('Metrics and Health', () => {
    it('should provide health status', async () => {
      const response = await axios.get(`${SHARED_MEMORY_URL}/health`);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
      expect(response.data.initialized).toBe(true);
      expect(response.data.buffer_count).toBeGreaterThanOrEqual(0);
      expect(response.data.rust_metrics).toBeDefined();
    });

    it('should expose metrics endpoint', async () => {
      const response = await axios.get(`${SHARED_MEMORY_URL}/metrics`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      
      const metrics = response.data;
      expect(metrics).toContain('ipc_transfers_total');
      expect(metrics).toContain('ipc_bytes_transferred_total');
    });

    it('should track metrics correctly', async () => {
      // Make some calls to generate metrics
      await axios.post(`${SHARED_MEMORY_URL}/api/v1/ipc/call`, {
        operation: 'echo',
        data: Buffer.from('metrics_test').toString('base64')
      });

      const response = await axios.get(`${SHARED_MEMORY_URL}/metrics`);
      const metrics = response.data;
      
      // Should have recorded the transfer
      expect(metrics).toContain('ipc_transfers_total');
      expect(metrics).toMatch(/ipc_transfers_total\s+[1-9]\d*/);
    });
  });
});

describe('ML Services Integration', () => {
  const ML_GO_URL = 'http://localhost:8086';
  const ML_RUST_URL = 'http://localhost:8087';

  it('should communicate between Go and Rust ML services', async () => {
    // This would require the ML services to be running
    // Placeholder for when ML services are fully integrated
    console.log('🧪 ML services integration test - placeholder');
    expect(true).toBe(true);
  });
});