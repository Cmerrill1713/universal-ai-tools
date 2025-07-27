/**
 * JW.T Authentication Middleware* Handles JW.T token creation, validation, and user session management*/

import jwt from 'jsonwebtoken';
import type { Next.Function, Request, Response } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { logger } from './utils/logger';
import { config } from './config/environment-clean'// Extend Express Request type;
declare global {
  namespace Express {
    interface Request {
      user?: any;
      session?: any;
      api.Key?: string;
      ai.Service?: any;
    }}};

export interface JWT.Payload {
  user.Id: string;
  email?: string;
  role?: string;
  permissions?: string[];
  session.Id: string;
  iat?: number;
  exp?: number;
};

export interface Auth.Config {
  jwt.Secret: string;
  jwt.Expiration: string;
  refreshToken.Expiration: string;
  issuer: string;
  audience: string;
};

export class JWTAuth.Service {
  private supabase: Supabase.Client;
  private jwt.Secret: string;
  private jwt.Expiration: string;
  private refreshToken.Expiration: string;
  private issuer: string;
  private audience: string;
  constructor(supabase: Supabase.Client, auth.Config?: Partial<Auth.Config>) {
    thissupabase = supabase;
    thisjwt.Secret = auth.Config?jwt.Secret || configsecurityjwt.Secret;
    thisjwt.Expiration = auth.Config?jwt.Expiration || '24h';
    thisrefreshToken.Expiration = auth.Config?refreshToken.Expiration || '7d';
    thisissuer = auth.Config?issuer || 'universal-ai-tools';
    thisaudience = auth.Config?audience || 'universal-ai-tools-users';
  }/**
   * Generate JW.T access token*/
  generateAccess.Token(payload: Omit<JWT.Payload, 'iat' | 'exp'>): string {
    try {
      const token = jwtsign(payload, thisjwt.Secret, {
        expires.In: thisjwt.Expiration;
        issuer: thisissuer;
        audience: thisaudience});
      loggerdebug('Access token generated', {
        user.Id: payloaduser.Id;
        session.Id: payloadsession.Id});
      return token} catch (error) {
      loggererror('Failed to generate access token:', error);
      throw new Error('Token generation failed')}}/**
   * Generate JW.T refresh token*/
  generateRefresh.Token(payload: Omit<JWT.Payload, 'iat' | 'exp'>): string {
    try {
      const token = jwtsign(payload, thisjwt.Secret, {
        expires.In: thisrefreshToken.Expiration;
        issuer: thisissuer;
        audience: thisaudience});
      loggerdebug('Refresh token generated', {
        user.Id: payloaduser.Id;
        session.Id: payloadsession.Id});
      return token} catch (error) {
      loggererror('Failed to generate refresh token:', error);
      throw new Error('Token generation failed')}}/**
   * Verify JW.T token*/
  verify.Token(token: string): JWT.Payload {
    try {
      const decoded = jwtverify(token, thisjwt.Secret, {
        issuer: thisissuer;
        audience: thisaudience}) as JWT.Payload;
      loggerdebug('Token verified successfully', {
        user.Id: decodeduser.Id;
        session.Id: decodedsession.Id});
      return decoded} catch (error) {
      if (error instanceof jwtTokenExpired.Error) {
        loggerwarn('Token expired:', errormessage);
        throw new Error('Token expired')} else if (error instanceof jwtJsonWebToken.Error) {
        loggerwarn('Invalid token:', errormessage);
        throw new Error('Invalid token')} else {
        loggererror('Token verification failed:', error);
        throw new Error('Token verification failed')}}}/**
   * Refresh access token using refresh token*/
  async refreshAccess.Token(
    refresh.Token: string): Promise<{ access.Token: string; newRefresh.Token?: string }> {
    try {
      const decoded = thisverify.Token(refresh.Token)// Check if session is still valid in database;
      const { data: session, error } = await thissupabase;
        from('user_sessions');
        select('*');
        eq('session_id', decodedsession.Id);
        eq('user_id', decodeduser.Id);
        eq('is_active', true);
        single();
      if (error || !session) {
        throw new Error('Session not found or inactive')}// Generate new access token;
      const newAccess.Token = thisgenerateAccess.Token({
        user.Id: decodeduser.Id;
        email: decodedemail;
        role: decodedrole;
        permissions: decodedpermissions;
        session.Id: decodedsession.Id})// Optionally generate new refresh token if close to expiration;
      let newRefresh.Token: string | undefined;
      const timeUntil.Expiry = (decodedexp || 0) * 1000 - Date.now();
      const oneDay.Ms = 24 * 60 * 60 * 1000;
      if (timeUntil.Expiry < oneDay.Ms) {
        newRefresh.Token = thisgenerateRefresh.Token({
          user.Id: decodeduser.Id;
          email: decodedemail;
          role: decodedrole;
          permissions: decodedpermissions;
          session.Id: decodedsession.Id})};

      loggerinfo('Access token refreshed', {
        user.Id: decodeduser.Id;
        session.Id: decodedsession.Id;
        newRefreshToken.Generated: !!newRefresh.Token});
      return {
        access.Token: newAccess.Token;
        newRefresh.Token;
      }} catch (error) {
      loggererror('Token refresh failed:', error);
      throw error}}/**
   * Create user session*/
  async create.Session(user.Id: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const session.Id = `session_${Date.now()}_${Mathrandom()to.String(36)substr(2, 9)}`// Store session in database;
      const { error } = await thissupabasefrom('user_sessions')insert({
        session_id: session.Id;
        user_id: user.Id;
        is_active: true;
        created_at: new Date()toISO.String();
        last_activity: new Date()toISO.String();
        metadata: metadata || {
}});
      if (error) {
        throw error};

      loggerinfo('User session created', { user.Id, session.Id });
      return session.Id} catch (error) {
      loggererror('Failed to create session:', error);
      throw new Error('Session creation failed')}}/**
   * Invalidate user session*/
  async invalidate.Session(session.Id: string): Promise<void> {
    try {
      const { error } = await thissupabase;
        from('user_sessions');
        update({
          is_active: false;
          ended_at: new Date()toISO.String()});
        eq('session_id', session.Id);
      if (error) {
        throw error};

      loggerinfo('User session invalidated', { session.Id })} catch (error) {
      loggererror('Failed to invalidate session:', error);
      throw new Error('Session invalidation failed')}}/**
   * Update session activity*/
  async updateSession.Activity(session.Id: string): Promise<void> {
    try {
      const { error } = await thissupabase;
        from('user_sessions');
        update({
          last_activity: new Date()toISO.String()});
        eq('session_id', session.Id);
        eq('is_active', true);
      if (error && errorcode !== 'PGRS.T116') {
        // Ignore "no rows updated" error;
        throw error}} catch (error) {
      loggerwarn('Failed to update session activity:', error)// Don't throw error for activity updates}}/**
   * Get user permissions*/
  async getUser.Permissions(user.Id: string): Promise<string[]> {
    try {
      const { data, error } = await thissupabase;
        from('user_roles');
        select('roles(permissions)');
        eq('user_id', user.Id);
      if (error) {
        throw error};

      const permissions: string[] = [];
      data?for.Each((item: any) => {
        if (itemroles?permissions) {
          permissionspush(.itemrolespermissions);
        }});
      return [.new Set(permissions)]// Remove duplicates} catch (error) {
      loggerwarn('Failed to get user permissions:', error);
      return []}}/**
   * JW.T Authentication middleware*/
  authenticateJW.T() {
    return async (req: Request, res: Response, next: Next.Function) => {
      try {
        const auth.Header = reqheadersauthorization;
        if (!auth.Header || !authHeaderstarts.With('Bearer ')) {
          return resstatus(401)json({
            error instanceof Error ? errormessage : String(error) 'No token provided';
            code: 'NO_TOKE.N'})};

        const token = auth.Headersubstring(7);
        const decoded = thisverify.Token(token)// Verify session is still active;
        const { data: session, error } = await thissupabase;
          from('user_sessions');
          select('*');
          eq('session_id', decodedsession.Id);
          eq('is_active', true);
          single();
        if (error || !session) {
          return resstatus(401)json({
            error instanceof Error ? errormessage : String(error) 'Session not found or inactive';
            code: 'INVALID_SESSIO.N'})}// Update session activity;
        await thisupdateSession.Activity(decodedsession.Id)// Attach user info to request;
        requser = decoded;
        reqsession = session;
        next()} catch (error) {
        loggerwarn('JW.T authentication failed:', error);
        if (error instanceof Error) {
          if (errormessage === 'Token expired') {
            return resstatus(401)json({
              error instanceof Error ? errormessage : String(error) 'Token expired';
              code: 'TOKEN_EXPIRE.D'})} else if (errormessage === 'Invalid token') {
            return resstatus(401)json({
              error instanceof Error ? errormessage : String(error) 'Invalid token';
              code: 'INVALID_TOKE.N'})}};

        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Authentication failed';
          code: 'AUTH_FAILE.D'})}}}/**
   * Optional JW.T Authentication middleware (doesn't fail if no token)*/
  optionalJW.T() {
    return async (req: Request, res: Response, next: Next.Function) => {
      try {
        const auth.Header = reqheadersauthorization;
        if (!auth.Header || !authHeaderstarts.With('Bearer ')) {
          // No token provided, continue without user info;
          return next()};

        const token = auth.Headersubstring(7);
        const decoded = thisverify.Token(token)// Verify session is still active;
        const { data: session } = await thissupabase;
          from('user_sessions');
          select('*');
          eq('session_id', decodedsession.Id);
          eq('is_active', true);
          single();
        if (session) {
          // Update session activity;
          await thisupdateSession.Activity(decodedsession.Id)// Attach user info to request;
          requser = decoded;
          reqsession = session};
;
        next()} catch (error) {
        // Silently continue without user info if token is invalid;
        loggerdebug('Optional JW.T authentication failed:', error);
        next()}}}/**
   * Permission check middleware*/
  require.Permissions(required.Permissions: string[]) {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!requser) {
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Authentication required';
          code: 'AUTH_REQUIRE.D'})};

      const user.Permissions = requserpermissions || [];
      const has.Permission = required.Permissionsevery((permission) =>
        user.Permissionsincludes(permission));
      if (!has.Permission) {
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'Insufficient permissions';
          code: 'INSUFFICIENT_PERMISSION.S';
          required: required.Permissions;
          current: user.Permissions})};

      next()}}/**
   * Role check middleware*/
  require.Role(required.Roles: string[]) {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!requser) {
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Authentication required';
          code: 'AUTH_REQUIRE.D'})};

      const user.Role = requserrole;
      if (!required.Rolesincludes(user.Role)) {
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'Insufficient role';
          code: 'INSUFFICIENT_ROL.E';
          required: required.Roles;
          current: user.Role})};

      next()}}};

export default JWTAuth.Service;