import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
process.env.
    NODE_ENV = 'test';
describe('Knowledge Router - Simplified Tests', () => {
    let app;
    let knowledgeStore = [];
    beforeEach(() => {
        knowledgeStore = [
            {
                id: 'knowledge-1',
                title: 'API Testing Guide',
                content: 'Comprehensive guide for testing APIs',
                type: 'documentation',
                user_id: 'test-user',
                created_at: '2024-01-01T00:00:00Z',
            },
            {
                id: 'knowledge-2',
                title: 'Security Best Practices',
                content: 'Security guidelines for web applications',
                type: 'security',
                user_id: 'test-user',
                created_at: '2024-01-02T00:00:00Z',
            },
        ];
        app = express();
        app.use(express.json());
        app.use('/api/knowledge', (req, res, next) => {
            const auth = req.headers.authorization;
            if (!auth || !auth.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            req.user = { id: 'test-user', email: 'test@example.com' };
            next();
        });
        app.post('/api/knowledge', (req, res) => {
            const { title, content, type, metadata } = req.body;
            if (!title || !content || !type) {
                return res.status(400).json({
                    error: 'Missing required fields: title, content, type',
                });
            }
            const sanitizedTitle = title.replace(/<script.*?>.*?<\/script>/gi, '');
            const sanitizedContent = content.replace(/<script.*?>.*?<\/script>/gi, '');
            const newKnowledge = {
                id: `knowledge-${Date.now()}`,
                title: sanitizedTitle,
                content: sanitizedContent,
                type,
                metadata: metadata || {},
                user_id: req.user.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            knowledgeStore.push(newKnowledge);
            res.status(201).json({
                success: true,
                data: newKnowledge,
            });
        });
        app.post('/api/knowledge/search', (req, res) => {
            const { query, limit = 10, filters = {} } = req.body;
            if (!query) {
                return res.status(400).json({ error: 'Search query required' });
            }
            let results = knowledgeStore.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.content.toLowerCase().includes(query.toLowerCase()));
            if (filters.type) {
                results = results.filter((item) => item.type === filters.type);
            }
            results = results.slice(0, Math.min(limit, 100));
            results = results.map((item) => ({
                ...item,
                similarity: Math.random() * 0.3 + 0.7,
            }));
            res.status(200).json({
                success: true,
                data: results,
            });
        });
        app.get('/api/knowledge/:id', (req, res) => {
            const { id } = req.params;
            if (!id.startsWith('knowledge-')) {
                return res.status(400).json({ error: 'Invalid knowledge ID format' });
            }
            const knowledge = knowledgeStore.find((item) => item.id === id);
            if (!knowledge) {
                return res.status(404).json({ error: 'Knowledge not found' });
            }
            res.status(200).json({
                success: true,
                data: knowledge,
            });
        });
        app.put('/api/knowledge/:id', (req, res) => {
            const { id } = req.params;
            const updates = req.body;
            const index = knowledgeStore.findIndex((item) => item.id === id);
            if (index === -1) {
                return res.status(404).json({ error: 'Knowledge not found' });
            }
            const knowledge = knowledgeStore[index];
            if (knowledge.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied: not owner' });
            }
            const updatedKnowledge = {
                ...knowledge,
                ...updates,
                updated_at: new Date().toISOString(),
            };
            knowledgeStore[index] = updatedKnowledge;
            res.status(200).json({
                success: true,
                data: updatedKnowledge,
            });
        });
        app.delete('/api/knowledge/:id', (req, res) => {
            const { id } = req.params;
            const index = knowledgeStore.findIndex((item) => item.id === id);
            if (index === -1) {
                return res.status(404).json({ error: 'Knowledge not found' });
            }
            const knowledge = knowledgeStore[index];
            if (knowledge.verified) {
                return res.status(403).json({
                    error: 'Cannot delete verified knowledge',
                });
            }
            knowledgeStore.splice(index, 1);
            res.status(200).json({
                success: true,
                message: 'Knowledge deleted successfully',
            });
        });
        app.get('/api/knowledge/type/:type', (req, res) => {
            const { type } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            const validTypes = ['documentation', 'security', 'tutorial', 'reference'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({ error: 'Invalid type' });
            }
            const results = knowledgeStore
                .filter((item) => item.type === type)
                .slice(Number(offset), Number(offset) + Number(limit));
            res.status(200).json({
                success: true,
                data: results,
            });
        });
    });
    describe('POST /api/knowledge', () => {
        it('should create knowledge entry successfully', async () => {
            const newKnowledge = {
                title: 'Test Knowledge',
                content: 'This is test content',
                type: 'documentation',
                metadata: { category: 'testing' },
            };
            const response = await request(app)
                .post('/api/knowledge')
                .set('Authorization', 'Bearer valid-token')
                .send(newKnowledge);
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.title).toBe(newKnowledge.title);
            expect(response.body.data.user_id).toBe('test-user');
        });
        it('should reject knowledge without required fields', async () => {
            const invalidKnowledge = {
                title: 'Test Knowledge',
            };
            const response = await request(app)
                .post('/api/knowledge')
                .set('Authorization', 'Bearer valid-token')
                .send(invalidKnowledge);
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Missing required fields');
        });
        it('should sanitize XSS attempts', async () => {
            const maliciousKnowledge = {
                title: 'Test<script>alert("XSS")</script>',
                content: '<p>Content</p><script>malicious()</script>',
                type: 'documentation',
            };
            const response = await request(app)
                .post('/api/knowledge')
                .set('Authorization', 'Bearer valid-token')
                .send(maliciousKnowledge);
            expect(response.status).toBe(201);
            expect(response.body.data.title).not.toContain('<script>');
            expect(response.body.data.content).not.toContain('<script>');
        });
        it('should require authentication', async () => {
            const response = await request(app).post('/api/knowledge').send({
                title: 'Test',
                content: 'Content',
                type: 'documentation',
            });
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });
    describe('POST /api/knowledge/search', () => {
        it('should search knowledge successfully', async () => {
            const response = await request(app)
                .post('/api/knowledge/search')
                .set('Authorization', 'Bearer valid-token')
                .send({
                query: 'testing',
                limit: 10,
            });
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
            expect(response.body.data[0]).toHaveProperty('similarity');
        });
        it('should filter by type', async () => {
            const response = await request(app)
                .post('/api/knowledge/search')
                .set('Authorization', 'Bearer valid-token')
                .send({
                query: 'guide',
                filters: { type: 'documentation' },
            });
            expect(response.status).toBe(200);
            expect(response.body.data.every((item) => item.type === 'documentation')).toBe(true);
        });
        it('should require search query', async () => {
            const response = await request(app)
                .post('/api/knowledge/search')
                .set('Authorization', 'Bearer valid-token')
                .send({
                limit: 10,
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Search query required');
        });
        it('should enforce maximum limit', async () => {
            const response = await request(app)
                .post('/api/knowledge/search')
                .set('Authorization', 'Bearer valid-token')
                .send({
                query: 'test',
                limit: MILLISECONDS_IN_SECOND,
            });
            expect(response.status).toBe(200);
            expect(response.body.data.length).toBeLessThanOrEqual(100);
        });
    });
    describe('GET /api/knowledge/:id', () => {
        it('should retrieve specific knowledge', async () => {
            const response = await request(app)
                .get('/api/knowledge/knowledge-1')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.id).toBe('knowledge-1');
            expect(response.body.data.title).toBe('API Testing Guide');
        });
        it('should return 404 for non-existent knowledge', async () => {
            const response = await request(app)
                .get('/api/knowledge/knowledge-nonexistent')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(404);
            expect(response.body.error).toContain('Knowledge not found');
        });
        it('should validate ID format', async () => {
            const response = await request(app)
                .get('/api/knowledge/invalid-format')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid knowledge ID format');
        });
    });
    describe('PUT /api/knowledge/:id', () => {
        it('should update knowledge successfully', async () => {
            const updates = {
                title: 'Updated API Testing Guide',
                content: 'Updated comprehensive guide',
            };
            const response = await request(app)
                .put('/api/knowledge/knowledge-1')
                .set('Authorization', 'Bearer valid-token')
                .send(updates);
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.title).toBe(updates.title);
            expect(response.body.data).toHaveProperty('updated_at');
        });
        it('should prevent updating non-existent knowledge', async () => {
            const response = await request(app)
                .put('/api/knowledge/knowledge-nonexistent')
                .set('Authorization', 'Bearer valid-token')
                .send({ title: 'Updated' });
            expect(response.status).toBe(404);
            expect(response.body.error).toContain('Knowledge not found');
        });
    });
    describe('DELETE /api/knowledge/:id', () => {
        it('should delete knowledge successfully', async () => {
            const response = await request(app)
                .delete('/api/knowledge/knowledge-1')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.message).toContain('deleted');
        });
        it('should prevent deleting verified knowledge', async () => {
            knowledgeStore.push({
                id: 'knowledge-verified',
                title: 'Verified Knowledge',
                content: 'This is verified',
                type: 'documentation',
                user_id: 'test-user',
                verified: true,
                created_at: '2024-01-01T00:00:00Z',
            });
            const response = await request(app)
                .delete('/api/knowledge/knowledge-verified')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(403);
            expect(response.body.error).toContain('verified knowledge');
        });
    });
    describe('GET /api/knowledge/type/:type', () => {
        it('should get knowledge by type', async () => {
            const response = await request(app)
                .get('/api/knowledge/type/documentation')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.every((item) => item.type === 'documentation')).toBe(true);
        });
        it('should validate knowledge type', async () => {
            const response = await request(app)
                .get('/api/knowledge/type/invalid-type')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid type');
        });
        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/knowledge/type/documentation?limit=1&offset=0')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body.data.length).toBeLessThanOrEqual(1);
        });
    });
    describe('Security Tests', () => {
        it('should require authentication for all endpoints', async () => {
            const endpoints = [
                { method: 'post', path: '/api/knowledge', data: { title: 'Test' } },
                { method: 'post', path: '/api/knowledge/search', data: { query: 'test' } },
                { method: 'get', path: '/api/knowledge/knowledge-1' },
                { method: 'put', path: '/api/knowledge/knowledge-1', data: { title: 'Updated' } },
                { method: 'delete', path: '/api/knowledge/knowledge-1' },
            ];
            for (const { method, path, data } of endpoints) {
                const response = await request(app)[method](path).send(data);
                expect(response.status).toBe(401);
                expect(response.body).toHaveProperty('error', 'Unauthorized');
            }
        });
    });
});
//# sourceMappingURL=knowledge-simple.test.js.map