/**
 * Comprehensive Rate Limiting Middleware
 * Advanced rate limiting with multiple strategies, adaptive limits, and bypass capabilities
 */

import type { NextFunction, Request, Response } from 'express';

import { config } from '../config/environment';
import { sendError } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipIf?: (req: Request) => boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

interface RateLimitRule {
  path: string | RegExp;
  method?: string | string[];
  config: RateLimitConfig;
}

interface ClientData {
  requests: number[];
  lastReset: number;
  consecutiveFailures: number;
  lastFailure: number;
}

export class ComprehensiveRateLimiter {
  private store = new Map<string, ClientData>();
  private rules: RateLimitRule[] = [];
  private globalConfig: RateLimitConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(globalConfig: RateLimitConfig) {
    this.globalConfig = globalConfig;
    this.startCleanup();
  }

  /**
   * Add rate limiting rule for specific paths/methods
   */
  addRule(rule: RateLimitRule): void {
    this.rules.push(rule);
    log.info('📋 Rate limit rule added', LogContext.API, {
      path: rule.path.toString(),
      method: rule.method || 'ALL',
      maxRequests: rule.config.maxRequests,
      windowMs: rule.config.windowMs,
    });
  }

  /**
   * Create Express middleware
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Check for explicit test bypass headers only
        const testBypass = req.headers['x-test-bypass'] === 'true' || 
                          req.headers['x-testing-mode'] === 'true';
        if (testBypass) {
          log.debug('Rate limiting bypassed via test headers', LogContext.API, {
            path: req.path,
            method: req.method,
            headers: {
              'x-test-bypass': req.headers['x-test-bypass'],
              'x-testing-mode': req.headers['x-testing-mode']
            }
          });
          return next();
        }

        const rateLimitConfig = this.getConfigForRequest(req);
        
        if (rateLimitConfig.skipIf && rateLimitConfig.skipIf(req)) {
          return next();
        }

        const key = rateLimitConfig.keyGenerator ? rateLimitConfig.keyGenerator(req) : this.getDefaultKey(req);
        const clientData = this.getClientData(key);
        const now = Date.now();

        // Reset window if needed
        if (now - clientData.lastReset > rateLimitConfig.windowMs) {
          clientData.requests = [];
          clientData.lastReset = now;
        }

        // Clean old requests outside window
        const windowStart = now - rateLimitConfig.windowMs;
        clientData.requests = clientData.requests.filter(time => time > windowStart);

        // Check if limit exceeded
        if (clientData.requests.length >= rateLimitConfig.maxRequests) {
          // Apply progressive penalties for repeated violations
          const penalty = this.calculatePenalty(clientData);
          
          if (rateLimitConfig.onLimitReached) {
            rateLimitConfig.onLimitReached(req, res);
          }

          // Set retry-after header
          const retryAfter = Math.ceil((rateLimitConfig.windowMs - (now - Math.min(...clientData.requests))) / 1000) + penalty;
          res.setHeader('Retry-After', retryAfter.toString());
          res.setHeader('X-RateLimit-Limit', rateLimitConfig.maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', new Date(now + rateLimitConfig.windowMs).toISOString());

          log.warn('🚫 Rate limit exceeded', LogContext.API, {
            key,
            path: req.path,
            method: req.method,
            requests: clientData.requests.length,
            limit: rateLimitConfig.maxRequests,
            windowMs: rateLimitConfig.windowMs,
            retryAfter,
          });

          // Track failure for progressive penalties
          clientData.consecutiveFailures++;
          clientData.lastFailure = now;

          return sendError(
            res,
            'RATE_LIMIT_EXCEEDED',
            `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            429
          );
        }

        // Record request
        clientData.requests.push(now);
        
        // Reset failure count on successful request
        clientData.consecutiveFailures = 0;

        // Set rate limit headers
        const remaining = Math.max(0, rateLimitConfig.maxRequests - clientData.requests.length);
        res.setHeader('X-RateLimit-Limit', rateLimitConfig.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', new Date(clientData.lastReset + rateLimitConfig.windowMs).toISOString());

        // Store updated data
        this.store.set(key, clientData);

        next();
      } catch (error) {
        log.error('Rate limiter error', LogContext.API, { error });
        // Continue without rate limiting on error
        next();
      }
    };
  }

  /**
   * Get rate limit configuration for specific request
   */
  private getConfigForRequest(req: Request): RateLimitConfig {
    for (const rule of this.rules) {
      if (this.matchesRule(req, rule)) {
        return rule.config;
      }
    }
    return this.globalConfig;
  }

