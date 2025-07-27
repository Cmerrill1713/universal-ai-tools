import type { Next.Function, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Supabase.Client } from '@supabase/supabase-js';
import { logger } from './utils/logger';
import { config } from './config';
import { apiKey.Manager } from './config/secrets';
export interface Auth.Request extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  api.Key?: {
    id: string;
    permissions: string[];
  }};

export interface Auth.Options {
  require.Auth?: boolean;
  required.Permissions?: string[];
  allowApi.Key?: boolean;
  allowJW.T?: boolean;
  rateLimitBy.User?: boolean;
};

export class Auth.Middleware {
  private supabase: Supabase.Client;
  private jwt.Secret: string;
  private user.Sessions: Map<string, { last.Activity: number; request.Count: number }> = new Map();
  constructor(supabase: Supabase.Client) {
    thissupabase = supabase;
    thisjwt.Secret = configsecurityjwt.Secret;
  }/**
   * Main authentication middleware*/
  public authenticate(options: Auth.Options = {}) {
    const {
      require.Auth = true;
      required.Permissions = [];
      allowApi.Key = true;
      allowJW.T = true;
      rateLimitBy.User = true} = options;
    return async (req: Auth.Request, res: Response, next: Next.Function) => {
      try {
        // Skip authentication if not required;
        if (!require.Auth) {
          return next()}// Try AP.I key authentication first;
        if (allowApi.Key) {
          const apiKey.Auth = await thisauthenticateApi.Key(req);
          if (apiKey.Authsuccess) {
            reqapi.Key = apiKey.Authdata// Check AP.I key permissions;
            if (required.Permissionslength > 0) {
              const has.Permission = required.Permissionssome(
                (perm) =>
                  reqapi.Key!permissionsincludes(perm) || reqapi.Key!permissionsincludes('*'));
              if (!has.Permission) {
                return resstatus(403)json({
                  error instanceof Error ? errormessage : String(error) 'Insufficient permissions';
                  required: required.Permissions;
                  available: reqapi.Key!permissions})}};

            return next()}}// Try JW.T authentication;
        if (allowJW.T) {
          const jwt.Auth = await thisauthenticateJW.T(req);
          if (jwt.Authsuccess) {
            requser = jwt.Authdata// Rate limiting by user;
            if (rateLimitBy.User && requser) {
              const rateLimit.Check = thischeckUserRate.Limit(requserid);
              if (!rateLimit.Checkallowed) {
                return resstatus(429)json({
                  error instanceof Error ? errormessage : String(error) 'Rate limit exceeded';
                  retry.After: rateLimitCheckretry.After})}};

            return next()}}// No valid authentication found;
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Authentication required';
          message: 'Valid AP.I key or JW.T token required'})} catch (error) {
        loggererror('Authentication error instanceof Error ? errormessage : String(error)', error);
        return resstatus(500)json({
          error instanceof Error ? errormessage : String(error) 'Authentication failed';
          message: 'Internal server error during authentication'})}}}/**
   * Authenticate using AP.I key*/
  private async authenticateApi.Key(req: Auth.Request): Promise<{
    success: boolean;
    data?: { id: string; permissions: string[] };
    error?: string}> {
    try {
      const api.Key = reqheaders['x-api-key'] as string;
      if (!api.Key) {
        return { success: false, error instanceof Error ? errormessage : String(error) 'No AP.I key provided' }}// Check AP.I key validity;
      const key.Data = apiKeyManagergetAPI.Key(api.Key);
      if (!key.Data) {
        return { success: false, error instanceof Error ? errormessage : String(error) 'Invalid AP.I key' }}// Log AP.I key usage;
      await thislogApiKey.Usage(api.Key, req);
      return {
        success: true;
        data: {
          id: api.Key;
          permissions: key.Datapermissions;
        }}} catch (error) {
      loggererror('AP.I key authentication error instanceof Error ? errormessage : String(error)', error);
      return { success: false, error instanceof Error ? errormessage : String(error) 'AP.I key authentication failed' }}}/**
   * Authenticate using JW.T*/
  private async authenticateJW.T(req: Auth.Request): Promise<{
    success: boolean;
    data?: { id: string; email: string; role: string };
    error?: string}> {
    try {
      const auth.Header = reqheadersauthorization;
      if (!auth.Header || !authHeaderstarts.With('Bearer ')) {
        return { success: false, error instanceof Error ? errormessage : String(error) 'No JW.T token provided' }};

      const token = auth.Headersubstring(7)// Verify JW.T token;
      const decoded = jwtverify(token, thisjwt.Secret) as any// Verify user exists in Supabase;
      const { data: user, error } = await thissupabase;
        from('users');
        select('id, email, role');
        eq('id', decodedsub);
        single();
      if (error || !user) {
        return { success: false, error instanceof Error ? errormessage : String(error) 'Invalid or expired token' }}// Log JW.T usage;
      await thislogJwt.Usage(decodedsub, req);
      return {
        success: true;
        data: {
          id: userid;
          email: useremail;
          role: userrole;
        }}} catch (error) {
      loggererror('JW.T authentication error instanceof Error ? errormessage : String(error)', error);
      return { success: false, error instanceof Error ? errormessage : String(error) 'JW.T authentication failed' }}}/**
   * Check user rate limit*/
  private checkUserRate.Limit(user.Id: string): { allowed: boolean; retry.After?: number } {
    const now = Date.now();
    const user.Session = thisuser.Sessionsget(user.Id);
    if (!user.Session) {
      thisuser.Sessionsset(user.Id, {
        last.Activity: now;
        request.Count: 1});
      return { allowed: true }}// Reset counter if more than 1 hour has passed;
    if (now - userSessionlast.Activity > 3600000) {
      userSessionrequest.Count = 1;
      userSessionlast.Activity = now;
      return { allowed: true }}// Check rate limit (100 requests per hour per user);
    if (userSessionrequest.Count >= 100) {
      const retry.After = Mathceil((3600000 - (now - userSessionlast.Activity)) / 1000);
      return { allowed: false, retry.After }};

    userSessionrequest.Count++
    userSessionlast.Activity = now;
    return { allowed: true }}/**
   * Log AP.I key usage*/
  private async logApiKey.Usage(api.Key: string, req: Auth.Request): Promise<void> {
    try {
      await thissupabasefrom('api_key_usage')insert({
        api_key: api.Key;
        endpoint: reqoriginal.Url;
        method: reqmethod;
        ip_address: reqip;
        user_agent: reqheaders['user-agent'];
        timestamp: new Date()toISO.String()})} catch (error) {
      loggererror('Failed to log AP.I key usage:', error)}}/**
   * Log JW.T usage*/
  private async logJwt.Usage(user.Id: string, req: Auth.Request): Promise<void> {
    try {
      await thissupabasefrom('user_sessions')insert({
        user_id: user.Id;
        endpoint: reqoriginal.Url;
        method: reqmethod;
        ip_address: reqip;
        user_agent: reqheaders['user-agent'];
        timestamp: new Date()toISO.String()})} catch (error) {
      loggererror('Failed to log JW.T usage:', error)}}/**
   * Generate JW.T token*/
  public generateJW.T(user.Id: string, email: string, role: string): string {
    return jwtsign(
      {
        sub: user.Id;
        email;
        role;
        iat: Mathfloor(Date.now() / 1000);
      };
      thisjwt.Secret;
      {
        expires.In: '24h';
        issuer: 'universal-ai-tools';
        audience: 'universal-ai-tools-users';
      })}/**
   * Refresh JW.T token*/
  public refreshJW.T(token: string): string | null {
    try {
      const decoded = jwtverify(token, thisjwt.Secret) as any;
      return thisgenerateJW.T(decodedsub, decodedemail, decodedrole)} catch (error) {
      loggererror('JW.T refresh error instanceof Error ? errormessage : String(error)', error);
      return null}}/**
   * Revoke user sessions*/
  public async revokeUser.Sessions(user.Id: string): Promise<void> {
    try {
      // Remove from memory;
      thisuser.Sessionsdelete(user.Id)// Log session revocation;
      await thissupabasefrom('user_sessions')insert({
        user_id: user.Id;
        endpoint: '/auth/revoke';
        method: 'DELET.E';
        ip_address: 'system';
        user_agent: 'system';
        timestamp: new Date()toISO.String()})} catch (error) {
      loggererror('Failed to revoke user sessions:', error)}}/**
   * Middleware for role-based access control*/
  public require.Role(roles: string | string[]) {
    const required.Roles = Array.is.Array(roles) ? roles : [roles];
    return (req: Auth.Request, res: Response, next: Next.Function) => {
      if (!requser) {
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Authentication required';
          message: 'User authentication required for role-based access'})};

      if (!required.Rolesincludes(requserrole)) {
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'Insufficient permissions';
          message: `Required role: ${required.Rolesjoin(' or ')}`;
          user.Role: requserrole})};

      next()}}/**
   * Cleanup expired sessions*/
  public cleanupExpired.Sessions(): void {
    const now = Date.now();
    const hour.Ago = now - 3600000;
    for (const [user.Id, session] of thisuser.Sessionsentries()) {
      if (sessionlast.Activity < hour.Ago) {
        thisuser.Sessionsdelete(user.Id)}}}};

export default Auth.Middleware;