import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createSupabaseClient } from '../helpers/test-utils';

// Mock services for testing
vi.mock('@/config/environment', () => ({
  config: {
    port: 9999,
    environment: 'test',
    database: {
      url: 'postgresql://test',
      poolSize: 5,
    },
    supabase: {
      url: 'https://test.supabase.co',
      anonKey: 'test-anon-key',
      serviceKey: 'test-service-key',
    },
    jwt: {
      secret: 'test-secret',
      expiresIn: '1h',
    },
    llm: {
      ollamaUrl: 'http://localhost:11434',
      lmStudioUrl: 'http://localhost:5901',
    },
  },
}));

describe('Backend Services Test Suite', () => {
  let app: express.Application;
  let supabase: any;

  beforeEach(async () => {
    // Setup test environment
    app = express();
    supabase = createSupabaseClient();
    
    // Clear any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    // Cleanup after each test
    await cleanupTestData();
  });

  describe('Health Check Endpoints', () => {
    test('should return server health status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          services: expect.objectContaining({
            database: expect.any(String),
            redis: expect.any(String),
            llm: expect.any(String),
          }),
        })
      );
    });

    test('should return detailed system information', async () => {
      const response = await request(app)
        .get('/api/v1/health/detailed')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          uptime: expect.any(Number),
          memory: expect.objectContaining({
            used: expect.any(Number),
            total: expect.any(Number),
            percentage: expect.any(Number),
          }),
          cpu: expect.objectContaining({
            usage: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('Agent Management', () => {
    test('should list available agents', async () => {
      const response = await request(app)
        .get('/api/v1/agents')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          agents: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
              type: expect.any(String),
              status: expect.any(String),
              capabilities: expect.any(Array),
            }),
          ]),
        })
      );
    });

    test('should create new agent with valid configuration', async () => {
      const agentConfig = {
        name: 'Test Agent',
        type: 'cognitive',
        description: 'Test agent for unit testing',
        capabilities: ['reasoning', 'analysis'],
        model: 'ollama:llama3.2:3b',
      };

      const response = await request(app)
        .post('/api/v1/agents')
        .send(agentConfig)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          agent: expect.objectContaining({
            id: expect.any(String),
            name: agentConfig.name,
            type: agentConfig.type,
            status: 'created',
          }),
        })
      );
    });

    test('should reject agent creation with invalid configuration', async () => {
      const invalidConfig = {
        name: '', // Invalid empty name
        type: 'invalid-type',
        description: 'Test',
      };

      const response = await request(app)
        .post('/api/v1/agents')
        .send(invalidConfig)
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('validation'),
        })
      );
    });

    test('should execute agent with proper input', async () => {
      // First create an agent
      const agentConfig = {
        name: 'Test Executor',
        type: 'cognitive',
        description: 'Test execution agent',
        capabilities: ['reasoning'],
        model: 'ollama:llama3.2:3b',
      };

      const createResponse = await request(app)
        .post('/api/v1/agents')
        .send(agentConfig)
        .expect(201);

      const agentId = createResponse.body.agent.id;

      // Execute the agent
      const executeResponse = await request(app)
        .post(`/api/v1/agents/${agentId}/execute`)
        .send({
          input: 'Test execution input',
          parameters: {
            temperature: 0.7,
            maxTokens: 100,
          },
        })
        .expect(200);

      expect(executeResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          result: expect.objectContaining({
            output: expect.any(String),
            confidence: expect.any(Number),
            executionTime: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('Memory System', () => {
    test('should store and retrieve memories', async () => {
      const memory = {
        content: 'Test memory content',
        type: 'conversation',
        metadata: {
          userId: 'test-user',
          timestamp: new Date().toISOString(),
        },
      };

      // Store memory
      const storeResponse = await request(app)
        .post('/api/v1/memory')
        .send(memory)
        .expect(201);

      expect(storeResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          memory: expect.objectContaining({
            id: expect.any(String),
            content: memory.content,
            type: memory.type,
          }),
        })
      );

      const memoryId = storeResponse.body.memory.id;

      // Retrieve memory
      const retrieveResponse = await request(app)
        .get(`/api/v1/memory/${memoryId}`)
        .expect(200);

      expect(retrieveResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          memory: expect.objectContaining({
            id: memoryId,
            content: memory.content,
            type: memory.type,
          }),
        })
      );
    });

    test('should search memories by query', async () => {
      // Store test memories
      const memories = [
        {
          content: 'JavaScript programming tutorial',
          type: 'knowledge',
          metadata: { topic: 'programming' },
        },
        {
          content: 'Python data analysis guide',
          type: 'knowledge',
          metadata: { topic: 'data-science' },
        },
      ];

      for (const memory of memories) {
        await request(app).post('/api/v1/memory').send(memory);
      }

      // Search for JavaScript memories
      const searchResponse = await request(app)
        .get('/api/v1/memory/search')
        .query({ q: 'JavaScript programming' })
        .expect(200);

      expect(searchResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          memories: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('JavaScript'),
              relevance: expect.any(Number),
            }),
          ]),
        })
      );
    });
  });

  describe('Vision Processing', () => {
    test('should process image with basic analysis', async () => {
      // Mock image data (base64 encoded test image)
      const testImageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...'; // Truncated for brevity

      const response = await request(app)
        .post('/api/v1/vision/analyze')
        .send({
          image: testImageData,
          options: {
            includeObjects: true,
            includeText: true,
          },
        })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          analysis: expect.objectContaining({
            objects: expect.any(Array),
            text: expect.any(String),
            confidence: expect.any(Number),
            processingTime: expect.any(Number),
          }),
        })
      );
    });

    test('should enhance image with SDXL refiner', async () => {
      const testImageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...';

      const response = await request(app)
        .post('/api/v1/vision/enhance')
        .send({
          image: testImageData,
          options: {
            strength: 0.3,
            steps: 20,
            guidance: 7.5,
          },
        })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          enhanced: expect.objectContaining({
            image: expect.stringMatching(/^data:image/),
            processingTime: expect.any(Number),
            settings: expect.objectContaining({
              strength: 0.3,
              steps: 20,
              guidance: 7.5,
            }),
          }),
        })
      );
    });
  });

  describe('MLX Integration', () => {
    test('should list available MLX models', async () => {
      const response = await request(app)
        .get('/api/v1/mlx/models')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          models: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
              size: expect.any(String),
              quantization: expect.any(String),
              status: expect.any(String),
            }),
          ]),
        })
      );
    });

    test('should start fine-tuning job with valid configuration', async () => {
      const fineTuningConfig = {
        baseModel: 'llama3.2:3b',
        trainingData: 'test-dataset.jsonl',
        optimization: 'lora',
        epochs: 5,
        learningRate: 0.0001,
        batchSize: 4,
      };

      const response = await request(app)
        .post('/api/v1/mlx/fine-tune')
        .send(fineTuningConfig)
        .expect(202);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          job: expect.objectContaining({
            id: expect.any(String),
            status: 'queued',
            config: expect.objectContaining(fineTuningConfig),
            estimatedDuration: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('Intelligent Parameters', () => {
    test('should optimize parameters for given task', async () => {
      const optimizationRequest = {
        task: 'code_generation',
        model: 'ollama:llama3.2:3b',
        context: {
          language: 'typescript',
          complexity: 'medium',
        },
        goals: ['accuracy', 'speed'],
      };

      const response = await request(app)
        .post('/api/v1/parameters/optimize')
        .send(optimizationRequest)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          parameters: expect.objectContaining({
            temperature: expect.any(Number),
            topP: expect.any(Number),
            maxTokens: expect.any(Number),
            stopSequences: expect.any(Array),
          }),
          confidence: expect.any(Number),
          reasoning: expect.any(String),
        })
      );
    });

    test('should provide parameter analytics', async () => {
      const response = await request(app)
        .get('/api/v1/parameters/analytics')
        .query({
          model: 'ollama:llama3.2:3b',
          timeRange: '24h',
        })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          analytics: expect.objectContaining({
            totalRequests: expect.any(Number),
            averageLatency: expect.any(Number),
            successRate: expect.any(Number),
            topParameters: expect.any(Array),
            trends: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid API endpoints gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Not found'),
          code: 'ENDPOINT_NOT_FOUND',
        })
      );
    });

    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/agents')
        .type('application/json')
        .send('invalid json{')
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid JSON'),
          code: 'MALFORMED_REQUEST',
        })
      );
    });

    test('should handle service unavailable scenarios', async () => {
      // Mock a service failure
      vi.mocked(supabase.from).mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/v1/memory')
        .expect(503);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Service temporarily unavailable'),
          code: 'SERVICE_UNAVAILABLE',
        })
      );
    });
  });
});

// Helper function to cleanup test data
async function cleanupTestData() {
  // Cleanup test agents, memories, and other test data
  const testPrefix = 'test-';
  
  try {
    // This would typically clean up test data from the database
    // Implementation depends on your specific database schema
    console.log('Cleaning up test data...');
  } catch (error) {
    console.warn('Failed to cleanup test data:', error);
  }
}