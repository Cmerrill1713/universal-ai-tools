/**
 * Comprehensive Rate Limiting Middleware
 * Advanced rate limiting with multiple strategies, adaptive limits, and bypass capabilities
 * Enhanced with security features, threat detection, and DDoS protection
 */

import crypto from 'crypto';
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
  threatScore: number;
  suspiciousPatterns: string[];
  isBlacklisted: boolean;
  blacklistExpiry?: number;
}

interface SecurityEvent {
  type: 'rate_limit' | 'ddos_attempt' | 'suspicious_pattern' | 'blacklist_add';
  ip: string;
  path: string;
  timestamp: number;
  details: any;
}

export class ComprehensiveRateLimiter {
  private store = new Map<string, ClientData>();
  private rules: RateLimitRule[] = [];
  private globalConfig: RateLimitConfig;
  private cleanupInterval?: NodeJS.Timeout;
  private securityEvents: SecurityEvent[] = [];
  private blacklistedIPs = new Set<string>();
  private ddosThreshold = 50; // requests per minute to trigger DDoS protection
  private suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempt
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
    /eval\s*\(/i, // Code injection
  ];

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
   * Check for suspicious patterns in request
   */
  private detectSuspiciousPatterns(req: Request): string[] {
    const detected: string[] = [];
    const checkTargets = [
      req.path,
      req.url,
      JSON.stringify(req.query),
      req.get('User-Agent') || '',
      req.get('Referer') || '',
    ];

    for (const target of checkTargets) {
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(target)) {
          detected.push(pattern.source);
        }
      }
    }

    return detected;
  }

  /**
   * Calculate threat score based on various factors
   */
  private calculateThreatScore(req: Request, clientData: ClientData): number {
    let score = 0;

    // Base score from consecutive failures
    score += clientData.consecutiveFailures * 10;

    // Score from suspicious patterns
    const patterns = this.detectSuspiciousPatterns(req);
    score += patterns.length * 20;

    // Score from request frequency
    const recentRequests = clientData.requests.filter(
      timestamp => Date.now() - timestamp < 60000 // Last minute
    );
    if (recentRequests.length > this.ddosThreshold) {
      score += 50;
    }

    // Score from missing or suspicious headers
    if (!req.get('User-Agent') || req.get('User-Agent')!.length < 10) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Check if IP should be temporarily blacklisted
   */
  private shouldBlacklist(threatScore: number, consecutiveFailures: number): boolean {
    return threatScore >= 80 || consecutiveFailures >= 10;
  }

  /**
   * Add IP to temporary blacklist
   */
  private addToBlacklist(ip: string, duration: number = 300000): void {
    this.blacklistedIPs.add(ip);
    
    // Remove from blacklist after duration
    setTimeout(() => {
      this.blacklistedIPs.delete(ip);
      log.info('🔓 IP removed from blacklist', LogContext.SECURITY, { ip });
    }, duration);

    log.warn('🚫 IP temporarily blacklisted', LogContext.SECURITY, { 
      ip, 
      durationMs: duration 
    });

    this.recordSecurityEvent({
      type: 'blacklist_add',
      ip,
      path: '',
      timestamp: Date.now(),
      details: { duration, reason: 'high_threat_score' }
    });
  }

  /**
   * Record security event for monitoring
   */
  private recordSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);
    
    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents.shift();
    }

    // Log critical events
    if (event.type === 'ddos_attempt' || event.type === 'blacklist_add') {
      log.error('🚨 Critical security event', LogContext.SECURITY, event as unknown as Record<string, unknown>);
    }
  }

  /**
   * Create Express middleware
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ip = this.extractIP(req);
        
        // Check blacklist first
        if (this.blacklistedIPs.has(ip)) {
          log.warn('🚫 Request blocked - IP blacklisted', LogContext.SECURITY, {
            ip,
            path: req.path,
            method: req.method,
          });
          
          return sendError(
            res,
            'AUTHENTICATION_ERROR',
            'Your IP has been temporarily blocked due to suspicious activity',
            403
          );
        }

        // DEBUG: Log all requests to verify middleware is working
        log.info('🔍 Rate limiter middleware executing', LogContext.API, {
          path: req.path,
          method: req.method,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });

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

        // Enhanced security: Calculate threat score
        const threatScore = this.calculateThreatScore(req, clientData);
        clientData.threatScore = threatScore;

        // Detect suspicious patterns
        const suspiciousPatterns = this.detectSuspiciousPatterns(req);
        if (suspiciousPatterns.length > 0) {
          clientData.suspiciousPatterns = suspiciousPatterns;
          this.recordSecurityEvent({
            type: 'suspicious_pattern',
            ip,
            path: req.path,
            timestamp: now,
            details: { patterns: suspiciousPatterns, threatScore }
          });
        }

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

          // Check if should blacklist based on threat score
          if (this.shouldBlacklist(threatScore, clientData.consecutiveFailures)) {
            this.addToBlacklist(ip, 300000); // 5 minutes
          }

          // Record security event
          this.recordSecurityEvent({
            type: 'rate_limit',
            ip,
            path: req.path,
            timestamp: now,
            details: { 
              requests: clientData.requests.length,
              limit: rateLimitConfig.maxRequests,
              threatScore,
              consecutiveFailures: clientData.consecutiveFailures
            }
          });

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
    // Sort rules by specificity (most specific first)
    const sortedRules = [...this.rules].sort((a, b) => {
      const aPath = typeof a.path === 'string' ? a.path : a.path.toString();
      const bPath = typeof b.path === 'string' ? b.path : b.path.toString();
      
      // Rules with methods are more specific
      const aHasMethod = !!a.method;
      const bHasMethod = !!b.method;
      if (aHasMethod && !bHasMethod) {return -1;}
      if (!aHasMethod && bHasMethod) {return 1;}
      
      // Longer paths are more specific
      return bPath.length - aPath.length;
    });

    for (const rule of sortedRules) {
      if (this.matchesRule(req, rule)) {
        log.info('🎯 Rate limit rule matched', LogContext.API, {
          path: req.path,
          method: req.method,
          matchedRule: rule.path.toString(),
          ruleMethod: rule.method || 'ALL',
          limit: rule.config.maxRequests,
          windowMs: rule.config.windowMs
        });
        return rule.config;
      }
    }
    
    log.info('🔧 Using global rate limit config', LogContext.API, {
      path: req.path,
      method: req.method,
      limit: this.globalConfig.maxRequests,
      windowMs: this.globalConfig.windowMs
    });
    return this.globalConfig;
  }

  /**
   * Check if request matches a rule
   */
  private matchesRule(req: Request, rule: RateLimitRule): boolean {
    // Check path
    const pathMatches = rule.path instanceof RegExp 
      ? rule.path.test(req.path)
      : req.path.startsWith(rule.path);

    if (!pathMatches) {return false;}

    // Check method if specified
    if (rule.method) {
      const methods = Array.isArray(rule.method) ? rule.method : [rule.method];
      if (!methods.includes(req.method)) {return false;}
    }

    return true;
  }

  /**
   * Extract IP address from request with proxy support
   */
  private extractIP(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Use the first IP in the forwarded chain (most reliable)
    if (forwardedFor) {
      return forwardedFor.split(',')[0]?.trim() || clientIp;
    }
    
    return realIp || clientIp;
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
        threatScore: 0,
        suspiciousPatterns: [],
        isBlacklisted: false,
      });
    }
    return this.store.get(key)!;
  }

  /**
   * Generate default key for rate limiting with enhanced evasion resistance
   */
  private getDefaultKey(req: Request): string {
    // Prefer user ID for authenticated requests
    if ((req as any).user?.id) {
      return `user:${(req as any).user.id}`;
    }

    // Enhanced IP detection to prevent evasion
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Use the most restrictive IP (first in forwarded chain if present)
    let effectiveIp = clientIp;
    if (forwardedFor) {
      effectiveIp = forwardedFor.split(',')[0]?.trim() || clientIp;
    } else if (realIp) {
      effectiveIp = realIp;
    }
    
    // Add user agent fingerprinting for better evasion resistance
    const userAgent = req.get('User-Agent') || 'unknown';
    const userAgentHash = require('crypto')
      .createHash('sha256')
      .update(userAgent)
      .digest('hex')
      .substring(0, 8);
    
    return `ip:${effectiveIp}:ua:${userAgentHash}`;
  }

  /**
   * Calculate progressive penalty for repeated violations
   */
  private calculatePenalty(clientData: ClientData): number {
    if (clientData.consecutiveFailures === 0) {return 0;}

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
   * Get current statistics including security metrics
   */
  getStats(): {
    activeClients: number;
    totalRules: number;
    memoryUsage: number;
    securityEvents: number;
    blacklistedIPs: number;
    highThreatClients: number;
    totalThreatScore: number;
  } {
    let highThreatCount = 0;
    let totalThreatScore = 0;
    
    for (const clientData of this.store.values()) {
      if (clientData.threatScore >= 50) {
        highThreatCount++;
      }
      totalThreatScore += clientData.threatScore;
    }

    return {
      activeClients: this.store.size,
      totalRules: this.rules.length,
      memoryUsage: JSON.stringify(Array.from(this.store.entries())).length,
      securityEvents: this.securityEvents.length,
      blacklistedIPs: this.blacklistedIPs.size,
      highThreatClients: highThreatCount,
      totalThreatScore,
    };
  }

  /**
   * Get security event history
   */
  getSecurityEvents(limit: number = 100): SecurityEvent[] {
    return this.securityEvents
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get current blacklisted IPs
   */
  getBlacklistedIPs(): string[] {
    return Array.from(this.blacklistedIPs);
  }

  /**
   * Manually add IP to blacklist
   */
  blacklistIP(ip: string, duration: number = 300000): void {
    this.addToBlacklist(ip, duration);
  }

  /**
   * Remove IP from blacklist
   */
  unblacklistIP(ip: string): boolean {
    const removed = this.blacklistedIPs.delete(ip);
    if (removed) {
      log.info('🔓 IP manually removed from blacklist', LogContext.SECURITY, { ip });
    }
    return removed;
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
  console.log('🔧 Creating standard rate limiter...');
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

  // Authentication endpoints - very strict (includes all auth sub-paths)
  limiter.addRule({
    path: /^\/api\/v1\/auth/,
    config: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 5, // More restrictive for security
    },
  });

  // Demo token endpoint - even stricter security
  limiter.addRule({
    path: '/api/v1/auth/demo-token',
    method: 'POST',
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 3, // Very limited for security
      skipIf: (req) => false, // Never skip for demo tokens
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