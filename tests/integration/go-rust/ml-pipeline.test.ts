/**
 * Integration tests for ML Pipeline (Go + Rust)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';
import { testEnv, generateTestData, measureLatency, runConcurrently } from './setup';

describe('ML Pipeline Integration', () => {
  const TEST_TIMEOUT = 60000;

  beforeAll(async () => {
    await testEnv.setupAll();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await testEnv.teardownAll();
  });

  describe('Go ML Service', () => {
    const ML_GO_URL = testEnv.getServiceUrl('ml-go');

    it('should be healthy and ready', async () => {
      const health = await testEnv.getServiceHealth('ml-go');
      expect(health.status).toBe('healthy');
    });

    it('should handle basic inference request', async () => {
      const inferenceRequest = {
        model_id: 'test-gorgonia-model',
        input: {
          tensor: [1, 2, 3, 4, 5],
          shape: [1, 5],
          dtype: 'float32'
        },
        parameters: {
          temperature: 0.7,
          max_tokens: 100,
          use_gpu: false
        }
      };

      const response = await axios.post(`${ML_GO_URL}/infer`, inferenceRequest);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('model_id');
      expect(response.data).toHaveProperty('output');
      expect(response.data).toHaveProperty('latency_ms');
      expect(response.data.model_id).toBe('test-gorgonia-model');
    });

    it('should load and manage models', async () => {
      const loadRequest = {
        model_id: 'test-model-go',
        model_path: '/models/test-model.onnx',
        framework: 'onnx',
        config: {
          max_batch_size: 4,
          use_gpu: false
        }
      };

      const loadResponse = await axios.post(`${ML_GO_URL}/models/load`, loadRequest);
      expect(loadResponse.status).toBe(200);
      expect(loadResponse.data.success).toBe(true);

      // List models
      const listResponse = await axios.get(`${ML_GO_URL}/models`);
      expect(listResponse.status).toBe(200);
      expect(Array.isArray(listResponse.data)).toBe(true);
      
      const modelExists = listResponse.data.some((model: any) => 
        model.model_id === 'test-model-go'
      );
      expect(modelExists).toBe(true);
    });

    it('should handle batch inference', async () => {
      const batchRequest = {
        model_id: 'test-gorgonia-model',
        inputs: [
          { tensor: [1, 2, 3], shape: [1, 3] },
          { tensor: [4, 5, 6], shape: [1, 3] },
          { tensor: [7, 8, 9], shape: [1, 3] }
        ],
        parameters: {
          batch_size: 3,
          temperature: 0.8
        }
      };

      const response = await axios.post(`${ML_GO_URL}/infer/batch`, batchRequest);

      expect(response.status).toBe(200);
      expect(response.data.outputs).toHaveLength(3);
      expect(response.data.batch_size).toBe(3);
    });

    it('should provide metrics', async () => {
      const response = await axios.get(`${ML_GO_URL}/metrics`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      
      const metrics = response.data;
      expect(metrics).toContain('ml_inference_total');
      expect(metrics).toContain('ml_inference_latency_ms');
    });
  });

  describe('Rust ML Service', () => {
    const ML_RUST_URL = testEnv.getServiceUrl('ml-rust');

    it('should be healthy and ready', async () => {
      const health = await testEnv.getServiceHealth('ml-rust');
      expect(health.status).toBe('healthy');
    });

    it('should handle Candle inference', async () => {
      const inferenceRequest = {
        model_id: 'test-candle-model',
        input: {
          Tensor: [0.1, 0.2, 0.3, 0.4, 0.5]
        },
        parameters: {
          temperature: 0.7,
          use_gpu: false,
          cache_result: true
        }
      };

      const response = await axios.post(`${ML_RUST_URL}/infer`, inferenceRequest);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('model_id');
      expect(response.data).toHaveProperty('output');
      expect(response.data).toHaveProperty('latency_ms');
      expect(response.data).toHaveProperty('framework');
      expect(response.data.framework).toBe('Candle');
    });

    it('should handle ONNX inference', async () => {
      const inferenceRequest = {
        model_id: 'test-onnx-model',
        input: {
          Tensor: [1.0, 2.0, 3.0, 4.0]
        },
        parameters: {
          use_gpu: false,
          cache_result: false
        }
      };

      const response = await axios.post(`${ML_RUST_URL}/infer`, inferenceRequest);

      expect(response.status).toBe(200);
      expect(response.data.framework).toBe('ONNX');
    });

    it('should handle SmartCore classical ML', async () => {
      const inferenceRequest = {
        model_id: 'test-smartcore-model',
        input: {
          Tabular: [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]]
        },
        parameters: {
          algorithm: 'random_forest',
          n_estimators: 100
        }
      };

      const response = await axios.post(`${ML_RUST_URL}/infer`, inferenceRequest);

      expect(response.status).toBe(200);
      expect(response.data.framework).toBe('SmartCore');
    });

    it('should load models dynamically', async () => {
      const loadRequest = {
        model_id: 'dynamic-rust-model',
        model_type: {
          CNN: { architecture: 'ResNet50' }
        },
        framework: 'Candle'
      };

      const response = await axios.post(`${ML_RUST_URL}/models/load`, loadRequest);

      expect(response.status).toBe(200);
      
      // Verify model is loaded
      const listResponse = await axios.get(`${ML_RUST_URL}/models`);
      expect(listResponse.data).toContain('dynamic-rust-model');
    });
  });

  describe('Cross-Service ML Pipeline', () => {
    it('should route inference between Go and Rust services', async () => {
      const SHARED_MEMORY_URL = testEnv.getServiceUrl('shared-memory');

      // Route to Go service
      const goRequest = {
        model_id: 'pipeline-test-go',
        input: Buffer.from('test input for go'),
        parameters: '{"framework": "go"}'
      };

      const goResponse = await axios.post(
        `${SHARED_MEMORY_URL}/api/v1/ipc/ml/inference`,
        goRequest
      );

      expect(goResponse.status).toBe(200);

      // Route to Rust service  
      const rustRequest = {
        model_id: 'pipeline-test-rust',
        input: Buffer.from('test input for rust'),
        parameters: '{"framework": "rust"}'
      };

      const rustResponse = await axios.post(
        `${SHARED_MEMORY_URL}/api/v1/ipc/ml/inference`,
        rustRequest
      );

      expect(rustResponse.status).toBe(200);
    });

    it('should handle model ensemble (Go + Rust)', async () => {
      const ensembleInput = [1, 2, 3, 4, 5];
      
      // Run inference on both services
      const [goResult, rustResult] = await Promise.all([
        axios.post(`${testEnv.getServiceUrl('ml-go')}/infer`, {
          model_id: 'ensemble-go',
          input: { tensor: ensembleInput, shape: [1, 5] }
        }),
        axios.post(`${testEnv.getServiceUrl('ml-rust')}/infer`, {
          model_id: 'ensemble-rust',
          input: { Tensor: ensembleInput }
        })
      ]);

      expect(goResult.status).toBe(200);
      expect(rustResult.status).toBe(200);

      // Both should have valid outputs
      expect(goResult.data.output).toBeDefined();
      expect(rustResult.data.output).toBeDefined();
      
      // Compare latencies
      console.log(`📊 Ensemble Results:`);
      console.log(`   Go latency: ${goResult.data.latency_ms}ms`);
      console.log(`   Rust latency: ${rustResult.data.latency_ms}ms`);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should benchmark Go ML service latency', async () => {
      const iterations = 20;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const { latency } = await measureLatency(async () => {
          return axios.post(`${testEnv.getServiceUrl('ml-go')}/infer`, {
            model_id: 'benchmark-go',
            input: { tensor: [1, 2, 3, 4, 5], shape: [1, 5] }
          });
        });
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

      console.log(`📊 Go ML Service Performance:`);
      console.log(`   Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`   P95: ${p95Latency.toFixed(2)}ms`);

      expect(avgLatency).toBeLessThan(1000); // Should be under 1s
    });

    it('should benchmark Rust ML service latency', async () => {
      const iterations = 20;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const { latency } = await measureLatency(async () => {
          return axios.post(`${testEnv.getServiceUrl('ml-rust')}/infer`, {
            model_id: 'benchmark-rust',
            input: { Tensor: [1, 2, 3, 4, 5] }
          });
        });
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

      console.log(`📊 Rust ML Service Performance:`);
      console.log(`   Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`   P95: ${p95Latency.toFixed(2)}ms`);

      expect(avgLatency).toBeLessThan(1000); // Should be under 1s
    });

    it('should handle concurrent inference requests', async () => {
      const concurrentRequests = 50;
      const requests = Array.from({ length: concurrentRequests }, (_, i) => () =>
        axios.post(`${testEnv.getServiceUrl('ml-go')}/infer`, {
          model_id: 'concurrent-test',
          input: { tensor: [i, i+1, i+2], shape: [1, 3] }
        })
      );

      const start = performance.now();
      const results = await runConcurrently(requests, 10);
      const end = performance.now();

      expect(results.length).toBe(concurrentRequests);
      
      const totalTime = end - start;
      const requestsPerSecond = (concurrentRequests / totalTime) * 1000;

      console.log(`📊 Concurrent Performance:`);
      console.log(`   Requests: ${concurrentRequests}`);
      console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`   RPS: ${requestsPerSecond.toFixed(2)}`);

      // All requests should succeed
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });
    });
  });

  describe('ML Pipeline Resilience', () => {
    it('should handle model loading failures gracefully', async () => {
      try {
        await axios.post(`${testEnv.getServiceUrl('ml-go')}/models/load`, {
          model_id: 'nonexistent-model',
          model_path: '/invalid/path/model.onnx',
          framework: 'onnx'
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBeGreaterThanOrEqual(400);
        expect(error.response.data).toHaveProperty('error');
      }
    });

    it('should handle inference with invalid input', async () => {
      try {
        await axios.post(`${testEnv.getServiceUrl('ml-rust')}/infer`, {
          model_id: 'test-model',
          input: { InvalidType: 'this should fail' },
          parameters: {}
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('should handle service unavailable scenarios', async () => {
      // Test with invalid service URL
      try {
        await axios.post('http://localhost:99999/infer', {
          model_id: 'test'
        }, { timeout: 1000 });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toMatch(/ECONNREFUSED|ETIMEDOUT/);
      }
    });
  });

  describe('ML Pipeline Monitoring', () => {
    it('should expose comprehensive metrics', async () => {
      const services = ['ml-go', 'ml-rust'];
      
      for (const serviceName of services) {
        const url = testEnv.getServiceUrl(serviceName);
        const response = await axios.get(`${url}/metrics`);
        
        expect(response.status).toBe(200);
        
        const metrics = response.data;
        expect(metrics).toContain('ml_inference_total');
        expect(metrics).toContain('ml_inference_latency');
        
        if (serviceName === 'ml-go') {
          expect(metrics).toContain('go_memstats');
        }
      }
    });

    it('should track model usage statistics', async () => {
      const modelId = 'usage-tracking-model';
      
      // Make several inference calls
      for (let i = 0; i < 5; i++) {
        await axios.post(`${testEnv.getServiceUrl('ml-go')}/infer`, {
          model_id: modelId,
          input: { tensor: [i, i+1, i+2], shape: [1, 3] }
        });
      }

      // Check metrics
      const response = await axios.get(`${testEnv.getServiceUrl('ml-go')}/metrics`);
      const metrics = response.data;
      
      // Should track usage for specific model
      expect(metrics).toContain(modelId);
    });
  });
});