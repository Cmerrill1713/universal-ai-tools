import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { config } from '@/config/environment';
import { LogContext, log } from '@/utils/logger';

const MILLISECONDS_IN_SECOND = 1000;

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// Environment-based configuration
const rateLimitDefaults: RateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute default
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // 100 requests per window
  keyPrefix: 'rate-limit',
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  standardHeaders: process.env.RATE_LIMIT_STANDARD_HEADERS !== 'false',
  legacyHeaders: process.env.RATE_LIMIT_LEGACY_HEADERS !== 'false',
};

// Endpoint-specific configurations
const endpointConfigs: Record<string, RateLimitConfig> = {
  '/api/v1/auth/login': {
    windowMs: 15 * 60 * MILLISECONDS_IN_SECOND, // 15 minutes
    maxRequests: 5, // 5 login attempts per 15 minutes
    keyPrefix: 'auth:login',
  },
  '/api/v1/auth/register': {
    windowMs: 60 * 60 * MILLISECONDS_IN_SECOND, // 1 hour
    maxRequests: 3, // 3 registrations per hour
    keyPrefix: 'auth:register',
  },
  '/api/v1/orchestration': {
    windowMs: 60 * MILLISECONDS_IN_SECOND, // 1 minute
    maxRequests: 30, // 30 orchestration requests per minute
    keyPrefix: 'orchestration',
  },
  '/api/v1/memory': {
    windowMs: 60 * MILLISECONDS_IN_SECOND, // 1 minute
    maxRequests: 50, // 50 memory operations per minute
    keyPrefix: 'memory',
  },
  '/api/v1/speech': {
    windowMs: 60 * MILLISECONDS_IN_SECOND, // 1 minute
    maxRequests: 20, // 20 speech operations per minute
    keyPrefix: 'speech',
  },
  '/api/v1/knowledge': {
    windowMs: 60 * MILLISECONDS_IN_SECOND, // 1 minute
    maxRequests: 40, // 40 knowledge queries per minute
    keyPrefix: 'knowledge',
  },
  // Broader patterns (prefix match)
  '/api/v1/assistant/': {
    windowMs: 60 * MILLISECONDS_IN_SECOND,
    maxRequests: 60,
    keyPrefix: 'assistant',
  },
  '/api/v1/agents/': {
    windowMs: 60 * MILLISECONDS_IN_SECOND,
    maxRequests: 30,
    keyPrefix: 'agents',
  },
  '/api/v1/external-apis/': {
    windowMs: 60 * MILLISECONDS_IN_SECOND,
    maxRequests: 60,
    keyPrefix: 'external',
  },
};

