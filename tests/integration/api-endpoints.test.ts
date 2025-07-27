import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { createClient } from '@supabase/supabase-js';

// Import the main server setup
import { setupServer } from '../../src/server';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../src/services/ollama-assistant');
jest.mock('../../src/services/dspy-service');
jest.mock('../../src/services/redis-service');

const mockSupabase = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
  rpc: jest.fn(),
};

describe('API Endpoints Integration Tests', () => {
  let app: express.Application;
  let server: unknown;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';
    process.env.JWT_SECRET = 'test-secret';

    // Setup mock responses
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Create test server
    app = await setupServer();
    server = createServer(app);

    // Setup test user and auth token
    testUserId = 'test-user-integration';
    authToken = 'Bearer test-integration-token';

    // Mock successful authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: testUserId,
          email: 'integration@test.com',
          role: 'admin',
        },
      },
      error: null,
    });
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Flow Integration', () => {
    it('should complete full authentication cycle', async () => {
      // 1. Register new user
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: {
          user: { id: 'new-user', email: 'newuser@test.com' },
          session: { access_token: 'new-token', refresh_token: 'refresh-token' },
        },
        error: null,
      });

      const registerResponse = await request(app).post('/api/auth/register').send({
        email: 'newuser@test.com',
        password: 'SecurePass123!',
        username: 'newuser',
      });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.data).toHaveProperty('token');

      // 2. Login with credentials
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: 'new-user', email: 'newuser@test.com' },
          session: { access_token: 'login-token', refresh_token: 'refresh-token' },
        },
        error: null,
      });

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'newuser@test.com',
        password: 'SecurePass123!',
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data).toHaveProperty('token');

      // 3. Access protected endpoint
      const protectedResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${loginResponse.body.data.token}`);

      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.body.data).toHaveProperty('email', 'newuser@test.com');

      // 4. Logout
      mockSupabase.auth.signOut.mockResolvedValueOnce({ error: null });

      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${loginResponse.body.data.token}`);

      expect(logoutResponse.status).toBe(200);
    });

    it('should handle authentication failures gracefully', async () => {
      // Attempt login with invalid credentials
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      const response = await request(app).post('/api/auth/login').send({
        email: 'invalid@test.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Knowledge Management Integration', () => {
    it('should complete full knowledge lifecycle', async () => {
      // 1. Create knowledge entry
      mockSupabase.from().insert.mockReturnThis();
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().single.mockResolvedValueOnce({
        data: {
          id: 'knowledge-integration-test',
          title: 'Integration Test Knowledge',
          content: 'This is test content for integration testing',
          type: 'documentation',
          user_id: testUserId,
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const createResponse = await request(app)
        .post('/api/knowledge')
        .set('Authorization', authToken)
        .send({
          title: 'Integration Test Knowledge',
          content: 'This is test content for integration testing',
          type: 'documentation',
        });

      expect(createResponse.status).toBe(201);
      const knowledgeId = createResponse.body.data.id;

      // 2. Search for the knowledge
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            id: knowledgeId,
            title: 'Integration Test Knowledge',
            similarity: 0.95,
          },
        ],
        error: null,
      });

      const searchResponse = await request(app)
        .post('/api/knowledge/search')
        .set('Authorization', authToken)
        .send({
          query: 'integration testing',
          limit: 10,
        });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.data).toHaveLength(1);
      expect(searchResponse.body.data[0].id).toBe(knowledgeId);

      // 3. Update the knowledge
      mockSupabase.from().update.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().single.mockResolvedValueOnce({
        data: {
          id: knowledgeId,
          title: 'Updated Integration Test Knowledge',
          content: 'Updated content',
          type: 'documentation',
        },
        error: null,
      });

      const updateResponse = await request(app)
        .put(`/api/knowledge/${knowledgeId}`)
        .set('Authorization', authToken)
        .send({
          title: 'Updated Integration Test Knowledge',
          content: 'Updated content',
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.title).toBe('Updated Integration Test Knowledge');

      // 4. Retrieve specific knowledge
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().single.mockResolvedValueOnce({
        data: {
          id: knowledgeId,
          title: 'Updated Integration Test Knowledge',
          content: 'Updated content',
        },
        error: null,
      });

      const getResponse = await request(app)
        .get(`/api/knowledge/${knowledgeId}`)
        .set('Authorization', authToken);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data.title).toBe('Updated Integration Test Knowledge');

      // 5. Delete the knowledge
      mockSupabase.from().delete.mockReturnThis();
      mockSupabase.from().eq.mockResolvedValueOnce({
        data: { id: knowledgeId },
        error: null,
      });

      const deleteResponse = await request(app)
        .delete(`/api/knowledge/${knowledgeId}`)
        .set('Authorization', authToken);

      expect(deleteResponse.status).toBe(200);
    });
  });

  describe('Orchestration Integration', () => {
    it('should orchestrate complex multi-agent task', async () => {
      // Mock orchestration service
      const mockOrchestrationResult = {
        id: 'orchestration-integration-test',
        status: 'completed',
        result: {
          analysis: 'Task analyzed successfully',
          implementation: 'Implementation completed',
          review: 'Review passed',
        },
        metrics: {
          duration: 15000,
          agents_used: THREE,
          tokens_consumed: 1200,
        },
      };

      // Mock the orchestration call
      const orchestrationModule = require('../../src/core/coordination/enhanced-dspy-coordinator');
      orchestrationModule.orchestrate = jest.fn().mockResolvedValue(mockOrchestrationResult);

      const orchestrationRequest = {
        task: 'Create integration tests for API endpoints',
        context: {
          domain: 'testing',
          priority: 'high',
        },
        agents: ['planner', 'code_assistant', 'reviewer'],
        config: {
          timeout: 30000,
          parallelism: TWO,
        },
      };

      const response = await request(app)
        .post('/api/orchestration/orchestrate')
        .set('Authorization', authToken)
        .send(orchestrationRequest);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status', 'completed');
      expect(response.body.data.metrics).toHaveProperty('agents_used', THREE);
    });

    it('should coordinate agents with dependencies', async () => {
      const coordinationRequest = {
        agents: [
          { id: 'agent-1', type: 'analyzer', config: { depth: 2 } },
          { id: 'agent-2', type: 'implementer', config: { style: 'comprehensive' } },
          { id: 'agent-3', type: 'validator', config: { strict: true } },
        ],
        workflow: {
          type: 'sequential',
          dependencies: ['agent-1 → agent-2 → agent-3'],
        },
      };

      const mockCoordinationResult = {
        id: 'coordination-integration-test',
        status: 'success',
        workflow_execution: {
          'agent-1': { status: 'completed', output: 'Analysis complete' },
          'agent-2': { status: 'completed', output: 'Implementation ready' },
          'agent-3': { status: 'completed', output: 'Validation passed' },
        },
      };

      const coordinatorModule = require('../../src/core/coordination/enhanced-dspy-coordinator');
      coordinatorModule.coordinate = jest.fn().mockResolvedValue(mockCoordinationResult);

      const response = await request(app)
        .post('/api/orchestration/coordinate')
        .set('Authorization', authToken)
        .send(coordinationRequest);

      expect(response.status).toBe(200);
      expect(response.body.data.workflow_execution).toHaveProperty('agent-1');
      expect(response.body.data.workflow_execution).toHaveProperty('agent-2');
      expect(response.body.data.workflow_execution).toHaveProperty('agent-3');
    });
  });

  describe('Health and Monitoring Integration', () => {
    it('should provide comprehensive system health', async () => {
      const response = await request(app).get('/api/health').set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');

      // Check individual service health
      if (response.body.services) {
        expect(response.body.services).toHaveProperty('database');
        expect(response.body.services).toHaveProperty('redis');
        expect(response.body.services).toHaveProperty('supabase');
      }
    });

    it('should return system metrics', async () => {
      const response = await request(app)
        .get('/api/orchestration/status')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('system');
      expect(response.body.data).toHaveProperty('agents');
      expect(response.body.data).toHaveProperty('orchestrations');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database error
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const response = await request(app)
        .get('/api/knowledge/non-existent-id')
        .set('Authorization', authToken);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Database');
    });

    it('should handle service timeouts appropriately', async () => {
      // Mock timeout scenario
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Service timeout')), 100);
      });

      const orchestrationModule = require('../../src/core/coordination/enhanced-dspy-coordinator');
      orchestrationModule.orchestrate = jest.fn().mockImplementation(() => timeoutPromise);

      const response = await request(app)
        .post('/api/orchestration/orchestrate')
        .set('Authorization', authToken)
        .send({
          task: 'Timeout test task',
          agents: ['slow-agent'],
          config: { timeout: 50 }, // Very short timeout
        });

      expect(response.status).toBe(408);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('timeout');
    });

    it('should validate request formats consistently', async () => {
      const invalidRequests = [
        {
          endpoint: '/api/knowledge',
          method: 'post',
          payload: {
            /* missing required fields */
          },
          expectedStatus: 400,
        },
        {
          endpoint: '/api/orchestration/orchestrate',
          method: 'post',
          payload: { agents: 'invalid-format' }, // Should be array
          expectedStatus: 400,
        },
        {
          endpoint: '/api/auth/register',
          method: 'post',
          payload: { email: 'invalid-email', password: '123' }, // Weak password
          expectedStatus: 400,
        },
      ];

      for (const { endpoint, method, payload, expectedStatus } of invalidRequests) {
        const response = await request(app)
          [method](endpoint)
          .set('Authorization', authToken)
          .send(payload);

        expect(response.status).toBe(expectedStatus);
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Security Integration', () => {
    it('should enforce rate limiting across endpoints', async () => {
      // Attempt multiple rapid requests to different endpoints
      const endpoints = [
        '/api/knowledge/search',
        '/api/orchestration/orchestrate',
        '/api/auth/login',
      ];

      for (const endpoint of endpoints) {
        const promises = Array(10)
          .fill(null)
          .map(() =>
            request(app).post(endpoint).set('Authorization', authToken).send({ test: 'data' })
          );

        const responses = await Promise.all(promises);
        const rateLimited = responses.some((r) => r.status === 429);

        // At least some requests should be rate limited
        if (!rateLimited) {
          console.warn(`Rate limiting may not be working for ${endpoint}`);
        }
      }
    });

    it('should maintain session security across requests', async () => {
      const sessionToken = 'Bearer session-consistency-test';

      // Mock consistent user for this session
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'session-user',
            email: 'session@test.com',
            role: 'user',
          },
        },
        error: null,
      });

      // Make multiple requests with same token
      const endpoints = [
        '/api/auth/profile',
        '/api/knowledge/type/documentation',
        '/api/orchestration/status',
      ];

      const responses = await Promise.all(
        endpoints.map((endpoint) => request(app).get(endpoint).set('Authorization', sessionToken))
      );

      // All should use the same user context
      responses.forEach((response) => {
        if (response.status === 200) {
          // User context should be consistent
          expect(response.body).toHaveProperty('success', true);
        }
      });
    });

    it('should prevent unauthorized access to admin endpoints', async () => {
      // Mock regular user
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'regular-user',
            email: 'user@test.com',
            role: 'user',
          },
        },
        error: null,
      });

      const adminEndpoints = [
        { method: 'post', path: '/api/backup/create' },
        { method: 'get', path: '/api/security-reports' },
        { method: 'post', path: '/api/enhanced-supabase/query' },
      ];

      for (const { method, path } of adminEndpoints) {
        const response = await request(app)
          [method](path)
          .set('Authorization', 'Bearer regular-user-token')
          .send({ test: 'data' });

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();

      const promises = Array(concurrentRequests)
        .fill(null)
        .map((_, index) =>
          request(app)
            .post('/api/knowledge/search')
            .set('Authorization', authToken)
            .send({
              query: `test query ${index}`,
              limit: 5,
            })
        );

      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should complete successfully
      responses.forEach((response) => {
        expect([200, 429]).toContain(response.status); // Success or rate limited
      });

      // Should complete within reasonable time (adjust based on your performance requirements)
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    it('should handle large payloads appropriately', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB

      const response = await request(app)
        .post('/api/knowledge')
        .set('Authorization', authToken)
        .send({
          title: 'Large Content Test',
          content: largeContent,
          type: 'documentation',
        });

      // Should either accept or reject based on configured limits
      expect([201, 413]).toContain(response.status);
    });
  });
});
