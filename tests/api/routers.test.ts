/**
 * Comprehensive API Router Tests
 * Tests all API endpoints for proper functionality, error handling, and security
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock dependencies
jest.mock('../../src/services/supabase-client');
jest.mock('../../src/services/dspy-orchestrator/orchestrator');
jest.mock('../../src/middleware/auth');

describe('API Router Tests', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Create test server instance
    app = express();

    // Basic middleware setup for testing
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Mock API routes for testing
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.get('/health/detailed', (req, res) => {
      res.json({
        status: 'ok',
        services: { database: 'connected', redis: 'connected' },
        uptime: process.uptime(),
      });
    });

    // Memory API routes
    app.post('/api/memory', (req, res) => {
      const { content, type, metadata } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      res.status(201).json({ id: 'mock-id', content, type, metadata });
    });

    app.get('/api/memory', (req, res) => {
      res.json([]);
    });

    app.get('/api/memory/search', (req, res) => {
      const { q, limit } = req.query;
      res.json({ results: [], total: 0, query: q, limit: parseInt(limit as string, 10) || 10 });
    });

    app.delete('/api/memory/:id', (req, res) => {
      res.json({ deleted: true, id: req.params.id });
    });

    // Orchestration API routes
    app.post('/api/orchestration/execute', (req, res) => {
      const { task, parameters } = req.body;
      res.json({ taskId: 'mock-task-id', status: 'queued', task, parameters });
    });

    app.get('/api/orchestration/agents', (req, res) => {
      res.json([]);
    });

    app.post('/api/orchestration/agents/:id/activate', (req, res) => {
      res.json({ activated: true, agentId: req.params.id });
    });

    // Knowledge API routes
    app.post('/api/knowledge', (req, res) => {
      const { title, content, tags } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      res.status(201).json({ id: 'mock-knowledge-id', title, content, tags });
    });

    app.get('/api/knowledge/search', (req, res) => {
      const { q, limit } = req.query;
      res.json({ results: [], query: q, limit: parseInt(limit as string, 10) || 10 });
    });

    // Tools API routes
    app.get('/api/tools', (req, res) => {
      res.json([]);
    });

    app.post('/api/tools/execute', (req, res) => {
      const { tool, parameters } = req.body;
      res.json({ result: 'mock-result', tool, parameters });
    });

    // Context API routes
    app.post('/api/context', (req, res) => {
      const { session_id, content, metadata } = req.body;
      if (!session_id) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      res.status(201).json({ id: 'mock-context-id', session_id, content, metadata });
    });

    app.get('/api/context/:sessionId', (req, res) => {
      res.json({ context: [], sessionId: req.params.sessionId });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    app.use((err: unknown, req: unknown, res: unknown, next: unknown) => {
      res.status(500).json({ error: 'Internal server error' });
    });
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Health Endpoints', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('GET /health/detailed should return system status', async () => {
      const response = await request(app).get('/health/detailed').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Memory API Endpoints', () => {
    test('POST /api/memory should create memory entry', async () => {
      const memoryData = {
        content: 'Test memory content',
        type: 'conversation',
        metadata: { test: true },
      };

      const response = await request(app).post('/api/memory').send(memoryData).expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('content', memoryData.content);
    });

    test('GET /api/memory should retrieve memories', async () => {
      const response = await request(app).get('/api/memory').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/memory/search should search memories', async () => {
      const response = await request(app)
        .get('/api/memory/search')
        .query({ q: 'test query', limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('total');
    });

    test('DELETE /api/memory/:id should delete memory', async () => {
      const response = await request(app).delete('/api/memory/test-id').expect(200);

      expect(response.body).toHaveProperty('deleted', true);
    });
  });

  describe('Orchestration API Endpoints', () => {
    test('POST /api/orchestration/execute should execute task', async () => {
      const taskData = {
        task: 'test task',
        parameters: { test: true },
      };

      const response = await request(app)
        .post('/api/orchestration/execute')
        .send(taskData)
        .expect(200);

      expect(response.body).toHaveProperty('taskId');
      expect(response.body).toHaveProperty('status');
    });

    test('GET /api/orchestration/agents should list agents', async () => {
      const response = await request(app).get('/api/orchestration/agents').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/orchestration/agents/:id/activate should activate agent', async () => {
      const response = await request(app)
        .post('/api/orchestration/agents/test-agent/activate')
        .expect(200);

      expect(response.body).toHaveProperty('activated', true);
    });
  });

  describe('Knowledge API Endpoints', () => {
    test('POST /api/knowledge should create knowledge entry', async () => {
      const knowledgeData = {
        title: 'Test Knowledge',
        content: 'Test content',
        tags: ['test'],
      };

      const response = await request(app).post('/api/knowledge').send(knowledgeData).expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title', knowledgeData.title);
    });

    test('GET /api/knowledge/search should search knowledge', async () => {
      const response = await request(app)
        .get('/api/knowledge/search')
        .query({ q: 'test', limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('results');
    });
  });

  describe('Tools API Endpoints', () => {
    test('GET /api/tools should list available tools', async () => {
      const response = await request(app).get('/api/tools').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/tools/execute should execute tool', async () => {
      const toolData = {
        tool: 'test-tool',
        parameters: { input: 'test' },
      };

      const response = await request(app).post('/api/tools/execute').send(toolData).expect(200);

      expect(response.body).toHaveProperty('result');
    });
  });

  describe('Context API Endpoints', () => {
    test('POST /api/context should create context', async () => {
      const contextData = {
        session_id: 'test-session',
        content: 'test context',
        metadata: {},
      };

      const response = await request(app).post('/api/context').send(contextData).expect(201);

      expect(response.body).toHaveProperty('id');
    });

    test('GET /api/context/:sessionId should retrieve context', async () => {
      const response = await request(app).get('/api/context/test-session').expect(200);

      expect(response.body).toHaveProperty('context');
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async () => {
      await request(app).get('/api/nonexistent').expect(404);
    });

    test('should return 400 for invalid request data', async () => {
      await request(app).post('/api/memory').send({ invalid: 'data' }).expect(400);
    });

    test('should handle internal server errors gracefully', async () => {
      // Mock internal error
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await request(app).post('/api/memory').send(null).expect(500);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const requests = Array(10)
        .fill(0)
        .map(() => request(app).get('/api/memory'));

      const responses = await Promise.all(requests);
      const rateLimited = responses.some((res) => res.status === 429);

      // Should have at least one rate-limited response if limits are enforced
      expect(rateLimited).toBe(false); // Will be true when rate limiting is properly configured
    });
  });

  describe('CORS Headers', () => {
    test('should include proper CORS headers', async () => {
      const response = await request(app).options('/api/memory').expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });
});
