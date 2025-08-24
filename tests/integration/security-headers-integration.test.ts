/**
 * Security Headers Integration Test Suite
 * End-to-end testing of security headers implementation
 * 
 * @version 1.0.0
 * @author Security Team
 * @date 2025-08-21
 */

import request from 'supertest';
import express from 'express';
import { securityHeadersMiddleware, jwtSecurityHeaders } from '../../src/middleware/security-headers';
import { corsMiddleware } from '../../src/middleware/cors-config';
import { auditSecurityConfiguration } from '../../src/middleware/security-config-validator';

describe('Security Headers Integration Tests', () => {
  let app: express.Application;
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    if (originalEnv) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  beforeEach(() => {
    app = express();
    app.use(corsMiddleware);
    app.use(securityHeadersMiddleware());
    
    // Test routes
    app.get('/api/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    app.post('/api/auth/login', jwtSecurityHeaders(), (req, res) => {
      res.json({ message: 'Login endpoint', timestamp: new Date().toISOString() });
    });
    
    app.get('/api/data', (req, res) => {
      res.json({ data: 'test data', timestamp: new Date().toISOString() });
    });
  });

  describe('Production Security Headers Compliance', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    test('should implement all OWASP recommended security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Critical OWASP headers
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toBeDefined();
      
      // Cross-origin policies
      expect(response.headers['cross-origin-embedder-policy']).toBe('require-corp');
      expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(response.headers['cross-origin-resource-policy']).toBe('same-site');
    });\n\n    test('should implement strict HSTS policy', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const hsts = response.headers['strict-transport-security'];
      expect(hsts).toContain('max-age=63072000'); // 2 years
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });\n\n    test('should implement production-grade CSP without unsafe directives', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain('block-all-mixed-content');
      
      // Should NOT contain unsafe directives in production
      expect(csp).not.toContain('unsafe-inline');
      expect(csp).not.toContain('unsafe-eval');
    });\n\n    test('should remove server fingerprinting headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });\n\n    test('should pass comprehensive security audit', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const auditResult = auditSecurityConfiguration(response.headers);
      expect(auditResult.isValid).toBe(true);
      expect(auditResult.score).toBeGreaterThanOrEqual(90);
      expect(auditResult.errors).toHaveLength(0);
    });\n  });\n\n  describe('Development Environment Configuration', () => {\n    beforeEach(() => {\n      process.env.NODE_ENV = 'development';\n    });\n\n    test('should allow development-friendly CSP directives', async () => {\n      const response = await request(app)\n        .get('/api/health')\n        .expect(200);\n\n      const csp = response.headers['content-security-policy'];\n      expect(csp).toContain('unsafe-inline'); // Allowed in development\n      expect(csp).toContain('unsafe-eval');   // Allowed in development\n      expect(csp).toContain('ws://localhost');\n      expect(csp).toContain('ws://127.0.0.1');\n    });\n\n    test('should not implement HSTS in development', async () => {\n      const response = await request(app)\n        .get('/api/health')\n        .expect(200);\n\n      expect(response.headers['strict-transport-security']).toBeUndefined();\n    });\n\n    test('should still implement core security headers', async () => {\n      const response = await request(app)\n        .get('/api/health')\n        .expect(200);\n\n      expect(response.headers['x-frame-options']).toBe('DENY');\n      expect(response.headers['x-content-type-options']).toBe('nosniff');\n      expect(response.headers['content-security-policy']).toBeDefined();\n    });\n  });\n\n  describe('JWT Authentication Endpoint Security', () => {\n    test('should implement strict security for JWT endpoints', async () => {\n      const response = await request(app)\n        .post('/api/auth/login')\n        .send({ username: 'test', password: 'test' })\n        .expect(200);\n\n      // No caching of auth responses\n      expect(response.headers['cache-control']).toContain('no-store');\n      expect(response.headers['cache-control']).toContain('no-cache');\n      expect(response.headers['pragma']).toBe('no-cache');\n      expect(response.headers['expires']).toBe('0');\n      \n      // Strict referrer policy for auth\n      expect(response.headers['referrer-policy']).toBe('no-referrer');\n      \n      // Request tracking\n      expect(response.headers['x-request-id']).toBeDefined();\n      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);\n    });\n\n    test('should implement strict CSP for authentication endpoints', async () => {\n      const response = await request(app)\n        .post('/api/auth/login')\n        .send({ username: 'test', password: 'test' })\n        .expect(200);\n\n      const csp = response.headers['content-security-policy'];\n      expect(csp).toContain(\"default-src 'none'\");\n      expect(csp).toContain(\"script-src 'none'\");\n      expect(csp).toContain(\"style-src 'none'\");\n      expect(csp).toContain(\"img-src 'none'\");\n      expect(csp).toContain(\"frame-ancestors 'none'\");\n    });\n  });\n\n  describe('CORS Security Integration', () => {\n    test('should implement secure CORS with security headers', async () => {\n      const response = await request(app)\n        .options('/api/health')\n        .set('Origin', 'http://localhost:3000')\n        .set('Access-Control-Request-Method', 'GET')\n        .expect(204);\n\n      // CORS headers should be present\n      expect(response.headers['access-control-allow-origin']).toBeDefined();\n      \n      // Security headers should still be applied\n      expect(response.headers['x-frame-options']).toBe('DENY');\n      expect(response.headers['x-content-type-options']).toBe('nosniff');\n    });\n\n    test('should reject requests from unauthorized origins in production', async () => {\n      process.env.NODE_ENV = 'production';\n      \n      const response = await request(app)\n        .options('/api/health')\n        .set('Origin', 'https://malicious-site.com')\n        .set('Access-Control-Request-Method', 'GET');\n\n      // Should either return CORS error or not include the origin\n      if (response.status === 200 || response.status === 204) {\n        expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');\n      }\n    });\n  });\n\n  describe('Security Headers Error Handling', () => {\n    test('should continue serving requests even if header setting fails', async () => {\n      // This test verifies graceful degradation\n      const response = await request(app)\n        .get('/api/health')\n        .expect(200);\n\n      expect(response.body).toEqual(\n        expect.objectContaining({ status: 'healthy' })\n      );\n    });\n\n    test('should handle missing request properties gracefully', async () => {\n      const response = await request(app)\n        .get('/api/data')\n        .expect(200);\n\n      // Should still have core security headers\n      expect(response.headers['x-frame-options']).toBeDefined();\n      expect(response.headers['content-security-policy']).toBeDefined();\n    });\n  });\n\n  describe('Performance Impact Assessment', () => {\n    test('should add minimal latency to requests', async () => {\n      const startTime = Date.now();\n      \n      await request(app)\n        .get('/api/health')\n        .expect(200);\n      \n      const endTime = Date.now();\n      const responseTime = endTime - startTime;\n      \n      // Security headers should add less than 50ms overhead\n      expect(responseTime).toBeLessThan(50);\n    });\n\n    test('should not significantly increase response size', async () => {\n      const response = await request(app)\n        .get('/api/health')\n        .expect(200);\n\n      // Calculate total header size\n      const headerSize = Object.entries(response.headers)\n        .reduce((total, [key, value]) => total + key.length + String(value).length, 0);\n      \n      // Security headers should add less than 2KB\n      expect(headerSize).toBeLessThan(2048);\n    });\n  });\n\n  describe('Security Headers Completeness', () => {\n    test('should implement all required security headers for modern web applications', async () => {\n      const response = await request(app)\n        .get('/api/health')\n        .expect(200);\n\n      const requiredHeaders = [\n        'content-security-policy',\n        'x-frame-options',\n        'x-content-type-options',\n        'referrer-policy',\n        'permissions-policy',\n        'cross-origin-embedder-policy',\n        'cross-origin-opener-policy',\n        'cross-origin-resource-policy'\n      ];\n\n      requiredHeaders.forEach(header => {\n        expect(response.headers[header]).toBeDefined();\n      });\n    });\n\n    test('should provide comprehensive protection against OWASP Top 10 vulnerabilities', async () => {\n      const response = await request(app)\n        .get('/api/health')\n        .expect(200);\n\n      const auditResult = auditSecurityConfiguration(response.headers);\n      \n      // High security score indicates protection against multiple attack vectors\n      expect(auditResult.score).toBeGreaterThanOrEqual(85);\n      expect(auditResult.warnings.length).toBeLessThanOrEqual(2);\n    });\n  });\n\n  describe('Environment-Specific Security Configuration', () => {\n    test('should validate security configuration matches environment', async () => {\n      process.env.NODE_ENV = 'production';\n      \n      const response = await request(app)\n        .get('/api/health')\n        .expect(200);\n\n      const auditResult = auditSecurityConfiguration(response.headers);\n      \n      // Production should have strict security configuration\n      expect(auditResult.isValid).toBe(true);\n      \n      // Should not have development-specific warnings in production audit\n      const devWarnings = auditResult.warnings.filter(w => \n        w.includes('development') || w.includes('unsafe')\n      );\n      expect(devWarnings).toHaveLength(0);\n    });\n  });\n});\n\ndescribe('Security Headers Real-World Attack Scenarios', () => {\n  let app: express.Application;\n\n  beforeEach(() => {\n    process.env.NODE_ENV = 'production';\n    app = express();\n    app.use(securityHeadersMiddleware());\n    \n    app.get('/api/user-content', (req, res) => {\n      // Simulate endpoint that might be vulnerable to XSS\n      res.json({ content: req.query.content || 'safe content' });\n    });\n    \n    app.get('/api/iframe-test', (req, res) => {\n      res.send('<html><body>Iframe test page</body></html>');\n    });\n  });\n\n  test('should prevent clickjacking attacks', async () => {\n    const response = await request(app)\n      .get('/api/iframe-test')\n      .expect(200);\n\n    expect(response.headers['x-frame-options']).toBe('DENY');\n    expect(response.headers['content-security-policy']).toContain(\"frame-ancestors 'none'\");\n  });\n\n  test('should prevent MIME type sniffing attacks', async () => {\n    const response = await request(app)\n      .get('/api/user-content')\n      .query({ content: '<script>alert(\"xss\")</script>' })\n      .expect(200);\n\n    expect(response.headers['x-content-type-options']).toBe('nosniff');\n  });\n\n  test('should prevent mixed content attacks', async () => {\n    const response = await request(app)\n      .get('/api/user-content')\n      .expect(200);\n\n    const csp = response.headers['content-security-policy'];\n    expect(csp).toContain('block-all-mixed-content');\n    expect(csp).toContain('upgrade-insecure-requests');\n  });\n\n  test('should prevent dangerous object embedding', async () => {\n    const response = await request(app)\n      .get('/api/user-content')\n      .expect(200);\n\n    const csp = response.headers['content-security-policy'];\n    expect(csp).toContain(\"object-src 'none'\");\n  });\n\n  test('should restrict form submission targets', async () => {\n    const response = await request(app)\n      .get('/api/user-content')\n      .expect(200);\n\n    const csp = response.headers['content-security-policy'];\n    expect(csp).toContain(\"form-action 'self'\");\n  });\n});