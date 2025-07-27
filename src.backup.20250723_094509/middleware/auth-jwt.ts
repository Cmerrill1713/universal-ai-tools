import type { NextFunction, Request, Response } from 'express';
import type { SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { config } from '../config';
import { secretsManager } from '../config/secrets';
import crypto from 'crypto';

export interface JWTPayload {
  sub: string; // user id
  email: string;
  role: string;
  type: 'access' | 'refresh';
  jti?: string; // JWT ID for tracking
  iat?: number;
  exp?: number;
}

export interface RefreshTokenData {
  userId: string;
  tokenId: string;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
  userAgent?: string;
  ipAddress?: string;
}

export class JWTAuthService {
  private supabase: SupabaseClient;
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string | number = '15m'; // 15 minutes
  private refreshTokenExpiry: string | number = '7d'; // 7 days
  private tokenBlacklist: Set<string> = new Set();
  private authAttempts: Map<string, { count: number; lastAttempt: number; blocked?: number }> =
    new Map();
  private readonly MAX_AUTH_ATTEMPTS = 5;
  private readonly BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.accessTokenSecret = config.security.jwtSecret;
    this.refreshTokenSecret = secretsManager.generateKey(64); // Generate separate secret for refresh tokens
  }

  /**
   * Generate both access and refresh tokens
   */
  public async generateTokenPair(
    userId: string,
    email: string,
    role: string,
    req?: Request
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const tokenId = crypto.randomUUID();

    // Generate access token
    const accessTokenOptions: SignOptions = {
      expiresIn: this.accessTokenExpiry as: any,
      issuer: 'universal-ai-tools',
      audience: 'universal-ai-tools-api',
    };

    const accessToken = jwt.sign(
      {
        sub: userId,
        email,
        role,
        type: 'access',
        jti: tokenId,
      },
      this.accessTokenSecret,
      accessTokenOptions
    );

    // Generate refresh token
    const refreshTokenOptions: SignOptions = {
      expiresIn: this.refreshTokenExpiry as: any,
      issuer: 'universal-ai-tools',
      audience: 'universal-ai-tools-refresh',
    };

    const refreshToken = jwt.sign(
      {
        sub: userId,
        email,
        role,
        type: 'refresh',
        jti: tokenId,
      },
      this.refreshTokenSecret,
      refreshTokenOptions
    );

    // Store refresh token in database
    const refreshTokenData: RefreshTokenData = {
      userId,
      tokenId,
      token: secretsManager.encrypt(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isRevoked: false,
      userAgent: req?.headers['user-agent'],
      ipAddress: req?.ip,
    };

    await this.storeRefreshToken(refreshTokenData);

    // Log successful token generation
    await this.logAuthEvent(userId, 'token_generated', req?.ip, req?.headers['user-agent'], true);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Verify and decode access token
   */
  public verifyAccessToken(token: string): JWTPayload | null {
    try {
      // Check if token is blacklisted
      const decoded = jwt.decode(token) as JWTPayload;
      if (decoded?.jti && this.tokenBlacklist.has(decoded.jti)) {
        logger.warn('Attempted use of blacklisted token', { jti: decoded.jti });
        return null;
      }

      // Verify token
      const payload = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'universal-ai-tools',
        audience: 'universal-ai-tools-api',
      }) as JWTPayload;

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      logger.error('Access token verification failed:', error);
      return null;
    }
  }

  /**
   * Verify and decode refresh token
   */
  public verifyRefreshToken(token: string): JWTPayload | null {
    try {
      const payload = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'universal-ai-tools',
        audience: 'universal-ai-tools-refresh',
      }) as JWTPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshAccessToken(
    refreshToken: string,
    req?: Request
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } | null> {
    try {
      // Verify refresh token
      const payload = this.verifyRefreshToken(refreshToken);
      if (!payload) {
        return null;
      }

      // Check if refresh token exists and is valid in database
      const storedToken = await this.getStoredRefreshToken(payload.sub, payload.jti!);
      if (!storedToken || storedToken.isRevoked) {
        logger.warn('Invalid or revoked refresh token', { userId: payload.sub, jti: payload.jti });
        return null;
      }

      // Verify the encrypted token matches
      const decryptedToken = secretsManager.decrypt(storedToken.token);
      if (decryptedToken !== refreshToken) {
        logger.warn('Refresh token mismatch', { userId: payload.sub });
        return null;
      }

      // Check expiration
      if (new Date() > storedToken.expiresAt) {
        logger.warn('Expired refresh token', { userId: payload.sub });
        await this.revokeRefreshToken(payload.sub, payload.jti!);
        return null;
      }

      // Revoke old refresh token
      await this.revokeRefreshToken(payload.sub, payload.jti!);

      // Log successful token refresh
      await this.logAuthEvent(
        payload.sub,
        'token_refreshed',
        req?.ip,
        req?.headers['user-agent'],
        true
      );

      // Generate new token pair
      return await this.generateTokenPair(payload.sub, payload.email, payload.role, req);
    } catch (error) {
      logger.error('Token refresh failed:', error);
      return null;
    }
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(tokenData: RefreshTokenData): Promise<void> {
    try {
      await this.supabase.from('refresh_tokens').insert({
        user_id: tokenData.userId,
        token_id: tokenData.tokenId,
        encrypted_token: tokenData.token,
        expires_at: tokenData.expiresAt,
        is_revoked: tokenData.isRevoked,
        user_agent: tokenData.userAgent,
        ip_address: tokenData.ipAddress,
        created_at: new Date(),
      });
    } catch (error) {
      logger.error('Failed to store refresh token:', error);
      throw error;
    }
  }

  /**
   * Get stored refresh token
   */
  private async getStoredRefreshToken(
    userId: string,
    tokenId: string
  ): Promise<RefreshTokenData | null> {
    try {
      const { data, error} = await this.supabase
        .from('refresh_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('token_id', tokenId)
        .single();

      if (_error|| !data) {
        return null;
      }

      return {
        userId: data.user_id,
        tokenId: data.token_id,
        token: data.encrypted_token,
        expiresAt: new Date(data.expires_at),
        isRevoked: data.is_revoked,
        userAgent: data.user_agent,
        ipAddress: data.ip_address,
      };
    } catch (error) {
      logger.error('Failed to get refresh token:', error);
      return null;
    }
  }

  /**
   * Revoke refresh token
   */
  public async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    try {
      await this.supabase
        .from('refresh_tokens')
        .update({ is_revoked: true, revoked_at: new Date() })
        .eq('user_id', userId)
        .eq('token_id', tokenId);

      // Add to blacklist
      this.tokenBlacklist.add(tokenId);
    } catch (error) {
      logger.error('Failed to revoke refresh token:', error);
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  public async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      const { data: tokens } = await this.supabase
        .from('refresh_tokens')
        .select('token_id')
        .eq('user_id', userId)
        .eq('is_revoked', false);

      if (tokens) {
        // Add all token IDs to blacklist
        tokens.forEach((token) => this.tokenBlacklist.add(token.token_id));
      }

      // Revoke all tokens in database
      await this.supabase
        .from('refresh_tokens')
        .update({ is_revoked: true, revoked_at: new Date() })
        .eq('user_id', userId);
    } catch (error) {
      logger.error('Failed to revoke all user tokens:', error);
    }
  }

  /**
   * Clean up expired tokens
   */
  public async cleanupExpiredTokens(): Promise<void> {
    try {
      const { error} = await this.supabase
        .from('refresh_tokens')
        .delete()
        .or('expires_at.lt.now(),is_revoked.eq.true');

      if (_error {
        logger.error('Failed to cleanup expired tokens:', error);
      }

      // Clear old entries from blacklist
      if (this.tokenBlacklist.size > 10000) {
        this.tokenBlacklist.clear();
      }
    } catch (error) {
      logger.error('Token cleanup failed:', error);
    }
  }

  /**
   * Check if IP is rate limited for authentication
   */
  public isAuthRateLimited(ip: string): { limited: boolean; retryAfter?: number } {
    const attempt = this.authAttempts.get(ip);
    if (!attempt) {
      return { limited: false };
    }

    const now = Date.now();

    // Check if currently blocked
    if (attempt.blocked && now < attempt.blocked) {
      const retryAfter = Math.ceil((attempt.blocked - now) / 1000);
      return { limited: true, retryAfter };
    }

    // Reset if block period expired
    if (attempt.blocked && now >= attempt.blocked) {
      this.authAttempts.delete(ip);
      return { limited: false };
    }

    // Check if too many attempts in time window
    if (
      attempt.count >= this.MAX_AUTH_ATTEMPTS &&
      now - attempt.lastAttempt < this.BLOCK_DURATION
    ) {
      attempt.blocked = now + this.BLOCK_DURATION;
      const retryAfter = Math.ceil(this.BLOCK_DURATION / 1000);
      return { limited: true, retryAfter };
    }

    return { limited: false };
  }

  /**
   * Record authentication attempt
   */
  public recordAuthAttempt(ip: string, success: boolean): void {
    const now = Date.now();
    const attempt = this.authAttempts.get(ip) || { count: 0, lastAttempt: 0 };

    if (success) {
      // Reset on successful auth
      this.authAttempts.delete(ip);
      return;
    }

    // Reset count if last attempt was more than block duration ago
    if (now - attempt.lastAttempt > this.BLOCK_DURATION) {
      attempt.count = 1;
    } else {
      attempt.count++;
    }

    attempt.lastAttempt = now;
    this.authAttempts.set(ip, attempt);
  }

  /**
   * Log authentication events
   */
  private async logAuthEvent(
    userId: string | null,
    event: string,
    ipAddress?: string,
    userAgent?: string,
    success = true
  ): Promise<void> {
    try {
      await this.supabase.from('auth_events').insert({
        user_id: userId,
        event_type: event,
        ip_address: ipAddress,
        user_agent: userAgent,
        success,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to log auth event:', error);
    }
  }

  /**
   * Get active sessions for a user
   */
  public async getUserSessions(userId: string): Promise<
    Array<{
      tokenId: string;
      createdAt: Date;
      expiresAt: Date;
      userAgent?: string;
      ipAddress?: string;
    }>
  > {
    try {
      const { data, error} = await this.supabase
        .from('refresh_tokens')
        .select('token_id, created_at, expires_at, user_agent, ip_address')
        .eq('user_id', userId)
        .eq('is_revoked', false)
        .order('created_at', { ascending: false });

      if (_error|| !data) {
        return [];
      }

      return data.map((session) => ({
        tokenId: session.token_id,
        createdAt: new Date(session.created_at),
        expiresAt: new Date(session.expires_at),
        userAgent: session.user_agent,
        ipAddress: session.ip_address,
      }));
    } catch (error) {
      logger.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * JWT Authentication Middleware
   */
  public authenticate(options: { requireAuth?: boolean } = {}) {
    const { requireAuth = true } = options;

    return async (req: any, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          if (requireAuth) {
            await this.logAuthEvent(
              null,
              'auth_failed_no_token',
              req.ip,
              req.headers['user-agent'],
              false
            );
            return res.status(401).json({
              error: 'Authentication required',
              message: 'No valid authorization header found',
            });
          }
          return next();
        }

        const token = authHeader.substring(7);
        const payload = this.verifyAccessToken(token);

        if (!payload) {
          await this.logAuthEvent(
            null,
            'auth_failed_invalid_token',
            req.ip,
            req.headers['user-agent'],
            false
          );
          return res.status(401).json({
            error: 'Invalid token',
            message: 'The provided token is invalid or expired',
          });
        }

        // Verify user still exists and is active
        const { data: user, error} = await this.supabase
          .from('users')
          .select('id, email, role, is_active')
          .eq('id', payload.sub)
          .single();

        if (_error|| !user || !user.is_active) {
          await this.logAuthEvent(
            payload.sub,
            'auth_failed_user_inactive',
            req.ip,
            req.headers['user-agent'],
            false
          );
          return res.status(401).json({
            error: 'User not found',
            message: 'User account not found or inactive',
          });
        }

        // Update last activity
        await this.updateUserActivity(user.id, req.ip, req.headers['user-agent']);

        // Attach user to request
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        };

        next();
      } catch (error) {
        logger.error('Authentication error', error);
        return res.status(500).json({
          error: 'Authentication failed',
          message: 'Internal server errorduring authentication',
        });
      }
    };
  }

  /**
   * Update user activity
   */
  private async updateUserActivity(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.supabase.from('user_activity').upsert({
        user_id: userId,
        last_activity: new Date(),
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    } catch (error) {
      logger.error('Failed to update user activity:', error);
    }
  }

  /**
   * Get user security info
   */
  public async getUserSecurityInfo(userId: string): Promise<{
    sessions: Array<any>;
    recentActivity: Array<any>;
    failedAttempts: number;
  }> {
    try {
      const [sessions, activity, failedAttempts] = await Promise.all([
        this.getUserSessions(userId),
        this.supabase
          .from('auth_events')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(10),
        this.supabase
          .from('auth_events')
          .select('count')
          .eq('user_id', userId)
          .eq('success', false)
          .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000))
          .single(),
      ]);

      return {
        sessions,
        recentActivity: activity.data || [],
        failedAttempts: failedAttempts.data?.count || 0,
      };
    } catch (error) {
      logger.error('Failed to get user security info:', error);
      return {
        sessions: [],
        recentActivity: [],
        failedAttempts: 0,
      };
    }
  }

  /**
   * Revoke specific session
   */
  public async revokeSession(userId: string, tokenId: string): Promise<boolean> {
    try {
      await this.revokeRefreshToken(userId, tokenId);
      await this.logAuthEvent(userId, 'session_revoked', 'user_action', 'user_action', true);
      return true;
    } catch (error) {
      logger.error('Failed to revoke session:', error);
      return false;
    }
  }
}

export default JWTAuthService;
