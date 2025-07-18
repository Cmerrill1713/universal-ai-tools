import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { SupabaseClient } from '@supabase/supabase-js';
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
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.accessTokenSecret = config.security.jwtSecret;
    this.refreshTokenSecret = secretsManager.generateKey(64); // Generate separate secret for refresh tokens
  }

  /**
   * Generate both access and refresh tokens
   */
  public async generateTokenPair(userId: string, email: string, role: string, req?: Request): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const tokenId = crypto.randomUUID();
    
    // Generate access token
    const accessTokenOptions: SignOptions = {
      expiresIn: this.accessTokenExpiry as any,
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
      expiresIn: this.refreshTokenExpiry as any,
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
  public async refreshAccessToken(refreshToken: string, req?: Request): Promise<{
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
      await this.supabase
        .from('refresh_tokens')
        .insert({
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
  private async getStoredRefreshToken(userId: string, tokenId: string): Promise<RefreshTokenData | null> {
    try {
      const { data, error } = await this.supabase
        .from('refresh_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('token_id', tokenId)
        .single();
      
      if (error || !data) {
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
        tokens.forEach(token => this.tokenBlacklist.add(token.token_id));
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
      const { error } = await this.supabase
        .from('refresh_tokens')
        .delete()
        .or('expires_at.lt.now(),is_revoked.eq.true');
      
      if (error) {
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
   * Get active sessions for a user
   */
  public async getUserSessions(userId: string): Promise<Array<{
    tokenId: string;
    createdAt: Date;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }>> {
    try {
      const { data, error } = await this.supabase
        .from('refresh_tokens')
        .select('token_id, created_at, expires_at, user_agent, ip_address')
        .eq('user_id', userId)
        .eq('is_revoked', false)
        .order('created_at', { ascending: false });
      
      if (error || !data) {
        return [];
      }
      
      return data.map(session => ({
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
          return res.status(401).json({
            error: 'Invalid token',
            message: 'The provided token is invalid or expired',
          });
        }
        
        // Verify user still exists and is active
        const { data: user, error } = await this.supabase
          .from('users')
          .select('id, email, role, is_active')
          .eq('id', payload.sub)
          .single();
        
        if (error || !user || !user.is_active) {
          return res.status(401).json({
            error: 'User not found',
            message: 'User account not found or inactive',
          });
        }
        
        // Attach user to request
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        };
        
        next();
      } catch (error) {
        logger.error('Authentication error:', error);
        return res.status(500).json({
          error: 'Authentication failed',
          message: 'Internal server error during authentication',
        });
      }
    };
  }
}

export default JWTAuthService;