/**
 * Authentication Middleware;
 * Supports JWT tokens and Apple device authentication;
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { LogContext, log } from '../utils/logger';
import { sendError } from '../utils/api-response';
import { secretsManager } from '../services/secrets-manager';

// Extend Request interface to include user and device info;
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
 * JWT authentication middleware with Apple device support;
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header or API key;
    const authHeader = req?.headers?.authorization;
    const apiKey = req?.headers['x-api-key'] as string;

    let token: string | null = null;

    if (authHeader && authHeader?.startsWith('Bearer ')) {
      token = authHeader?.substring(7);
    } else if (apiKey) {
      // API key authentication - validate against stored keys;
      const isValid = await validateApiKey(apiKey);
      if (isValid) {
        req?.user = {
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
      // Check if this is a public endpoint;
      if (isPublicEndpoint(req?.path)) {
        return next();
      }

      // Development mode fallback;
      if (process?.env?.NODE_ENV === 'development' && process?.env?.SKIP_AUTH === 'true') {
        req?.user = {
          id: 'dev-user',
          email: 'dev@localhost',
          isAdmin: true,
          permissions: ['*'],
        };
        return next();
      }

      return sendError(res, 'AUTHENTICATION_ERROR', 'No token provided', 401);
    }

    // Get JWT secret from vault with fallback;
    let jwtSecret = await secretsManager?.getSecret('jwt_secret');
    if (!jwtSecret) {
      // Fallback to environment variable for development;
      jwtSecret = process?.env?.JWT_SECRET || 'device-auth-secret';
      if (process?.env?.NODE_ENV === 'production') {
        log?.error('JWT secret not found in vault', LogContext?.API);
        return sendError(res, 'AUTHENTICATION_ERROR', 'Authentication configuration error', 500);
      }
    }

    // Verify JWT token;
    const decoded = jwt?.verify(token, jwtSecret) as JwtPayload;

    req?.user = {
      id: decoded?.userId,
      email: decoded?.email,
      isAdmin: decoded?.isAdmin || false,
      permissions: decoded?.permissions || [],
      deviceId: decoded?.deviceId,
      deviceType: decoded?.deviceType as unknown,
      trusted: decoded?.trusted || false,
    };

    // Log device authentication;
    if (decoded?.deviceId) {
      log?.info('Device authenticated', LogContext?.API, {
        userId: decoded?.userId,
        deviceId: decoded?.deviceId,
        deviceType: decoded?.deviceType,
        trusted: decoded?.trusted,
      });
    }

    next();
  } catch (error) {
    if (error instanceof jwt?.JsonWebTokenError) {
      log?.warn('Invalid JWT token', LogContext?.API, { error: error?.message });
      return sendError(res, 'AUTHENTICATION_ERROR', 'Invalid token', 401);
    } else if (error instanceof jwt?.TokenExpiredError) {
      log?.warn('Expired JWT token', LogContext?.API);
      return sendError(res, 'AUTHENTICATION_ERROR', 'Token expired', 401);
    } else {
      log?.error('Authentication failed', LogContext?.API, { error });
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

  return publicPaths?.some((publicPath) => path?.startsWith(publicPath));
}

/**
 * Get valid API keys from storage;
 */
async function getValidApiKeys(): Promise<string[]> {
  try {
    // Get API keys from secrets manager;
    const services = await secretsManager?.getAvailableServices();
    const apiKeys: string[] = [];

    // Add system API keys;
    const systemApiKey = await secretsManager?.getSecret('system_api_key');
    if (systemApiKey) {
      apiKeys?.push(systemApiKey);
    }

    // Add client API keys (stored with prefix)
    for (const service of services) {
      if (service?.startsWith('client_api_key_')) {
        const apiKey = await secretsManager?.getSecret(service);
        if (apiKey) {
          apiKeys?.push(apiKey);
        }
      }
    }

    // In development, also accept a test key;
    if (process?.env?.NODE_ENV === 'development') {
      apiKeys?.push('test_api_key_12345678901234567890123456789012');
    }

    return apiKeys;
  } catch (error) {
    log?.error('Failed to retrieve valid API keys', LogContext?.API, { error });
    return [];
  }
}

/**
 * Validate API key permissions and expiration;
 */
async function validateApiKeyPermissions(apiKey: string): Promise<boolean> {
  try {
    // Check if this is a test key in development;
    if (process?.env?.NODE_ENV === 'development' && apiKey?.startsWith('test_api_key_')) {
      return true;
    }

    // In production, implement proper permission checking;
    // This could include:
    // - Rate limiting per API key;
    // - Permission scopes;
    // - Expiration dates;
    // - Usage quotas;

    // For now, all valid keys have full permissions;
    return true;
  } catch (error) {
    log?.error('API key permission validation failed', LogContext?.API, { error });
    return false;
  }
}

/**
 * Validate API key against stored keys;
 */
async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    if (!apiKey || apiKey?.length < 32) {
      return false;
    }

    // Check against stored API keys in Supabase or secrets manager;
    const validApiKeys = await getValidApiKeys();
    
    // Check if the provided API key exists in our valid keys;
    const isValidKey = validApiKeys?.includes(apiKey);
    
    // Additional validation: check key format and expiration;
    if (isValidKey) {
      return await validateApiKeyPermissions(apiKey);
    }
    
    return false;
  } catch (error) {
    log?.error('API key validation failed', LogContext?.API, { error });
    return false;
  }
}

/**
 * Admin authentication middleware;
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req?.user?.isAdmin) {
    return sendError(res, 'AUTHENTICATION_ERROR', 'Admin access required', 403);
  }
  next();
};

export default authenticate;
