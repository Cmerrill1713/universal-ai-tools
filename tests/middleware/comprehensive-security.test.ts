import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Set up test environment first
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock external dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
  })),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    disconnect: jest.fn(),
  }));
});

// Import middleware after mocking
import { rateLimiter } from '../../src/middleware/rate-limiter';
import { validateRequest } from '../../src/middleware/request-validation';
import { securityMiddleware } from '../../src/middleware/security';
import { requireAuth } from '../../src/middleware/auth-jwt';

describe('Comprehensive Security Middleware Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rate Limiter Middleware', () => {
    beforeEach(() => {
      app.use('/api/test', rateLimiter);
      app.get('/api/test', (req, res) => {
        res.json({ success: true, message: 'Request processed' });
      });
    });

    it('should allow requests within rate limit', async () => {
      const response = await request(app).get('/api/test').set('X-Forwarded-For', '192.168.1.100');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/api/test').set('X-Forwarded-For', '192.168.1.101');

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should block requests exceeding rate limit', async () => {
      const ip = '192.168.1.102';

      // Make multiple requests rapidly
      const promises = Array(20)
        .fill(null)
        .map(() => request(app).get('/api/test').set('X-Forwarded-For', ip));

      const responses = await Promise.all(promises);

      // Some should be rate limited
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should handle different IPs independently', async () => {
      const ip1 = '192.168.1.103';
      const ip2 = '192.168.1.104';

      const response1 = await request(app).get('/api/test').set('X-Forwarded-For', ip1);

      const response2 = await request(app).get('/api/test').set('X-Forwarded-For', ip2);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });

  describe('Request Validation Middleware', () => {
    const validationRules = {
      body: {
        name: { type: 'string', required: true, min: TWO, max: 50 },
        email: { type: 'string', required: true, pattern: /^[^s@]+@[^s@]+.[^s@]+$/ },
        age: { type: 'number', required: false, min: 0, max: 120 },
      },
    };

    beforeEach(() => {
      app.post('/api/test', validateRequest(validationRules), (req, res) => {
        res.json({ success: true, data: req.body });
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app).post('/api/test').send({
        // Missing required name and email
        age: 25,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should validate field types', async () => {
      const response = await request(app).post('/api/test').send({
        name: 'John Doe',
        email: 'john@example.com',
        age: 'invalid-age', // Should be number
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('type');
    });

    it('should validate string length constraints', async () => {
      const response = await request(app).post('/api/test').send({
        name: 'J', // Too short (min: TWO)
        email: 'john@example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('length');
    });

    it('should validate email pattern', async () => {
      const response = await request(app).post('/api/test').send({
        name: 'John Doe',
        email: 'invalid-email', // Doesn't match pattern
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('pattern');
    });

    it('should validate number ranges', async () => {
      const response = await request(app).post('/api/test').send({
        name: 'John Doe',
        email: 'john@example.com',
        age: 150, // Exceeds max (120)
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('range');
    });

    it('should allow valid requests', async () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      const response = await request(app).post('/api/test').send(validData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual(validData);
    });

    it('should sanitize XSS attempts', async () => {
      const maliciousData = {
        name: 'John<script>alert("XSS")</script>',
        email: 'john@example.com',
      };

      const response = await request(app).post('/api/test').send(maliciousData);

      if (response.status === 200) {
        expect(response.body.data.name).not.toContain('<script>');
      } else {
        expect(response.status).toBe(400);
      }
    });
  });

  describe('Security Middleware', () => {
    beforeEach(() => {
      app.use('/api/test', securityMiddleware);
      app.post('/api/test', (req, res) => {
        res.json({ success: true, headers: req.headers });
      });
    });

    it('should set security headers', async () => {
      const response = await request(app).post('/api/test').send({ test: 'data' });

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should sanitize SQL injection attempts', async () => {
      const sqlInjection = {
        query: "'; DROP TABLE users; --",
        search: "' OR '1'='1",
      };

      const response = await request(app).post('/api/test').send(sqlInjection);

      // Should either sanitize or reject
      if (response.status === 200) {
        expect(JSON.stringify(response.body)).not.toContain('DROP TABLE');
        expect(JSON.stringify(response.body)).not.toContain("'1'='1");
      } else {
        expect(response.status).toBe(400);
      }
    });

    it('should prevent NoSQL injection', async () => {
      const nosqlInjection = {
        user: { $ne: null },
        password: { $regex: '.*' },
      };

      const response = await request(app).post('/api/test').send(nosqlInjection);

      // Should reject or sanitize NoSQL operators
      if (response.status === 200) {
        expect(JSON.stringify(response.body)).not.toContain('$ne');
        expect(JSON.stringify(response.body)).not.toContain('$regex');
      } else {
        expect(response.status).toBe(400);
      }
    });

    it('should limit request size', async () => {
      const largePayload = {
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB
      };

      const response = await request(app).post('/api/test').send(largePayload);

      expect(response.status).toBe(413); // Payload too large
    });

    it('should validate Content-Type', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('data=test');

      // Should only accept JSON for API endpoints
      expect([400, 415]).toContain(response.status);
    });
  });

  describe('JWT Authentication Middleware', () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user',
    };

    beforeEach(() => {
      app.use('/api/test', requireAuth);
      app.get('/api/test', (req, res) => {
        res.json({ success: true, user: req.user });
      });

      // Mock successful auth
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should reject requests without Authorization header', async () => {
      const response = await request(app).get('/api/test');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Authorization header required');
    });

    it('should reject invalid Authorization format', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Bearer');
    });

    it('should reject expired tokens', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: null,
        error: { message: 'Token expired' },
      });

      const response = await request(app)
        .get('/api/test')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('expired');
    });

    it('should accept valid tokens', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toEqual(mockUser);
    });

    it('should handle malformed tokens gracefully', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Authorization', 'Bearer malformed..token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate token signature', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid signature' },
      });

      const response = await request(app)
        .get('/api/test')
        .set('Authorization', 'Bearer invalid-signature-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('Middleware Chain Integration', () => {
    beforeEach(() => {
      // Apply full middleware chain
      app.use(
        '/api/secure',
        rateLimiter,
        securityMiddleware,
        requireAuth,
        validateRequest({
          body: {
            action: { type: 'string', required: true },
          },
        })
      );

      app.post('/api/secure', (req, res) => {
        res.json({
          success: true,
          message: 'Passed all security checks',
          user: req.user,
          body: req.body,
        });
      });

      // Mock authentication
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should pass valid request through all middleware', async () => {
      const response = await request(app)
        .post('/api/secure')
        .set('Authorization', 'Bearer valid-token')
        .set('X-Forwarded-For', '192.168.1.200')
        .send({ action: 'test-action' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
    });

    it('should fail at rate limiting', async () => {
      const ip = '192.168.1.201';

      // Exhaust rate limit
      const promises = Array(25)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/secure')
            .set('Authorization', 'Bearer valid-token')
            .set('X-Forwarded-For', ip)
            .send({ action: 'test-action' })
        );

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should fail at authentication', async () => {
      const response = await request(app)
        .post('/api/secure')
        .set('X-Forwarded-For', '192.168.1.202')
        .send({ action: 'test-action' });

      expect(response.status).toBe(401);
    });

    it('should fail at validation', async () => {
      const response = await request(app)
        .post('/api/secure')
        .set('Authorization', 'Bearer valid-token')
        .set('X-Forwarded-For', '192.168.1.203')
        .send({
          /* missing required action */
        });

      expect(response.status).toBe(400);
    });

    it('should handle middleware errors gracefully', async () => {
      // Mock middleware error
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      mockSupabase.auth.getUser.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/secure')
        .set('Authorization', 'Bearer valid-token')
        .set('X-Forwarded-For', '192.168.1.204')
        .send({ action: 'test-action' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security Edge Cases', () => {
    beforeEach(() => {
      app.use('/api/edge', securityMiddleware, (req, res) => {
        res.json({ success: true, body: req.body });
      });
    });

    it('should handle empty request body', async () => {
      const response = await request(app).post('/api/edge').send();

      expect(response.status).toBe(200);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/edge')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should handle deeply nested objects', async () => {
      const deeplyNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  data: 'deep',
                },
              },
            },
          },
        },
      };

      const response = await request(app).post('/api/edge').send(deeplyNested);

      expect(response.status).toBe(200);
    });

    it('should handle special characters', async () => {
      const specialChars = {
        unicode: '👍🔒🛡️',
        symbols: '!@#$%^&*()',
        quotes: '"\'`',
        backslashes: '\\n\\t\\r',
      };

      const response = await request(app).post('/api/edge').send(specialChars);

      expect(response.status).toBe(200);
    });

    it('should handle null and undefined values', async () => {
      const nullValues = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zeroNumber: 0,
        falseBoolean: false,
      };

      const response = await request(app).post('/api/edge').send(nullValues);

      expect(response.status).toBe(200);
    });
  });
});