class RateLimiter {
  private redis: Redis | null = null;
  private inMemoryStore: Map<string, TokenBucket> = new Map();
  private useRedis = false;

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis(): void {
    if (config.redis?.url) {
      try {
        this.redis = new Redis(config.redis.url, {
          retryStrategy: (times: number) => {
            if (times > (config.redis?.retryAttempts || 3)) {
              log.error(
                'Redis connection failed, falling back to in-memory rate limiting',
                LogContext.API
              );
              this.useRedis = false;
              return null;
            }
            return Math.min(times * 50, 2000);
          },
          reconnectOnError: (err: Error) => {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
              return true;
            }
            return false;
          },
        });

        this.redis.on('connect', () => {
          this.useRedis = true;
          log.info('Redis connected for rate limiting', LogContext.API);
        });

        this.redis.on('error', (err: Error) => {
          log.error('Redis error in rate limiter', LogContext.API, { error: err.message });
          this.useRedis = false;
        });
      } catch (error) {
        log.error('Failed to initialize Redis for rate limiting', LogContext.API, { error });
        this.useRedis = false;
      }
    } else {
      log.info('Redis not configured, using in-memory rate limiting', LogContext.API);
    }
  }

  private getKey(req: Request, keyPrefix?: string): string {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;
    const prefix = keyPrefix || 'rate-limit';

    // Use user ID if authenticated, otherwise use IP
    const identifier = userId || ip;
    return `${prefix}:${identifier}`;
  }

  private async getTokenBucket(key: string, config: RateLimitConfig): Promise<TokenBucket> {
    const now = Date.now();

    if (this.useRedis && this.redis) {
      try {
        const data = await this.redis.get(key);
        if (data) {
          const bucket = JSON.parse(data) as TokenBucket;
          return this.refillTokens(bucket, config, now);
        }
      } catch (error) {
        log.error('Redis error getting token bucket', LogContext.API, { error, key });
        // Fall through to create new bucket
      }
    } else {
      // In-memory fallback
      const bucket = this.inMemoryStore.get(key);
      if (bucket) {
        return this.refillTokens(bucket, config, now);
      }
    }

    // Create new bucket
    return {
      tokens: config.maxRequests,
      lastRefill: now,
    };
  }

  private refillTokens(bucket: TokenBucket, config: RateLimitConfig, now: number): TokenBucket {
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed * config.maxRequests) / config.windowMs);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    return bucket;
  }

  private async saveTokenBucket(
    key: string,
    bucket: TokenBucket,
    config: RateLimitConfig
  ): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        const ttl = Math.ceil(config.windowMs / MILLISECONDS_IN_SECOND);
        await this.redis.setex(key, ttl, JSON.stringify(bucket));
      } catch (error) {
        log.error('Redis error saving token bucket', LogContext.API, { error, key });
        // Fall through to in-memory
      }
    }

    // Always save to in-memory as fallback
    this.inMemoryStore.set(key, bucket);

    // Clean up old entries periodically
    if (this.inMemoryStore.size > 10000) {
      this.cleanupInMemoryStore();
    }
  }

  private cleanupInMemoryStore(): void {
    const now = Date.now();
    const entries = Array.from(this.inMemoryStore.entries());

    // Remove entries older than 1 hour
    entries.forEach(([key, bucket]) => {
      if (now - bucket.lastRefill > 3600000) {
        this.inMemoryStore.delete(key);
      }
    });
  }

  private getRateLimitInfo(bucket: TokenBucket, config: RateLimitConfig): RateLimitInfo {
    const now = Date.now();
    const windowEnd = bucket.lastRefill + config.windowMs;
    const msUntilReset = Math.max(0, windowEnd - now);

    return {
      limit: config.maxRequests,
      remaining: Math.max(0, bucket.tokens),
      reset: new Date(windowEnd),
      retryAfter: bucket.tokens <= 0 ? Math.ceil(msUntilReset / MILLISECONDS_IN_SECOND) : undefined,
    };
  }

  private setHeaders(res: Response, info: RateLimitInfo, config: RateLimitConfig): void {
    if (config.standardHeaders !== false) {
      res.setHeader('RateLimit-Limit', info.limit);
      res.setHeader('RateLimit-Remaining', info.remaining);
      res.setHeader('RateLimit-Reset', info.reset.toISOString());
    }

    if (config.legacyHeaders !== false) {
      res.setHeader('X-RateLimit-Limit', info.limit);
      res.setHeader('X-RateLimit-Remaining', info.remaining);
      res.setHeader('X-RateLimit-Reset', Math.floor(info.reset.getTime() / MILLISECONDS_IN_SECOND));
    }

    if (info.retryAfter !== undefined) {
      res.setHeader('Retry-After', info.retryAfter);
    }
  }

  public middleware(customConfig?: Partial<RateLimitConfig>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Get endpoint-specific config or use defaults
        const endpoint = req.path;
        // Exact match, else choose the longest prefix match
        let baseConfig = endpointConfigs[endpoint];
        if (!baseConfig) {
          let bestKey = '';
          for (const key of Object.keys(endpointConfigs)) {
            if (endpoint.startsWith(key) && key.length > bestKey.length) {
              bestKey = key;
            }
          }
          baseConfig = bestKey ? endpointConfigs[bestKey] : rateLimitDefaults;
        }
        const ensuredBase = baseConfig || rateLimitDefaults;
        const config: RateLimitConfig = {
          ...ensuredBase,
          ...customConfig,
          windowMs: (customConfig?.windowMs ?? ensuredBase.windowMs) as number,
          maxRequests: (customConfig?.maxRequests ?? ensuredBase.maxRequests) as number,
        };

        const key = this.getKey(req, config.keyPrefix);
        const bucket = await this.getTokenBucket(key, config);

        const info = this.getRateLimitInfo(bucket, config);
        this.setHeaders(res, info, config);

        // Check if request should be rate limited
        if (bucket.tokens <= 0) {
          log.warn('Rate limit exceeded', LogContext.API, {
            key,
            endpoint,
            ip: req.ip,
            userId: (req as any).user?.id,
          });

          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later',
              details: {
                limit: info.limit,
                windowMs: config.windowMs,
                retryAfter: info.retryAfter,
              },
            },
          });
          return;
        }

        // Consume a token
        bucket.tokens--;
        await this.saveTokenBucket(key, bucket, config);

        // Update remaining header after consumption
        res.setHeader('RateLimit-Remaining', Math.max(0, bucket.tokens));
        if (config.legacyHeaders !== false) {
          res.setHeader('X-RateLimit-Remaining', Math.max(0, bucket.tokens));
        }

        next();
      } catch (error) {
        log.error('Rate limiter error', LogContext.API, { error });
        // On error, allow the request to proceed
        next();
      }
    };
  }

  public async reset(identifier?: string): Promise<void> {
    if (identifier) {
      const pattern = `*:${identifier}`;

      if (this.useRedis && this.redis) {
        try {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } catch (error) {
          log.error('Redis error resetting rate limit', LogContext.API, { error, identifier });
        }
      }

      // Also clear from in-memory store
      Array.from(this.inMemoryStore.keys())
        .filter((key) => key.includes(identifier))
        .forEach((key) => this.inMemoryStore.delete(key));
    } else {
      // Reset all
      if (this.useRedis && this.redis) {
        try {
          await this.redis.flushdb();
        } catch (error) {
          log.error('Redis error flushing rate limits', LogContext.API, { error });
        }
      }
      this.inMemoryStore.clear();
    }
  }

  public async getStatus(identifier: string): Promise<Record<string, RateLimitInfo> | null> {
    const status: Record<string, RateLimitInfo> = {};

    try {
      // Check all endpoint configs
      for (const [endpoint, endpointConfig] of Object.entries(endpointConfigs)) {
        const key = `${endpointConfig.keyPrefix || 'rate-limit'}:${identifier}`;
        const bucket = await this.getTokenBucket(key, endpointConfig);

        if (bucket.lastRefill > 0) {
          status[endpoint] = this.getRateLimitInfo(bucket, endpointConfig);
        }
      }

      return Object.keys(status).length > 0 ? status : null;
    } catch (error) {
      log.error('Error getting rate limit status', LogContext.API, { error, identifier });
      return null;
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Export middleware factory
export const createRateLimiter = (config?: Partial<RateLimitConfig>) => {
  return rateLimiter.middleware(config);
};

// Export instance methods for admin operations
export const resetRateLimit = rateLimiter.reset.bind(rateLimiter);
export const getRateLimitStatus = rateLimiter.getStatus.bind(rateLimiter);

// Export default middleware with standard config
export default createRateLimiter();
