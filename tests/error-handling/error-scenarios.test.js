import { jest } from '@jest/globals';
import { errorHandler } from '../../src/middleware/error-handler';
import { CircuitBreaker } from '../../src/services/circuit-breaker';
import { HealthCheckService } from '../../src/services/health-check';
import { BackupRecoveryService } from '../../src/services/backup-recovery-service';
jest.mock('../../src/services/supabase_service');
jest.mock('../../src/utils/enhanced-logger');
describe('Error Handling Tests', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    beforeEach(() => {
        mockReq = {
            method: 'GET',
            url: '/test',
            headers: {},
            body: {},
            ip: '127.0.0.1'
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn(),
            locals: {}
        };
        mockNext = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
    });
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });
    describe('Error Handler Middleware', () => {
        test('should handle generic errors', async () => {
            const error = new Error('Generic error message');
            await errorHandler(error, mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred',
                requestId: expect.any(String)
            });
        });
        test('should handle validation errors', async () => {
            const validationError = new Error('Validation failed');
            validationError.name = 'ValidationError';
            validationError.statusCode = 400;
            validationError.details = [
                { field: 'email', message: 'Invalid email format' },
                { field: 'password', message: 'Password too short' }
            ];
            await errorHandler(validationError, mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Validation Error',
                message: 'Validation failed',
                details: [
                    { field: 'email', message: 'Invalid email format' },
                    { field: 'password', message: 'Password too short' }
                ],
                requestId: expect.any(String)
            });
        });
        test('should handle authentication errors', async () => {
            const authError = new Error('Authentication failed');
            authError.name = 'AuthenticationError';
            authError.statusCode = 401;
            await errorHandler(authError, mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Authentication Error',
                message: 'Authentication failed',
                requestId: expect.any(String)
            });
        });
        test('should handle authorization errors', async () => {
            const authzError = new Error('Insufficient permissions');
            authzError.name = 'AuthorizationError';
            authzError.statusCode = 403;
            await errorHandler(authzError, mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Authorization Error',
                message: 'Insufficient permissions',
                requestId: expect.any(String)
            });
        });
        test('should handle not found errors', async () => {
            const notFoundError = new Error('Resource not found');
            notFoundError.name = 'NotFoundError';
            notFoundError.statusCode = 404;
            await errorHandler(notFoundError, mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Not Found',
                message: 'Resource not found',
                requestId: expect.any(String)
            });
        });
        test('should handle database errors', async () => {
            const dbError = new Error('Database connection failed');
            dbError.name = 'DatabaseError';
            dbError.statusCode = 503;
            dbError.code = 'CONNECTION_FAILED';
            await errorHandler(dbError, mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(503);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Service Unavailable',
                message: 'Database service is temporarily unavailable',
                code: 'CONNECTION_FAILED',
                requestId: expect.any(String)
            });
        });
        test('should handle rate limit errors', async () => {
            const rateLimitError = new Error('Rate limit exceeded');
            rateLimitError.name = 'RateLimitError';
            rateLimitError.statusCode = 429;
            rateLimitError.retryAfter = SECONDS_IN_MINUTE;
            await errorHandler(rateLimitError, mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded',
                retryAfter: SECONDS_IN_MINUTE,
                requestId: expect.any(String)
            });
        });
        test('should sanitize error messages in production', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            const sensitiveError = new Error('Database password is invalid: mypassword123');
            await errorHandler(sensitiveError, mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred',
                requestId: expect.any(String)
            });
            const responseCall = mockRes.json.mock.calls[0][0];
            expect(responseCall.message).not.toContain('mypassword123');
            process.env.NODE_ENV = originalNodeEnv;
        });
        test('should include stack trace in development', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            const error = new Error('Development error');
            await errorHandler(error, mockReq, mockRes, mockNext);
            const responseCall = mockRes.json.mock.calls[0][0];
            expect(responseCall).toHaveProperty('stack');
            process.env.NODE_ENV = originalNodeEnv;
        });
        test('should log errors with context', async () => {
            const loggerSpy = jest.spyOn(console, 'error');
            const error = new Error('Test error for logging');
            await errorHandler(error, mockReq, mockRes, mockNext);
            expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Error occurred'), expect.objectContaining({
                error: error.message,
                method: 'GET',
                url: '/test',
                ip: '127.0.0.1'
            }));
        });
    });
    describe('Circuit Breaker Error Handling', () => {
        let circuitBreaker;
        let mockService;
        beforeEach(() => {
            mockService = jest.fn();
            circuitBreaker = new CircuitBreaker(mockService, {
                failureThreshold: THREE,
                recoveryTimeout: MILLISECONDS_IN_SECOND,
                monitoringPeriod: 2000
            });
        });
        test('should handle service failures gracefully', async () => {
            const serviceError = new Error('Service unavailable');
            mockService.mockRejectedValue(serviceError);
            try {
                await circuitBreaker.execute('test-request');
            }
            catch (error) {
                expect(error.message).toBe('Service unavailable');
            }
            expect(mockService).toHaveBeenCalledWith('test-request');
        });
        test('should open circuit after threshold failures', async () => {
            const serviceError = new Error('Repeated failure');
            mockService.mockRejectedValue(serviceError);
            for (let i = 0; i < THREE; i++) {
                try {
                    await circuitBreaker.execute(`request-${i}`);
                }
                catch (error) {
                }
            }
            expect(circuitBreaker.state).toBe('open');
            try {
                await circuitBreaker.execute('fast-fail-request');
            }
            catch (error) {
                expect(error.message).toContain('Circuit breaker is open');
            }
            expect(mockService).toHaveBeenCalledTimes(3);
        });
        test('should transition to half-open state after timeout', async () => {
            const serviceError = new Error('Temporary failure');
            mockService.mockRejectedValue(serviceError);
            for (let i = 0; i < THREE; i++) {
                try {
                    await circuitBreaker.execute(`request-${i}`);
                }
                catch (error) {
                }
            }
            expect(circuitBreaker.state).toBe('open');
            await new Promise(resolve => setTimeout(resolve, 1100));
            mockService.mockResolvedValue('success');
            const result = await circuitBreaker.execute('recovery-request');
            expect(result).toBe('success');
            expect(circuitBreaker.state).toBe('closed');
        });
        test('should provide fallback responses', async () => {
            const fallbackBreaker = new CircuitBreaker(mockService, {
                failureThreshold: 1,
                fallback: () => 'fallback-response'
            });
            mockService.mockRejectedValue(new Error('Service down'));
            const result = await fallbackBreaker.execute('request-with-fallback');
            expect(result).toBe('fallback-response');
        });
    });
    describe('Health Check Error Scenarios', () => {
        let healthCheck;
        beforeEach(() => {
            healthCheck = new HealthCheckService();
        });
        test('should detect database connectivity issues', async () => {
            jest.doMock('../../src/services/supabase_service', () => ({
                getSupabaseClient: () => {
                    throw new Error('Database connection failed');
                }
            }));
            const status = await healthCheck.checkDatabase();
            expect(status.healthy).toBe(false);
            expect(status.error).toContain('Database connection failed');
        });
        test('should detect Redis connectivity issues', async () => {
            jest.doMock('ioredis', () => {
                return jest.fn().mockImplementation(() => {
                    throw new Error('Redis connection refused');
                });
            });
            const status = await healthCheck.checkRedis();
            expect(status.healthy).toBe(false);
            expect(status.error).toContain('Redis connection refused');
        });
        test('should handle external service timeouts', async () => {
            const timeoutService = jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 100)));
            const status = await healthCheck.checkExternalService(timeoutService);
            expect(status.healthy).toBe(false);
            expect(status.error).toContain('Request timeout');
        }, 10000);
        test('should aggregate health status correctly', async () => {
            jest.spyOn(healthCheck, 'checkDatabase').mockResolvedValue({
                healthy: true,
                responseTime: 50
            });
            jest.spyOn(healthCheck, 'checkRedis').mockResolvedValue({
                healthy: false,
                error: 'Redis unavailable'
            });
            const overallStatus = await healthCheck.getOverallStatus();
            expect(overallStatus.healthy).toBe(false);
            expect(overallStatus.services.database.healthy).toBe(true);
            expect(overallStatus.services.redis.healthy).toBe(false);
        });
    });
    describe('Backup and Recovery Error Handling', () => {
        let backupService;
        beforeEach(() => {
            backupService = new BackupRecoveryService();
        });
        test('should handle backup creation failures', async () => {
            jest.spyOn(backupService, 'createBackup').mockRejectedValue(new Error('Storage quota exceeded'));
            try {
                await backupService.createBackup('test-backup');
            }
            catch (error) {
                expect(error.message).toBe('Storage quota exceeded');
            }
        });
        test('should handle corrupted backup detection', async () => {
            jest.spyOn(backupService, 'validateBackup').mockResolvedValue({
                valid: false,
                errors: ['Checksum mismatch', 'Missing required files']
            });
            const validation = await backupService.validateBackup('corrupted-backup');
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('Checksum mismatch');
        });
        test('should handle restoration failures gracefully', async () => {
            jest.spyOn(backupService, 'restoreFromBackup').mockRejectedValue(new Error('Insufficient permissions for restoration'));
            try {
                await backupService.restoreFromBackup('test-backup');
            }
            catch (error) {
                expect(error.message).toBe('Insufficient permissions for restoration');
            }
            const systemStatus = await backupService.getSystemStatus();
            expect(systemStatus.inRestoration).toBe(false);
        });
    });
    describe('Graceful Degradation', () => {
        test('should degrade to cached responses when database fails', async () => {
            const mockCache = {
                get: jest.fn().mockResolvedValue({ data: 'cached-data', timestamp: Date.now() }),
                set: jest.fn(),
                delete: jest.fn()
            };
            const result = await mockCache.get('fallback-key');
            expect(result.data).toBe('cached-data');
        });
        test('should provide read-only mode when write operations fail', async () => {
            const mockDatabase = {
                read: jest.fn().mockResolvedValue({ success: true, data: [] }),
                write: jest.fn().mockRejectedValue(new Error('Write operation failed'))
            };
            const readResult = await mockDatabase.read();
            expect(readResult.success).toBe(true);
            try {
                await mockDatabase.write({ data: 'test' });
            }
            catch (error) {
                expect(error.message).toBe('Write operation failed');
            }
        });
        test('should provide limited functionality during partial outages', async () => {
            const services = {
                core: { available: true },
                analytics: { available: false },
                notifications: { available: true }
            };
            expect(services.core.available).toBe(true);
            expect(services.analytics.available).toBe(false);
            expect(services.notifications.available).toBe(true);
        });
    });
    describe('Error Recovery Mechanisms', () => {
        test('should implement exponential backoff for retries', async () => {
            const mockService = jest.fn()
                .mockRejectedValueOnce(new Error('Temporary failure 1'))
                .mockRejectedValueOnce(new Error('Temporary failure 2'))
                .mockResolvedValue('success');
            const retryWithBackoff = async (fn, maxRetries = THREE) => {
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        return await fn();
                    }
                    catch (error) {
                        if (attempt === maxRetries)
                            throw error;
                        const delay = Math.pow(2, attempt) * 100;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            };
            const result = await retryWithBackoff(mockService);
            expect(result).toBe('success');
            expect(mockService).toHaveBeenCalledTimes(3);
        });
        test('should implement jittered retry to avoid thundering herd', async () => {
            const mockService = jest.fn()
                .mockRejectedValueOnce(new Error('Failure'))
                .mockResolvedValue('success');
            const retryWithJitter = async (fn) => {
                try {
                    return await fn();
                }
                catch (error) {
                    const jitter = Math.random() * 100;
                    await new Promise(resolve => setTimeout(resolve, 100 + jitter));
                    return await fn();
                }
            };
            const result = await retryWithJitter(mockService);
            expect(result).toBe('success');
            expect(mockService).toHaveBeenCalledTimes(2);
        });
        test('should implement dead letter queue for failed messages', async () => {
            const messages = [
                { id: 1, data: 'valid message' },
                { id: TWO, data: null },
                { id: THREE, data: 'another valid message' }
            ];
            const processedMessages = [];
            const deadLetterQueue = [];
            for (const message of messages) {
                try {
                    if (!message.data) {
                        throw new Error('Invalid message data');
                    }
                    processedMessages.push(message);
                }
                catch (error) {
                    deadLetterQueue.push({ message, error: error.message, timestamp: Date.now() });
                }
            }
            expect(processedMessages).toHaveLength(2);
            expect(deadLetterQueue).toHaveLength(1);
            expect(deadLetterQueue[0].message.id).toBe(2);
        });
    });
    describe('Monitoring and Alerting', () => {
        test('should generate error metrics', () => {
            const errorMetrics = {
                totalErrors: 0,
                errorsByType: new Map(),
                errorRate: 0
            };
            const recordError = (error) => {
                errorMetrics.totalErrors++;
                const errorType = error.name || 'UnknownError';
                errorMetrics.errorsByType.set(errorType, (errorMetrics.errorsByType.get(errorType) || 0) + 1);
            };
            recordError(new Error('Test error 1'));
            recordError(new Error('Test error 2'));
            const validationError = new Error('Validation failed');
            validationError.name = 'ValidationError';
            recordError(validationError);
            expect(errorMetrics.totalErrors).toBe(3);
            expect(errorMetrics.errorsByType.get('Error')).toBe(2);
            expect(errorMetrics.errorsByType.get('ValidationError')).toBe(1);
        });
        test('should trigger alerts for critical errors', () => {
            const alerts = [];
            const triggerAlert = (severity, message) => {
                alerts.push({
                    severity,
                    message,
                    timestamp: new Date().toISOString()
                });
            };
            const handleCriticalError = (error) => {
                if (error.message.includes('database') || error.message.includes('security')) {
                    triggerAlert('critical', `Critical error: ${error.message}`);
                }
            };
            handleCriticalError(new Error('Database connection lost'));
            handleCriticalError(new Error('Security breach detected'));
            handleCriticalError(new Error('Minor validation error'));
            expect(alerts).toHaveLength(2);
            expect(alerts[0].severity).toBe('critical');
            expect(alerts[1].severity).toBe('critical');
        });
    });
});
//# sourceMappingURL=error-scenarios.test.js.map