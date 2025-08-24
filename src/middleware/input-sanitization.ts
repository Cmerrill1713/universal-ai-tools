/**
 * Input sanitization middleware for Universal AI Tools
 * Provides basic input cleaning and validation
 */
import { Request, Response, NextFunction } from 'express';

/**
 * Basic auth sanitization middleware
 * Sanitizes common authentication-related inputs
 */
function authSanitizer(req: Request, res: Response, next: NextFunction): void {
  try {
    // Sanitize common auth fields
    if (req.body) {
      // Remove null bytes and control characters
      const sanitizeString = (str: any): any => {
        if (typeof str === 'string') {
          return str
            .replace(/\0/g, '') // Remove null bytes
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
            .trim();
        }
        return str;
      };

      // Sanitize common fields
      if (req.body.name) {req.body.name = sanitizeString(req.body.name);}
      if (req.body.purpose) {req.body.purpose = sanitizeString(req.body.purpose);}
      if (req.body.email) {req.body.email = sanitizeString(req.body.email);}
      if (req.body.username) {req.body.username = sanitizeString(req.body.username);}
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Input sanitization failed',
      message: 'Invalid input data'
    });
  }
}

/**
 * General sanitization middleware for all requests
 */
function generalSanitizer(req: Request, res: Response, next: NextFunction): void {
  try {
    // Basic sanitization for all string inputs
    const sanitizeString = (str: any): any => {
      if (typeof str === 'string') {
        return str
          .replace(/\0/g, '') // Remove null bytes
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
          .trim();
      }
      return str;
    };

    // Recursively sanitize object
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeString(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };

    // Sanitize body, query, and params
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query) as any;
    }
    if (req.params) {
      req.params = sanitizeObject(req.params) as any;
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Input sanitization failed',
      message: 'Invalid input data'
    });
  }
}

/**
 * Collection of sanitization middleware functions
 */
export const sanitizers = {
  auth: authSanitizer,
  general: generalSanitizer,
};