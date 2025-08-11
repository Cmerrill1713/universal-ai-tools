/**
 * Authentication Middleware
 * Supports JWT tokens and Apple device authentication
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { secretsManager } from '../services/secrets-manager';
import { sendError } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';

// Extend Request interface to include user and device info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        isAdmin?: boolean;
        permissions?: string[];
        deviceId?: string;
        deviceType?: 'iPhone' | 'iPad' | 'AppleWatch' | 'Mac';
        trusted?: boolean;
      };
    }
  }
}

interface JwtPayload {
  userId: string;
  email?: string;
  isAdmin?: boolean;
  permissions?: string[];
  deviceId?: string;
  deviceType?: string;
  trusted?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * JWT authentication middleware with Apple device support
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // No development authentication bypasses. Tests must provide auth or hit public endpoints.

    // Check temporary lockout before any heavy work
    if (await isIpLockedOut(req)) {
      const retry = await getLockoutRetryAfter(req);
      if (retry > 0) {
        res.setHeader('Retry-After', String(retry));
      }
      return sendError(
        res,
        'AUTHENTICATION_ERROR',
        'Too many failed attempts. Try again later.',
        429
      );
    }
    // Extract token from Authorization header or API key
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (apiKey) {
      // API key authentication - validate against stored keys
      const isValid = await validateApiKey(apiKey);
      if (isValid) {
        req.user = {
          id: 'api-user',
          isAdmin: false,
          permissions: ['api_access'],
        };
        return next();
      } else {
        return sendError(res, 'AUTHENTICATION_ERROR', 'Invalid API key', 401);
      }
    }

    if (!token) {
      const fullPath = `${(req as any).baseUrl || ''}${req.path || ''}`;
      // Check if this is a public endpoint
      if (isPublicEndpoint(req.path, fullPath)) {
        return next();
      }
      return sendError(res, 'AUTHENTICATION_ERROR', 'No token provided', 401);
    }

    // Get JWT secret
    let jwtSecret: string | null = null;
    jwtSecret = (await secretsManager.getSecret('jwt_secret')) || process.env.JWT_SECRET || '';
    if (!jwtSecret) {
      log.error('JWT secret not configured', LogContext.API);
      return sendError(res, 'AUTHENTICATION_ERROR', 'Authentication configuration error', 500);
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      isAdmin: decoded.isAdmin || false,
      permissions: decoded.permissions || [],
      deviceId: decoded.deviceId,
      deviceType: decoded.deviceType as any,
      trusted: decoded.trusted || false,
    };

    // Successful auth: reset failure counters
    await recordAuthSuccess(req);

    // Log device authentication
    if (decoded.deviceId) {
      log.info('Device authenticated', LogContext.API, {
        userId: decoded.userId,
        deviceId: decoded.deviceId,
        deviceType: decoded.deviceType,
        trusted: decoded.trusted,
      });
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      log.warn('Invalid JWT token', LogContext.API, { error: error.message });
      await slowDownOnAuthFailure(req);
      await recordAuthFailure(req);
      return sendError(res, 'AUTHENTICATION_ERROR', 'Invalid token', 401);
    } else if (error instanceof jwt.TokenExpiredError) {
      log.warn('Expired JWT token', LogContext.API);
      await slowDownOnAuthFailure(req);
      await recordAuthFailure(req);
      return sendError(res, 'AUTHENTICATION_ERROR', 'Token expired', 401);
    } else {
      log.error('Authentication failed', LogContext.API, { error });
      await slowDownOnAuthFailure(req);
      await recordAuthFailure(req);
      return sendError(res, 'AUTHENTICATION_ERROR', 'Authentication failed', 401);
    }
  }
};

/**
 * Check if endpoint is public (doesn't require authentication)
 */
function isPublicEndpoint(path: string, fullPath?: string): boolean {
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
    '/graphql', // health query only; resolvers should enforce auth for sensitive ops
  ];

  const candidates = [path, fullPath].filter(Boolean) as string[];
  return publicPaths.some((publicPath) => candidates.some((p) => p.startsWith(publicPath)));
}

/**
 * Slow down repeated auth failures per IP without storing PII
 */
