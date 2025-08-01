/**
 * Mock Authentication Middleware for Testing
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

interface ApiKeyRecord {
  id: string;
  service_name: string;
  is_active: boolean;
  rate_limit: number;
  permissions: string[];
  current_usage?: number;
}

// Mock storage for API keys
const mockApiKeys = new Map<string, ApiKeyRecord>();

export const validateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const serviceName = req.headers['x-ai-service'] as string;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required'
      }
    });
  }

  // Simulate database lookup
  const keyRecord = mockApiKeys.get(apiKey);
  
  if (!keyRecord) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key'
      }
    });
  }

  if (!keyRecord.is_active) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'API_KEY_INACTIVE',
        message: 'API key is inactive'
      }
    });
  }

  res.locals.apiKey = keyRecord;
  return next();
};

export const authenticateRequest = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authorization token required'
      }
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret') as any;
    res.locals.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
};

export const rateLimitByApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const {apiKey} = res.locals;

  if (!apiKey) {
    return next();
  }

  if (apiKey.current_usage >= apiKey.rate_limit) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'API rate limit exceeded'
      }
    });
  }

  // Increment usage
  apiKey.current_usage = (apiKey.current_usage || 0) + 1;
  res.locals.apiKey = apiKey;
  
  return next();
};

// Helper function to set up mock data for tests
export const _setMockApiKey = (apiKey: string, record: ApiKeyRecord) => {
  mockApiKeys.set(apiKey, record);
};

export const _clearMockApiKeys = () => {
  mockApiKeys.clear();
};