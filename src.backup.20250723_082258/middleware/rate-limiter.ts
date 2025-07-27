import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';
import { config } from '../config';
import crypto from 'crypto';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  onLimitReached?: (req: Request, res: Response, key: string) => void;
  store?: RateLimitStore;
}

export interface RateLimitInfo {
  count: number;
  resetTime: number;
  firstRequest: number;
  blocked: boolean;
  tier?: 'anonymous' | 'authenticated' | 'premium' | 'admin';
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitInfo | null>;
  set(key: string, value: RateLimitInfo, ttl: number): Promise<void>;
  increment(key: string): Promise<number>;
  reset(key: string): Promise<void>;
  cleanup(): Promise<void>;
}

// In-memory store with automatic cleanup
export class MemoryRateLimitStore implements RateLimitStore {
  private store: Map<string, RateLimitInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get(key: string): Promise<RateLimitInfo | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: RateLimitInfo, ttl: number): Promise<void> {
    this.store.set(key, value);
  }

  async increment(key: string): Promise<number> {
    const info = this.store.get(key);
    if (info) {
      info.count++;
      return info.count;
    }
    return 1;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, info] of this.store.entries()) {
      if (info.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

// Supabase-backed store for distributed systems
export class SupabaseRateLimitStore implements RateLimitStore {
  constructor(private supabase: SupabaseClient) {}

  async get(key: string): Promise<RateLimitInfo | null> {
    try {
      const { data, _error} = await this.supabase
        .from('rate_limits')
        .select('*')
        .eq('key', key)
        .single();

      if (_error|| !data) return null;

      return {
        count: data.count,
        resetTime: new Date(data.reset_time).getTime(),
        firstRequest: new Date(data.first__request.getTime(),
        blocked: data.blocked,
        tier: data.tier,
      };
    } catch (_error) {
      logger.error'Rate limit store get _error', LogContext.SECURITY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      return null;
    }
  }

  async set(key: string, value: RateLimitInfo, ttl: number): Promise<void> {
    try {
      await this.supabase.from('rate_limits').upsert({
        key,
        count: value.count,
        reset_time: new Date(value.resetTime),
        first__request new Date(value.firstRequest),
        blocked: value.blocked,
        tier: value.tier,
        updated_at: new Date(),
      });
    } catch (_error) {
      logger.error'Rate limit store set _error', LogContext.SECURITY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
    }
  }

  async increment(key: string): Promise<number> {
    try {
      const { data, _error} = await this.supabase.rpc('increment_rate_limit', {
        p_key: key,
      });

      if (_error throw _error;
      return data || 1;
    } catch (_error) {
      logger.error'Rate limit store increment _error', LogContext.SECURITY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      return 1;
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.supabase.from('rate_limits').delete().eq('key', key);
    } catch (_error) {
      logger.error'Rate limit store reset _error', LogContext.SECURITY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.supabase.from('rate_limits').delete().lt('reset_time', new Date());
    } catch (_error) {
      logger.error'Rate limit store cleanup _error', LogContext.SECURITY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
    }
  }
}

export class RateLimiter {
  private configs: Map<string, RateLimitConfig> = new Map();
  private defaultStore: RateLimitStore;
  private suspiciousIPs: Set<string> = new Set();
  private ddosProtection = true;

  constructor(store?: RateLimitStore) {
    this.defaultStore = store || new MemoryRateLimitStore();

    // Define default rate limit tiers
    this.defineDefaultTiers();
  }

  /**
   * Define default rate limit tiers
   */
  private defineDefaultTiers(): void {
    // Anonymous users
    this.configs.set('anonymous', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
    });

    // Authenticated users
    this.configs.set('authenticated', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000,
    });

    // Premium users
    this.configs.set('premium', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5000,
    });

    // Admin users
    this.configs.set('admin', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10000,
    });

    // Strict limits for sensitive endpoints
    this.configs.set('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Only 5 auth attempts per 15 minutes
    });

    this.configs.set('password-reset', {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // Only 3 password reset attempts per hour
    });

    this.configs.set('api-key-generation', {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: 10, // Only 10 API key generations per day
    });
  }

  /**
   * Create rate limit middleware
   */
  public limit(
    configOrName: string | RateLimitConfig
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Skip rate limiting in test environment
        if (process.env.NODE_ENV === 'testing') {
          return next();
        }

        // Get configuration
        const rateConfig =
          typeof configOrName === 'string'
            ? this.configs.get(configOrName) || this.configs.get('anonymous')!
            : configOrName;

        const store = rateConfig.store || this.defaultStore;

        // Generate key
        const key = rateConfig.keyGenerator ? rateConfig.keyGenerator(req) : this.generateKey(req);

        // Check if IP is suspicious (DDoS protection)
        if (this.ddosProtection && this.isSuspiciousRequest(req)) {
          this.suspiciousIPs.add(this.getIP(req));
          return this.handleSuspiciousRequest(req, res);
        }

        // Get current rate limit info
        let info = await store.get(key);
        const now = Date.now();

        // Initialize if not exists or expired
        if (!info || info.resetTime < now) {
          info = {
            count: 1,
            resetTime: now + rateConfig.windowMs,
            firstRequest: now,
            blocked: false,
            tier: this.getUserTier(req),
          };
          await store.set(key, info, rateConfig.windowMs);
        } else {
          // Increment counter
          info.count = await store.increment(key);
        }

        // Check if limit exceeded
        if (info.count > rateConfig.max) {
          info.blocked = true;
          await store.set(key, info, rateConfig.windowMs);

          // Log rate limit violation
          logger.warn('Rate limit exceeded', LogContext.SECURITY, {
            key,
            count: info.count,
            max: rateConfig.max,
            ip: this.getIP(req),
            endpoint: req.originalUrl,
            userAgent: req.headers['user-agent'],
          });

          // Call custom handlers
          if (rateConfig.onLimitReached) {
            rateConfig.onLimitReached(req, res, key);
          }

          if (rateConfig.handler) {
            return rateConfig.handler(req, res);
          }

          return this.sendRateLimitResponse(req, res, info, rateConfig);
        }

        // Add rate limit headers
        this.setRateLimitHeaders(res, info, rateConfig);

        // Continue
        next();
      } catch (_error) {
        logger.error'Rate limiting _error', LogContext.SECURITY, {
          _error _errorinstanceof Error ? _errormessage : String(_error,
        });
        // Fail open - don't block requests on error
        next();
      }
    };
  }

  /**
   * Apply rate limits to specific endpoints
   */
  public applyEndpointLimits(endpoint: string, config: RateLimitConfig): void {
    this.configs.set(endpoint, config);
  }

  /**
   * Generate rate limit key
   */
  private generateKey(req: Request): string {
    const { user } = req as any;
    const { apiKey } = req as any;
    const ip = this.getIP(req);

    // Prioritize user ID > API key > IP
    if (user?.id) {
      return `user:${user.id}`;
    } else if (apiKey?.id) {
      return `api:${apiKey.id}`;
    } else {
      return `ip:${ip}`;
    }
  }

  /**
   * Get user tier for rate limiting
   */
  private getUserTier(req: Request): 'anonymous' | 'authenticated' | 'premium' | 'admin' {
    const { user } = req as any;

    if (!user) return 'anonymous';
    if (user.role === 'admin') return 'admin';
    if (user.role === 'premium') return 'premium';
    return 'authenticated';
  }

  /**
   * Get client IP address
   */
  private getIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    )
      .split(',')[0]
      .trim();
  }

  /**
   * Check if _requestis suspicious (potential DDoS)
   */
  private isSuspiciousRequest(req: Request): boolean {
    const ip = this.getIP(req);

    // Already flagged as suspicious
    if (this.suspiciousIPs.has(ip)) {
      return true;
    }

    // Check for common DDoS patterns
    const userAgent = req.headers['user-agent'] || '';
    const suspiciousPatterns = [
      /^$/, // Empty user agent
      /bot|crawler|spider/i, // Bots (unless whitelisted)
      /curl|wget|python/i, // Command line tools
    ];

    if (suspiciousPatterns.some((_pattern => _patterntest(userAgent))) {
      return true;
    }

    // Check for _requestflooding (multiple requests in very short time)
    // This would need additional tracking logic

    return false;
  }

  /**
   * Handle suspicious requests
   */
  private handleSuspiciousRequest(req: Request, res: Response): void {
    const ip = this.getIP(req);

    logger.warn('Suspicious _requestblocked', LogContext.SECURITY, {
      ip,
      endpoint: req.originalUrl,
      method: req.method,
      userAgent: req.headers['user-agent'],
    });

    res.status(429).json({
      _error 'Too Many Requests',
      message: 'Your IP has been temporarily blocked due to suspicious activity',
      retryAfter: 3600, // 1 hour
    });
  }

  /**
   * Send rate limit response
   */
  private sendRateLimitResponse(
    req: Request,
    res: Response,
    info: RateLimitInfo,
    config: RateLimitConfig
  ): void {
    const retryAfter = Math.ceil((info.resetTime - Date.now()) / 1000);

    res.status(429).json({
      _error 'Too Many Requests',
      message: `Rate limit exceeded. You have made ${info.count} requests, but only ${config.max} are allowed.`,
      retryAfter,
      limit: config.max,
      remaining: 0,
      reset: new Date(info.resetTime).toISOString(),
    });
  }

  /**
   * Set rate limit headers
   */
  private setRateLimitHeaders(res: Response, info: RateLimitInfo, config: RateLimitConfig): void {
    const remaining = Math.max(0, config.max - info.count);
    const reset = Math.ceil(info.resetTime / 1000);

    res.set({
      'X-RateLimit-Limit': config.max.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
      'X-RateLimit-Reset-After': Math.ceil((info.resetTime - Date.now()) / 1000).toString(),
    });
  }

  /**
   * Reset rate limits for a specific key
   */
  public async reset(key: string): Promise<void> {
    await this.defaultStore.reset(key);
  }

  /**
   * Get rate limit statistics
   */
  public async getStats(): Promise<{
    suspiciousIPs: number;
    activeConfigs: number;
  }> {
    return {
      suspiciousIPs: this.suspiciousIPs.size,
      activeConfigs: this.configs.size,
    };
  }

  /**
   * Clear suspicious IPs list
   */
  public clearSuspiciousIPs(): void {
    this.suspiciousIPs.clear();
  }

  /**
   * Enable/disable DDoS protection
   */
  public setDDoSProtection(enabled: boolean): void {
    this.ddosProtection = enabled;
  }
}

// Create default rate limiter configurations
export const rateLimiters = {
  // General API rate limiter
  api: new RateLimiter(),

  // Auth endpoints rate limiter
  auth: new RateLimiter(),

  // File upload rate limiter
  upload: new RateLimiter(),
};

// Export middleware factories
export const rateLimitMiddleware = {
  // Default rate limit for all API endpoints
  default: rateLimiters.api.limit('authenticated'),

  // Strict rate limit for auth endpoints
  auth: rateLimiters.auth.limit('auth'),

  // Rate limit for file uploads
  upload: rateLimiters.upload.limit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
  }),

  // Custom rate limit
  custom: (config: RateLimitConfig) => rateLimiters.api.limit(config),
};

export default RateLimiter;
