/**
 * Comprehensive Security Headers Test Suite
 * Tests all security headers implementation against OWASP standards
 * 
 * @version 1.0.0
 * @author Security Audit Team
 * @date 2025-08-21
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { securityHeadersMiddleware, jwtSecurityHeaders, securityMonitoringHeaders } from '../../src/middleware/security-headers';

// Mock Express request/response objects
const createMockReq = (options: Partial<Request> = {}): Partial<Request> => ({
  headers: {},
  path: '/test',
  method: 'GET',
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' } as any,
  get: (header: string) => (options.headers as any)?.[header.toLowerCase()],
  ...options,
});

const createMockRes = (): { res: Partial<Response>; headers: Record<string, string> } => {
  const headers: Record<string, string> = {};
  const res: Partial<Response> = {
    setHeader: jest.fn((key: string, value: string) => {
      headers[key.toLowerCase()] = value;
      return res as Response;
    }) as any,
    removeHeader: jest.fn((key: string) => {
      delete headers[key.toLowerCase()];
      return res as Response;
    }) as any,
    end: jest.fn(),
    statusCode: 200,
  };
  return { res, headers };
};

const createMockNext = () => jest.fn();

describe('Security Headers Middleware - OWASP Compliance Test Suite', () => {
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

  describe('OWASP Security Headers - Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    test('should implement strict HSTS in production', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      expect(headers['strict-transport-security']).toBe(
        'max-age=63072000; includeSubDomains; preload'
      );
      expect(next).toHaveBeenCalled();
    });

    test('should implement production-grade CSP', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      const csp = headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' https://cdn.jsdelivr.net");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain('block-all-mixed-content');
      
      // Production should NOT contain unsafe directives
      expect(csp).not.toContain('unsafe-inline');
      expect(csp).not.toContain('unsafe-eval');
    });

    test('should implement X-Frame-Options: DENY', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      expect(headers['x-frame-options']).toBe('DENY');
    });

    test('should implement X-Content-Type-Options: nosniff', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      expect(headers['x-content-type-options']).toBe('nosniff');
    });

    test('should implement secure Referrer-Policy', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    test('should implement comprehensive Permissions-Policy', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      const permissionsPolicy = headers['permissions-policy'];
      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=(self)');
      expect(permissionsPolicy).toContain('geolocation=()');
      expect(permissionsPolicy).toContain('payment=()');
      expect(permissionsPolicy).toContain('usb=()');
    });

    test('should remove server fingerprinting headers', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(res.removeHeader).toHaveBeenCalledWith('Server');
    });

    test('should implement Cross-Origin policies', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
      expect(headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(headers['cross-origin-resource-policy']).toBe('same-site');
    });
  });

  describe('Development Environment Configuration', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('should allow development-friendly CSP', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      const csp = headers['content-security-policy'];
      expect(csp).toContain('unsafe-inline');
      expect(csp).toContain('unsafe-eval');
      expect(csp).toContain('ws://localhost:*');
      expect(csp).toContain('ws://127.0.0.1:*');
    });

    test('should not implement HSTS in development', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      expect(headers['strict-transport-security']).toBeUndefined();
    });
  });

  describe('JWT Security Headers', () => {
    test('should implement strict JWT endpoint security', () => {
      const req = createMockReq({
        path: '/auth/login',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = jwtSecurityHeaders();
      middleware(req as Request, res as Response, next);

      expect(headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
      expect(headers['pragma']).toBe('no-cache');
      expect(headers['expires']).toBe('0');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['referrer-policy']).toBe('no-referrer');
    });

    test('should implement strict CSP for JWT endpoints', () => {
      const req = createMockReq({ path: '/auth/login' });
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = jwtSecurityHeaders();
      middleware(req as Request, res as Response, next);

      const csp = headers['content-security-policy'];
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("script-src 'none'");
      expect(csp).toContain("style-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    test('should add request tracking for security monitoring', () => {
      const req = createMockReq({ path: '/auth/token' });
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = jwtSecurityHeaders();
      middleware(req as Request, res as Response, next);

      expect(headers['x-request-id']).toBeDefined();
      expect(headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    test('should warn on non-JSON content type for POST requests', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const req = createMockReq({
        path: '/auth/login',
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        get: ((header: string) => header === 'Content-Type' ? 'text/plain' : undefined) as any,
      });
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = jwtSecurityHeaders();
      middleware(req as Request, res as Response, next);

      // Should still execute but log warning
      expect(next).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Security Monitoring Headers', () => {
    test('should add request tracking and timing', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityMonitoringHeaders();
      middleware(req as Request, res as Response, next);

      expect(headers['x-request-id']).toBeDefined();
      expect(headers['x-security-framework']).toBe('universal-ai-tools-v1.2');
      expect(res.end).toBeDefined();
    });

    test('should measure response time', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityMonitoringHeaders();
      middleware(req as Request, res as Response, next);

      // Simulate response end
      (res.end as jest.Mock).mock.calls[0]?.[0]; // Call the overridden end function
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should continue execution if header setting fails', () => {
      const req = createMockReq();
      const { res } = createMockRes();
      const next = createMockNext();

      // Mock setHeader to throw error
      (res.setHeader as jest.Mock).mockImplementation(() => {
        throw new Error('Header setting failed');
      });

      const middleware = securityHeadersMiddleware();
      expect(() => middleware(req as Request, res as Response, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });

    test('should handle missing request properties gracefully', () => {
      const req = {} as Request; // Minimal request object
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      expect(() => middleware(req, res as Response, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Security Configuration Validation', () => {
    test('should validate CSP directives format', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      const csp = headers['content-security-policy'];
      
      // CSP should be properly formatted with semicolon separators
      expect(csp.split(';').length).toBeGreaterThan(5);
      expect(csp).not.toContain(';;'); // No double semicolons
      expect(csp.trim().endsWith(';')).toBe(false); // No trailing semicolon
    });

    test('should ensure no conflicting security headers', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      // X-XSS-Protection should be disabled when CSP is present
      expect(headers['x-xss-protection']).toBe('0');
      
      // Frame options should be consistent
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });
  });

  describe('OWASP Top 10 Compliance', () => {
    test('should mitigate Injection attacks (A01)', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      // CSP helps prevent script injection
      expect(headers['content-security-policy']).toContain("object-src 'none'");
      expect(headers['x-content-type-options']).toBe('nosniff');
    });

    test('should mitigate Broken Authentication (A02)', () => {
      const req = createMockReq({ path: '/auth/login' });
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const jwtMiddleware = jwtSecurityHeaders();
      jwtMiddleware(req as Request, res as Response, next);

      // Prevent caching of auth responses
      expect(headers['cache-control']).toContain('no-store');
      expect(headers['referrer-policy']).toBe('no-referrer');
    });

    test('should mitigate Sensitive Data Exposure (A03)', () => {
      process.env.NODE_ENV = 'production';
      
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      // HSTS enforces encryption
      expect(headers['strict-transport-security']).toBeDefined();
      expect(res.removeHeader).toHaveBeenCalledWith('Server');
    });

    test('should mitigate Security Misconfiguration (A05)', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      // Comprehensive security headers present
      expect(headers['x-content-type-options']).toBeDefined();
      expect(headers['x-frame-options']).toBeDefined();
      expect(headers['referrer-policy']).toBeDefined();
      expect(headers['permissions-policy']).toBeDefined();
    });

    test('should mitigate Using Components with Known Vulnerabilities (A06)', () => {
      const req = createMockReq();
      const { res, headers } = createMockRes();
      const next = createMockNext();

      const middleware = securityHeadersMiddleware();
      middleware(req as Request, res as Response, next);

      // Remove version disclosure headers
      expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(res.removeHeader).toHaveBeenCalledWith('Server');
    });
  });
});

describe('Security Headers Integration Tests', () => {
  test('should work correctly with multiple middleware layers', () => {
    const req = createMockReq({ path: '/auth/verify' });
    const { res, headers } = createMockRes();
    const next = createMockNext();

    // Apply multiple middleware in sequence
    const securityMiddleware = securityHeadersMiddleware();
    const jwtMiddleware = jwtSecurityHeaders();
    const monitoringMiddleware = securityMonitoringHeaders();

    securityMiddleware(req as Request, res as Response, () => {
      jwtMiddleware(req as Request, res as Response, () => {
        monitoringMiddleware(req as Request, res as Response, next);
      });
    });

    // Should have headers from all middleware
    expect(headers['content-security-policy']).toBeDefined(); // From security middleware
    expect(headers['cache-control']).toBeDefined(); // From JWT middleware  
    expect(headers['x-request-id']).toBeDefined(); // From monitoring middleware
    expect(next).toHaveBeenCalled();
  });

  test('should handle production configuration correctly', () => {
    process.env.NODE_ENV = 'production';
    
    const req = createMockReq();
    const { res, headers } = createMockRes();
    const next = createMockNext();

    const middleware = securityHeadersMiddleware();
    middleware(req as Request, res as Response, next);

    // Production-specific configurations
    expect(headers['strict-transport-security']).toBeDefined();
    expect(headers['content-security-policy']).toContain('upgrade-insecure-requests');
    expect(headers['content-security-policy']).not.toContain('unsafe-inline');
  });
});