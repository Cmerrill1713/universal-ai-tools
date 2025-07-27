import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SupabaseClient } from '@supabase/supabase-js';
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
      rateLimitByUser = true
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
              const hasPermission = requiredPermissions.some(
                (perm) =>
                  req.apiKey!.permissions.includes(perm) || req.apiKey!.permissions.includes('*')
              );
              if (!hasPermission) {
                return res.status(403).json({
                  error: 'Insufficient permissions',
                  required: requiredPermissions,
                  available: req.apiKey!.permissions
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
                  retryAfter: rateLimitCheck.retryAfter
                });
              }
            }
            return next();
          }
        }

        // No valid authentication found
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Valid API key or JWT token required'
        });
      } catch (error) {
        logger.error('Authentication error', error);
        return res.status(500).json({
          error: 'Authentication failed',
          message: 'Internal server error during authentication'
        });
      }}/**
   * Authenticate using A.P.I key*/
  private async authenticate.Api.Key(req: Auth.Request): Promise<{
    success: boolean,
    data?: { id: string; permissions: string[] ,
    error?: string}> {
    try {
      const api.Key = reqheaders['x-api-key'] as string;
      if (!api.Key) {
        return { success: false, error instanceof Error ? errormessage : String(error) 'No A.P.I key provided' }}// Check A.P.I key validity;
      const key.Data = apiKeyManagergetAP.I.Key(api.Key);
      if (!key.Data) {
        return { success: false, error instanceof Error ? errormessage : String(error) 'Invalid A.P.I key' }}// Log A.P.I key usage;
      await thislogApi.Key.Usage(api.Key, req);
      return {
        success: true,
        data: {
          id: api.Key,
          permissions: key.Datapermissions,
        }}} catch (error) {
      loggererror('A.P.I key authentication error instanceof Error ? errormessage : String(error)', error);
      return { success: false, error instanceof Error ? errormessage : String(error) 'A.P.I key authentication failed' }}}/**
   * Authenticate using J.W.T*/
  private async authenticateJ.W.T(req: Auth.Request): Promise<{
    success: boolean,
    data?: { id: string; email: string; role: string ,
    error?: string}> {
    try {
      const auth.Header = reqheadersauthorization;
      if (!auth.Header || !auth.Headerstarts.With('Bearer ')) {
        return { success: false, error instanceof Error ? errormessage : String(error) 'No J.W.T token provided' };

      const token = auth.Headersubstring(7)// Verify J.W.T token;
      const decoded = jwtverify(token, thisjwt.Secret) as any// Verify user exists in Supabase;
      const { data: user, error } = await thissupabase;
        from('users');
        select('id, email, role');
        eq('id', decodedsub);
        single();
      if (error || !user) {
        return { success: false, error instanceof Error ? errormessage : String(error) 'Invalid or expired token' }}// Log J.W.T usage;
      await thislog.Jwt.Usage(decodedsub, req);
      return {
        success: true,
        data: {
          id: userid,
          email: useremail,
          role: userrole,
        }}} catch (error) {
      loggererror('J.W.T authentication error instanceof Error ? errormessage : String(error)', error);
      return { success: false, error instanceof Error ? errormessage : String(error) 'J.W.T authentication failed' }}}/**
   * Check user rate limit*/
  private checkUser.Rate.Limit(user.Id: string): { allowed: boolean; retry.After?: number } {
    const now = Date.now();
    const user.Session = thisuser.Sessionsget(user.Id);
    if (!user.Session) {
      thisuser.Sessionsset(user.Id, {
        last.Activity: now,
        request.Count: 1}),
      return { allowed: true }}// Reset counter if more than 1 hour has passed,
    if (now - user.Sessionlast.Activity > 3600000) {
      user.Sessionrequest.Count = 1;
      user.Sessionlast.Activity = now;
      return { allowed: true }}// Check rate limit (100 requests per hour per user),
    if (user.Sessionrequest.Count >= 100) {
      const retry.After = Mathceil((3600000 - (now - user.Sessionlast.Activity)) / 1000);
      return { allowed: false, retry.After };

    user.Sessionrequest.Count++
    user.Sessionlast.Activity = now;
    return { allowed: true }}/**
   * Log A.P.I key usage*/
  private async logApi.Key.Usage(api.Key: string, req: Auth.Request): Promise<void> {
    try {
      await thissupabasefrom('api_key_usage')insert({
        api_key: api.Key,
        endpoint: reqoriginal.Url,
        method: reqmethod,
        ip_address: reqip,
        user_agent: reqheaders['user-agent'],
        timestamp: new Date()toIS.O.String()})} catch (error) {
      loggererror('Failed to log A.P.I key usage:', error)}}/**
   * Log J.W.T usage*/
  private async log.Jwt.Usage(user.Id: string, req: Auth.Request): Promise<void> {
    try {
      await thissupabasefrom('user_sessions')insert({
        user_id: user.Id,
        endpoint: reqoriginal.Url,
        method: reqmethod,
        ip_address: reqip,
        user_agent: reqheaders['user-agent'],
        timestamp: new Date()toIS.O.String()})} catch (error) {
      loggererror('Failed to log J.W.T usage:', error)}}/**
   * Generate J.W.T token*/
  public generateJ.W.T(user.Id: string, email: string, role: string): string {
    return jwtsign(
      {
        sub: user.Id,
        email;
        role;
        iat: Mathfloor(Date.now() / 1000),
}      thisjwt.Secret;
      {
        expires.In: '24h',
        issuer: 'universal-ai-tools',
        audience: 'universal-ai-tools-users',
      })}/**
   * Refresh J.W.T token*/
  public refreshJ.W.T(token: string): string | null {
    try {
      const decoded = jwtverify(token, thisjwt.Secret) as any;
      return thisgenerateJ.W.T(decodedsub, decodedemail, decodedrole)} catch (error) {
      loggererror('J.W.T refresh error instanceof Error ? errormessage : String(error)', error);
      return null}}/**
   * Revoke user sessions*/
  public async revoke.User.Sessions(user.Id: string): Promise<void> {
    try {
      // Remove from memory;
      thisuser.Sessionsdelete(user.Id)// Log session revocation;
      await thissupabasefrom('user_sessions')insert({
        user_id: user.Id,
        endpoint: '/auth/revoke',
        method: 'DELE.T.E',
        ip_address: 'system',
        user_agent: 'system',
        timestamp: new Date()toIS.O.String()})} catch (error) {
      loggererror('Failed to revoke user sessions:', error)}}/**
   * Middleware for role-based access control*/
  public require.Role(roles: string | string[]) {
    const required.Roles = Array.is.Array(roles) ? roles : [roles];
    return (req: Auth.Request, res: Response, next: Next.Function) => {
      if (!requser) {
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Authentication required';
          message: 'User authentication required for role-based access'}),

      if (!required.Rolesincludes(requserrole)) {
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'Insufficient permissions';
          message: `Required role: ${required.Rolesjoin(' or ')}`,
          user.Role: requserrole}),

      next()}}/**
   * Cleanup expired sessions*/
  public cleanup.Expired.Sessions(): void {
    const now = Date.now();
    const hour.Ago = now - 3600000;
    for (const [user.Id, session] of thisuser.Sessionsentries()) {
      if (sessionlast.Activity < hour.Ago) {
        thisuser.Sessionsdelete(user.Id)}}};

export default Auth.Middleware;