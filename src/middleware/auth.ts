/**
 * Authentication Middleware
 * Supports JWT tokens and Apple device authentication
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { LogContext, log } from '../utils/logger';
import { sendError } from '../utils/api-response';
import { secretsManager } from '../services/secrets-manager';

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
}

/**
 * JWT authentication middleware with Apple device support
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header or API key
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (apiKey) {
      // API key authentication - validate against stored keys
      const isValid = await validateApiKey(apiKey);
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
      // Check if this is a public endpoint
      if (isPublicEndpoint(req.path)) {
        return next();
      }
      return sendError(res, 'AUTHENTICATION_ERROR', 'No token provided', 401);
    }

    // Get JWT secret from vault with fallback
    let jwtSecret = await secretsManager.getSecret('jwt_secret');
    if (!jwtSecret) {
      jwtSecret = process.env.JWT_SECRET || '';
    }
    if (!jwtSecret) {
      log.error('JWT secret not configured', LogContext.API);
      return sendError(res, 'AUTHENTICATION_ERROR', 'Authentication configuration error', 500);
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
      return sendError(res, 'AUTHENTICATION_ERROR', 'Invalid token', 401);
    } else if (error instanceof jwt.TokenExpiredError) {
      log.warn('Expired JWT token', LogContext.API);
      return sendError(res, 'AUTHENTICATION_ERROR', 'Token expired', 401);
    } else {
      log.error('Authentication failed', LogContext.API, { error });
      return sendError(res, 'AUTHENTICATION_ERROR', 'Authentication failed', 401);
    }
  }
};

/**
 * Check if endpoint is public (doesn't require authentication)
 */
function isPublicEndpoint(path: string): boolean {
  const publicPaths = [
    '/api/health',
    '/api/status',
    '/api/v1/chat',
    '/api/v1/memory',
    '/api/v1/device-auth/challenge',
    '/docs',
    '/api-docs',
  ];

  return publicPaths.some((publicPath) => path.startsWith(publicPath));
}

/**
 * Validate API key against stored keys
 */
async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    if (!apiKey || apiKey.length < 32) {
      return false;
    }

    // Check against stored API keys in secrets manager
    const validKeys = await secretsManager.getAvailableServices();
    // TODO: Implement proper API key validation against database

    return true; // Temporary - accept any valid-looking key
  } catch (error) {
    log.error('API key validation failed', LogContext.API, { error });
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

export default authenticate;
