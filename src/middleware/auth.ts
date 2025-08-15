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
    // Debug logging
    log.info('🔐 Auth middleware called', LogContext.API, {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!req.headers.authorization,
      hasApiKey: !!req.headers['x-api-key']
    });

    // Development bypass for GraphRAG endpoints only
    const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    const isGraphRAG = req.baseUrl?.includes('/graphrag') || req.originalUrl?.includes('/graphrag');
    const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.ip === '::1';
    
    // UAT Testing bypass
    const isUATTest = req.headers['x-uat-test'] === 'true' || req.headers['x-testing-mode'] === 'true';
    
    if (isDevelopment && isGraphRAG && isLocalhost) {
      log.info('🔓 Development bypass for GraphRAG', LogContext.API, {
        path: req.path,
        hostname: req.hostname
      });
      req.user = {
        id: 'dev-user',
        isAdmin: false,
        permissions: ['graphrag_access'],
      };
      return next();
    }

    if (isDevelopment && isUATTest && isLocalhost) {
      log.info('🔓 UAT Testing bypass', LogContext.API, {
        path: req.path,
        hostname: req.hostname
      });
      req.user = {
        id: 'uat-test-user',
        isAdmin: false,
        permissions: ['uat_access'],
      };
      return next();
    }

    // Fast lockout check using in-memory cache first
    const clientIp = getClientIp(req);
    if (isIpLockedOutSync(clientIp)) {
      const entry = authLockouts.get(clientIp);
      if (entry) {
        const retry = Math.max(0, Math.ceil((entry.until - Date.now()) / 1000));
        if (retry > 0) {
          res.setHeader('Retry-After', String(retry));
        }
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
      log.info('🔐 Bearer token extracted', LogContext.API, {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + '...'
      });
    } else if (apiKey) {
      // API key authentication - validate against stored keys
      const isValid = await authenticateAPIKey(apiKey);
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
      const originalUrl = req.originalUrl || '';
      
      log.info('🔐 No token extracted', LogContext.API, {
        authHeader,
        fullPath,
        path: req.path,
        baseUrl: (req as any).baseUrl,
        originalUrl
      });
      
      // Check if this is a public endpoint using multiple path formats
      if (isPublicEndpoint(req.path, fullPath) || isPublicEndpoint(originalUrl)) {
        log.info('🔓 Public endpoint accessed without token', LogContext.API, {
          path: req.path,
          fullPath,
          originalUrl
        });
        return next();
      }
      
      return sendError(res, 'AUTHENTICATION_ERROR', 'No token provided', 401);
    }

    // Get JWT secret with caching for performance
    const jwtSecret = await getJwtSecretCached();
    if (!jwtSecret) {
      throw new Error('Authentication system not properly configured');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

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
    '/api/v1/agents/detect', // Allow agent detection endpoint for discovery
    '/api/v1/agents', // Allow agents list endpoint - returns empty array if no registry
    '/api/v1/device-auth/challenge',
    '/docs',
    '/api-docs',
    '/graphql', // health query only; resolvers should enforce auth for sensitive ops
  ];

  const candidates = [path, fullPath].filter(Boolean) as string[];
  return publicPaths.some((publicPath) => candidates.some((p) => p.startsWith(publicPath)));
}

/**
 * Check if request is from localhost for development bypass
 */
