import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { config } from '../config';
import { apiKeyManager } from '../config/secrets';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  apiKey?: {
    id: string;
    permissions: string[];
  };
}

export interface AuthOptions {
  requireAuth?: boolean;
  requiredPermissions?: string[];
  allowApiKey?: boolean;
  allowJWT?: boolean;
  rateLimitByUser?: boolean;
}

export class AuthMiddleware {
  private supabase: SupabaseClient;
  private jwtSecret: string;
  private userSessions: Map<string, { lastActivity: number; requestCount: number }> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.jwtSecret = config.security.jwtSecret;
  }

  /**
   * Main authentication middleware
   */
  public authenticate(options: AuthOptions = {}) {
    const {
      requireAuth = true,
      requiredPermissions = [],
      allowApiKey = true,
      allowJWT = true,
      rateLimitByUser = true,
    } = options;

    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        // Skip authentication if not required
        if (!requireAuth) {
          return next();
        }

        // Try API key authentication first
        if (allowApiKey) {
          const apiKeyAuth = await this.authenticateApiKey(req);
          if (apiKeyAuth.success) {
            req.apiKey = apiKeyAuth.data;
            
            // Check API key permissions
            if (requiredPermissions.length > 0) {
              const hasPermission = requiredPermissions.some(perm => 
                req.apiKey!.permissions.includes(perm) || 
                req.apiKey!.permissions.includes('*')
              );
              
              if (!hasPermission) {
                return res.status(403).json({
                  error: 'Insufficient permissions',
                  required: requiredPermissions,
                  available: req.apiKey!.permissions,
                });
              }
            }
            
            return next();
          }
        }

        // Try JWT authentication
        if (allowJWT) {
          const jwtAuth = await this.authenticateJWT(req);
          if (jwtAuth.success) {
            req.user = jwtAuth.data;
            
            // Rate limiting by user
            if (rateLimitByUser && req.user) {
              const rateLimitCheck = this.checkUserRateLimit(req.user.id);
              if (!rateLimitCheck.allowed) {
                return res.status(429).json({
                  error: 'Rate limit exceeded',
                  retryAfter: rateLimitCheck.retryAfter,
                });
              }
            }
            
            return next();
          }
        }

        // No valid authentication found
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Valid API key or JWT token required',
        });

      } catch (error) {
        logger.error('Authentication error:', error);
        return res.status(500).json({
          error: 'Authentication failed',
          message: 'Internal server error during authentication',
        });
      }
    };
  }

  /**
   * Authenticate using API key
   */
  private async authenticateApiKey(req: AuthRequest): Promise<{
    success: boolean;
    data?: { id: string; permissions: string[] };
    error?: string;
  }> {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        return { success: false, error: 'No API key provided' };
      }

      // Check API key validity
      const keyData = apiKeyManager.getAPIKey(apiKey);
      if (!keyData) {
        return { success: false, error: 'Invalid API key' };
      }

      // Log API key usage
      await this.logApiKeyUsage(apiKey, req);

      return {
        success: true,
        data: {
          id: apiKey,
          permissions: keyData.permissions,
        },
      };
    } catch (error) {
      logger.error('API key authentication error:', error);
      return { success: false, error: 'API key authentication failed' };
    }
  }

  /**
   * Authenticate using JWT
   */
  private async authenticateJWT(req: AuthRequest): Promise<{
    success: boolean;
    data?: { id: string; email: string; role: string };
    error?: string;
  }> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { success: false, error: 'No JWT token provided' };
      }

      const token = authHeader.substring(7);
      
      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Verify user exists in Supabase
      const { data: user, error } = await this.supabase
        .from('users')
        .select('id, email, role')
        .eq('id', decoded.sub)
        .single();

      if (error || !user) {
        return { success: false, error: 'Invalid or expired token' };
      }

      // Log JWT usage
      await this.logJwtUsage(decoded.sub, req);

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      logger.error('JWT authentication error:', error);
      return { success: false, error: 'JWT authentication failed' };
    }
  }

  /**
   * Check user rate limit
   */
  private checkUserRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const userSession = this.userSessions.get(userId);

    if (!userSession) {
      this.userSessions.set(userId, {
        lastActivity: now,
        requestCount: 1,
      });
      return { allowed: true };
    }

    // Reset counter if more than 1 hour has passed
    if (now - userSession.lastActivity > 3600000) {
      userSession.requestCount = 1;
      userSession.lastActivity = now;
      return { allowed: true };
    }

    // Check rate limit (100 requests per hour per user)
    if (userSession.requestCount >= 100) {
      const retryAfter = Math.ceil((3600000 - (now - userSession.lastActivity)) / 1000);
      return { allowed: false, retryAfter };
    }

    userSession.requestCount++;
    userSession.lastActivity = now;
    return { allowed: true };
  }

  /**
   * Log API key usage
   */
  private async logApiKeyUsage(apiKey: string, req: AuthRequest): Promise<void> {
    try {
      await this.supabase
        .from('api_key_usage')
        .insert({
          api_key: apiKey,
          endpoint: req.originalUrl,
          method: req.method,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      logger.error('Failed to log API key usage:', error);
    }
  }

  /**
   * Log JWT usage
   */
  private async logJwtUsage(userId: string, req: AuthRequest): Promise<void> {
    try {
      await this.supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          endpoint: req.originalUrl,
          method: req.method,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      logger.error('Failed to log JWT usage:', error);
    }
  }

  /**
   * Generate JWT token
   */
  public generateJWT(userId: string, email: string, role: string): string {
    return jwt.sign(
      {
        sub: userId,
        email,
        role,
        iat: Math.floor(Date.now() / 1000),
      },
      this.jwtSecret,
      {
        expiresIn: '24h',
        issuer: 'universal-ai-tools',
        audience: 'universal-ai-tools-users',
      }
    );
  }

  /**
   * Refresh JWT token
   */
  public refreshJWT(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return this.generateJWT(decoded.sub, decoded.email, decoded.role);
    } catch (error) {
      logger.error('JWT refresh error:', error);
      return null;
    }
  }

  /**
   * Revoke user sessions
   */
  public async revokeUserSessions(userId: string): Promise<void> {
    try {
      // Remove from memory
      this.userSessions.delete(userId);
      
      // Log session revocation
      await this.supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          endpoint: '/auth/revoke',
          method: 'DELETE',
          ip_address: 'system',
          user_agent: 'system',
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      logger.error('Failed to revoke user sessions:', error);
    }
  }

  /**
   * Middleware for role-based access control
   */
  public requireRole(roles: string | string[]) {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User authentication required for role-based access',
        });
      }

      if (!requiredRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Required role: ${requiredRoles.join(' or ')}`,
          userRole: req.user.role,
        });
      }

      next();
    };
  }

  /**
   * Cleanup expired sessions
   */
  public cleanupExpiredSessions(): void {
    const now = Date.now();
    const hourAgo = now - 3600000;

    for (const [userId, session] of this.userSessions.entries()) {
      if (session.lastActivity < hourAgo) {
        this.userSessions.delete(userId);
      }
    }
  }
}

export default AuthMiddleware;