async function slowDownOnAuthFailure(req: Request): Promise<void> {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const count = await getFailureCount(ip);
    // Exponential-ish backoff with jitter, capped for local use
    const base = 100;
    const factor = Math.min(count, 10) * 100;
    const jitter = Math.floor(Math.random() * 200);
    await new Promise((r) => setTimeout(r, base + factor + jitter));
    // Optionally, integrate with redisService for per-IP counters later
  } catch {
    // ignore
  }
}

// ---------- Auth failure tracking (Redis-backed with in-memory fallback) ----------

const FAILURE_WINDOW_SEC = 15 * 60; // 15 minutes
const LOCKOUT_THRESHOLD = 10; // failures in window
const LOCKOUT_TTL_SEC = 5 * 60; // 5 minutes

function getClientIp(req: Request): string {
  return (req.ip || (req.connection as any)?.remoteAddress || 'unknown').toString();
}

async function getRedisService(): Promise<any | null> {
  try {
    const { redisService } = await import('../services/redis-service');
    return redisService;
  } catch {
    return null;
  }
}

async function getFailureCount(ip: string): Promise<number> {
  try {
    const redis = await getRedisService();
    const key = `auth:fail:${ip}`;
    if (redis && redis.isConnected()) {
      const val = await redis.get(key);
      return typeof val === 'number' ? val : Number(val?.count || val) || 0;
    }
    return Number((authFailures.get(ip)?.count as number) || 0);
  } catch {
    return 0;
  }
}

async function recordAuthFailure(req: Request): Promise<void> {
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

  // Fallback in-memory
  const current = authFailures.get(ip) || { count: 0, ts: Date.now() };
  const updated = { count: current.count + 1, ts: Date.now() } as { count: number; ts: number };
  authFailures.set(ip, updated);
  setTimeout(() => authFailures.delete(ip), FAILURE_WINDOW_SEC * 1000);
  if (updated.count >= LOCKOUT_THRESHOLD) {
    authLockouts.set(ip, { until: Date.now() + LOCKOUT_TTL_SEC * 1000 });
    setTimeout(() => authLockouts.delete(ip), LOCKOUT_TTL_SEC * 1000);
  }
}

async function recordAuthSuccess(req: Request): Promise<void> {
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

async function isIpLockedOut(req: Request): Promise<boolean> {
  const ip = getClientIp(req);
  const redis = await getRedisService();
  const lockKey = `auth:lock:${ip}`;
  if (redis && redis.isConnected()) {
    const val = await redis.get(lockKey);
    if (!val) return false;
    const until = typeof val === 'number' ? val : Number(val?.until || 0);
    return until ? Date.now() < until : true;
  }
  const entry = authLockouts.get(ip);
  return entry ? Date.now() < entry.until : false;
}

async function getLockoutRetryAfter(req: Request): Promise<number> {
  const ip = getClientIp(req);
  const redis = await getRedisService();
  const lockKey = `auth:lock:${ip}`;
  if (redis && redis.isConnected()) {
    const val = await redis.get(lockKey);
    const until = typeof val === 'number' ? val : Number(val?.until || 0);
    if (!until) return 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }
  const entry = authLockouts.get(ip);
  if (!entry) return 0;
  return Math.max(0, Math.ceil((entry.until - Date.now()) / 1000));
}

const authFailures = new Map<string, { count: number; ts: number }>();
const authLockouts = new Map<string, { until: number }>();

/**
 * Validate API key against stored keys
 */
async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    if (!apiKey || apiKey.length < 32) {
      return false;
    }

    // Validate against Vault-backed service configuration
    const { secretsManager } = await import('../services/secrets-manager');
    const services = await secretsManager.getAvailableServices();
    if (!services || services.length === 0) {
      return false;
    }

    // Optional: check a dedicated API key service entry if present
    const apiServiceCfg = await secretsManager.getServiceConfig('api_gateway');
    if (apiServiceCfg?.api_key && typeof apiServiceCfg.api_key === 'string') {
      return apiKey === apiServiceCfg.api_key;
    }

    // Otherwise, deny by default (no dev/test bypass)
    return false;
  } catch (error) {
    const { LogContext, log } = await import('../utils/logger');
    log.error('API key validation failed', LogContext.API, { error });
    return false;
  }
}

/**
 * Admin authentication middleware
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return sendError(res, 'AUTHENTICATION_ERROR', 'Admin access required', 403);
  }
  next();
};

// Export authenticateRequest for backward compatibility
export const authenticateRequest = authenticate;

export default authenticate;
