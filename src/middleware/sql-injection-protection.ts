/**
 * SQL Injection Protection Middleware
 * Basic protection against SQL injection attempts
 */

import type { NextFunction, Request, Response } from 'express';
import { LogContext, log } from '../utils/logger';
import { sendError } from '../utils/api-response';

const SQL_INJECTION_PATTERNS = [
  // SQL commands with suspicious context
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*\b(from|where|into|values|set)\b)/i,
  // SQL injection attack patterns (not just quotes/semicolons alone)
  /(';?\s*--)|(';\s*(drop|delete|insert|update|union|select))/i,
  // Logic-based injection patterns
  /(\b(or|and)\b\s*[\d'"]+\s*=\s*[\d'"]+)/i,
  // XSS attempts (keep existing pattern)
  /(script|javascript|vbscript|onload|onerror)/i
];

export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Skip protection for safe endpoints
    const safeEndpoints = ['/health', '/api/v1/health', '/api/health', '/api/v1/vision/analyze'];
    if (safeEndpoints.includes(req.path)) {
      return next();
    }

    // Check query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string' && containsSqlInjection(value)) {
        log.warn('SQL injection attempt detected in query params', LogContext.SECURITY, {
          path: req.path,
          method: req.method,
          param: key,
          value: value.substring(0, 100), // Log first 100 chars only
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        return sendError(res, 'VALIDATION_ERROR', 'Invalid query parameter', 400);
      }
    }

    // Check body parameters
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      if (containsSqlInjection(bodyStr)) {
        log.warn('SQL injection attempt detected in request body', LogContext.SECURITY, {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        return sendError(res, 'VALIDATION_ERROR', 'Invalid request data', 400);
      }
    }

    next();
  } catch (error) {
    log.error('SQL injection protection middleware error', LogContext.SECURITY, { error });
    next();
  }
};

function containsSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

export default sqlInjectionProtection;