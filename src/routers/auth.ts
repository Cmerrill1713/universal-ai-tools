/**
 * Authentication Router
 * Handles user authentication, demo tokens, and account management
 */

import { type Request, type Response, Router } from 'express';
import type { SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { zodValidate } from '../middleware/zod-validate';
import { secretsManager } from '../services/secrets-manager';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';

const router = Router();

// Validation schemas
const demoTokenSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  purpose: z.string().max(200).optional(),
  duration: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
});

const apiKeySchema = z.object({
  name: z.string().min(1).max(50),
  permissions: z.array(z.string()).optional().default(['api_access']),
  duration: z.enum(['30d', '90d', '1y', 'never']).optional().default('90d'),
});

/**
 * @route GET /api/v1/auth
 * @description Authentication API information and available endpoints
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const endpoints = {
      demoToken: 'POST /api/v1/auth/demo-token - Generate a demo token for testing',
      apiKey: 'POST /api/v1/auth/api-key - Generate an API key (requires authentication)',
      validate: 'POST /api/v1/auth/validate - Validate a token or API key',
      refresh: 'POST /api/v1/auth/refresh - Refresh an expired token',
      revoke: 'POST /api/v1/auth/revoke - Revoke a token or API key',
      info: 'GET /api/v1/auth/info - Get authentication information for current user'
    };

    sendSuccess(res, {
      service: 'Universal AI Tools - Authentication API',
      version: '1.0.0',
      status: 'operational',
      endpoints,
      supportedMethods: [
        'JWT Bearer tokens',
        'API keys via X-API-Key header',
        'Demo tokens for testing',
        'Apple device authentication'
      ],
      demoAvailable: true,
      documentation: 'https://docs.universal-ai-tools.com/auth'
    });
  } catch (error) {
    sendError(res, 'SERVICE_ERROR', 'Failed to get auth API info', 500);
  }
});

/**
 * @route POST /api/v1/auth/demo-token
 * @description Generate a demo token for testing and evaluation
 */
router.post(
  '/demo-token',
  zodValidate(demoTokenSchema),
  async (req: Request, res: Response) => {
    try {
      const { name = 'Demo User', purpose = 'API Testing', duration = '24h' } = req.body;

      // Get JWT secret using the same logic as auth middleware
      let jwtSecret: string | null = null;
      try {
        const secretFromVault = await secretsManager.getSecret('jwt_secret');
        jwtSecret = secretFromVault || process.env.JWT_SECRET || null;
        
        if (!jwtSecret) {
          log.error('JWT secret not configured in secrets manager or environment', LogContext.API);
          return sendError(res, 'CONFIGURATION_ERROR', 'Authentication system not properly configured', 500);
        }
        
        if (jwtSecret.length < 32) {
          log.error('JWT secret must be at least 32 characters', LogContext.API);
          return sendError(res, 'CONFIGURATION_ERROR', 'Authentication system configuration error', 500);
        }
      } catch (error) {
        log.error('JWT secret configuration error', LogContext.API, { 
          error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 'CONFIGURATION_ERROR', 'Authentication system configuration error', 500);
      }

      // Calculate expiration
      const expirationMap: Record<'1h' | '24h' | '7d' | '30d', string> = {
        '1h': '1h',
        '24h': '24h', 
        '7d': '7d',
        '30d': '30d'
      };

      // Ensure duration is a valid key
      const validDuration = duration as keyof typeof expirationMap;
      if (!expirationMap[validDuration]) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid duration specified', 400);
      }

      const userId = `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const payload = {
        userId,
        email: `${userId}@demo.universal-ai-tools.com`,
        isAdmin: false,
        permissions: ['api_access', 'demo_user'],
        deviceType: 'demo',
        trusted: false,
        purpose,
        isDemoToken: true,
      };

      const signOptions = {
        expiresIn: expirationMap[validDuration],
        issuer: 'universal-ai-tools',
        audience: 'api-users'
      };

      const token = jwt.sign(payload, jwtSecret!, signOptions as jwt.SignOptions);

      // Calculate actual expiration timestamp
      const now = new Date();
      const expiration = new Date(now);
      switch (duration) {
        case '1h':
          expiration.setHours(now.getHours() + 1);
          break;
        case '24h':
          expiration.setDate(now.getDate() + 1);
          break;
        case '7d':
          expiration.setDate(now.getDate() + 7);
          break;
        case '30d':
          expiration.setDate(now.getDate() + 30);
          break;
      }

      log.info('🎫 Demo token generated', LogContext.API, {
        userId,
        name,
        purpose,
        duration,
        expiresAt: expiration.toISOString(),
      });

      sendSuccess(res, {
        token,
        tokenType: 'Bearer',
        user: {
          id: userId,
          name,
          email: payload.email,
          permissions: payload.permissions,
          isDemoToken: true,
        },
        expiresAt: expiration.toISOString(),
        expiresIn: duration,
        usage: {
          header: 'Authorization: Bearer ' + token,
          curl: `curl -H "Authorization: Bearer ${token}" http://localhost:9999/api/v1/...`,
          note: 'This is a demo token for testing. It has limited capabilities and will expire.'
        },
        availableEndpoints: [
          '/api/v1/agents - List and interact with AI agents',
          '/api/v1/vision - Image analysis and computer vision',
          '/api/v1/parameters - Intelligent parameter optimization',
          '/api/v1/feedback - Submit feedback and analytics',
          '/api/v1/health - System health monitoring'
        ]
      });

    } catch (error) {
      log.error('Failed to generate demo token', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      sendError(res, 'TOKEN_GENERATION_ERROR', `Failed to generate demo token: ${error instanceof Error ? error.message : String(error)}`, 500);
    }
  }
);

