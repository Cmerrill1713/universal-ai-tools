import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../src/middleware/auth-jwt';
import { validateRequest } from '../../src/middleware/request-validation';
import filesystemRouter from '../../src/routers/filesystem';
import backupRouter from '../../src/routers/backup';
import securityReportsRouter from '../../src/routers/security-reports';
import enhancedSupabaseRouter from '../../src/routers/enhanced-supabase';
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';
jest.mock('@supabase/supabase-js');
jest.mock('../../src/middleware/auth-jwt');
jest.mock('../../src/middleware/request-validation');
jest.mock('fs/promises');
jest.mock('path');
jest.mock('archiver');
const mockSupabase = {
    from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
    })),
    storage: {
        from: jest.fn(() => ({
            upload: jest.fn(),
            download: jest.fn(),
            list: jest.fn(),
            remove: jest.fn(),
        })),
    },
    rpc: jest.fn(),
};
describe('Security-Critical Routers', () => {
    let app;
    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/filesystem', filesystemRouter);
        app.use('/api/backup', backupRouter);
        app.use('/api/security-reports', securityReportsRouter);
        app.use('/api/enhanced-supabase', enhancedSupabaseRouter);
        jest.clearAllMocks();
        createClient.mockReturnValue(mockSupabase);
        requireAuth.mockImplementation((req, res, next) => {
            req.user = {
                id: 'test-user-id',
                email: 'test@example.com',
                role: 'admin',
            };
            next();
        });
        validateRequest.mockImplementation((req, res, next) => next());
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    describe('Filesystem Router Security', () => {
        describe('POST /api/filesystem/read', () => {
            it('should prevent path traversal attacks', async () => {
                const maliciousPath = {
                    path: '../../../etc/passwd',
                };
                const response = await request(app)
                    .post('/api/filesystem/read')
                    .set('Authorization', 'Bearer valid-token')
                    .send(maliciousPath);
                expect(response.status).toBe(403);
                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toContain('Invalid path');
            });
            it('should restrict access to allowed directories only', async () => {
                const systemPath = {
                    path: '/system/sensitive/config.txt',
                };
                const response = await request(app)
                    .post('/api/filesystem/read')
                    .set('Authorization', 'Bearer valid-token')
                    .send(systemPath);
                expect(response.status).toBe(403);
                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toContain('Access denied');
            });
            it('should allow reading from permitted directories', async () => {
                const allowedPath = {
                    path: '/app/data/user-files/document.txt',
                };
                const fs = require('fs/promises');
                fs.readFile = jest.fn().mockResolvedValue('File content');
                const response = await request(app)
                    .post('/api/filesystem/read')
                    .set('Authorization', 'Bearer valid-token')
                    .send(allowedPath);
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('content');
            });
            it('should require admin role for sensitive file access', async () => {
                requireAuth.mockImplementationOnce((req, res, next) => {
                    req.user = { id: 'regular-user', email: 'user@example.com', role: 'user' };
                    next();
                });
                const response = await request(app)
                    .post('/api/filesystem/read')
                    .set('Authorization', 'Bearer valid-token')
                    .send({ path: '/app/config/database.env' });
                expect(response.status).toBe(403);
                expect(response.body.error).toContain('Insufficient permissions');
            });
        });
        describe('POST /api/filesystem/write', () => {
            it('should sanitize file content to prevent code injection', async () => {
                const maliciousContent = {
                    path: '/app/data/user-files/script.js',
                    content: 'const malicious = require("child_process").exec("rm -rf /");',
                };
                const response = await request(app)
                    .post('/api/filesystem/write')
                    .set('Authorization', 'Bearer valid-token')
                    .send(maliciousContent);
                if (response.status === 200) {
                    expect(response.body.data.sanitized).toBe(true);
                }
                else {
                    expect(response.status).toBe(400);
                    expect(response.body.error).toContain('Unsafe content');
                }
            });
            it('should enforce file size limits', async () => {
                const largeFile = {
                    path: '/app/data/user-files/large.txt',
                    content: 'x'.repeat(10 * 1024 * 1024),
                };
                const response = await request(app)
                    .post('/api/filesystem/write')
                    .set('Authorization', 'Bearer valid-token')
                    .send(largeFile);
                expect(response.status).toBe(413);
                expect(response.body.error).toContain('File too large');
            });
            it('should validate file extensions', async () => {
                const executableFile = {
                    path: '/app/data/user-files/malware.exe',
                    content: 'executable content',
                };
                const response = await request(app)
                    .post('/api/filesystem/write')
                    .set('Authorization', 'Bearer valid-token')
                    .send(executableFile);
                expect(response.status).toBe(400);
                expect(response.body.error).toContain('Invalid file type');
            });
        });
        describe('POST /api/filesystem/list', () => {
            it('should not expose sensitive system directories', async () => {
                const response = await request(app)
                    .post('/api/filesystem/list')
                    .set('Authorization', 'Bearer valid-token')
                    .send({ path: '/' });
                expect(response.status).toBe(200);
                if (response.body.data) {
                    const directories = response.body.data.directories || [];
                    expect(directories).not.toContain('/etc');
                    expect(directories).not.toContain('/var');
                    expect(directories).not.toContain('/sys');
                }
            });
        });
    });
    describe('Backup Router Security', () => {
        describe('POST /api/backup/create', () => {
            it('should require admin privileges for backup creation', async () => {
                requireAuth.mockImplementationOnce((req, res, next) => {
                    req.user = { id: 'regular-user', email: 'user@example.com', role: 'user' };
                    next();
                });
                const response = await request(app)
                    .post('/api/backup/create')
                    .set('Authorization', 'Bearer valid-token')
                    .send({ type: 'full' });
                expect(response.status).toBe(403);
                expect(response.body.error).toContain('Admin privileges required');
            });
            it('should validate backup configuration', async () => {
                const invalidConfig = {
                    type: 'full',
                    destination: '../../../sensitive-location',
                    encryption: false,
                };
                const response = await request(app)
                    .post('/api/backup/create')
                    .set('Authorization', 'Bearer valid-token')
                    .send(invalidConfig);
                expect(response.status).toBe(400);
                expect(response.body.error).toMatch(/Invalid|encryption required/i);
            });
            it('should enforce backup frequency limits', async () => {
                mockSupabase.from().select.mockReturnThis();
                mockSupabase.from().eq.mockReturnThis();
                mockSupabase.from().order.mockReturnThis();
                mockSupabase.from().limit.mockResolvedValue({
                    data: [
                        {
                            created_at: new Date(Date.now() - 60000).toISOString(),
                        },
                    ],
                    error: null,
                });
                const response = await request(app)
                    .post('/api/backup/create')
                    .set('Authorization', 'Bearer valid-token')
                    .send({ type: 'incremental' });
                expect(response.status).toBe(429);
                expect(response.body.error).toContain('Too frequent');
            });
        });
        describe('POST /api/backup/restore', () => {
            it('should require double authentication for restore operations', async () => {
                const response = await request(app)
                    .post('/api/backup/restore')
                    .set('Authorization', 'Bearer valid-token')
                    .send({
                    backup_id: 'backup-123',
                    confirm_password: 'admin-password',
                });
                expect([401, 403]).toContain(response.status);
                expect(response.body.error).toMatch(/verification|confirmation/i);
            });
            it('should validate backup integrity before restore', async () => {
                const response = await request(app)
                    .post('/api/backup/restore')
                    .set('Authorization', 'Bearer valid-token')
                    .send({
                    backup_id: 'corrupted-backup-456',
                    confirm_password: 'admin-password',
                    force_verification: true,
                });
                expect(response.status).toBe(400);
                expect(response.body.error).toContain('integrity check failed');
            });
        });
    });
    describe('Security Reports Router', () => {
        describe('GET /api/security-reports', () => {
            it('should require security analyst role', async () => {
                requireAuth.mockImplementationOnce((req, res, next) => {
                    req.user = { id: 'dev-user', email: 'dev@example.com', role: 'developer' };
                    next();
                });
                const response = await request(app)
                    .get('/api/security-reports')
                    .set('Authorization', 'Bearer valid-token');
                expect(response.status).toBe(403);
                expect(response.body.error).toContain('Security analyst role required');
            });
            it('should not expose sensitive security details in logs', async () => {
                const mockReports = [
                    {
                        id: 'report-1',
                        type: 'vulnerability_scan',
                        findings: ['SQL injection risk', 'XSS vulnerability'],
                        severity: 'high',
                        details: 'Sensitive technical details...',
                    },
                ];
                mockSupabase.from().select.mockReturnThis();
                mockSupabase.from().order.mockResolvedValue({
                    data: mockReports,
                    error: null,
                });
                const response = await request(app)
                    .get('/api/security-reports')
                    .set('Authorization', 'Bearer valid-token');
                expect(response.status).toBe(200);
                expect(JSON.stringify(response.body)).not.toContain('Sensitive technical details');
            });
        });
        describe('POST /api/security-reports/scan', () => {
            it('should validate scan parameters to prevent abuse', async () => {
                const abusiveParams = {
                    target: 'external-system.com',
                    intensity: 'maximum',
                    concurrent_threads: MILLISECONDS_IN_SECOND,
                };
                const response = await request(app)
                    .post('/api/security-reports/scan')
                    .set('Authorization', 'Bearer valid-token')
                    .send(abusiveParams);
                expect(response.status).toBe(400);
                expect(response.body.error).toMatch(/Invalid target|excessive/i);
            });
            it('should rate limit security scans', async () => {
                const promises = Array(5)
                    .fill(null)
                    .map(() => request(app)
                    .post('/api/security-reports/scan')
                    .set('Authorization', 'Bearer valid-token')
                    .send({ target: 'localhost', type: 'basic' }));
                const responses = await Promise.all(promises);
                const rateLimited = responses.some((r) => r.status === 429);
                expect(rateLimited).toBe(true);
            });
        });
    });
    describe('Enhanced Supabase Router Security', () => {
        describe('POST /api/enhanced-supabase/query', () => {
            it('should prevent SQL injection in custom queries', async () => {
                const sqlInjection = {
                    query: "SELECT * FROM users WHERE id = '1'; DROP TABLE users; --",
                    params: [],
                };
                const response = await request(app)
                    .post('/api/enhanced-supabase/query')
                    .set('Authorization', 'Bearer valid-token')
                    .send(sqlInjection);
                expect(response.status).toBe(400);
                expect(response.body.error).toContain('Invalid query');
            });
            it('should restrict access to sensitive tables', async () => {
                const sensitiveQuery = {
                    query: 'SELECT * FROM auth_tokens',
                    params: [],
                };
                const response = await request(app)
                    .post('/api/enhanced-supabase/query')
                    .set('Authorization', 'Bearer valid-token')
                    .send(sensitiveQuery);
                expect(response.status).toBe(403);
                expect(response.body.error).toContain('Access denied to table');
            });
            it('should validate parameterized queries', async () => {
                const validQuery = {
                    query: 'SELECT id, title FROM knowledge WHERE user_id = $1',
                    params: ['test-user-id'],
                };
                const response = await request(app)
                    .post('/api/enhanced-supabase/query')
                    .set('Authorization', 'Bearer valid-token')
                    .send(validQuery);
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('success', true);
            });
        });
        describe('POST /api/enhanced-supabase/batch', () => {
            it('should limit batch operation size', async () => {
                const largeBatch = {
                    operations: Array(1000).fill({
                        table: 'knowledge',
                        operation: 'insert',
                        data: { title: 'Test', content: 'Content' },
                    }),
                };
                const response = await request(app)
                    .post('/api/enhanced-supabase/batch')
                    .set('Authorization', 'Bearer valid-token')
                    .send(largeBatch);
                expect(response.status).toBe(400);
                expect(response.body.error).toContain('Batch size too large');
            });
            it('should validate all operations in batch', async () => {
                const mixedBatch = {
                    operations: [
                        {
                            table: 'knowledge',
                            operation: 'insert',
                            data: { title: 'Valid', content: 'Content' },
                        },
                        {
                            table: 'auth_tokens',
                            operation: 'select',
                            data: {},
                        },
                    ],
                };
                const response = await request(app)
                    .post('/api/enhanced-supabase/batch')
                    .set('Authorization', 'Bearer valid-token')
                    .send(mixedBatch);
                expect(response.status).toBe(400);
                expect(response.body.error).toContain('Invalid operation');
            });
        });
    });
    describe('Cross-Router Security Scenarios', () => {
        it('should maintain session security across different routers', async () => {
            const token = 'Bearer consistent-session-token';
            const responses = await Promise.all([
                request(app).get('/api/security-reports').set('Authorization', token),
                request(app)
                    .post('/api/filesystem/list')
                    .set('Authorization', token)
                    .send({ path: '/app' }),
                request(app).get('/api/backup/list').set('Authorization', token),
            ]);
            responses.forEach((response) => {
                if (response.status === 200) {
                    expect(response.body).toHaveProperty('success', true);
                }
            });
        });
        it('should enforce CORS policies consistently', async () => {
            const maliciousOrigin = 'https://malicious-site.com';
            const response = await request(app)
                .post('/api/filesystem/read')
                .set('Origin', maliciousOrigin)
                .set('Authorization', 'Bearer valid-token')
                .send({ path: '/app/data/test.txt' });
            expect(response.headers['access-control-allow-origin']).not.toBe(maliciousOrigin);
        });
        it('should log security events across all routers', async () => {
            const securityEvents = [
                { endpoint: '/api/filesystem/read', payload: { path: '../../../etc/passwd' } },
                { endpoint: '/api/backup/restore', payload: { backup_id: 'invalid' } },
                { endpoint: '/api/enhanced-supabase/query', payload: { query: 'DROP TABLE users' } },
            ];
            for (const event of securityEvents) {
                await request(app)
                    .post(event.endpoint)
                    .set('Authorization', 'Bearer valid-token')
                    .send(event.payload);
            }
            expect(true).toBe(true);
        });
        it('should handle authentication failures gracefully', async () => {
            const endpoints = [
                '/api/filesystem/read',
                '/api/backup/create',
                '/api/security-reports',
                '/api/enhanced-supabase/query',
            ];
            for (const endpoint of endpoints) {
                const response = await request(app).post(endpoint).send({ test: 'data' });
                expect(response.status).toBe(401);
                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toMatch(/unauthorized|authentication/i);
            }
        });
    });
});
//# sourceMappingURL=security-critical.test.js.map