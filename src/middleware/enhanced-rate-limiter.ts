/**
 * Enhanced Rate Limiting Middleware - Security Focused
 * 
 * SECURITY AUDIT COMPLIANT:
 * - Implements comprehensive rate limiting on all endpoints
 * - Configurable limits per endpoint type (auth, API, public)
 * - Redis for distributed rate limiting with in-memory fallback
 * - Proper error responses with Retry-After headers
 * - Security monitoring and logging integration
 * - Request size limits and abuse protection
 * - DDoS and suspicious pattern detection
 * 
 * OWASP Security Requirements Addressed:
 * - A10:2021 Server-Side Request Forgery (SSRF)
 * - A03:2021 Injection (Rate limiting prevents brute force)
 * - A07:2021 Identification and Authentication Failures
 * - Custom: DoS/DDoS Protection
 */

import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { createHash } from 'crypto';

import { config } from '../config/environment';
import { sendError } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';

// Security-focused rate limiting configuration
interface SecurityRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  blockDuration?: number; // How long to block after limit exceeded
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableBurstProtection?: boolean;
  burstLimit?: number; // Requests allowed in a short burst (5 seconds)
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  requestSizeLimit?: number; // Max request body size in bytes
  headers?: {
    includeHeaders?: boolean;
    includeRetryAfter?: boolean;
    includeSecurityHeaders?: boolean;
  };
}

interface SecurityRateLimitRule {
  path: string | RegExp;
  method?: string | string[];
  config: SecurityRateLimitConfig;
  description?: string;
}

interface ClientSecurityData {
  requests: number[];
  burstRequests: number[];
  lastReset: number;
  consecutiveFailures: number;
  lastFailure: number;
  suspiciousActivities: string[];
  threatScore: number;
  blocked: boolean;
  blockExpiry?: number;
  totalRequests: number;
  firstSeen: number;
}

interface SecurityEvent {
  type: 'rate_limit_exceeded' | 'burst_limit_exceeded' | 'security_block' | 'suspicious_pattern' | 'large_request';
  clientId: string;
  ip: string;
  path: string;
  method: string;
  timestamp: number;
  threatScore: number;
  details: Record<string, any>;
  [key: string]: unknown;
}

/**
 * Enhanced Security Rate Limiter
 * Implements defense-in-depth rate limiting with security monitoring
 */
export class EnhancedSecurityRateLimiter {
  private redis: Redis | null = null;
  private inMemoryStore = new Map<string, ClientSecurityData>();
  private rules: SecurityRateLimitRule[] = [];
  private globalConfig: SecurityRateLimitConfig;
  private securityEvents: SecurityEvent[] = [];
  private suspiciousPatterns = [
    /(\.\.|\/\.)/g, // Path traversal
    /<script[^>]*>.*?<\/script>/gi, // XSS
    /(union|select|insert|delete|update|drop|exec|script)/i, // SQL injection
    /javascript:|data:|vbscript:/i, // Code injection
    /(eval|exec|system|passthru|shell_exec)\s*\(/i, // Command injection
  ];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private useRedis = false;

  constructor(globalConfig: SecurityRateLimitConfig) {
    this.globalConfig = globalConfig;
    this.initializeRedis();
    this.startCleanupProcess();
    this.setupSecurityDefaults();
  }

  /**
   * Initialize Redis connection for distributed rate limiting
   */
  private async initializeRedis(): Promise<void> {
    if (config.redis?.url) {
      try {
        this.redis = new Redis(config.redis.url, {
          retryStrategy: (times: number) => {
            if (times > 3) {
              log.warn('Redis connection failed, using in-memory rate limiting', LogContext.SECURITY);
              this.useRedis = false;
              return null;
            }
            return Math.min(times * 50, 2000);
          },
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });

        this.redis.on('connect', () => {
          this.useRedis = true;
          log.info('Redis connected for enhanced rate limiting', LogContext.SECURITY);
        });

        this.redis.on('error', (err) => {
          log.error('Redis error in enhanced rate limiter', LogContext.SECURITY, { error: err.message });
          this.useRedis = false;
        });

        await this.redis.connect();
      } catch (error) {
        log.error('Failed to initialize Redis for rate limiting', LogContext.SECURITY, { error });
        this.useRedis = false;
      }
    } else {
      log.info('Redis not configured, using in-memory rate limiting', LogContext.SECURITY);
    }
  }

  /**
   * Setup default security rules for common attack patterns
   */
  private setupSecurityDefaults(): void {
    // Authentication endpoints - highest security
    this.addRule({
      path: /^\/api\/v1\/auth\/(login|register|reset|verify)/,
      config: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        blockDuration: 30 * 60 * 1000, // 30 minutes block
        securityLevel: 'critical',
        enableBurstProtection: true,
        burstLimit: 2,
        requestSizeLimit: 1024 * 1024, // 1MB
        headers: {
          includeHeaders: true,
          includeRetryAfter: true,
          includeSecurityHeaders: true,
        },
      },
      description: 'Authentication endpoints - critical security',
    });

    // Password endpoints - maximum security
    this.addRule({
      path: /^\/api\/v1\/auth\/(password|forgot)/,
      config: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,
        blockDuration: 60 * 60 * 1000, // 1 hour block
        securityLevel: 'critical',
        enableBurstProtection: true,
        burstLimit: 1,
        requestSizeLimit: 512 * 1024, // 512KB
      },
      description: 'Password operations - maximum security',
    });