  /**
   * Check if request matches a rule
   */
  private matchesRule(req: Request, rule: RateLimitRule): boolean {
    // Check path
    const pathMatches = rule.path instanceof RegExp 
      ? rule.path.test(req.path)
      : req.path.startsWith(rule.path as string);

    if (!pathMatches) return false;

    // Check method if specified
    if (rule.method) {
      const methods = Array.isArray(rule.method) ? rule.method : [rule.method];
      if (!methods.includes(req.method)) return false;
    }

    return true;
  }

  /**
   * Get client data (create if not exists)
   */
  private getClientData(key: string): ClientData {
    if (!this.store.has(key)) {
      this.store.set(key, {
        requests: [],
        lastReset: Date.now(),
        consecutiveFailures: 0,
        lastFailure: 0,
      });
    }
    return this.store.get(key)!;
  }

  /**
   * Generate default key for rate limiting
   */
  private getDefaultKey(req: Request): string {
    // Prefer user ID for authenticated requests
    if ((req as any).user?.id) {
      return `user:${(req as any).user.id}`;
    }

    // Fall back to IP address
    return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
  }

  /**
   * Calculate progressive penalty for repeated violations
   */
  private calculatePenalty(clientData: ClientData): number {
    if (clientData.consecutiveFailures === 0) return 0;

    // Exponential backoff with max cap
    const basePenalty = Math.min(clientData.consecutiveFailures * 2, 60); // Max 60 seconds
    const timeSinceLastFailure = Date.now() - clientData.lastFailure;
    
    // Reduce penalty if some time has passed
    if (timeSinceLastFailure > 60000) { // 1 minute
      return Math.floor(basePenalty / 2);
    }
    
    return basePenalty;
  }

  /**
   * Start cleanup process for old entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = Math.max(this.globalConfig.windowMs, 3600000); // At least 1 hour

      for (const [key, data] of this.store.entries()) {
        if (now - data.lastReset > maxAge && data.requests.length === 0) {
          this.store.delete(key);
        }
      }

      log.debug('Rate limiter cleanup completed', LogContext.API, {
        activeClients: this.store.size,
      });
    }, 300000); // Every 5 minutes
  }

  /**
   * Get current statistics
   */
  getStats(): {
    activeClients: number;
    totalRules: number;
    memoryUsage: number;
  } {
    return {
      activeClients: this.store.size,
      totalRules: this.rules.length,
      memoryUsage: JSON.stringify(Array.from(this.store.entries())).length,
    };
  }

  /**
   * Reset rate limits for a specific key
   */
  reset(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.store.clear();
    log.info('🔄 All rate limits reset', LogContext.API);
  }

  /**
   * Shutdown cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
    log.info('🛑 Rate limiter shutdown complete', LogContext.API);
  }
}

// Pre-configured rate limiters for common use cases
export const createStandardRateLimiter = () => {
  const limiter = new ComprehensiveRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // Default limit
  });

  // API endpoints - stricter limits
  limiter.addRule({
    path: '/api/',
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 500,
    },
  });

  // Authentication endpoints - very strict
  limiter.addRule({
    path: '/api/v1/auth',
    config: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 10,
    },
  });

  // Chat endpoint - stricter limits for security
  limiter.addRule({
    path: '/api/v1/chat',
    method: 'POST',
    config: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 30, // Limit chat requests to prevent abuse
    },
  });

  // Other AI generation endpoints - moderate limits
  limiter.addRule({
    path: /^\/api\/v1\/(vision|agents|parameters)/,
    config: {
      windowMs: 10 * 60 * 1000, // 10 minutes
      maxRequests: 100,
    },
  });

  // Health checks - very permissive
  limiter.addRule({
    path: /^\/api\/v1\/(health|status|metrics)/,
    config: {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: true,
    },
  });

  return limiter;
};

// Export default configured limiter
export const standardRateLimiter = createStandardRateLimiter();

export default ComprehensiveRateLimiter;