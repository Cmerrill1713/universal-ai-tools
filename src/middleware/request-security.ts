/**
 * Request Security Middleware
 * Additional request validation and security checks
 */

import type { NextFunction, Request, Response } from 'express';
import { LogContext, log } from '../utils/logger'
import { sendError } from '../utils/api-response'

interface SecurityCheckResult {
  passed: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
}

interface SuspiciousActivity {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  ip: string;
  userAgent: string;
  timestamp: number;
  endpoint: string;
}

// Track suspicious activity per IP
const suspiciousActivityTracker = new Map<string, SuspiciousActivity[]>();

export const requestSecurity = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // Perform security checks
    const headerCheck = validateHeaders(req);
    const payloadCheck = validatePayload(req);
    const pathCheck = validatePath(req);
    const behaviorCheck = checkSuspiciousBehavior(req, ip, userAgent);

    // Combine all security checks
    const securityChecks = [headerCheck, payloadCheck, pathCheck, behaviorCheck];
    const failedChecks = securityChecks.filter(check => !check.passed);

    if (failedChecks.length > 0) {
      // Log security violation
      const highSeverityFailures = failedChecks.filter(check => check.severity === 'high');
      
      if (highSeverityFailures.length > 0) {
        log.warn('High severity security check failed', LogContext.SECURITY, {
          ip,
          userAgent,
          endpoint: req.path,
          method: req.method,
          failures: highSeverityFailures.map(f => f.reason),
          allChecks: failedChecks.length
        });
        
        // Block high severity violations
        return sendError(res, 'SECURITY_VIOLATION', 'Request blocked for security reasons', 403);
      } else {
        // Log medium/low severity violations but allow request
        log.info('Security check warnings', LogContext.SECURITY, {
          ip,
          endpoint: req.path,
          warnings: failedChecks.map(f => f.reason)
        });
      }
    }

    // Add security headers to response
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Request-ID': generateRequestId(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    next();
  } catch (error) {
    log.error('Request security middleware error', LogContext.SECURITY, { error });
    // Don't block requests if security check fails - log and continue
    next();
  }
};

/**
 * Validate request headers for security issues
 */
function validateHeaders(req: Request): SecurityCheckResult {
  const {headers} = req;
  
  // Check for suspicious headers
  const suspiciousHeaders = [
    'x-forwarded-host',
    'x-original-url',
    'x-rewrite-url',
    'x-cluster-client-ip',
    'x-forwarded-proto'
  ];

  for (const header of suspiciousHeaders) {
    if (headers[header]) {
      // Only flag as suspicious if values look malicious
      const value = String(headers[header]).toLowerCase();
      if (value.includes('<script') || value.includes('javascript:') || value.includes('data:')) {
        return {
          passed: false,
          reason: `Malicious content in ${header} header`,
          severity: 'high'
        };
      }
    }
  }

  // Check User-Agent for common attack patterns
  const userAgent = headers['user-agent'];
  if (userAgent) {
    const maliciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nessus/i,
      /burpsuite/i,
      /masscan/i,
      /<script/i,
      /javascript: /i
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(userAgent)) {
        return {
          passed: false,
          reason: 'Malicious user agent detected',
          severity: 'high'
        };
      }
    }
  }

  // Check for excessively long headers (potential buffer overflow attempts)
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' && value.length > 8192) {
      return {
        passed: false,
        reason: `Header ${key} too long (${value.length} chars)`,
        severity: 'medium'
      };
    }
  }

  return { passed: true };
}

/**
 * Validate request payload for security issues
 */
function validatePayload(req: Request): SecurityCheckResult {
  // Check Content-Length header for reasonable limits
  const contentLength = req.get('content-length');
  if (contentLength) {
    const length = parseInt(contentLength, 10);
    if (length > 100 * 1024 * 1024) { // 100MB limit
      return {
        passed: false,
        reason: `Request payload too large: ${length} bytes`,
        severity: 'medium'
      };
    }
  }

  // Validate JSON payload if present
  if (req.body && typeof req.body === 'object') {
    const bodyString = JSON.stringify(req.body);
    
    // Check for deeply nested objects (JSON bomb attacks)
    const maxDepth = 10;
    if (getObjectDepth(req.body) > maxDepth) {
      return {
        passed: false,
        reason: 'Request payload too deeply nested',
        severity: 'high'
      };
    }

    // Check for excessively large string values
    if (bodyString.length > 1024 * 1024) { // 1MB limit for JSON
      return {
        passed: false,
        reason: `JSON payload too large: ${bodyString.length} chars`,
        severity: 'medium'
      };
    }
  }

  return { passed: true };
}

