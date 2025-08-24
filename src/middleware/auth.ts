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
  iss?: string; // issuer
  aud?: string; // audience
  jti?: string; // JWT ID for revocation tracking
  sub?: string; // subject
  isDemoToken?: boolean; // Mark demo tokens for special handling
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

    // Remove all development bypasses for production security
    // Authentication is always required

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

    // Verify JWT token with enhanced validation
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['HS256'], // Explicitly specify allowed algorithms for security
      clockTolerance: 30, // Allow 30 seconds clock skew
      maxAge: '24h', // Maximum token age
      issuer: process.env.JWT_ISSUER || 'universal-ai-tools', // Validate issuer
      audience: process.env.JWT_AUDIENCE || 'universal-ai-tools-api', // Validate audience
      ignoreExpiration: false, // Ensure expiration is always checked
      ignoreNotBefore: false // Ensure nbf (not before) is checked if present
    };

    const decoded = jwt.verify(token, jwtSecret, verifyOptions) as JwtPayload;

    // Additional security validations
    if (!decoded.userId) {
      throw new Error('Token missing required userId claim');
    }

    // Validate token structure and required claims
    if (typeof decoded.userId !== 'string' || decoded.userId.length === 0) {
      throw new Error('Invalid userId claim in token');
    }

    // Enhanced token validation
    if (decoded.userId.length > 100) {
      throw new Error('userId claim exceeds maximum length');
    }

    // Validate email format if present
    if (decoded.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decoded.email)) {
      throw new Error('Invalid email format in token');
    }

    // Validate permissions array if present
    if (decoded.permissions && (!Array.isArray(decoded.permissions) || 
        decoded.permissions.some(p => typeof p !== 'string' || p.length > 50))) {
      throw new Error('Invalid permissions format in token');
    }

    // Check for suspicious token age
    if (decoded.iat) {
      const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;
      if (tokenAge > 24 * 60 * 60) { // 24 hours
        log.warn('🔐 Very old token being used', LogContext.SECURITY, {
          userId: decoded.userId,
          tokenAgeHours: Math.floor(tokenAge / 3600)
        });
      }
    }

    // Check for token replay attacks (optional: implement jti blacklist)
    if (decoded.jti) {
      try {
        const redis = await getRedisService();
        if (redis?.isConnected()) {
          const isBlacklisted = await redis.get(`blacklist:jti:${decoded.jti}`);
          if (isBlacklisted) {
            throw new Error('Token has been revoked');
          }
        }
      } catch (error) {
        log.warn('Failed to check token blacklist', LogContext.SECURITY, { error });
        // Continue without blacklist check if Redis is unavailable
      }
    }

    // Check for user-level revocation (logout from all devices)
    const userRevoked = await isUserRevoked(decoded);
    if (userRevoked) {
      throw new Error('All user tokens have been revoked');
    }

    log.info('🔐 JWT token verified successfully', LogContext.API, {
      userId: decoded.userId,
      permissions: decoded.permissions?.slice(0, 5), // Limit logged permissions
      deviceId: decoded.deviceId ? decoded.deviceId.substring(0, 8) + '...' : undefined,
      tokenAge: decoded.iat ? Math.floor((Date.now() / 1000) - decoded.iat) : undefined,
      isDemoToken: decoded.isDemoToken || false,
      deviceType: decoded.deviceType
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
function _isLocalDevelopmentRequest(req: Request): boolean {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (!isDevelopment) {return false;}
  
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
    if (redis?.isConnected()) {
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
  const userAgent = req.get('User-Agent') || 'unknown';
  const authHeader = req.headers.authorization ? 'present' : 'missing';
  const redis = await getRedisService();
  const failKey = `auth:fail:${ip}`;
  const lockKey = `auth:lock:${ip}`;

  // Enhanced security logging
  log.warn('🚨 Authentication failure recorded', LogContext.SECURITY, {
    ip,
    userAgent: userAgent.substring(0, 100), // Truncate for security
    authHeader,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    event: 'auth_failure'
  });

  if (redis?.isConnected()) {
    const cur = await redis.get(failKey);
    const count = (typeof cur === 'number' ? cur : Number(cur?.count || cur) || 0) + 1;
    
    // Store enhanced failure data
    const failureData = {
      count,
      ts: Date.now(),
      lastUserAgent: userAgent,
      lastPath: req.path,
      lastMethod: req.method
    };
    
    await redis.set(failKey, failureData, FAILURE_WINDOW_SEC);
    
    // Create security audit entry
    const auditEntry = {
      type: 'auth_failure',
      ip,
      userAgent,
      path: req.path,
      method: req.method,
      count,
      timestamp: Date.now()
    };
    await redis.lpush('security:audit:auth_failures', JSON.stringify(auditEntry));
    await redis.expire('security:audit:auth_failures', 30 * 24 * 60 * 60); // 30 days
    
    if (count >= LOCKOUT_THRESHOLD) {
      await redis.set(lockKey, { until: Date.now() + LOCKOUT_TTL_SEC * 1000 }, LOCKOUT_TTL_SEC);
      
      // Alert on lockout
      log.error('🚨 IP address locked out due to repeated auth failures', LogContext.SECURITY, {
        ip,
        failureCount: count,
        lockoutDuration: LOCKOUT_TTL_SEC,
        userAgent,
        timestamp: new Date().toISOString()
      });
      
      // Store lockout audit entry
      const lockoutAudit = {
        type: 'auth_lockout',
        ip,
        failureCount: count,
        lockoutUntil: Date.now() + LOCKOUT_TTL_SEC * 1000,
        userAgent,
        timestamp: Date.now()
      };
      await redis.lpush('security:audit:lockouts', JSON.stringify(lockoutAudit));
      await redis.expire('security:audit:lockouts', 30 * 24 * 60 * 60); // 30 days
    }
    
    // Track patterns for advanced threat detection
    const hourlyKey = `auth_failures:hourly:${Math.floor(Date.now() / (60 * 60 * 1000))}`;
    await redis.incr(hourlyKey);
    await redis.expire(hourlyKey, 60 * 60); // 1 hour
    
    const hourlyCount = await redis.get(hourlyKey);
    if (Number(hourlyCount) >= 100) { // High failure rate threshold
      log.error('🚨 High authentication failure rate detected', LogContext.SECURITY, {
        hourlyFailures: hourlyCount,
        threshold: 100,
        window: '1 hour'
      });
    }
    
    return;
  }

  // Fallback in-memory with enhanced data
  const current = authFailures.get(ip) || { count: 0, ts: Date.now() };
  const updated = { 
    count: current.count + 1, 
    ts: Date.now(),
    lastUserAgent: userAgent,
    lastPath: req.path 
  } as { count: number; ts: number; lastUserAgent: string; lastPath: string };
  
  authFailures.set(ip, updated);
  setTimeout(() => authFailures.delete(ip), FAILURE_WINDOW_SEC * 1000);
  
  if (updated.count >= LOCKOUT_THRESHOLD) {
    authLockouts.set(ip, { until: Date.now() + LOCKOUT_TTL_SEC * 1000 });
    setTimeout(() => authLockouts.delete(ip), LOCKOUT_TTL_SEC * 1000);
    
    log.error('🚨 IP address locked out (in-memory)', LogContext.SECURITY, {
      ip,
      failureCount: updated.count,
      lockoutDuration: LOCKOUT_TTL_SEC
    });
  }
}

async function recordAuthSuccess(req: Request): Promise<void> {
  const ip = getClientIp(req);
  const redis = await getRedisService();
  const failKey = `auth:fail:${ip}`;
  const lockKey = `auth:lock:${ip}`;
  if (redis?.isConnected()) {
    await redis.del(failKey);
    await redis.del(lockKey);
    return;
  }
  authFailures.delete(ip);
  authLockouts.delete(ip);
}

async function _isIpLockedOut(req: Request): Promise<boolean> {
  const ip = getClientIp(req);
  const redis = await getRedisService();
  const lockKey = `auth:lock:${ip}`;
  if (redis?.isConnected()) {
    const val = await redis.get(lockKey);
    if (!val) {return false;}
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
  if (redis?.isConnected()) {
    const val = await redis.get(lockKey);
    const until = typeof val === 'number' ? val : Number(val?.until || 0);
    if (!until) {return 0;}
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }
  const entry = authLockouts.get(ip);
  if (!entry) {return 0;}
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

  // Load secret from enhanced secrets manager
  try {
    const jwtSecret = await secretsManager.getJwtSecret();
    
    if (!jwtSecret) {
      log.error('🔐 JWT secret not available from secrets manager', LogContext.API);
      return null;
    }
    
    // Cache the secret
    cachedJwtSecret = jwtSecret;
    jwtSecretExpiry = now + JWT_CACHE_TTL;
    
    log.info('🔐 JWT secret cached with enhanced security validation', LogContext.API, { 
      length: jwtSecret.length,
      cacheExpiry: new Date(jwtSecretExpiry).toISOString(),
      cacheTtlMinutes: JWT_CACHE_TTL / (60 * 1000)
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
 * Record successful API key authentication for audit purposes
 */
async function recordAPIKeySuccess(service: string, keyField: string): Promise<void> {
  try {
    const { LogContext, log } = await import('../utils/logger');
    log.info('🔑 API key authentication successful', LogContext.SECURITY, {
      service,
      keyField,
      timestamp: new Date().toISOString(),
      event: 'api_key_success'
    });

    // Store in security audit log if available
    try {
      const redis = await getRedisService();
      if (redis?.isConnected()) {
        const auditEntry = {
          type: 'api_key_success',
          service,
          keyField,
          timestamp: Date.now()
        };
        await redis.lpush('security:audit:api_keys', JSON.stringify(auditEntry));
        await redis.expire('security:audit:api_keys', 30 * 24 * 60 * 60); // 30 days
      }
    } catch (error) {
      // Audit logging failure shouldn't break authentication
      log.warn('Failed to store API key success audit log', LogContext.SECURITY, { error });
    }
  } catch (error) {
    // Even logging failure shouldn't break authentication
    console.error('API key success logging failed:', error);
  }
}

/**
 * Record failed API key authentication for audit and security monitoring
 */
async function recordAPIKeyFailure(category: string, reason: string): Promise<void> {
  try {
    const { LogContext, log } = await import('../utils/logger');
    log.warn('🚨 API key authentication failed', LogContext.SECURITY, {
      category,
      reason,
      timestamp: new Date().toISOString(),
      event: 'api_key_failure'
    });

    // Store in security audit log if available
    try {
      const redis = await getRedisService();
      if (redis?.isConnected()) {
        const auditEntry = {
          type: 'api_key_failure',
          category,
          reason,
          timestamp: Date.now()
        };
        await redis.lpush('security:audit:api_key_failures', JSON.stringify(auditEntry));
        await redis.expire('security:audit:api_key_failures', 30 * 24 * 60 * 60); // 30 days

        // Track failure patterns for alerting
        const failureKey = `api_key_failures:${category}:${reason}`;
        await redis.incr(failureKey);
        await redis.expire(failureKey, 60 * 60); // 1 hour window

        const count = await redis.get(failureKey);
        if (Number(count) >= 10) { // Alert threshold
          log.error('🚨 High API key failure rate detected', LogContext.SECURITY, {
            category,
            reason,
            count,
            window: '1 hour'
          });
        }
      }
    } catch (error) {
      // Audit logging failure shouldn't break authentication
      log.warn('Failed to store API key failure audit log', LogContext.SECURITY, { error });
    }
  } catch (error) {
    // Even logging failure shouldn't break authentication
    console.error('API key failure logging failed:', error);
  }
}

/**
 * Validate API key against stored keys with timing-safe comparison
 * Prevents timing attacks by using constant-time comparison
 */
export async function authenticateAPIKey(apiKey: string): Promise<boolean> {
  const crypto = await import('crypto');
  
  try {
    // Input validation with consistent timing
    if (!apiKey) {
      // Perform dummy operation to maintain consistent timing
      crypto.timingSafeEqual(Buffer.from('dummy32charlengthstringforsecurity'), Buffer.from('dummy32charlengthstringforsecurity'));
      await recordAPIKeyFailure('invalid_input', 'missing_api_key');
      return false;
    }
    
    if (apiKey.length < 32) {
      // Perform dummy operation to maintain consistent timing
      crypto.timingSafeEqual(Buffer.from('dummy32charlengthstringforsecurity'), Buffer.from('dummy32charlengthstringforsecurity'));
      await recordAPIKeyFailure('invalid_input', 'key_too_short');
      return false;
    }

    // Validate against Vault-backed service configuration
    const services = await secretsManager.getAvailableServices();
    
    // If no services are available, return false
    if (!services || services.length === 0) {
      // Perform dummy operation to maintain consistent timing
      crypto.timingSafeEqual(Buffer.from('dummy32charlengthstringforsecurity'), Buffer.from('dummy32charlengthstringforsecurity'));
      await recordAPIKeyFailure('config_error', 'no_services_available');
      return false;
    }

    let validKeyFound = false;
    
    // Check if any service has this API key using timing-safe comparison
    for (const service of services) {
      try {
        // Check service configuration for API key
        const serviceConfig = await secretsManager.getServiceConfig(service);
        
        if (serviceConfig?.api_key) {
          // Use timing-safe comparison to prevent timing attacks
          const storedKey = Buffer.from(serviceConfig.api_key, 'utf8');
          const providedKey = Buffer.from(apiKey, 'utf8');
          
          // Ensure both buffers are the same length for comparison
          if (storedKey.length === providedKey.length && 
              crypto.timingSafeEqual(storedKey, providedKey)) {
            validKeyFound = true;
            await recordAPIKeySuccess(service, 'api_key_field');
            break;
          }
        }
        
        if (serviceConfig?.apiKey) {
          // Check alternative field name with timing-safe comparison
          const storedKey = Buffer.from(serviceConfig.apiKey, 'utf8');
          const providedKey = Buffer.from(apiKey, 'utf8');
          
          if (storedKey.length === providedKey.length && 
              crypto.timingSafeEqual(storedKey, providedKey)) {
            validKeyFound = true;
            await recordAPIKeySuccess(service, 'apiKey_field');
            break;
          }
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
    
    // Check dedicated API gateway service with timing-safe comparison
    if (!validKeyFound) {
      try {
        const apiServiceCfg = await secretsManager.getServiceConfig('api_gateway');
        if (apiServiceCfg?.api_key) {
          const storedKey = Buffer.from(apiServiceCfg.api_key, 'utf8');
          const providedKey = Buffer.from(apiKey, 'utf8');
          
          if (storedKey.length === providedKey.length && 
              crypto.timingSafeEqual(storedKey, providedKey)) {
            validKeyFound = true;
            await recordAPIKeySuccess('api_gateway', 'api_key_field');
          }
        }
      } catch (error) {
        // Log but don't fail - this is optional
        const { LogContext, log } = await import('../utils/logger');
        log.debug('API gateway service not configured', LogContext.API);
      }
    }

    if (!validKeyFound) {
      await recordAPIKeyFailure('authentication', 'invalid_api_key');
    }

    return validKeyFound;
  } catch (error) {
    const { LogContext, log } = await import('../utils/logger');
    log.error('API key validation failed', LogContext.API, { error });
    await recordAPIKeyFailure('system_error', 'validation_exception');
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
 * Token revocation function for secure logout
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    // Decode token without verification to get jti
    const decoded = jwt.decode(token) as JwtPayload | null;
    
    if (!decoded?.jti) {
      log.warn('Attempted to revoke token without jti', LogContext.SECURITY);
      return false;
    }

    const redis = await getRedisService();
    if (redis?.isConnected()) {
      // Add token to blacklist
      const expiry = decoded.exp ? decoded.exp * 1000 : Date.now() + 24 * 60 * 60 * 1000; // 24h default
      const ttl = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      
      await redis.set(`blacklist:jti:${decoded.jti}`, 'revoked', ttl);
      
      log.info('🔐 Token successfully revoked', LogContext.SECURITY, {
        jti: decoded.jti,
        userId: decoded.userId,
        ttl
      });
      
      return true;
    }
    
    log.warn('Token revocation failed - Redis unavailable', LogContext.SECURITY);
    return false;
  } catch (error) {
    log.error('Token revocation error', LogContext.SECURITY, { error });
    return false;
  }
}

/**
 * Revoke all tokens for a user (logout from all devices)
 */
export async function revokeAllUserTokens(userId: string): Promise<boolean> {
  try {
    const redis = await getRedisService();
    if (redis?.isConnected()) {
      // Set a user-level revocation timestamp
      const revocationTime = Date.now();
      await redis.set(`user:revoke:${userId}`, revocationTime, 24 * 60 * 60); // 24 hours
      
      log.info('🔐 All tokens revoked for user', LogContext.SECURITY, {
        userId,
        revocationTime: new Date(revocationTime).toISOString()
      });
      
      return true;
    }
    
    log.warn('User token revocation failed - Redis unavailable', LogContext.SECURITY);
    return false;
  } catch (error) {
    log.error('User token revocation error', LogContext.SECURITY, { error });
    return false;
  }
}

/**
 * Check if user has been globally revoked (for all-device logout)
 */
async function isUserRevoked(decoded: JwtPayload): Promise<boolean> {
  try {
    if (!decoded.userId || !decoded.iat) {
      return false;
    }

    const redis = await getRedisService();
    if (redis?.isConnected()) {
      const revocationTime = await redis.get(`user:revoke:${decoded.userId}`);
      if (revocationTime) {
        const tokenIssuedAt = decoded.iat * 1000; // Convert to milliseconds
        const userRevokedAt = Number(revocationTime);
        
        if (tokenIssuedAt < userRevokedAt) {
          log.warn('Token issued before user revocation', LogContext.SECURITY, {
            userId: decoded.userId,
            tokenIssuedAt: new Date(tokenIssuedAt).toISOString(),
            userRevokedAt: new Date(userRevokedAt).toISOString()
          });
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    log.warn('Failed to check user revocation status', LogContext.SECURITY, { error });
    return false; // Fail open if we can't check
  }
}

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
