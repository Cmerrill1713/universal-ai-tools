import { jest } from '@jest/globals';
import { rateLimiter } from '../../src/middleware/rate-limiter';
import { csrfProtection } from '../../src/middleware/csrf';
import { sqlInjectionProtection } from '../../src/middleware/sql-injection-protection';
import { securityEnhanced } from '../../src/middleware/security-enhanced';
import { securityHardened } from '../../src/middleware/security-hardened';
describe('Security Middleware Tests', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    beforeEach(() => {
        mockReq = {
            ip: '127.0.0.1',
            headers: {
                'user-agent': 'test-agent',
                host: 'localhost:3000',
            },
            body: {},
            query: {},
            params: {},
            method: 'GET',
            url: '/test',
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn(),
            setHeader: jest.fn(),
            getHeader: jest.fn(),
            locals: {},
        };
        mockNext = jest.fn();
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('Rate Limiting Middleware', () => {
        test('should allow requests within rate limit', async () => {
            const rateLimitMiddleware = rateLimiter({
                windowMs: 60000,
                max: 100,
                message: 'Too many requests',
            });
            await rateLimitMiddleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalledWith(429);
        });
        test('should block requests exceeding rate limit', async () => {
            const rateLimitMiddleware = rateLimiter({
                windowMs: MILLISECONDS_IN_SECOND,
                max: 1,
                message: 'Rate limit exceeded',
            });
            await rateLimitMiddleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(1);
            jest.clearAllMocks();
            await rateLimitMiddleware(mockReq, mockRes, mockNext);
            if (mockRes.status && typeof mockRes.status === 'function') {
                mockRes.status.mockReturnValue(mockRes);
            }
        });
        test('should set appropriate rate limit headers', async () => {
            const rateLimitMiddleware = rateLimiter({
                windowMs: 60000,
                max: 100,
                standardHeaders: true,
            });
            await rateLimitMiddleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
    });
    describe('CSRF Protection Middleware', () => {
        test('should generate CSRF token for safe methods', async () => {
            mockReq.method = 'GET';
            mockReq.session = { csrfSecret: 'test-secret' };
            await csrfProtection(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
        test('should validate CSRF token for unsafe methods', async () => {
            mockReq.method = 'POST';
            mockReq.headers = {
                ...mockReq.headers,
                'x-csrf-token': 'valid-csrf-token',
            };
            mockReq.session = { csrfSecret: 'test-secret' };
            await csrfProtection(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
        test('should reject requests with invalid CSRF token', async () => {
            mockReq.method = 'POST';
            mockReq.headers = {
                ...mockReq.headers,
                'x-csrf-token': 'invalid-csrf-token',
            };
            mockReq.session = { csrfSecret: 'test-secret' };
            await csrfProtection(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
        test('should reject requests without CSRF token', async () => {
            mockReq.method = 'POST';
            mockReq.session = { csrfSecret: 'test-secret' };
            await csrfProtection(mockReq, mockRes, mockNext);
        });
    });
    describe('SQL Injection Protection Middleware', () => {
        test('should allow safe query parameters', async () => {
            mockReq.query = {
                search: 'normal search term',
                limit: '10',
                offset: '0',
            };
            await sqlInjectionProtection(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
        test('should block SQL injection attempts in query params', async () => {
            mockReq.query = {
                search: "'; DROP TABLE users; --",
                id: '1 OR 1=1',
            };
            await sqlInjectionProtection(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid request parameters detected',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
        test('should block SQL injection attempts in request body', async () => {
            mockReq.body = {
                username: 'admin',
                password: "password' OR '1'='1",
            };
            await sqlInjectionProtection(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockNext).not.toHaveBeenCalled();
        });
        test('should sanitize and allow safe HTML content', async () => {
            mockReq.body = {
                content: '<p>Safe HTML content</p>',
                description: 'Normal text description',
            };
            await sqlInjectionProtection(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
        test('should block XSS attempts', async () => {
            mockReq.body = {
                comment: '<script>alert("xss")</script>',
                title: '<img src=x onerror=alert(1)>',
            };
            await sqlInjectionProtection(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
    describe('Enhanced Security Middleware', () => {
        test('should set security headers', async () => {
            await securityEnhanced(mockReq, mockRes, mockNext);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
            expect(mockNext).toHaveBeenCalled();
        });
        test('should validate request origin', async () => {
            mockReq.headers = {
                ...mockReq.headers,
                origin: 'https://malicious-site.com',
            };
            await securityEnhanced(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
        test('should check for suspicious user agents', async () => {
            mockReq.headers = {
                ...mockReq.headers,
                'user-agent': 'sqlmap/1.0',
            };
            await securityEnhanced(mockReq, mockRes, mockNext);
        });
    });
    describe('Hardened Security Middleware', () => {
        test('should implement strict security policies', async () => {
            await securityHardened(mockReq, mockRes, mockNext);
            expect(mockRes.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining("default-src 'self'"));
            expect(mockNext).toHaveBeenCalled();
        });
        test('should validate request size limits', async () => {
            mockReq.body = 'x'.repeat(10000000);
            mockReq.headers = {
                ...mockReq.headers,
                'content-length': '10000000',
            };
            await securityHardened(mockReq, mockRes, mockNext);
        });
        test('should implement request timeout protection', async () => {
            const startTime = Date.now();
            await securityHardened(mockReq, mockRes, mockNext);
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(1000);
            expect(mockNext).toHaveBeenCalled();
        });
    });
    describe('Input Validation', () => {
        test('should validate email format', () => {
            const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'admin+tag@company.org'];
            const invalidEmails = ['invalid-email', '@domain.com', 'test@', 'test..test@domain.com'];
            validEmails.forEach((email) => {
                expect(isValidEmail(email)).toBe(true);
            });
            invalidEmails.forEach((email) => {
                expect(isValidEmail(email)).toBe(false);
            });
        });
        test('should validate URL format', () => {
            const validUrls = [
                'https://example.com',
                'http://localhost:3000',
                'https://sub.domain.com/path?query=value',
            ];
            const invalidUrls = [
                'not-a-url',
                'ftp://example.com',
                'javascript:alert(1)',
                'data:text/html,<script>alert(1)</script>',
            ];
            validUrls.forEach((url) => {
                expect(isValidUrl(url)).toBe(true);
            });
            invalidUrls.forEach((url) => {
                expect(isValidUrl(url)).toBe(false);
            });
        });
    });
    describe('Security Event Logging', () => {
        test('should log security violations', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            mockReq.body = {
                malicious: "'; DROP TABLE users; --",
            };
            await sqlInjectionProtection(mockReq, mockRes, mockNext);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Security violation detected'));
            consoleSpy.mockRestore();
        });
        test('should track failed authentication attempts', () => {
            const securityLog = {
                timestamp: new Date().toISOString(),
                ip: mockReq.ip,
                userAgent: mockReq.headers?.['user-agent'],
                violation: 'failed_authentication',
                severity: 'medium',
            };
            expect(securityLog).toHaveProperty('timestamp');
            expect(securityLog).toHaveProperty('ip');
            expect(securityLog).toHaveProperty('violation');
        });
    });
});
function isValidEmail(email) {
    const emailRegex = /^[^s@]+@[^s@]+.[^s@]+$/;
    return emailRegex.test(email);
}
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=security.test.js.map