import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import authRouter from '../../src/routers/auth';
import { requireAuth } from '../../src/middleware/auth-jwt';
import { rateLimiter } from '../../src/middleware/rate-limiter';
jest.mock('@supabase/supabase-js');
jest.mock('../../src/middleware/auth-jwt');
jest.mock('../../src/middleware/rate-limiter');
jest.mock('../../src/services/secure-token-storage');
const mockSupabase = {
    auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
        getUser: jest.fn(),
        updateUser: jest.fn(),
    },
    from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
    })),
};
describe('Auth Router', () => {
    let app;
    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRouter);
        jest.clearAllMocks();
        createClient.mockReturnValue(mockSupabase);
        requireAuth.mockImplementation((req, res, next) => {
            req.user = { id: 'test-user-id', email: 'test@example.com' };
            next();
        });
        rateLimiter.mockImplementation((req, res, next) => next());
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const newUser = {
                email: 'newuser@example.com',
                password: 'SecurePass123!',
                username: 'newuser',
            };
            mockSupabase.auth.signUp.mockResolvedValue({
                data: {
                    user: { id: 'new-user-id', email: newUser.email },
                    session: { access_token: 'new-access-token' },
                },
                error: null,
            });
            const response = await request(app).post('/api/auth/register').send(newUser);
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data.user');
            expect(response.body.data.user.email).toBe(newUser.email);
            expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
                email: newUser.email,
                password: newUser.password,
                options: {
                    data: { username: newUser.username },
                },
            });
        });
        it('should reject registration with weak password', async () => {
            const newUser = {
                email: 'newuser@example.com',
                password: 'weak',
                username: 'newuser',
            };
            const response = await request(app).post('/api/auth/register').send(newUser);
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('password');
        });
        it('should reject registration with invalid email', async () => {
            const newUser = {
                email: 'invalid-email',
                password: 'SecurePass123!',
                username: 'newuser',
            };
            const response = await request(app).post('/api/auth/register').send(newUser);
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('email');
        });
        it('should handle duplicate email registration', async () => {
            mockSupabase.auth.signUp.mockResolvedValue({
                data: null,
                error: { message: 'User already registered' },
            });
            const response = await request(app).post('/api/auth/register').send({
                email: 'existing@example.com',
                password: 'SecurePass123!',
                username: 'existing',
            });
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('already registered');
        });
    });
    describe('POST /api/auth/login', () => {
        it('should login successfully with valid credentials', async () => {
            const credentials = {
                email: 'user@example.com',
                password: 'ValidPass123!',
            };
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: {
                    user: { id: 'user-id', email: credentials.email },
                    session: {
                        access_token: 'access-token',
                        refresh_token: 'refresh-token',
                    },
                },
                error: null,
            });
            const response = await request(app).post('/api/auth/login').send(credentials);
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data.token');
            expect(response.body).toHaveProperty('data.user');
            expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith(credentials);
        });
        it('should reject login with invalid credentials', async () => {
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: null,
                error: { message: 'Invalid login credentials' },
            });
            const response = await request(app).post('/api/auth/login').send({
                email: 'user@example.com',
                password: 'WrongPassword',
            });
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Invalid login credentials');
        });
        it('should enforce rate limiting on login attempts', async () => {
            rateLimiter.mockImplementationOnce((req, res) => {
                res.status(429).json({ error: 'Too many requests' });
            });
            const response = await request(app).post('/api/auth/login').send({
                email: 'user@example.com',
                password: 'password',
            });
            expect(response.status).toBe(429);
            expect(response.body.error).toContain('Too many requests');
        });
    });
    describe('POST /api/auth/refresh', () => {
        it('should refresh token successfully', async () => {
            mockSupabase.auth.refreshSession.mockResolvedValue({
                data: {
                    session: {
                        access_token: 'new-access-token',
                        refresh_token: 'new-refresh-token',
                    },
                    user: { id: 'user-id', email: 'user@example.com' },
                },
                error: null,
            });
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refresh_token: 'old-refresh-token' });
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data.token', 'new-access-token');
            expect(response.body).toHaveProperty('data.refresh_token', 'new-refresh-token');
        });
        it('should reject invalid refresh token', async () => {
            mockSupabase.auth.refreshSession.mockResolvedValue({
                data: null,
                error: { message: 'Invalid refresh token' },
            });
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refresh_token: 'invalid-token' });
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
    });
    describe('POST /api/auth/logout', () => {
        it('should logout current session successfully', async () => {
            mockSupabase.auth.signOut.mockResolvedValue({ error: null });
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
            expect(mockSupabase.auth.signOut).toHaveBeenCalled();
        });
        it('should require authentication for logout', async () => {
            requireAuth.mockImplementationOnce((req, res) => {
                res.status(401).json({ error: 'Unauthorized' });
            });
            const response = await request(app).post('/api/auth/logout');
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });
    describe('POST /api/auth/logout-all', () => {
        it('should logout all sessions successfully', async () => {
            const mockDelete = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({
                delete: mockDelete,
                eq: jest.fn().mockReturnThis(),
            });
            const response = await request(app)
                .post('/api/auth/logout-all')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.message).toContain('All sessions revoked');
        });
    });
    describe('GET /api/auth/sessions', () => {
        it('should return user sessions', async () => {
            const mockSessions = [
                {
                    id: 'session-1',
                    created_at: '2024-01-01T00:00:00Z',
                    last_used: '2024-01-02T00:00:00Z',
                    user_agent: 'Mozilla/5.0',
                    ip_address: '192.168.1.1',
                },
                {
                    id: 'session-2',
                    created_at: '2024-01-03T00:00:00Z',
                    last_used: '2024-01-04T00:00:00Z',
                    user_agent: 'Chrome/96.0',
                    ip_address: '192.168.1.2',
                },
            ];
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: mockSessions, error: null }),
            });
            const response = await request(app)
                .get('/api/auth/sessions')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data[0]).toHaveProperty('id', 'session-1');
        });
    });
    describe('DELETE /api/auth/sessions/:tokenId', () => {
        it('should revoke specific session successfully', async () => {
            mockSupabase.from.mockReturnValue({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                and: jest.fn().mockResolvedValue({ error: null }),
            });
            const response = await request(app)
                .delete('/api/auth/sessions/session-to-revoke')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.message).toContain('Session revoked');
        });
        it('should prevent revoking non-existent session', async () => {
            mockSupabase.from.mockReturnValue({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                and: jest.fn().mockResolvedValue({
                    error: { message: 'Session not found' },
                }),
            });
            const response = await request(app)
                .delete('/api/auth/sessions/non-existent')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
        });
    });
    describe('GET /api/auth/security-info', () => {
        it('should return security information for authenticated user', async () => {
            const mockSecurityInfo = {
                two_factor_enabled: false,
                last_password_change: '2024-01-01T00:00:00Z',
                account_created: '2023-01-01T00:00:00Z',
                failed_login_attempts: 0,
                security_questions_set: true,
            };
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: mockSecurityInfo,
                    error: null,
                }),
            });
            const response = await request(app)
                .get('/api/auth/security-info')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('two_factor_enabled', false);
            expect(response.body.data).toHaveProperty('security_questions_set', true);
        });
    });
    describe('POST /api/auth/change-password', () => {
        it('should change password successfully', async () => {
            const passwordData = {
                current_password: 'OldPass123!',
                new_password: 'NewSecurePass456!',
            };
            mockSupabase.auth.updateUser.mockResolvedValue({
                data: { user: { id: 'user-id' } },
                error: null,
            });
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer valid-token')
                .send(passwordData);
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.message).toContain('Password changed');
        });
        it('should reject weak new password', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer valid-token')
                .send({
                current_password: 'OldPass123!',
                new_password: 'weak',
            });
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('password requirements');
        });
        it('should reject password change with incorrect current password', async () => {
            mockSupabase.auth.updateUser.mockResolvedValue({
                data: null,
                error: { message: 'Invalid current password' },
            });
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer valid-token')
                .send({
                current_password: 'WrongPassword',
                new_password: 'NewSecurePass456!',
            });
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
    });
    describe('GET /api/auth/profile', () => {
        it('should return user profile successfully', async () => {
            const mockProfile = {
                id: 'user-id',
                email: 'user@example.com',
                username: 'testuser',
                created_at: '2023-01-01T00:00:00Z',
                role: 'user',
                email_verified: true,
            };
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockProfile },
                error: null,
            });
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('email', 'user@example.com');
            expect(response.body.data).toHaveProperty('username', 'testuser');
            expect(response.body.data).not.toHaveProperty('password');
        });
        it('should require authentication for profile access', async () => {
            requireAuth.mockImplementationOnce((req, res) => {
                res.status(401).json({ error: 'Unauthorized' });
            });
            const response = await request(app).get('/api/auth/profile');
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });
    describe('Security Scenarios', () => {
        it('should sanitize user input to prevent XSS', async () => {
            const maliciousInput = {
                email: 'test@example.com',
                password: 'ValidPass123!',
                username: '<script>alert("XSS")</script>',
            };
            const response = await request(app).post('/api/auth/register').send(maliciousInput);
            if (response.status === 201) {
                expect(response.body.data.user.username).not.toContain('<script>');
            }
            else {
                expect(response.status).toBe(400);
            }
        });
        it('should handle SQL injection attempts in email field', async () => {
            const sqlInjectionAttempt = {
                email: "admin'--",
                password: 'password',
            };
            const response = await request(app).post('/api/auth/login').send(sqlInjectionAttempt);
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
        it('should enforce maximum request size', async () => {
            const largePayload = {
                email: 'test@example.com',
                password: 'ValidPass123!',
                username: 'a'.repeat(10000),
            };
            const response = await request(app).post('/api/auth/register').send(largePayload);
            expect(response.status).toBe(400);
        });
    });
});
//# sourceMappingURL=auth.test.js.map