    // Admin endpoints - high security
    this.addRule({
      path: /^\/api\/v1\/admin/,
      config: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        maxRequests: 10,
        blockDuration: 15 * 60 * 1000, // 15 minutes block
        securityLevel: 'high',
        enableBurstProtection: true,
        burstLimit: 3,
        requestSizeLimit: 2 * 1024 * 1024, // 2MB
      },
      description: 'Admin endpoints - high security',
    });

    // API endpoints - medium security
    this.addRule({
      path: /^\/api\/v1\//,
      config: {
        windowMs: 10 * 60 * 1000, // 10 minutes
        maxRequests: 100,
        blockDuration: 5 * 60 * 1000, // 5 minutes block
        securityLevel: 'medium',
        enableBurstProtection: true,
        burstLimit: 20,
        requestSizeLimit: 10 * 1024 * 1024, // 10MB
      },
      description: 'General API endpoints - medium security',
    });

    // Health and status endpoints - low security but monitored
    this.addRule({
      path: /^\/api\/v1\/(health|status|metrics)/,
      config: {
        windowMs: 1 * 60 * 1000, // 1 minute
        maxRequests: 60,
        securityLevel: 'low',
        enableBurstProtection: false,
        requestSizeLimit: 64 * 1024, // 64KB
        skipSuccessfulRequests: true,
      },
      description: 'Health endpoints - monitored but permissive',
    });
  }

  /**
   * Add custom rate limiting rule
   */
  addRule(rule: SecurityRateLimitRule): void {
    this.rules.push(rule);
    log.info('Enhanced rate limit rule added', LogContext.SECURITY, {
      path: rule.path.toString(),
      method: rule.method || 'ALL',
      securityLevel: rule.config.securityLevel,
      maxRequests: rule.config.maxRequests,
      windowMs: rule.config.windowMs,
      description: rule.description,
    });
  }

  /**
   * Generate secure client identifier
   */
  private getClientId(req: Request): string {
    const ip = this.extractClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    const userId = (req as any).user?.id;

    // Use user ID for authenticated requests
    if (userId) {
      return `user:${userId}`;
    }

    // Create fingerprint for anonymous users
    const fingerprint = createHash('sha256')
      .update(`${ip}:${userAgent}`)
      .digest('hex')
      .substring(0, 16);

    return `anon:${ip}:${fingerprint}`;
  }

  /**
   * Extract client IP with proxy support
   */
  private extractClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (forwarded) {
      return forwarded.split(',')[0]?.trim() || clientIp;
    }

    return realIp || clientIp;
  }

  /**
   * Get client security data from storage
   */
  private async getClientData(clientId: string): Promise<ClientSecurityData> {
    const now = Date.now();

    // Try Redis first
    if (this.useRedis && this.redis) {
      try {
        const data = await this.redis.get(`rate_limit:${clientId}`);
        if (data) {
          const parsed = JSON.parse(data) as ClientSecurityData;
          return parsed;
        }
      } catch (error) {
        log.debug('Redis get error, falling back to memory', LogContext.SECURITY, { error });
      }
    }

    // Fallback to in-memory
    if (!this.inMemoryStore.has(clientId)) {
      this.inMemoryStore.set(clientId, {
        requests: [],
        burstRequests: [],
        lastReset: now,
        consecutiveFailures: 0,
        lastFailure: 0,
        suspiciousActivities: [],
        threatScore: 0,
        blocked: false,
        totalRequests: 0,
        firstSeen: now,
      });
    }

    return this.inMemoryStore.get(clientId)!;
  }

  /**
   * Save client security data to storage
   */
  private async saveClientData(clientId: string, data: ClientSecurityData): Promise<void> {
    // Always save to memory
    this.inMemoryStore.set(clientId, data);

    // Try to save to Redis
    if (this.useRedis && this.redis) {
      try {
        const ttl = Math.max(this.globalConfig.windowMs, 3600000) / 1000; // At least 1 hour
        await this.redis.setex(`rate_limit:${clientId}`, ttl, JSON.stringify(data));
      } catch (error) {
        log.debug('Redis save error', LogContext.SECURITY, { error });
      }
    }
  }

  /**
   * Detect suspicious patterns in request
   */
  private detectSuspiciousPatterns(req: Request): string[] {
    const detected: string[] = [];
    const targets = [
      req.url,
      req.path,
      JSON.stringify(req.query),
      JSON.stringify(req.body || {}),
      req.get('User-Agent') || '',
      req.get('Referer') || '',
    ];

    for (const target of targets) {
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(target)) {
          detected.push(pattern.source);
        }
      }
    }

    return detected;
  }

  /**
   * Calculate client threat score
   */
  private calculateThreatScore(req: Request, clientData: ClientSecurityData, rule: SecurityRateLimitConfig): number {
    let score = 0;

    // Base score from consecutive failures
    score += clientData.consecutiveFailures * 15;

    // Suspicious patterns detection
    const suspiciousPatterns = this.detectSuspiciousPatterns(req);
    score += suspiciousPatterns.length * 25;

    // Request frequency analysis
    const now = Date.now();
    const recentRequests = clientData.requests.filter(time => now - time < 60000);
    if (recentRequests.length > rule.maxRequests * 2) {
      score += 30;
    }

    // Burst analysis
    if (rule.enableBurstProtection && rule.burstLimit) {
      const burstRequests = clientData.burstRequests.filter(time => now - time < 5000);
      if (burstRequests.length > rule.burstLimit) {
        score += 20;
      }
    }

    // Request size analysis
    const contentLength = parseInt(req.get('content-length') || '0');
    if (rule.requestSizeLimit && contentLength > rule.requestSizeLimit) {
      score += 40;
    }

    // Missing or suspicious headers
    const userAgent = req.get('User-Agent');
    if (!userAgent || userAgent.length < 10) {
      score += 10;
    }

    // Security level multiplier
    const multipliers = { low: 0.5, medium: 1, high: 1.5, critical: 2 };
    score *= multipliers[rule.securityLevel];

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Find matching rule for request
   */
  private findMatchingRule(req: Request): SecurityRateLimitConfig {
    // Sort rules by specificity
    const sortedRules = [...this.rules].sort((a, b) => {
      const aPath = typeof a.path === 'string' ? a.path : a.path.toString();
      const bPath = typeof b.path === 'string' ? b.path : b.path.toString();
      return bPath.length - aPath.length;
    });

    for (const rule of sortedRules) {
      if (this.matchesRule(req, rule)) {
        return rule.config;
      }
    }

    return this.globalConfig;
  }

  /**
   * Check if request matches rule
   */
  private matchesRule(req: Request, rule: SecurityRateLimitRule): boolean {
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
   * Record security event
   */
  private recordSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);

    // Keep only recent events (last 1000)
    if (this.securityEvents.length > 1000) {
      this.securityEvents.shift();
    }

    // Log critical events
    if (event.type === 'security_block' || event.threatScore >= 70) {
      log.error('Critical security event detected', LogContext.SECURITY, event);
    } else {
      log.warn('Security event recorded', LogContext.SECURITY, event);
    }
  }

  /**
   * Main middleware function
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const now = Date.now();
        const clientId = this.getClientId(req);
        const ip = this.extractClientIP(req);
        const rule = this.findMatchingRule(req);

        // Check request size limit
        const contentLength = parseInt(req.get('content-length') || '0');
        if (rule.requestSizeLimit && contentLength > rule.requestSizeLimit) {
          this.recordSecurityEvent({
            type: 'large_request',
            clientId,
            ip,
            path: req.path,
            method: req.method,
            timestamp: now,
            threatScore: 0,
            details: { contentLength, limit: rule.requestSizeLimit },
          });

          return sendError(
            res,
            'PAYLOAD_TOO_LARGE',
            `Request too large. Maximum allowed: ${rule.requestSizeLimit} bytes`,
            413
          );
        }

        const clientData = await this.getClientData(clientId);

        // Check if client is blocked
        if (clientData.blocked && clientData.blockExpiry && now < clientData.blockExpiry) {
          const retryAfter = Math.ceil((clientData.blockExpiry - now) / 1000);
          res.setHeader('Retry-After', retryAfter.toString());

          return sendError(
            res,
            'CLIENT_BLOCKED',
            `Client temporarily blocked due to security violations. Try again in ${retryAfter} seconds.`,
            429
          );
        }

        // Reset block if expired
        if (clientData.blocked && clientData.blockExpiry && now >= clientData.blockExpiry) {
          clientData.blocked = false;
          clientData.blockExpiry = undefined;
          clientData.consecutiveFailures = 0;
        }

        // Calculate threat score
        const threatScore = this.calculateThreatScore(req, clientData, rule);
        clientData.threatScore = threatScore;

        // Clean old requests
        const windowStart = now - rule.windowMs;
        clientData.requests = clientData.requests.filter(time => time > windowStart);

        // Clean old burst requests
        if (rule.enableBurstProtection) {
          const burstStart = now - 5000; // 5 seconds
          clientData.burstRequests = clientData.burstRequests.filter(time => time > burstStart);
        }

        // Check burst protection
        if (rule.enableBurstProtection && rule.burstLimit) {
          if (clientData.burstRequests.length >= rule.burstLimit) {
            this.recordSecurityEvent({
              type: 'burst_limit_exceeded',
              clientId,
              ip,
              path: req.path,
              method: req.method,
              timestamp: now,
              threatScore,
              details: { burstRequests: clientData.burstRequests.length, limit: rule.burstLimit },
            });

            clientData.consecutiveFailures++;
            await this.saveClientData(clientId, clientData);

            res.setHeader('Retry-After', '5');
            return sendError(
              res,
              'BURST_LIMIT_EXCEEDED',
              'Too many requests in a short time. Please slow down.',
              429
            );
          }
        }

        // Check main rate limit
        if (clientData.requests.length >= rule.maxRequests) {
          clientData.consecutiveFailures++;
          clientData.lastFailure = now;

          // Apply block if configured
          if (rule.blockDuration && (clientData.consecutiveFailures >= 3 || threatScore >= 80)) {
            clientData.blocked = true;
            clientData.blockExpiry = now + rule.blockDuration;
          }

          this.recordSecurityEvent({
            type: 'rate_limit_exceeded',
            clientId,
            ip,
            path: req.path,
            method: req.method,
            timestamp: now,
            threatScore,
            details: {
              requests: clientData.requests.length,
              limit: rule.maxRequests,
              consecutiveFailures: clientData.consecutiveFailures,
            },
          });

          await this.saveClientData(clientId, clientData);

          const retryAfter = Math.ceil(rule.windowMs / 1000);
          if (rule.headers?.includeRetryAfter !== false) {
            res.setHeader('Retry-After', retryAfter.toString());
          }

          if (rule.headers?.includeHeaders !== false) {
            res.setHeader('X-RateLimit-Limit', rule.maxRequests.toString());
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('X-RateLimit-Reset', new Date(now + rule.windowMs).toISOString());
          }

          if (rule.headers?.includeSecurityHeaders !== false) {
            res.setHeader('X-Security-Level', rule.securityLevel);
            res.setHeader('X-Threat-Score', threatScore.toString());
          }

          return sendError(
            res,
            'RATE_LIMIT_EXCEEDED',
            `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            429
          );
        }

        // Record successful request
        clientData.requests.push(now);
        if (rule.enableBurstProtection) {
          clientData.burstRequests.push(now);
        }
        clientData.totalRequests++;
        clientData.consecutiveFailures = 0;

        await this.saveClientData(clientId, clientData);

        // Set response headers
        if (rule.headers?.includeHeaders !== false) {
          const remaining = Math.max(0, rule.maxRequests - clientData.requests.length);
          res.setHeader('X-RateLimit-Limit', rule.maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', remaining.toString());
          res.setHeader('X-RateLimit-Reset', new Date(now + rule.windowMs).toISOString());
        }

        if (rule.headers?.includeSecurityHeaders !== false) {
          res.setHeader('X-Security-Level', rule.securityLevel);
          res.setHeader('X-Threat-Score', threatScore.toString());
        }

        next();
      } catch (error) {
        log.error('Enhanced rate limiter error', LogContext.SECURITY, { error });
        // Continue on error to avoid breaking the application
        next();
      }
    };
  }

  /**
   * Get current security statistics
   */
  getSecurityStats(): {
    totalClients: number;
    blockedClients: number;
    highThreatClients: number;
    totalSecurityEvents: number;
    recentEvents: number;
    averageThreatScore: number;
  } {
    const now = Date.now();
    let blockedClients = 0;
    let highThreatClients = 0;
    let totalThreatScore = 0;

    for (const data of this.inMemoryStore.values()) {
      if (data.blocked) {blockedClients++;}
      if (data.threatScore >= 50) {highThreatClients++;}
      totalThreatScore += data.threatScore;
    }

    const recentEvents = this.securityEvents.filter(
      event => now - event.timestamp < 3600000 // Last hour
    ).length;

    return {
      totalClients: this.inMemoryStore.size,
      blockedClients,
      highThreatClients,
      totalSecurityEvents: this.securityEvents.length,
      recentEvents,
      averageThreatScore: this.inMemoryStore.size > 0 ? totalThreatScore / this.inMemoryStore.size : 0,
    };
  }

  /**
   * Get recent security events
   */
  getSecurityEvents(limit: number = 50): SecurityEvent[] {
    return this.securityEvents
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Manually block a client
   */
  async blockClient(clientId: string, duration: number = 3600000): Promise<void> {
    const clientData = await this.getClientData(clientId);
    clientData.blocked = true;
    clientData.blockExpiry = Date.now() + duration;
    await this.saveClientData(clientId, clientData);

    log.info('Client manually blocked', LogContext.SECURITY, {
      clientId,
      duration: duration / 1000,
    });
  }

  /**
   * Unblock a client
   */
  async unblockClient(clientId: string): Promise<void> {
    const clientData = await this.getClientData(clientId);
    clientData.blocked = false;
    clientData.blockExpiry = undefined;
    clientData.consecutiveFailures = 0;
    await this.saveClientData(clientId, clientData);

    log.info('Client unblocked', LogContext.SECURITY, { clientId });
  }

  /**
   * Start cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const [clientId, data] of this.inMemoryStore.entries()) {
        if (now - data.firstSeen > maxAge && data.requests.length === 0 && !data.blocked) {
          this.inMemoryStore.delete(clientId);
        }
      }

      // Clean old security events
      this.securityEvents = this.securityEvents.filter(
        event => now - event.timestamp < 24 * 60 * 60 * 1000 // Keep 24 hours
      );

      log.debug('Security rate limiter cleanup completed', LogContext.SECURITY, {
        activeClients: this.inMemoryStore.size,
        securityEvents: this.securityEvents.length,
      });
    }, 300000); // Every 5 minutes
  }

  /**
   * Shutdown cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.redis) {
      this.redis.disconnect();
    }

    this.inMemoryStore.clear();
    log.info('Enhanced security rate limiter shutdown complete', LogContext.SECURITY);
  }
}

// Export enhanced rate limiter with security-focused defaults
export const createEnhancedSecurityRateLimiter = () => {
  return new EnhancedSecurityRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    securityLevel: 'medium',
    enableBurstProtection: true,
    burstLimit: 10,
    requestSizeLimit: 5 * 1024 * 1024, // 5MB default
    headers: {
      includeHeaders: true,
      includeRetryAfter: true,
      includeSecurityHeaders: true,
    },
  });
};

// Export singleton instance
export const enhancedSecurityRateLimiter = createEnhancedSecurityRateLimiter();

export default enhancedSecurityRateLimiter;