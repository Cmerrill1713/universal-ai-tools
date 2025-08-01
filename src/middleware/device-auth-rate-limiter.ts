/**
 * Device Authentication Rate Limiting Middleware
 * Production-ready rate limiting for device registration and authentication endpoints
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import type { Request, Response } from 'express';
import { createClient } from 'redis';
import { LogContext, log } from '../utils/logger';

// Create Redis client for rate limiting
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
  }
});

redisClient.on('error', (err) => {
  log.error('Redis client error for rate limiting', LogContext.SYSTEM, { error: err });
});

redisClient.connect().catch((err) => {
  log.error('Failed to connect to Redis for rate limiting', LogContext.SYSTEM, { error: err });
});

/**
 * Device registration rate limiter
 * Strict limits to prevent abuse during initial registration
 */
export const deviceRegistrationLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:device:register:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Allow 5 device registrations per 15 minutes per IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many device registration attempts. Please try again later.',
      retryAfter: 15 * 60 // seconds
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => {
    // Use IP address and user ID if available
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;
    return userId ? `${ip}:${userId}` : ip;
  },
  handler: (req: Request, res: Response) => {
    log.warn('Device registration rate limit exceeded', LogContext.SECURITY, {
      ip: req.ip,
      userId: (req as any).user?.id,
      path: req.path
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many device registration attempts. Please try again later.',
        retryAfter: 15 * 60
      }
    });
  }
});

/**
 * Challenge request rate limiter
 * More lenient for authentication attempts
 */
export const challengeRequestLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:device:challenge:',
  }),
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Allow 20 challenge requests per 5 minutes
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
      retryAfter: 5 * 60
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful authentications
  keyGenerator: (req: Request) => {
    // Use device ID if provided, otherwise IP
    const deviceId = req.body?.deviceId;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return deviceId ? `device:${deviceId}` : `ip:${ip}`;
  }
});

/**
 * Verification rate limiter
 * Strict limits for verification attempts
 */
export const verificationLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:device:verify:',
  }),
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Allow 10 verification attempts per 5 minutes
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many verification attempts. Please try again later.',
      retryAfter: 5 * 60
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => {
    // Use challenge ID to prevent brute force on specific challenges
    const challengeId = req.body?.challengeId;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return challengeId ? `challenge:${challengeId}` : `ip:${ip}`;
  },
  handler: (req: Request, res: Response) => {
    // Log potential brute force attempt
    log.error('Verification rate limit exceeded - potential brute force', LogContext.SECURITY, {
      ip: req.ip,
      challengeId: req.body?.challengeId,
      userAgent: req.headers['user-agent']
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many verification attempts. Please try again later.',
        retryAfter: 5 * 60
      }
    });
  }
});

/**
 * Proximity update rate limiter
 * Reasonable limits for normal operation
 */
export const proximityUpdateLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:device:proximity:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Allow 1 update per second on average
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many proximity updates. Please reduce update frequency.',
      retryAfter: 60
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => {
    // Use user ID and device ID
    const userId = (req as any).user?.id;
    const deviceId = req.body?.deviceId;
    return `${userId}:${deviceId}`;
  }
});

/**
 * WebSocket connection rate limiter
 * Prevent rapid reconnection attempts
 */
export const wsConnectionLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:device:ws:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Allow 10 WebSocket connections per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many WebSocket connection attempts. Please wait before reconnecting.',
      retryAfter: 60
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;
    return userId ? `${ip}:${userId}` : ip;
  }
});

/**
 * Global API rate limiter for all device auth endpoints
 * Fallback protection
 */
export const globalDeviceAuthLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:device:global:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Allow 100 requests per minute across all endpoints
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.',
      retryAfter: 60
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;
    return userId ? `user:${userId}` : `ip:${ip}`;
  }
});

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanupRateLimiters(): Promise<void> {
  try {
    await redisClient.quit();
    log.info('Rate limiter Redis connection closed', LogContext.SYSTEM);
  } catch (error) {
    log.error('Error closing rate limiter Redis connection', LogContext.SYSTEM, { error });
  }
}