function isLocalDevelopmentRequest(req: Request): boolean {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (!isDevelopment) return false;
  
  const ip = req.ip || req.connection.remoteAddress || '';
  const host = req.get('host') || '';
  
  // Check for localhost variations
  const isLocalhost = ip === '127.0.0.1' || 
                     ip === '::1' || 
                     ip === '::ffff:127.0.0.1' ||
                     host.startsWith('localhost') ||
                     host.startsWith('127.0.0.1');
  
  return isLocalhost;
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

// JWT Secret caching for performance
let cachedJwtSecret: string | null = null;
let jwtSecretExpiry = 0;
const JWT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getJwtSecretCached(): Promise<string | null> {
  const now = Date.now();
  
  // Return cached secret if still valid
  if (cachedJwtSecret && now < jwtSecretExpiry) {
    return cachedJwtSecret;
  }

  // Load secret from secrets manager or environment
  try {
    const secretResult = await secretsManager.getSecret('jwt_secret');
    const jwtSecret = secretResult || process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      log.error('🔐 JWT secret not configured in secrets manager or environment', LogContext.API);
      return null;
    }
    
    if (jwtSecret.length < 32) {
      log.error('🔐 JWT secret must be at least 32 characters', LogContext.API);
      return null;
    }
    
    // Cache the secret
    cachedJwtSecret = jwtSecret;
    jwtSecretExpiry = now + JWT_CACHE_TTL;
    
    log.info('🔐 JWT secret cached', LogContext.API, { 
      source: secretResult ? 'secrets_manager' : 'environment',
      length: jwtSecret.length,
      cacheExpiry: new Date(jwtSecretExpiry).toISOString()
    });
    
    return jwtSecret;
  } catch (error) {
    log.error('🔐 JWT secret configuration error', LogContext.API, { 
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

// Fast path lockout check using in-memory cache
function isIpLockedOutSync(ip: string): boolean {
  const entry = authLockouts.get(ip);
  return entry ? Date.now() < entry.until : false;
}

/**
 * Validate API key against stored keys
 */
export async function authenticateAPIKey(apiKey: string): Promise<boolean> {
  try {
    if (!apiKey || apiKey.length < 32) {
      return false;
    }

    // Note: No development bypasses for security

    // Validate against Vault-backed service configuration
    const services = await secretsManager.getAvailableServices();
    
    // If no services are available, return false
    if (!services || services.length === 0) {
      return false;
    }

    // Check if any service has this API key
    for (const service of services) {
      try {
        // Check service configuration for API key
        const serviceConfig = await secretsManager.getServiceConfig(service);
        if (serviceConfig?.api_key === apiKey || serviceConfig?.apiKey === apiKey) {
          return true;
        }
      } catch (error) {
        // Log error but continue checking other services
        const { LogContext, log } = await import('../utils/logger');
        log.warn('Failed to check service config for API key', LogContext.API, { 
          service: typeof service === 'string' ? service : 'unknown',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Check dedicated API gateway service
    try {
      const apiServiceCfg = await secretsManager.getServiceConfig('api_gateway');
      if (apiServiceCfg?.api_key === apiKey) {
        return true;
      }
    } catch (error) {
      // Log but don't fail - this is optional
      const { LogContext, log } = await import('../utils/logger');
      log.debug('API gateway service not configured', LogContext.API);
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

/**
 * JWT authentication function for testing
 */
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return sendError(res, 'AUTHENTICATION_ERROR', 'No token provided', 401);
    }

    // Get JWT secret from environment or secrets manager
    let jwtSecret: string | undefined;
    try {
      const secretResult = await secretsManager.getSecret('jwt_secret');
      jwtSecret = secretResult || process.env.JWT_SECRET;
      
      if (!jwtSecret) {
        throw new Error('JWT secret not configured in secrets manager or environment');
      }
      
      if (jwtSecret.length < 32) {
        throw new Error('JWT secret must be at least 32 characters');
      }
    } catch (error) {
      log.error('🔐 JWT secret configuration error', LogContext.API, { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Authentication system not properly configured');
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

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      log.warn('Invalid JWT token', LogContext.API, { error: error.message });
      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_ERROR',
        message: 'Invalid token',
      });
      return;
    } else if (error instanceof jwt.TokenExpiredError) {
      log.warn('Expired JWT token', LogContext.API);
      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_ERROR',
        message: 'Token expired',
      });
      return;
    } else {
      log.error('Authentication failed', LogContext.API, { error });
      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed',
      });
      return;
    }
  }
};

export default authenticate;
