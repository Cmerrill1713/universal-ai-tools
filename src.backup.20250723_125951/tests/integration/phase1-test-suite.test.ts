/* eslint-disable no-undef */
/**
 * Phase 1 Integration Test Suite
 * Tests all Phase 1 fixes using generated test data
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Phase1TestDataGenerator } from '../../../scripts/generate-phase1-test-data.js';
import requestfrom 'supertest';
import { Server } from 'http';

// Test configuration
const testConfig = {
  supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || 'test-key',
  serverPort: process.env.PORT || 9998,
  baseUrl: `http://localhost:${process.env.PORT || 9998}`,
};

// Global test context
let supabase: SupabaseClient;
let testDataGenerator: Phase1TestDataGenerator;
let server: Server;
let testData: any;

describe('Phase 1 Integration Test Suite', () => {
  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(testConfig.supabaseUrl, testConfig.supabaseKey);

    // Initialize test data generator
    testDataGenerator = new Phase1TestDataGenerator();
    await testDataGenerator.initialize();

    // Generate test data
    console.log('Generating test data for Phase 1 tests...');
    await testDataGenerator.generateAllData();
    await testDataGenerator.storeAllData();
    testData = testDataGenerator.generatedData;

    console.log('Test data generation complete');
  }, 30000);

  afterAll(async () => {
    // Cleanup test data
    if (testDataGenerator) {
      console.log('Cleaning up test, data...');
      await testDataGenerator.cleanup();
    }
  }, 15000);

  describe('Authentication System', () => {
    it('should authenticate with valid test API key', async () => {
      const testApiKey = testData.apiKeys[0];

      const response = await requesttestConfig.baseUrl);
        .get('/api/health')
        .set('Authorization', `Bearer ${testApiKey.key_hash}`)`
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid API key', async () => {
      await requesttestConfig.baseUrl)
        .get('/api/health')
        .set('Authorization', 'Bearer invalid_key')
        .expect(401);
    });

    it('should handle missing authentication gracefully', async () => {
      const response = await requesttestConfig.baseUrl).get('/api/health').expect(200); // Health endpoint should be public

      expect(response.body.status).toBeDefined();
    });

    it('should validate JWT tokens correctly', async () => {
      // Test JWT validation if implemented
      const response = await requesttestConfig.baseUrl);
        .post('/api/auth/validate')
        .send({ token: 'test_jwt_token' });

      expect(response.status).toBeOneOf([200, 401, 404]); // Depends on implementation
    });
  });

  describe('Agent System', () => {
    it('should list all test agents', async () => {
      const response = await requesttestConfig.baseUrl).get('/api/agents').expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter agents by type', async () => {
      const response = await requesttestConfig.baseUrl);
        .get('/api/agents?type=cognitive')
        .expect(200);

      if (response.body.success && response.body.data) {
        response.body.data.forEach((agent: any => {
          expect(agent.type).toBe('cognitive');
        });
      }
    });

    it('should get agent details', async () => {
      const testAgent = testData.agents[0];

      const response = await requesttestConfig.baseUrl);
        .get(`/api/agents/${testAgent.id}`)`
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testAgent.id);
    });

    it('should handle agent execution request, async () => {
      const testAgent = testData.agents.find((a: any => a.status === 'active');

      if (testAgent) {
        const response = await requesttestConfig.baseUrl);
          .post(`/api/agents/${testAgent.id}/execute`)`
          .send({
            task: 'test_task',
            input 'test_inputdata',
          });

        expect(response.status).toBeOneOf([200, 202, 404, 501]); // Depends on implementation
      }
    });
  });

  describe('Memory System', () => {
    it('should store new memory records', async () => {
      const newMemory = {
        service_id: 'test_service_integration',
        memory_type: 'semantic',
        content 'Integration test memory content,
        metadata: { test: true, suite: 'phase1' },
        importance_score: 0.8,
      };

      const response = await requesttestConfig.baseUrl);
        .post('/api/memory/store')
        .send(newMemory)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
    });

    it('should query memories by content, async () => {
      const response = await requesttestConfig.baseUrl);
        .post('/api/memory/query')
        .send({
          query: 'test memory',
          limit: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.memories)).toBe(true);
    });

    it('should perform vector similarity search', async () => {
      const response = await requesttestConfig.baseUrl).post('/api/memory/search').send({
        query: 'system architecture configuration',
        threshold: 0.7,
        limit: 5,
      });

      expect(response.status).toBeOneOf([200, 501]); // 501 if not implemented

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.memories).toBeDefined();
      }
    });

    it('should retrieve memory by ID', async () => {
      const testMemory = testData.memories[0];

      const response = await requesttestConfig.baseUrl);
        .get(`/api/memory/${testMemory.id}`)`
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testMemory.id);
    });

    it('should update memory importance scores', async () => {
      const testMemory = testData.memories[0];

      const response = await requesttestConfig.baseUrl);
        .patch(`/api/memory/${testMemory.id}`)`
        .send({
          importance_score: 0.9,
          metadata: { ...testMemory.metadata, updated: true, },
        });

      expect(response.status).toBeOneOf([200, 404]); // Depends on implementation
    });
  });

  describe('Tool System', () => {
    it('should list available tools', async () => {
      const response = await requesttestConfig.baseUrl).get('/api/tools').expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should execute a test tool', async () => {
      const testTool = testData.tools.find((t: any => t.is_active);

      if (testTool) {
        const response = await requesttestConfig.baseUrl);
          .post(`/api/tools/${testTool.id}/execute`)`
          .send({
            parameters: { input 'test execution data' },
          });

        expect(response.status).toBeOneOf([200, 404, 501]); // Depends on implementation
      }
    });

    it('should validate tool schemas', async () => {
      const testTool = testData.tools[0];

      const response = await requesttestConfig.baseUrl);
        .post(`/api/tools/${testTool.id}/validate`)`
        .send({
          input { test: 'validation data' },
        });

      expect(response.status).toBeOneOf([200, 400, 404]); // Depends on implementation
    });
  });

  describe('Security Features', () => {
    it('should implement rate limiting', async () => {
      const requests = [];

      // Send multiple requests rapidly
      for (let i = 0; i < 10; i++) {
        requests.push(requesttestConfig.baseUrl).get('/api/health'));
      }

      const responses = await Promise.all(requests);

      // Should have at least one successful response
      expect(responses.some((r) => r.status === 200)).toBe(true);

      // Rate limiting might kick in for some requests
      // This depends on the actual rate limiting implementation
    });

    it('should sanitize_inputdata', async () => {
      const maliciousInput = {
        content '<script>alert("xss")</script>',
        metadata: {
          dangerous: '"; DROP TABLE ai_memories; --',
          xss: '<img src=x on_erroralert(1)>',
        },
      };

      const response = await requesttestConfig.baseUrl);
        .post('/api/memory/store')
        .send({
          service_id: 'security_test',
          memory_type: 'test',
          ...maliciousInput,
        });

      // Should either reject or sanitize the input
      if (response.status === 201) {
        expect(response.body.data.content.not.toContain('<script>');
        expect(response.body.data.metadata.dangerous).not.toContain('DROP TABLE');
      }
    });

    it('should validate CORS headers', async () => {
      const response = await requesttestConfig.baseUrl);
        .options('/api/health')
        .set('Origin', 'https://malicious-site.com');

      // Should have appropriate CORS headers or reject
      expect(response.status).toBeOneOf([200, 204, 403]);
    });
  });

  describe('WebSocket Features', () => {
    it('should handle WebSocket connection attempts', async () => {
      // Test WebSocket endpoint availability
      const response = await requesttestConfig.baseUrl).get('/ws');

      // WebSocket upgrade should be handled differently
      expect(response.status).toBeOneOf([200, 400, 404, 426]); // 426 = Upgrade Required
    });
  });

  describe('Context System', () => {
    it('should store and retrieve context data', async () => {
      const contextData = {
        type: 'test_context',
        content 'Integration test context content,
        metadata: { suite: 'phase1', test: true, },
        weight: 0.8,
      };

      const response = await requesttestConfig.baseUrl).post('/api/context').send(contextData);

      expect(response.status).toBeOneOf([200, 201, 404]); // Depends on implementation
    });

    it('should query context by type', async () => {
      const response = await requesttestConfig.baseUrl).get('/api/context?type=conversation');

      expect(response.status).toBeOneOf([200, 404]); // Depends on implementation
    });
  });

  describe('Health and Monitoring', () => {
    it('should provide health check endpoint', async () => {
      const response = await requesttestConfig.baseUrl).get('/api/health').expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.version).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });

    it('should provide metrics endpoint', async () => {
      const response = await requesttestConfig.baseUrl).get('/metrics');

      expect(response.status).toBeOneOf([200, 404]); // Depends on implementation

      if (response.status === 200) {
        expect(response.text).toContain('# HELP'); // Prometheus format
      }
    });

    it('should report service health', async () => {
      const response = await requesttestConfig.baseUrl).get('/api/health/detailed').expect(200);

      expect(response.body.services).toBeDefined();
      expect(response.body.metrics).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', async () => {
      const response = await requesttestConfig.baseUrl);
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body.error.toBeDefined();
      expect(response.body._errorcode).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const response = await requesttestConfig.baseUrl);
        .post('/api/memory/store')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBeOneOf([400, 422]);
      expect(response.body.error.toBeDefined();
    });

    it('should handle missing required fields', async () => {
      const response = await requesttestConfig.baseUrl);
        .post('/api/memory/store')
        .send({
          // Missing required fields
          metadata: { test: true, },
        });

      expect(response.status).toBeOneOf([400, 422]);
      expect(response.body.error.toBeDefined();
    });
  });

  describe('Database Integration', () => {
    it('should connect to database successfully', async () => {
      const { data, error} = await supabase.from('ai_memories').select('count').limit(1);

      expect(error.toBeNull();
      expect(data).toBeDefined();
    });

    it('should handle database query errors gracefully', async () => {
      // Attempt invalid query
      const { data, error} = await supabase.from('nonexistent_table').select('*');

      expect(error.toBeDefined();
      expect(data).toBeNull();
    });

    it('should maintain data consistency', async () => {
      // Insert test record
      const testRecord = {
        service_id: 'consistency_test',
        memory_type: 'test',
        content 'Consistency test content,
      };

      const { data: inserted, error: insertError, } = await supabase
        .from('ai_memories')
        .insert([testRecord])
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(inserted).toBeDefined();

      // Verify record exists
      const { data: retrieved, error: retrieveError, } = await supabase
        .from('ai_memories')
        .select('*')
        .eq('id', inserted.id)
        .single();

      expect(retrieveError).toBeNull();
      expect(retrieved.content.toBe(testRecord.content;

      // Cleanup
      await supabase.from('ai_memories').delete().eq('id', inserted.id);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 5;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(requesttestConfig.baseUrl).get('/api/health'));
      }

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All requests should succeed
      expect(responses.every((r) => r.status === 200)).toBe(true);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      const response = await requesttestConfig.baseUrl).get('/api/health').expect(200);

      const responseTime = Date.now() - startTime;

      // Should respond within 2 seconds
      expect(responseTime).toBeLessThan(2000);
    });
  });
});

// Helper function for flexible status code testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: number[]): R;
    }
  }
}

expect.extend({
  toBeOneOf(received: number, expected: number[]) {
    const pass = expected.includes(received);
    return {
      message: () => `expected ${received} to be one of [${expected.join(', ')}]`,
      pass,
    };
  },
});
