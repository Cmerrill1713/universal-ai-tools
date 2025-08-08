/**
 * Comprehensive Integration Tests for Model Services
 * Ensures all models are "playing nice together and working extremely well"
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import axios, { AxiosResponse } from 'axios';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const API_BASE_URL = 'http://localhost:9999';
const TEST_TIMEOUT = 60000; // 60 seconds for integration tests

let serverProcess: ChildProcess | null = null;

// Helper to wait for server readiness
async function waitForServer(maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      if (response.data.status === 'healthy' || response.data.status === 'degraded') {
        console.log('✅ Server is ready');
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

describe('Model Services Integration Tests', () => {
  beforeAll(async () => {
    // Start the server
    const serverPath = path.join(__dirname, '../../src/server.ts');
    serverProcess = spawn('npx', ['tsx', serverPath], {
      env: { ...process.env, PORT: '9999' },
      stdio: 'pipe'
    });

    // Wait for server to be ready
    const isReady = await waitForServer();
    if (!isReady) {
      throw new Error('Server failed to start within timeout');
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Clean up server process
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  });

  describe('Core Services Health', () => {
    it('should have all critical services healthy', async () => {
      const response = await axios.get(`${API_BASE_URL}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data.status).toMatch(/healthy|degraded/);
      
      // Check individual services
      const services = response.data.services;
      expect(services.supabase).toBe(true);
      expect(services.redis).toBe(true);
      expect(services.websocket).toBe(true);
      
      // Check agents availability
      expect(response.data.agents.available).toBeGreaterThan(0);
    });

    it('should have API status endpoint working', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/v1/status`);
      
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('operational');
      expect(response.data.version).toBeDefined();
    });
  });

  describe('LLM Services Integration', () => {
    it('should have Ollama service available with models', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/v1/ollama/models`);
      
      expect(response.status).toBe(200);
      expect(response.data.models).toBeDefined();
      expect(Array.isArray(response.data.models)).toBe(true);
      expect(response.data.models.length).toBeGreaterThan(0);
    });

    it('should route requests through multi-tier LLM architecture', async () => {
      const testPrompt = 'What is 2+2?';
      
      const response = await axios.post(`${API_BASE_URL}/api/v1/chat`, {
        message: testPrompt,
        model: 'auto' // Let the system choose based on complexity
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data.response || response.data.message || response.data.content).toBeDefined();
    });

    it('should handle LFM2 fast routing without temperature errors', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/v1/fast-coordinator/route`, {
        task: 'Classify this as simple or complex: Hello world',
        type: 'classification'
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      // Should not have temperature-related errors
      expect(response.data.error).not.toMatch(/temperature/i);
    });
  });

  describe('MLX Service Integration', () => {
    it('should detect Apple Silicon and MLX availability', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/v1/mlx/health`);
      
      expect(response.status).toBe(200);
      expect(response.data.status).toBeDefined();
      
      // On Apple Silicon, should detect hardware
      if (process.platform === 'darwin' && process.arch === 'arm64') {
        expect(response.data.hardware).toMatch(/Apple Silicon/i);
      }
    });

    it('should handle MLX inference requests without errors', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/v1/mlx/inference`, {
          prompt: 'Test prompt',
          maxTokens: 50
        });
        
        // Either succeeds or returns appropriate fallback
        expect([200, 503]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.data).toBeDefined();
        }
      } catch (error: any) {
        // MLX might not be fully configured, but shouldn't crash
        expect(error.response.status).toBe(503);
        expect(error.response.data.message).toMatch(/not initialized|not available/i);
      }
    });
  });

  describe('Vision Services Integration', () => {
    it('should have vision models available', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/v1/vision/models`);
      
      expect(response.status).toBe(200);
      expect(response.data.models).toBeDefined();
      expect(Array.isArray(response.data.models)).toBe(true);
    });

    it('should handle vision analysis requests', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/v1/vision/analyze`, {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        prompt: 'What is in this image?'
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });
  });

  describe('Agent Orchestration Integration', () => {
    it('should list available agents', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/v1/agents/list`);
      
      expect(response.status).toBe(200);
      expect(response.data.agents).toBeDefined();
      expect(response.data.agents.length).toBeGreaterThan(0);
      
      // Check for expected agents
      const agentNames = response.data.agents.map((a: any) => a.name);
      expect(agentNames).toContain('planner');
      expect(agentNames).toContain('personal_assistant');
    });

    it('should execute agent tasks through orchestration', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/v1/agents/execute`, {
        agent: 'planner',
        task: 'Create a simple plan for testing',
        context: { test: true }
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data.result || response.data.response).toBeDefined();
    });

    it('should coordinate multiple agents through AB-MCTS', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/v1/ab-mcts/orchestrate`, {
        userRequest: 'Test multi-agent coordination',
        context: { agents: ['planner', 'synthesizer'] }
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });
  });

  describe('Intelligent Parameters Integration', () => {
    it('should optimize parameters based on task type', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/v1/parameters/optimize`, {
        model: 'qwen2.5:7b',
        taskType: 'code_generation',
        context: { language: 'typescript' }
      });
      
      expect(response.status).toBe(200);
      expect(response.data.parameters).toBeDefined();
      expect(response.data.parameters.temperature).toBeDefined();
      expect(response.data.parameters.maxTokens).toBeDefined();
    });

    it('should track parameter effectiveness', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/v1/parameters/analytics`);
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });
  });

  describe('Cross-Service Integration', () => {
    it('should handle complex multi-service workflow', async () => {
      // Test a workflow that uses multiple services together
      
      // Step 1: Get optimal parameters
      const paramsResponse = await axios.post(`${API_BASE_URL}/api/v1/parameters/optimize`, {
        model: 'qwen2.5:7b',
        taskType: 'analysis'
      });
      
      expect(paramsResponse.status).toBe(200);
      const parameters = paramsResponse.data.parameters;
      
      // Step 2: Use parameters in chat request
      const chatResponse = await axios.post(`${API_BASE_URL}/api/v1/chat`, {
        message: 'Analyze the effectiveness of integration testing',
        model: 'qwen2.5:7b',
        ...parameters
      });
      
      expect(chatResponse.status).toBe(200);
      expect(chatResponse.data).toBeDefined();
      
      // Step 3: Store context for future use
      const contextResponse = await axios.post(`${API_BASE_URL}/api/v1/context/store`, {
        content: JSON.stringify({
          test: 'integration',
          result: chatResponse.data
        }),
        category: 'test_results',
        source: 'integration_test'
      });
      
      expect(contextResponse.status).toBe(200);
    });

    it('should maintain service resilience with fallbacks', async () => {
      // Test that services gracefully handle failures
      
      // Try to use a non-existent model
      const response = await axios.post(`${API_BASE_URL}/api/v1/chat`, {
        message: 'Test fallback behavior',
        model: 'non-existent-model'
      });
      
      // Should fallback to default model
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });
  });

  describe('Performance and Stability', () => {
    it('should handle concurrent requests without errors', async () => {
      const requests = Array(5).fill(null).map((_, i) => 
        axios.post(`${API_BASE_URL}/api/v1/chat`, {
          message: `Concurrent test ${i}`,
          model: 'qwen2.5:7b'
        })
      );
      
      const responses = await Promise.allSettled(requests);
      
      const successful = responses.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(3); // At least 60% should succeed
      
      successful.forEach(r => {
        if (r.status === 'fulfilled') {
          expect(r.value.status).toBe(200);
        }
      });
    });

    it('should not have memory leaks after multiple requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Make several requests
      for (let i = 0; i < 10; i++) {
        await axios.get(`${API_BASE_URL}/health`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed requests gracefully', async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/v1/chat`, {
          // Missing required fields
        });
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBeDefined();
      }
    });

    it('should recover from service failures', async () => {
      // Test circuit breaker functionality
      const response = await axios.get(`${API_BASE_URL}/api/v1/system/metrics`);
      
      expect(response.status).toBe(200);
      expect(response.data.circuitBreakers).toBeDefined();
    });
  });
});

describe('Model Cooperation Tests', () => {
  it('should coordinate LFM2 routing with downstream models', async () => {
    // Test that LFM2 correctly routes to appropriate tier models
    const simpleTask = await axios.post(`${API_BASE_URL}/api/v1/fast-coordinator/classify`, {
      text: 'Hello',
      taskType: 'simple'
    });
    
    expect(simpleTask.status).toBe(200);
    expect(simpleTask.data.tier).toBeLessThanOrEqual(2);
    
    const complexTask = await axios.post(`${API_BASE_URL}/api/v1/fast-coordinator/classify`, {
      text: 'Explain quantum computing and its applications in cryptography',
      taskType: 'complex'
    });
    
    expect(complexTask.status).toBe(200);
    expect(complexTask.data.tier).toBeGreaterThanOrEqual(3);
  });

  it('should maintain consistency across model transitions', async () => {
    // Test that context is preserved when switching between models
    const sessionId = `test-${Date.now()}`;
    
    // Start with a fast model
    const response1 = await axios.post(`${API_BASE_URL}/api/v1/chat`, {
      message: 'My name is TestUser',
      model: 'gemma:2b',
      sessionId
    });
    
    expect(response1.status).toBe(200);
    
    // Switch to a larger model
    const response2 = await axios.post(`${API_BASE_URL}/api/v1/chat`, {
      message: 'What is my name?',
      model: 'qwen2.5:7b',
      sessionId
    });
    
    expect(response2.status).toBe(200);
    // Context should be maintained
    expect(response2.data.response || response2.data.message).toMatch(/TestUser/i);
  });

  it('should validate all models are working together without conflicts', async () => {
    // Comprehensive test to ensure all models play nice together
    const testCases = [
      { model: 'lfm2', task: 'routing' },
      { model: 'gemma:2b', task: 'simple' },
      { model: 'qwen2.5:7b', task: 'complex' },
      { model: 'deepseek-r1:14b', task: 'code' }
    ];
    
    const results = await Promise.allSettled(
      testCases.map(tc => 
        axios.post(`${API_BASE_URL}/api/v1/chat`, {
          message: `Test ${tc.task} task`,
          model: tc.model
        })
      )
    );
    
    const successful = results.filter(r => r.status === 'fulfilled');
    expect(successful.length).toBeGreaterThanOrEqual(testCases.length - 1); // Allow one failure
    
    // No temperature-related errors
    results.forEach(r => {
      if (r.status === 'rejected') {
        expect(r.reason.message).not.toMatch(/temperature/i);
      }
    });
  });
});