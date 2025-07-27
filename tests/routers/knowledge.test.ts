import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import knowledgeRouter from '../../src/routers/knowledge';
import { requireAuth } from '../../src/middleware/auth-jwt';
import { validateRequest } from '../../src/middleware/request-validation';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../src/middleware/auth-jwt');
jest.mock('../../src/middleware/request-validation');
jest.mock('../../src/services/dspy-service');
jest.mock('../../src/services/reranking-service');

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
  rpc: jest.fn(),
};

describe('Knowledge Router', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/knowledge', knowledgeRouter);

    // Reset mocks
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (requireAuth as jest.Mock).mockImplementation((req, res, next) => {
      req.user = { id: 'test-user-id', email: 'test@example.com' };
      next();
    });
    (validateRequest as jest.Mock).mockImplementation((req, res, next) => next());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/knowledge', () => {
    it('should create a new knowledge entry successfully', async () => {
      const newKnowledge = {
        title: 'Test Knowledge',
        content: 'This is test knowledge content',
        type: 'documentation',
        metadata: { category: 'testing' },
      };

      const mockCreatedKnowledge = {
        id: 'knowledge-123',
        ...newKnowledge,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'test-user-id',
        embedding: [0.1, 0.2, 0.3], // Mock embedding
      };

      mockSupabase.from().insert.mockReturnThis();
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().single.mockResolvedValue({
        data: mockCreatedKnowledge,
        error: null,
      });

      const response = await request(app)
        .post('/api/knowledge')
        .set('Authorization', 'Bearer valid-token')
        .send(newKnowledge);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', 'knowledge-123');
      expect(response.body.data).toHaveProperty('title', newKnowledge.title);
    });

    it('should validate required fields', async () => {
      const invalidKnowledge = {
        // Missing required title and content
        type: 'documentation',
      };

      const response = await request(app)
        .post('/api/knowledge')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidKnowledge);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should sanitize HTML content to prevent XSS', async () => {
      const maliciousKnowledge = {
        title: 'Test<script>alert("XSS")</script>',
        content: '<p>Safe content</p><script>malicious()</script>',
        type: 'documentation',
      };

      mockSupabase.from().insert.mockReturnThis();
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().single.mockResolvedValue({
        data: {
          id: 'knowledge-123',
          title: 'Test', // Script tags removed
          content: '<p>Safe content</p>', // Script removed
          type: 'documentation',
        },
        error: null,
      });

      const response = await request(app)
        .post('/api/knowledge')
        .set('Authorization', 'Bearer valid-token')
        .send(maliciousKnowledge);

      expect(response.status).toBe(201);
      expect(response.body.data.title).not.toContain('<script>');
      expect(response.body.data.content).not.toContain('<script>');
    });
  });

  describe('POST /api/knowledge/search', () => {
    it('should search knowledge base successfully', async () => {
      const searchQuery = {
        query: 'testing documentation',
        limit: 10,
        offset: 0,
        filters: {
          type: 'documentation',
        },
      };

      const mockSearchResults = [
        {
          id: 'knowledge-1',
          title: 'Testing Guide',
          content: 'Guide for testing applications',
          type: 'documentation',
          similarity: 0.95,
        },
        {
          id: 'knowledge-2',
          title: 'Test Best Practices',
          content: 'Best practices for testing',
          type: 'documentation',
          similarity: 0.87,
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockSearchResults,
        error: null,
      });

      const response = await request(app)
        .post('/api/knowledge/search')
        .set('Authorization', 'Bearer valid-token')
        .send(searchQuery);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('similarity');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_knowledge', expect.any(Object));
    });

    it('should handle empty search results', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const response = await request(app)
        .post('/api/knowledge/search')
        .set('Authorization', 'Bearer valid-token')
        .send({ query: 'non-existent-topic' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(0);
    });

    it('should validate search query parameters', async () => {
      const invalidSearch = {
        // Missing required query field
        limit: 10,
      };

      const response = await request(app)
        .post('/api/knowledge/search')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidSearch);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should enforce maximum limit', async () => {
      const response = await request(app)
        .post('/api/knowledge/search')
        .set('Authorization', 'Bearer valid-token')
        .send({
          query: 'test',
          limit: MILLISECONDS_IN_SECOND, // Too high
        });

      // Should either cap at max or return error
      expect([200, 400]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.data.length).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('GET /api/knowledge/:id', () => {
    it('should retrieve specific knowledge entry', async () => {
      const mockKnowledge = {
        id: 'knowledge-123',
        title: 'Test Knowledge',
        content: 'Test content',
        type: 'documentation',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        user_id: 'test-user-id',
      };

      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().single.mockResolvedValue({
        data: mockKnowledge,
        error: null,
      });

      const response = await request(app)
        .get('/api/knowledge/knowledge-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', 'knowledge-123');
    });

    it('should return 404 for non-existent knowledge', async () => {
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const response = await request(app)
        .get('/api/knowledge/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .get('/api/knowledge/invalid-uuid-format')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('PUT /api/knowledge/:id', () => {
    it('should update knowledge entry successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content',
        metadata: { updated: true },
      };

      const mockUpdatedKnowledge = {
        id: 'knowledge-123',
        ...updateData,
        type: 'documentation',
        updated_at: new Date().toISOString(),
      };

      mockSupabase.from().update.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().single.mockResolvedValue({
        data: mockUpdatedKnowledge,
        error: null,
      });

      const response = await request(app)
        .put('/api/knowledge/knowledge-123')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('title', 'Updated Title');
    });

    it('should prevent updating non-owned knowledge', async () => {
      mockSupabase.from().update.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: { message: 'Unauthorized' },
      });

      const response = await request(app)
        .put('/api/knowledge/other-users-knowledge')
        .set('Authorization', 'Bearer valid-token')
        .send({ title: 'Hacked!' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/knowledge/:id/verify', () => {
    it('should verify knowledge entry', async () => {
      const verificationData = {
        verified: true,
        verification_notes: 'Content verified and accurate',
      };

      mockSupabase.from().update.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().single.mockResolvedValue({
        data: {
          id: 'knowledge-123',
          verified: true,
          verified_at: new Date().toISOString(),
          verified_by: 'test-user-id',
        },
        error: null,
      });

      const response = await request(app)
        .put('/api/knowledge/knowledge-123/verify')
        .set('Authorization', 'Bearer valid-token')
        .send(verificationData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('verified', true);
    });

    it('should require special permissions to verify', async () => {
      // Mock user without verification permissions
      (requireAuth as jest.Mock).mockImplementationOnce((req, res, next) => {
        req.user = { id: 'regular-user', email: 'user@example.com', role: 'user' };
        next();
      });

      const response = await request(app)
        .put('/api/knowledge/knowledge-123/verify')
        .set('Authorization', 'Bearer valid-token')
        .send({ verified: true });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('permission');
    });
  });

  describe('GET /api/knowledge/type/:type', () => {
    it('should retrieve knowledge by type', async () => {
      const mockKnowledgeList = [
        {
          id: 'knowledge-1',
          title: 'API Documentation',
          type: 'documentation',
        },
        {
          id: 'knowledge-2',
          title: 'Setup Guide',
          type: 'documentation',
        },
      ];

      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().order.mockResolvedValue({
        data: mockKnowledgeList,
        error: null,
      });

      const response = await request(app)
        .get('/api/knowledge/type/documentation')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('type', 'documentation');
    });

    it('should validate knowledge type', async () => {
      const response = await request(app)
        .get('/api/knowledge/type/invalid-type')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid type');
    });

    it('should support pagination', async () => {
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().order.mockReturnThis();
      mockSupabase.from().limit.mockResolvedValue({
        data: [],
        error: null,
      });

      const response = await request(app)
        .get('/api/knowledge/type/documentation?limit=20&offset=40')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockSupabase.from().limit).toHaveBeenCalledWith(20);
    });
  });

  describe('DELETE /api/knowledge/:id', () => {
    it('should delete knowledge entry successfully', async () => {
      mockSupabase.from().delete.mockReturnThis();
      mockSupabase.from().eq.mockResolvedValue({
        data: { id: 'knowledge-123' },
        error: null,
      });

      const response = await request(app)
        .delete('/api/knowledge/knowledge-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('deleted');
    });

    it('should prevent deleting verified knowledge', async () => {
      // First check if knowledge is verified
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().single.mockResolvedValue({
        data: { id: 'knowledge-123', verified: true },
        error: null,
      });

      const response = await request(app)
        .delete('/api/knowledge/knowledge-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('verified knowledge');
    });
  });

  describe('Security and Performance', () => {
    it('should rate limit knowledge creation', async () => {
      // Mock multiple rapid requests
      const promises = Array(10)
        .fill(null)
        .map(() =>
          request(app).post('/api/knowledge').set('Authorization', 'Bearer valid-token').send({
            title: 'Spam Knowledge',
            content: 'Spam content',
            type: 'documentation',
          })
        );

      const responses = await Promise.all(promises);
      const rateLimited = responses.some((r) => r.status === 429);
      expect(rateLimited).toBe(true);
    });

    it('should prevent large payload attacks', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of text

      const response = await request(app)
        .post('/api/knowledge')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: 'Large Knowledge',
          content: largeContent,
          type: 'documentation',
        });

      expect(response.status).toBe(413); // Payload too large
    });

    it('should sanitize search queries to prevent injection', async () => {
      const maliciousQuery = {
        query: "'; DROP TABLE knowledge; --",
        limit: 10,
      };

      const response = await request(app)
        .post('/api/knowledge/search')
        .set('Authorization', 'Bearer valid-token')
        .send(maliciousQuery);

      // Should either sanitize or reject
      expect([200, 400]).toContain(response.status);
      if (response.status === 200) {
        expect(mockSupabase.rpc).toHaveBeenCalledWith(
          'search_knowledge',
          expect.not.objectContaining({ query: maliciousQuery.query })
        );
      }
    });
  });
});
