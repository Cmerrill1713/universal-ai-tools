import jwt from 'jsonwebtoken';
import { secretsManager } from '../services/secrets-manager';
import { sendError } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
export const authenticate = async (req, res, next) => {
    try {
        log.info('🔐 Auth middleware called', LogContext.API, {
            path: req.path,
            method: req.method,
            hasAuthHeader: !!req.headers.authorization,
            hasApiKey: !!req.headers['x-api-key']
        });
        if (await isIpLockedOut(req)) {
            const retry = await getLockoutRetryAfter(req);
            if (retry > 0) {
                res.setHeader('Retry-After', String(retry));
            }
            return sendError(res, 'AUTHENTICATION_ERROR', 'Too many failed attempts. Try again later.', 429);
        }
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'];
        let token = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
            log.info('🔐 Bearer token extracted', LogContext.API, {
                tokenLength: token.length,
                tokenPrefix: token.substring(0, 20) + '...'
            });
        }
        else if (apiKey) {
            const isValid = await validateApiKey(apiKey);
            if (isValid) {
                req.user = {
                    id: 'api-user',
                    isAdmin: false,
                    permissions: ['api_access'],
                };
                return next();
            }
            else {
                return sendError(res, 'AUTHENTICATION_ERROR', 'Invalid API key', 401);
            }
        }
        if (!token) {
            const fullPath = `${req.baseUrl || ''}${req.path || ''}`;
            log.info('🔐 No token extracted', LogContext.API, {
                authHeader,
                fullPath,
                path: req.path,
                baseUrl: req.baseUrl
            });
            if (isPublicEndpoint(req.path, fullPath)) {
                return next();
            }
            return sendError(res, 'AUTHENTICATION_ERROR', 'No token provided', 401);
        }
        let jwtSecret;
        try {
            const secretResult = await secretsManager.getSecret('jwt_secret');
            jwtSecret = secretResult || process.env.JWT_SECRET;
            if (!jwtSecret) {
                throw new Error('JWT secret not configured in secrets manager or environment');
            }
            if (jwtSecret.length < 32) {
                throw new Error('JWT secret must be at least 32 characters');
            }
            log.info('🔐 JWT secret resolved', LogContext.API, {
                source: secretResult ? 'secrets_manager' : 'environment',
                length: jwtSecret.length
            });
        }
        catch (error) {
            log.error('🔐 JWT secret configuration error', LogContext.API, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error('Authentication system not properly configured');
        }
        const decoded = jwt.verify(token, jwtSecret);
        log.info('🔐 JWT token verified successfully', LogContext.API, {
            userId: decoded.userId,
            permissions: decoded.permissions
        });
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            isAdmin: decoded.isAdmin || false,
            permissions: decoded.permissions || [],
            deviceId: decoded.deviceId,
            deviceType: decoded.deviceType,
            trusted: decoded.trusted || false,
        };
        await recordAuthSuccess(req);
        if (decoded.deviceId) {
            log.info('Device authenticated', LogContext.API, {
                userId: decoded.userId,
                deviceId: decoded.deviceId,
                deviceType: decoded.deviceType,
                trusted: decoded.trusted,
            });
        }
        next();
    }
    catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            log.warn('Invalid JWT token', LogContext.API, { error: error.message });
            await slowDownOnAuthFailure(req);
            await recordAuthFailure(req);
            return sendError(res, 'AUTHENTICATION_ERROR', 'Invalid token', 401);
        }
        else if (error instanceof jwt.TokenExpiredError) {
            log.warn('Expired JWT token', LogContext.API);
            await slowDownOnAuthFailure(req);
            await recordAuthFailure(req);
            return sendError(res, 'AUTHENTICATION_ERROR', 'Token expired', 401);
        }
        else {
            log.error('Authentication failed', LogContext.API, { error });
            await slowDownOnAuthFailure(req);
            await recordAuthFailure(req);
            return sendError(res, 'AUTHENTICATION_ERROR', 'Authentication failed', 401);
        }
    }
};
function isPublicEndpoint(path, fullPath) {
    const publicPaths = [
        '/health',
        '/api/health',
        '/api/v1/health',
        '/status',
        '/metrics',
        '/api/v1/status',
        '/api/v1/ollama/models',
        '/api/v1/vision/models',
        '/api/v1/agents/registry',
        '/api/v1/device-auth/challenge',
        '/docs',
        '/api-docs',
        '/graphql',
    ];
    const candidates = [path, fullPath].filter(Boolean);
    return publicPaths.some((publicPath) => candidates.some((p) => p.startsWith(publicPath)));
}
async function slowDownOnAuthFailure(req) {
    try {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const count = await getFailureCount(ip);
        const base = 100;
        const factor = Math.min(count, 10) * 100;
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, base + factor + jitter));
    }
    catch {
    }
}
const FAILURE_WINDOW_SEC = 15 * 60;
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_TTL_SEC = 5 * 60;
function getClientIp(req) {
    return (req.ip || req.connection?.remoteAddress || 'unknown').toString();
}
async function getRedisService() {
    try {
        const { redisService } = await import('../services/redis-service');
        return redisService;
    }
    catch {
        return null;
    }
}
async function getFailureCount(ip) {
    try {
        const redis = await getRedisService();
        const key = `auth:fail:${ip}`;
        if (redis && redis.isConnected()) {
            const val = await redis.get(key);
            return typeof val === 'number' ? val : Number(val?.count || val) || 0;
        }
        return Number(authFailures.get(ip)?.count || 0);
    }
    catch {
        return 0;
    }
}
async function recordAuthFailure(req) {
    const ip = getClientIp(req);
    const redis = await getRedisService();
    const failKey = `auth:fail:${ip}`;
    const lockKey = `auth:lock:${ip}`;
    if (redis && redis.isConnected()) {
        const cur = await redis.get(failKey);
        const count = (typeof cur === 'number' ? cur : Number(cur?.count || cur) || 0) + 1;
        await redis.set(failKey, { count, ts: Date.now() }, FAILURE_WINDOW_SEC);
        if (count >= LOCKOUT_THRESHOLD) {
            await redis.set(lockKey, { until: Date.now() + LOCKOUT_TTL_SEC * 1000 }, LOCKOUT_TTL_SEC);
        }
        return;
    }
    const current = authFailures.get(ip) || { count: 0, ts: Date.now() };
    const updated = { count: current.count + 1, ts: Date.now() };
    authFailures.set(ip, updated);
    setTimeout(() => authFailures.delete(ip), FAILURE_WINDOW_SEC * 1000);
    if (updated.count >= LOCKOUT_THRESHOLD) {
        authLockouts.set(ip, { until: Date.now() + LOCKOUT_TTL_SEC * 1000 });
        setTimeout(() => authLockouts.delete(ip), LOCKOUT_TTL_SEC * 1000);
    }
}
async function recordAuthSuccess(req) {
    const ip = getClientIp(req);
    const redis = await getRedisService();
    const failKey = `auth:fail:${ip}`;
    const lockKey = `auth:lock:${ip}`;
    if (redis && redis.isConnected()) {
        await redis.del(failKey);
        await redis.del(lockKey);
        return;
    }
    authFailures.delete(ip);
    authLockouts.delete(ip);
}
async function isIpLockedOut(req) {
    const ip = getClientIp(req);
    const redis = await getRedisService();
    const lockKey = `auth:lock:${ip}`;
    if (redis && redis.isConnected()) {
        const val = await redis.get(lockKey);
        if (!val)
            return false;
        const until = typeof val === 'number' ? val : Number(val?.until || 0);
        return until ? Date.now() < until : true;
    }
    const entry = authLockouts.get(ip);
    return entry ? Date.now() < entry.until : false;
}
async function getLockoutRetryAfter(req) {
    const ip = getClientIp(req);
    const redis = await getRedisService();
    const lockKey = `auth:lock:${ip}`;
    if (redis && redis.isConnected()) {
        const val = await redis.get(lockKey);
        const until = typeof val === 'number' ? val : Number(val?.until || 0);
        if (!until)
            return 0;
        return Math.max(0, Math.ceil((until - Date.now()) / 1000));
    }
    const entry = authLockouts.get(ip);
    if (!entry)
        return 0;
    return Math.max(0, Math.ceil((entry.until - Date.now()) / 1000));
}
const authFailures = new Map();
const authLockouts = new Map();
async function validateApiKey(apiKey) {
    try {
        if (!apiKey || apiKey.length < 32) {
            return false;
        }
        const { secretsManager } = await import('../services/secrets-manager');
        const services = await secretsManager.getAvailableServices();
        if (!services || services.length === 0) {
            return false;
        }
        const apiServiceCfg = await secretsManager.getServiceConfig('api_gateway');
        if (apiServiceCfg?.api_key && typeof apiServiceCfg.api_key === 'string') {
            return apiKey === apiServiceCfg.api_key;
        }
        return false;
    }
    catch (error) {
        const { LogContext, log } = await import('../utils/logger');
        log.error('API key validation failed', LogContext.API, { error });
        return false;
    }
}
export const requireAdmin = (req, res, next) => {
    if (!req.user?.isAdmin) {
        return sendError(res, 'AUTHENTICATION_ERROR', 'Admin access required', 403);
    }
    next();
};
export const authenticateRequest = authenticate;
export default authenticate;
//# sourceMappingURL=auth.js.map