/**
 * Validate request path for security issues
 */
function validatePath(req: Request): SecurityCheckResult {
  const {path} = req;
  
  // Check for directory traversal attempts
  if (path.includes('../') || path.includes('..\\') || path.includes('%2e%2e')) {
    return {
      passed: false,
      reason: 'Directory traversal attempt detected',
      severity: 'high'
    };
  }

  // Check for null byte injection
  if (path.includes('\0') || path.includes('%00')) {
    return {
      passed: false,
      reason: 'Null byte injection attempt detected',
      severity: 'high'
    };
  }

  // Check for extremely long paths
  if (path.length > 2048) {
    return {
      passed: false,
      reason: `Request path too long: ${path.length} chars`,
      severity: 'medium'
    };
  }

  return { passed: true };
}

/**
 * Check for suspicious request patterns/behavior
 */
function checkSuspiciousBehavior(req: Request, ip: string, userAgent: string): SecurityCheckResult {
  const now = Date.now();
  const endpoint = req.path;
  
  // Get or create activity log for this IP
  if (!suspiciousActivityTracker.has(ip)) {
    suspiciousActivityTracker.set(ip, []);
  }
  
  const activities = suspiciousActivityTracker.get(ip)!;
  
  // Clean up old activities (older than 1 hour)
  const recentActivities = activities.filter(activity => now - activity.timestamp < 3600000);
  suspiciousActivityTracker.set(ip, recentActivities);
  
  // Check for rapid fire requests (more than 50 requests in 1 minute)
  const lastMinuteActivities = recentActivities.filter(activity => now - activity.timestamp < 60000);
  if (lastMinuteActivities.length > 50) {
    return {
      passed: false,
      reason: 'Rapid fire requests detected',
      severity: 'high'
    };
  }

  // Check for scanning behavior (accessing many different endpoints)
  const uniqueEndpoints = new Set(recentActivities.map(a => a.endpoint));
  if (uniqueEndpoints.size > 20) {
    return {
      passed: false,
      reason: 'Endpoint scanning behavior detected',
      severity: 'medium'
    };
  }

  // Add current request to activity log
  recentActivities.push({
    type: 'request',
    description: `${req.method} ${endpoint}`,
    severity: 'low',
    ip,
    userAgent,
    timestamp: now,
    endpoint
  });

  return { passed: true };
}

/**
 * Calculate object depth for JSON bomb detection
 */
function getObjectDepth(obj: unknown, depth = 0): number {
  if (depth > 20) return depth; // Prevent stack overflow
  
  if (typeof obj !== 'object' || obj === null) {
    return depth;
  }
  
  if (Array.isArray(obj)) {
    return Math.max(depth, ...obj.map(item => getObjectDepth(item, depth + 1)));
  }
  
  const values = Object.values(obj);
  if (values.length === 0) {
    return depth;
  }
  
  return Math.max(depth, ...values.map(value => getObjectDepth(value, depth + 1)));
}

/**
 * Generate unique request ID for tracking
 */
function generateRequestId(): string {
  return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get suspicious activity summary for monitoring
 */
export function getSuspiciousActivitySummary(): { ip: string; activities: number; lastActivity: number }[] {
  const summary: { ip: string; activities: number; lastActivity: number }[] = [];
  const now = Date.now();
  
  suspiciousActivityTracker.forEach((activities, ip) => {
    // Only include IPs with recent activity (last hour)
    const recentActivities = activities.filter(activity => now - activity.timestamp < 3600000);
    if (recentActivities.length > 0) {
      summary.push({
        ip,
        activities: recentActivities.length,
        lastActivity: Math.max(...recentActivities.map(a => a.timestamp))
      });
    }
  });
  
  return summary.sort((a, b) => b.activities - a.activities);
}

export default requestSecurity;