/**
 * @route POST /api/v1/auth/validate
 * @description Validate a token or API key
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { token, apiKey } = req.body;

    if (!token && !apiKey) {
      return sendError(res, 'VALIDATION_ERROR', 'Token or API key required', 400);
    }

    let isValid = false;
    let decoded: any = null;
    let type = '';

    if (token) {
      try {
        let jwtSecret: string | null = null;
        try {
          const secretFromVault = await secretsManager.getSecret('jwt_secret');
          jwtSecret = secretFromVault || process.env.JWT_SECRET || null;
        } catch (error) {
          jwtSecret = process.env.JWT_SECRET || null;
        }
        
        if (!jwtSecret) {
          log.error('JWT secret not available for validation', LogContext.API);
          isValid = false;
        } else {
          decoded = jwt.verify(token, jwtSecret);
          isValid = true;
          type = 'jwt';
        }
      } catch (error) {
        isValid = false;
      }
    } else if (apiKey) {
      // Simple API key validation (would be more sophisticated in production)
      isValid = apiKey.startsWith('uai_') && apiKey.length > 20;
      type = 'api_key';
      if (isValid) {
        decoded = { userId: 'api-user', permissions: ['api_access'] };
      }
    }

    if (isValid) {
      sendSuccess(res, {
        valid: true,
        type,
        user: decoded ? {
          id: decoded.userId,
          email: decoded.email,
          permissions: decoded.permissions || [],
          isDemoToken: decoded.isDemoToken || false,
          deviceType: decoded.deviceType,
        } : null,
        expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
      });
    } else {
      sendSuccess(res, {
        valid: false,
        type: null,
        reason: 'Invalid or expired token/API key'
      });
    }

  } catch (error) {
    log.error('Failed to validate token', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    sendError(res, 'VALIDATION_ERROR', 'Failed to validate token', 500);
  }
});

/**
 * @route GET /api/v1/auth/info
 * @description Get authentication information for current user (requires auth)
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    // This endpoint requires authentication, but we'll make it permissive for demo
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    if (!authHeader && !apiKey) {
      return sendError(res, 'AUTHENTICATION_ERROR', 'Authentication required', 401);
    }

    let userInfo: any = {
      authenticated: false,
      type: 'none'
    };

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        let jwtSecret: string | null = null;
        try {
          const secretFromVault = await secretsManager.getSecret('jwt_secret');
          jwtSecret = secretFromVault || process.env.JWT_SECRET || null;
        } catch (error) {
          jwtSecret = process.env.JWT_SECRET || null;
        }
        
        if (!jwtSecret) {
          userInfo = {
            authenticated: false,
            type: 'jwt',
            error: 'JWT secret not configured'
          };
        } else {
          const decoded = jwt.verify(token, jwtSecret) as any;
          
          userInfo = {
            authenticated: true,
            type: 'jwt',
            user: {
              id: decoded.userId,
              email: decoded.email,
              permissions: decoded.permissions || [],
              isDemoToken: decoded.isDemoToken || false,
              deviceType: decoded.deviceType,
            },
            expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
          };
        }
      } catch (error) {
        userInfo = {
          authenticated: false,
          type: 'jwt',
          error: 'Invalid or expired token'
        };
      }
    } else if (apiKey) {
      const isValid = apiKey.startsWith('uai_') && apiKey.length > 20;
      userInfo = {
        authenticated: isValid,
        type: 'api_key',
        user: isValid ? {
          id: 'api-user',
          permissions: ['api_access']
        } : null,
        error: isValid ? null : 'Invalid API key'
      };
    }

    sendSuccess(res, userInfo);

  } catch (error) {
    log.error('Failed to get auth info', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    sendError(res, 'AUTH_INFO_ERROR', 'Failed to get authentication info', 500);
  }
});

/**
 * @route GET /api/v1/auth/demo
 * @description Get quick demo information and sample requests
 */
router.get('/demo', async (req: Request, res: Response) => {
  try {
    sendSuccess(res, {
      title: 'Universal AI Tools - Demo Access',
      description: 'Get started with Universal AI Tools using our demo token system',
      quickStart: {
        step1: {
          action: 'Generate a demo token',
          endpoint: 'POST /api/v1/auth/demo-token',
          example: 'curl -X POST http://localhost:9999/api/v1/auth/demo-token -H "Content-Type: application/json" -d \'{"name":"My Test","purpose":"Trying the API"}\''
        },
        step2: {
          action: 'Use the token to access APIs',
          example: 'curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:9999/api/v1/agents'
        },
        step3: {
          action: 'Explore available endpoints',
          endpoints: [
            'GET /api/v1/vision - Computer vision capabilities',
            'GET /api/v1/parameters - AI parameter optimization', 
            'GET /api/v1/agents - Available AI agents',
            'POST /api/v1/feedback - Submit feedback'
          ]
        }
      },
      features: {
        noSignup: 'No account creation required',
        immediate: 'Instant access to AI capabilities',
        comprehensive: 'Full API access with demo limitations',
        secure: 'Temporary tokens with controlled permissions'
      },
      limitations: {
        duration: 'Demo tokens expire after 24 hours (configurable)',
        rateLimit: 'Standard rate limits apply',
        persistence: 'No data persistence across sessions'
      }
    });
  } catch (error) {
    sendError(res, 'DEMO_INFO_ERROR', 'Failed to get demo information', 500);
  }
});

export default router;