import type { Next.Function, Request, Response } from 'express';
import type { Sign.Options } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import type { Supabase.Client } from '@supabase/supabase-js';
import { logger } from './utils/logger';
import { config } from './config';
import { secrets.Manager } from './config/secrets';
import crypto from 'crypto';
export interface JWT.Payload {
  sub: string// user id;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  jti?: string// JW.T I.D for tracking;
  iat?: number;
  exp?: number;
};

export interface RefreshToken.Data {
  user.Id: string;
  token.Id: string;
  token: string;
  expires.At: Date;
  is.Revoked: boolean;
  user.Agent?: string;
  ip.Address?: string;
};

export class JWTAuth.Service {
  private supabase: Supabase.Client;
  private accessToken.Secret: string;
  private refreshToken.Secret: string;
  private accessToken.Expiry: string | number = '15m' // 15 minutes;
  private refreshToken.Expiry: string | number = '7d' // 7 days;
  private token.Blacklist: Set<string> = new Set();
  private auth.Attempts: Map<string, { count: number; last.Attempt: number; blocked?: number }> =
    new Map();
  private readonly MAX_AUTH_ATTEMPT.S = 5;
  private readonly BLOCK_DURATIO.N = 15 * 60 * 1000 // 15 minutes;

  constructor(supabase: Supabase.Client) {
    thissupabase = supabase;
    thisaccessToken.Secret = configsecurityjwt.Secret;
    thisrefreshToken.Secret = secretsManagergenerate.Key(64)// Generate separate secret for refresh tokens}/**
   * Generate both access and refresh tokens*/
  public async generateToken.Pair(
    user.Id: string;
    email: string;
    role: string;
    req?: Request): Promise<{
    access.Token: string;
    refresh.Token: string;
    expires.In: number}> {
    const token.Id = cryptorandomUUI.D()// Generate access token;
    const accessToken.Options: Sign.Options = {
      expires.In: thisaccessToken.Expiry as any;
      issuer: 'universal-ai-tools';
      audience: 'universal-ai-tools-api';
    };
    const access.Token = jwtsign(
      {
        sub: user.Id;
        email;
        role;
        type: 'access';
        jti: token.Id;
      };
      thisaccessToken.Secret;
      accessToken.Options)// Generate refresh token;
    const refreshToken.Options: Sign.Options = {
      expires.In: thisrefreshToken.Expiry as any;
      issuer: 'universal-ai-tools';
      audience: 'universal-ai-tools-refresh';
    };
    const refresh.Token = jwtsign(
      {
        sub: user.Id;
        email;
        role;
        type: 'refresh';
        jti: token.Id;
      };
      thisrefreshToken.Secret;
      refreshToken.Options)// Store refresh token in database;
    const refreshToken.Data: RefreshToken.Data = {
      user.Id;
      token.Id;
      token: secrets.Managerencrypt(refresh.Token);
      expires.At: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days;
      is.Revoked: false;
      user.Agent: req?headers['user-agent'];
      ip.Address: req?ip;
    };
    await thisstoreRefresh.Token(refreshToken.Data)// Log successful token generation;
    await thislogAuth.Event(user.Id, 'token_generated', req?ip, req?headers['user-agent'], true);
    return {
      access.Token;
      refresh.Token;
      expires.In: 900, // 15 minutes in seconds}}/**
   * Verify and decode access token*/
  public verifyAccess.Token(token: string): JWT.Payload | null {
    try {
      // Check if token is blacklisted;
      const decoded = jwtdecode(token) as JWT.Payload;
      if (decoded?jti && thistoken.Blacklisthas(decodedjti)) {
        loggerwarn('Attempted use of blacklisted token', { jti: decodedjti });
        return null}// Verify token;
      const payload = jwtverify(token, thisaccessToken.Secret, {
        issuer: 'universal-ai-tools';
        audience: 'universal-ai-tools-api'}) as JWT.Payload;
      if (payloadtype !== 'access') {
        throw new Error('Invalid token type')};

      return payload} catch (error) {
      loggererror('Access token verification failed:', error);
      return null}}/**
   * Verify and decode refresh token*/
  public verifyRefresh.Token(token: string): JWT.Payload | null {
    try {
      const payload = jwtverify(token, thisrefreshToken.Secret, {
        issuer: 'universal-ai-tools';
        audience: 'universal-ai-tools-refresh'}) as JWT.Payload;
      if (payloadtype !== 'refresh') {
        throw new Error('Invalid token type')};

      return payload} catch (error) {
      loggererror('Refresh token verification failed:', error);
      return null}}/**
   * Refresh access token using refresh token*/
  public async refreshAccess.Token(
    refresh.Token: string;
    req?: Request): Promise<{
    access.Token: string;
    refresh.Token: string;
    expires.In: number} | null> {
    try {
      // Verify refresh token;
      const payload = thisverifyRefresh.Token(refresh.Token);
      if (!payload) {
        return null}// Check if refresh token exists and is valid in database;
      const stored.Token = await thisgetStoredRefresh.Token(payloadsub, payloadjti!);
      if (!stored.Token || storedTokenis.Revoked) {
        loggerwarn('Invalid or revoked refresh token', { user.Id: payloadsub, jti: payloadjti });
        return null}// Verify the encrypted token matches;
      const decrypted.Token = secrets.Managerdecrypt(stored.Tokentoken);
      if (decrypted.Token !== refresh.Token) {
        loggerwarn('Refresh token mismatch', { user.Id: payloadsub });
        return null}// Check expiration;
      if (new Date() > storedTokenexpires.At) {
        loggerwarn('Expired refresh token', { user.Id: payloadsub });
        await thisrevokeRefresh.Token(payloadsub, payloadjti!);
        return null}// Revoke old refresh token;
      await thisrevokeRefresh.Token(payloadsub, payloadjti!)// Log successful token refresh;
      await thislogAuth.Event(
        payloadsub;
        'token_refreshed';
        req?ip;
        req?headers['user-agent'];
        true)// Generate new token pair;
      return await thisgenerateToken.Pair(payloadsub, payloademail, payloadrole, req)} catch (error) {
      loggererror('Token refresh failed:', error);
      return null}}/**
   * Store refresh token in database*/
  private async storeRefresh.Token(token.Data: RefreshToken.Data): Promise<void> {
    try {
      await thissupabasefrom('refresh_tokens')insert({
        user_id: tokenDatauser.Id;
        token_id: tokenDatatoken.Id;
        encrypted_token: token.Datatoken;
        expires_at: tokenDataexpires.At;
        is_revoked: tokenDatais.Revoked;
        user_agent: tokenDatauser.Agent;
        ip_address: tokenDataip.Address;
        created_at: new Date()})} catch (error) {
      loggererror('Failed to store refresh token:', error);
      throw error)}}/**
   * Get stored refresh token*/
  private async getStoredRefresh.Token(
    user.Id: string;
    token.Id: string): Promise<RefreshToken.Data | null> {
    try {
      const { data, error } = await thissupabase;
        from('refresh_tokens');
        select('*');
        eq('user_id', user.Id);
        eq('token_id', token.Id);
        single();
      if (error || !data) {
        return null};

      return {
        user.Id: datauser_id;
        token.Id: datatoken_id;
        token: dataencrypted_token;
        expires.At: new Date(dataexpires_at);
        is.Revoked: datais_revoked;
        user.Agent: datauser_agent;
        ip.Address: dataip_address;
      }} catch (error) {
      loggererror('Failed to get refresh token:', error);
      return null}}/**
   * Revoke refresh token*/
  public async revokeRefresh.Token(user.Id: string, token.Id: string): Promise<void> {
    try {
      await thissupabase;
        from('refresh_tokens');
        update({ is_revoked: true, revoked_at: new Date() });
        eq('user_id', user.Id);
        eq('token_id', token.Id)// Add to blacklist;
      thistoken.Blacklistadd(token.Id)} catch (error) {
      loggererror('Failed to revoke refresh token:', error)}}/**
   * Revoke all refresh tokens for a user*/
  public async revokeAllUser.Tokens(user.Id: string): Promise<void> {
    try {
      const { data: tokens } = await thissupabase;
        from('refresh_tokens');
        select('token_id');
        eq('user_id', user.Id);
        eq('is_revoked', false);
      if (tokens) {
        // Add all token I.Ds to blacklist;
        tokensfor.Each((token) => thistoken.Blacklistadd(tokentoken_id))}// Revoke all tokens in database;
      await thissupabase;
        from('refresh_tokens');
        update({ is_revoked: true, revoked_at: new Date() });
        eq('user_id', user.Id)} catch (error) {
      loggererror('Failed to revoke all user tokens:', error)}}/**
   * Clean up expired tokens*/
  public async cleanupExpired.Tokens(): Promise<void> {
    try {
      const { error instanceof Error ? errormessage : String(error)  = await thissupabase;
        from('refresh_tokens');
        delete();
        or('expires_atltnow(),is_revokedeqtrue');
      if (error) {
        loggererror('Failed to cleanup expired tokens:', error)}// Clear old entries from blacklist;
      if (thistoken.Blacklistsize > 10000) {
        thistoken.Blacklistclear()}} catch (error) {
      loggererror('Token cleanup failed:', error)}}/**
   * Check if I.P is rate limited for authentication*/
  public isAuthRate.Limited(ip: string): { limited: boolean; retry.After?: number } {
    const attempt = thisauth.Attemptsget(ip);
    if (!attempt) {
      return { limited: false }};

    const now = Date.now()// Check if currently blocked;
    if (attemptblocked && now < attemptblocked) {
      const retry.After = Mathceil((attemptblocked - now) / 1000);
      return { limited: true, retry.After }}// Reset if block period expired;
    if (attemptblocked && now >= attemptblocked) {
      thisauth.Attemptsdelete(ip);
      return { limited: false }}// Check if too many attempts in time window;
    if (
      attemptcount >= thisMAX_AUTH_ATTEMPT.S &&
      now - attemptlast.Attempt < thisBLOCK_DURATIO.N) {
      attemptblocked = now + thisBLOCK_DURATIO.N;
      const retry.After = Mathceil(thisBLOCK_DURATIO.N / 1000);
      return { limited: true, retry.After }};

    return { limited: false }}/**
   * Record authentication attempt*/
  public recordAuth.Attempt(ip: string, success: boolean): void {
    const now = Date.now();
    const attempt = thisauth.Attemptsget(ip) || { count: 0, last.Attempt: 0 };
    if (success) {
      // Reset on successful auth;
      thisauth.Attemptsdelete(ip);
      return}// Reset count if last attempt was more than block duration ago;
    if (now - attemptlast.Attempt > thisBLOCK_DURATIO.N) {
      attemptcount = 1} else {
      attemptcount++};

    attemptlast.Attempt = now;
    thisauth.Attemptsset(ip, attempt)}/**
   * Log authentication events*/
  private async logAuth.Event(
    user.Id: string | null;
    event: string;
    ip.Address?: string;
    user.Agent?: string;
    success = true): Promise<void> {
    try {
      await thissupabasefrom('auth_events')insert({
        user_id: user.Id;
        event_type: event;
        ip_address: ip.Address;
        user_agent: user.Agent;
        success;
        timestamp: new Date()})} catch (error) {
      loggererror('Failed to log auth event:', error)}}/**
   * Get active sessions for a user*/
  public async getUser.Sessions(user.Id: string): Promise<
    Array<{
      token.Id: string;
      created.At: Date;
      expires.At: Date;
      user.Agent?: string;
      ip.Address?: string}>
  > {
    try {
      const { data, error } = await thissupabase;
        from('refresh_tokens');
        select('token_id, created_at, expires_at, user_agent, ip_address');
        eq('user_id', user.Id);
        eq('is_revoked', false);
        order('created_at', { ascending: false });
      if (error || !data) {
        return []};

      return datamap((session) => ({
        token.Id: sessiontoken_id;
        created.At: new Date(sessioncreated_at);
        expires.At: new Date(sessionexpires_at);
        user.Agent: sessionuser_agent;
        ip.Address: sessionip_address}))} catch (error) {
      loggererror('Failed to get user sessions:', error);
      return []}}/**
   * JW.T Authentication Middleware*/
  public authenticate(options: { require.Auth?: boolean } = {}) {
    const { require.Auth = true } = options;
    return async (req: any, res: Response, next: Next.Function) => {
      try {
        const auth.Header = reqheadersauthorization;
        if (!auth.Header || !authHeaderstarts.With('Bearer ')) {
          if (require.Auth) {
            await thislogAuth.Event(
              null;
              'auth_failed_no_token';
              reqip;
              reqheaders['user-agent'];
              false);
            return resstatus(401)json({
              error instanceof Error ? errormessage : String(error) 'Authentication required';
              message: 'No valid authorization header found'})};
          return next()};

        const token = auth.Headersubstring(7);
        const payload = thisverifyAccess.Token(token);
        if (!payload) {
          await thislogAuth.Event(
            null;
            'auth_failed_invalid_token';
            reqip;
            reqheaders['user-agent'];
            false);
          return resstatus(401)json({
            error instanceof Error ? errormessage : String(error) 'Invalid token';
            message: 'The provided token is invalid or expired'})}// Verify user still exists and is active;
        const { data: user, error instanceof Error ? errormessage : String(error)  = await thissupabase;
          from('users');
          select('id, email, role, is_active');
          eq('id', payloadsub);
          single();
        if (error || !user || !useris_active) {
          await thislogAuth.Event(
            payloadsub;
            'auth_failed_user_inactive';
            reqip;
            reqheaders['user-agent'];
            false);
          return resstatus(401)json({
            error instanceof Error ? errormessage : String(error) 'User not found';
            message: 'User account not found or inactive'})}// Update last activity;
        await thisupdateUser.Activity(userid, reqip, reqheaders['user-agent'])// Attach user to request;
        requser = {
          id: userid;
          email: useremail;
          role: userrole};
        next()} catch (error) {
        loggererror('Authentication error instanceof Error ? errormessage : String(error) , error);
        return resstatus(500)json({
          error instanceof Error ? errormessage : String(error) 'Authentication failed';
          message: 'Internal server error during authentication'})}}}/**
   * Update user activity*/
  private async updateUser.Activity(
    user.Id: string;
    ip.Address?: string;
    user.Agent?: string): Promise<void> {
    try {
      await thissupabasefrom('user_activity')upsert({
        user_id: user.Id;
        last_activity: new Date();
        ip_address: ip.Address;
        user_agent: user.Agent})} catch (error) {
      loggererror('Failed to update user activity:', error)}}/**
   * Get user security info*/
  public async getUserSecurity.Info(user.Id: string): Promise<{
    sessions: Array<any>
    recent.Activity: Array<any>
    failed.Attempts: number}> {
    try {
      const [sessions, activity, failed.Attempts] = await Promiseall([
        thisgetUser.Sessions(user.Id);
        thissupabase;
          from('auth_events');
          select('*');
          eq('user_id', user.Id);
          order('timestamp', { ascending: false });
          limit(10);
        thissupabase;
          from('auth_events');
          select('count');
          eq('user_id', user.Id);
          eq('success', false);
          gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000));
          single()]);
      return {
        sessions;
        recent.Activity: activitydata || [];
        failed.Attempts: failed.Attemptsdata?count || 0;
      }} catch (error) {
      loggererror('Failed to get user security info:', error);
      return {
        sessions: [];
        recent.Activity: [];
        failed.Attempts: 0;
      }}}/**
   * Revoke specific session*/
  public async revoke.Session(user.Id: string, token.Id: string): Promise<boolean> {
    try {
      await thisrevokeRefresh.Token(user.Id, token.Id);
      await thislogAuth.Event(user.Id, 'session_revoked', 'user_action', 'user_action', true);
      return true} catch (error) {
      loggererror('Failed to revoke session:', error);
      return false}}};

export default JWTAuth.Service;