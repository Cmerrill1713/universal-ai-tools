/**
 * JWT Authentication Middleware
 * Handles JWT token creation, validation, and user session management
 */

import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { config } from '../config/environment-clean';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
      session?: any;
      apiKey?: string;
      aiService?: any;
    }
  }
}

export interface JWTPayload {
  userId: string;
  email?: string;
  role?: string;
  permissions?: string[];
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiration: string;
  refreshTokenExpiration: string;
  issuer: string;
  audience: string;
}

export class JWTAuthService {
  private supabase: SupabaseClient;
  private jwtSecret: string;
  private jwtExpiration: string;
  private refreshTokenExpiration: string;
  private issuer: string;
  private audience: string;

  constructor(
    supabase: SupabaseClient,
    authConfig?: Partial<AuthConfig>
  ) {
    this.supabase = supabase;
    this.jwtSecret = authConfig?.jwtSecret || config.security.jwtSecret;
    this.jwtExpiration = authConfig?.jwtExpiration || '24h';
    this.refreshTokenExpiration = authConfig?.refreshTokenExpiration || '7d';
    this.issuer = authConfig?.issuer || 'universal-ai-tools';
    this.audience = authConfig?.audience || 'universal-ai-tools-users';
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    try {
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiration,
        issuer: this.issuer,
        audience: this.audience,
      });

      logger.debug('Access token generated', {
        userId: payload.userId,
        sessionId: payload.sessionId,
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate access token:', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    try {
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.refreshTokenExpiration,
        issuer: this.issuer,
        audience: this.audience,
      });

      logger.debug('Refresh token generated', {
        userId: payload.userId,
        sessionId: payload.sessionId,
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate refresh token:', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.issuer,
        audience: this.audience,
      }) as JWTPayload;

      logger.debug('Token verified successfully', {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
      });

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('Token expired:', error.message);
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid token:', error.message);
        throw new Error('Invalid token');
      } else {
        logger.error('Token verification failed:', error);
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; newRefreshToken?: string }> {
    try {
      const decoded = this.verifyToken(refreshToken);
      
      // Check if session is still valid in database
      const { data: session, error } = await this.supabase
        .from('user_sessions')
        .select('*')
        .eq('session_id', decoded.sessionId)
        .eq('user_id', decoded.userId)
        .eq('is_active', true)
        .single();

      if (error || !session) {
        throw new Error('Session not found or inactive');
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions,
        sessionId: decoded.sessionId,
      });

      // Optionally generate new refresh token if close to expiration
      let newRefreshToken: string | undefined;
      const timeUntilExpiry = (decoded.exp || 0) * 1000 - Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      if (timeUntilExpiry < oneDayMs) {
        newRefreshToken = this.generateRefreshToken({
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          permissions: decoded.permissions,
          sessionId: decoded.sessionId,
        });
      }

      logger.info('Access token refreshed', {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        newRefreshTokenGenerated: !!newRefreshToken,
      });

      return {
        accessToken: newAccessToken,
        newRefreshToken,
      };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Create user session
   */
  async createSession(userId: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store session in database
      const { error } = await this.supabase
        .from('user_sessions')
        .insert({
          session_id: sessionId,
          user_id: userId,
          is_active: true,
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          metadata: metadata || {},
        });

      if (error) {
        throw error;
      }

      logger.info('User session created', { userId, sessionId });
      return sessionId;
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw new Error('Session creation failed');
    }
  }

  /**
   * Invalidate user session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_sessions')
        .update({ 
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      if (error) {
        throw error;
      }

      logger.info('User session invalidated', { sessionId });
    } catch (error) {
      logger.error('Failed to invalidate session:', error);
      throw new Error('Session invalidation failed');
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
        })
        .eq('session_id', sessionId)
        .eq('is_active', true);

      if (error && error.code !== 'PGRST116') { // Ignore "no rows updated" error
        throw error;
      }
    } catch (error) {
      logger.warn('Failed to update session activity:', error);
      // Don't throw error for activity updates
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_roles')
        .select('roles(permissions)')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      const permissions: string[] = [];
      data?.forEach((item: any) => {
        if (item.roles?.permissions) {
          permissions.push(...item.roles.permissions);
        }
      });

      return [...new Set(permissions)]; // Remove duplicates
    } catch (error) {
      logger.warn('Failed to get user permissions:', error);
      return [];
    }
  }

  /**
   * JWT Authentication middleware
   */
  authenticateJWT() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            error: 'No token provided',
            code: 'NO_TOKEN',
          });
        }

        const token = authHeader.substring(7);
        const decoded = this.verifyToken(token);

        // Verify session is still active
        const { data: session, error } = await this.supabase
          .from('user_sessions')
          .select('*')
          .eq('session_id', decoded.sessionId)
          .eq('is_active', true)
          .single();

        if (error || !session) {
          return res.status(401).json({
            error: 'Session not found or inactive',
            code: 'INVALID_SESSION',
          });
        }

        // Update session activity
        await this.updateSessionActivity(decoded.sessionId);

        // Attach user info to request
        req.user = decoded;
        req.session = session;

        next();
      } catch (error) {
        logger.warn('JWT authentication failed:', error);
        
        if (error instanceof Error) {
          if (error.message === 'Token expired') {
            return res.status(401).json({
              error: 'Token expired',
              code: 'TOKEN_EXPIRED',
            });
          } else if (error.message === 'Invalid token') {
            return res.status(401).json({
              error: 'Invalid token',
              code: 'INVALID_TOKEN',
            });
          }
        }

        return res.status(401).json({
          error: 'Authentication failed',
          code: 'AUTH_FAILED',
        });
      }
    };
  }

  /**
   * Optional JWT Authentication middleware (doesn't fail if no token)
   */
  optionalJWT() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          // No token provided, continue without user info
          return next();
        }

        const token = authHeader.substring(7);
        const decoded = this.verifyToken(token);

        // Verify session is still active
        const { data: session } = await this.supabase
          .from('user_sessions')
          .select('*')
          .eq('session_id', decoded.sessionId)
          .eq('is_active', true)
          .single();

        if (session) {
          // Update session activity
          await this.updateSessionActivity(decoded.sessionId);
          
          // Attach user info to request
          req.user = decoded;
          req.session = session;
        }

        next();
      } catch (error) {
        // Silently continue without user info if token is invalid
        logger.debug('Optional JWT authentication failed:', error);
        next();
      }
    };
  }

  /**
   * Permission check middleware
   */
  requirePermissions(requiredPermissions: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const userPermissions = req.user.permissions || [];
      const hasPermission = requiredPermissions.every(permission =>
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: requiredPermissions,
          current: userPermissions,
        });
      }

      next();
    };
  }

  /**
   * Role check middleware
   */
  requireRole(requiredRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const userRole = req.user.role;
      
      if (!requiredRoles.includes(userRole)) {
        return res.status(403).json({
          error: 'Insufficient role',
          code: 'INSUFFICIENT_ROLE',
          required: requiredRoles,
          current: userRole,
        });
      }

      next();
    };
  }
}

export default JWTAuthService;