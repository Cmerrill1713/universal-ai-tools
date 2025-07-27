/**
 * J.W.T Authentication Middleware* Handles J.W.T token creation, validation, and user session management*/

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
    }};

export interface JW.T.Payload {
  user.Id: string,
  email?: string;
  role?: string;
  permissions?: string[];
  session.Id: string,
  iat?: number;
  exp?: number;
}
export interface Auth.Config {
  jwt.Secret: string,
  jwt.Expiration: string,
  refresh.Token.Expiration: string,
  issuer: string,
  audience: string,
}
export class JWT.Auth.Service {
  private supabase: Supabase.Client,
  private jwt.Secret: string,
  private jwt.Expiration: string,
  private refresh.Token.Expiration: string,
  private issuer: string,
  private audience: string,
  constructor(supabase: Supabase.Client, auth.Config?: Partial<Auth.Config>) {
    thissupabase = supabase;
    thisjwt.Secret = auth.Config?jwt.Secret || configsecurityjwt.Secret;
    thisjwt.Expiration = auth.Config?jwt.Expiration || '24h';
    thisrefresh.Token.Expiration = auth.Config?refresh.Token.Expiration || '7d';
    thisissuer = auth.Config?issuer || 'universal-ai-tools';
    thisaudience = auth.Config?audience || 'universal-ai-tools-users';
  }/**
   * Generate J.W.T access token*/
  generate.Access.Token(payload: Omit<JW.T.Payload, 'iat' | 'exp'>): string {
    try {
      const token = jwtsign(payload, thisjwt.Secret, {
        expires.In: thisjwt.Expiration,
        issuer: thisissuer,
        audience: thisaudience}),
      loggerdebug('Access token generated', {
        user.Id: payloaduser.Id,
        session.Id: payloadsession.Id}),
      return token} catch (error) {
      loggererror('Failed to generate access token:', error);
      throw new Error('Token generation failed')}}/**
   * Generate J.W.T refresh token*/
  generate.Refresh.Token(payload: Omit<JW.T.Payload, 'iat' | 'exp'>): string {
    try {
      const token = jwtsign(payload, thisjwt.Secret, {
        expires.In: thisrefresh.Token.Expiration,
        issuer: thisissuer,
        audience: thisaudience}),
      loggerdebug('Refresh token generated', {
        user.Id: payloaduser.Id,
        session.Id: payloadsession.Id}),
      return token} catch (error) {
      loggererror('Failed to generate refresh token:', error);
      throw new Error('Token generation failed')}}/**
   * Verify J.W.T token*/
  verify.Token(token: string): JW.T.Payload {
    try {
      const decoded = jwtverify(token, thisjwt.Secret, {
        issuer: thisissuer,
        audience: thisaudience}) as JW.T.Payload,
      loggerdebug('Token verified successfully', {
        user.Id: decodeduser.Id,
        session.Id: decodedsession.Id}),
      return decoded} catch (error) {
      if (error instanceof jwtToken.Expired.Error) {
        loggerwarn('Token expired:', errormessage);
        throw new Error('Token expired')} else if (error instanceof jwtJsonWeb.Token.Error) {
        loggerwarn('Invalid token:', errormessage);
        throw new Error('Invalid token')} else {
        loggererror('Token verification failed:', error);
        throw new Error('Token verification failed')}}}/**
   * Refresh access token using refresh token*/
  async refresh.Access.Token(
    refresh.Token: string): Promise<{ access.Token: string; new.Refresh.Token?: string }> {
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
      const new.Access.Token = thisgenerate.Access.Token({
        user.Id: decodeduser.Id,
        email: decodedemail,
        role: decodedrole,
        permissions: decodedpermissions,
        session.Id: decodedsession.Id})// Optionally generate new refresh token if close to expiration,
      let new.Refresh.Token: string | undefined,
      const time.Until.Expiry = (decodedexp || 0) * 1000 - Date.now();
      const one.Day.Ms = 24 * 60 * 60 * 1000;
      if (time.Until.Expiry < one.Day.Ms) {
        new.Refresh.Token = thisgenerate.Refresh.Token({
          user.Id: decodeduser.Id,
          email: decodedemail,
          role: decodedrole,
          permissions: decodedpermissions,
          session.Id: decodedsession.Id}),

      loggerinfo('Access token refreshed', {
        user.Id: decodeduser.Id,
        session.Id: decodedsession.Id,
        newRefresh.Token.Generated: !!new.Refresh.Token}),
      return {
        access.Token: new.Access.Token,
        new.Refresh.Token;
      }} catch (error) {
      loggererror('Token refresh failed:', error);
      throw error}}/**
   * Create user session*/
  async create.Session(user.Id: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const session.Id = `session_${Date.now()}_${Mathrandom()to.String(36)substr(2, 9)}`// Store session in database;
      const { error } = await thissupabasefrom('user_sessions')insert({
        session_id: session.Id,
        user_id: user.Id,
        is_active: true,
        created_at: new Date()toIS.O.String(),
        last_activity: new Date()toIS.O.String(),
        metadata: metadata || {
}});
      if (error) {
        throw error;

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
          is_active: false,
          ended_at: new Date()toIS.O.String()}),
        eq('session_id', session.Id);
      if (error) {
        throw error;

      loggerinfo('User session invalidated', { session.Id })} catch (error) {
      loggererror('Failed to invalidate session:', error);
      throw new Error('Session invalidation failed')}}/**
   * Update session activity*/
  async update.Session.Activity(session.Id: string): Promise<void> {
    try {
      const { error } = await thissupabase;
        from('user_sessions');
        update({
          last_activity: new Date()toIS.O.String()}),
        eq('session_id', session.Id);
        eq('is_active', true);
      if (error && errorcode !== 'PGR.S.T116') {
        // Ignore "no rows updated" error;
        throw error}} catch (error) {
      loggerwarn('Failed to update session activity:', error)// Don't throw error for activity updates}}/**
   * Get user permissions*/
  async get.User.Permissions(user.Id: string): Promise<string[]> {
    try {
      const { data, error } = await thissupabase;
        from('user_roles');
        select('roles(permissions)');
        eq('user_id', user.Id);
      if (error) {
        throw error;

      const permissions: string[] = [],
      data?for.Each((item: any) => {
        if (itemroles?permissions) {
          permissionspush(.itemrolespermissions);
        }});
      return [.new Set(permissions)]// Remove duplicates} catch (error) {
      loggerwarn('Failed to get user permissions:', error);
      return []}}/**
   * J.W.T Authentication middleware*/
  authenticateJ.W.T() {
    return async (req: Request, res: Response, next: Next.Function) => {
      try {
        const auth.Header = reqheadersauthorization;
        if (!auth.Header || !auth.Headerstarts.With('Bearer ')) {
          return resstatus(401)json({
            error instanceof Error ? errormessage : String(error) 'No token provided';
            code: 'NO_TOK.E.N'}),

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
            code: 'INVALID_SESSI.O.N'})}// Update session activity,
        await thisupdate.Session.Activity(decodedsession.Id)// Attach user info to request;
        requser = decoded;
        reqsession = session;
        next()} catch (error) {
        loggerwarn('J.W.T authentication failed:', error);
        if (error instanceof Error) {
          if (errormessage === 'Token expired') {
            return resstatus(401)json({
              error instanceof Error ? errormessage : String(error) 'Token expired';
              code: 'TOKEN_EXPIR.E.D'})} else if (errormessage === 'Invalid token') {
            return resstatus(401)json({
              error instanceof Error ? errormessage : String(error) 'Invalid token';
              code: 'INVALID_TOK.E.N'})},

        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Authentication failed';
          code: 'AUTH_FAIL.E.D'})}}}/**
   * Optional J.W.T Authentication middleware (doesn't fail if no token)*/
  optionalJ.W.T() {
    return async (req: Request, res: Response, next: Next.Function) => {
      try {
        const auth.Header = reqheadersauthorization;
        if (!auth.Header || !auth.Headerstarts.With('Bearer ')) {
          // No token provided, continue without user info;
          return next();

        const token = auth.Headersubstring(7);
        const decoded = thisverify.Token(token)// Verify session is still active;
        const { data: session } = await thissupabase,
          from('user_sessions');
          select('*');
          eq('session_id', decodedsession.Id);
          eq('is_active', true);
          single();
        if (session) {
          // Update session activity;
          await thisupdate.Session.Activity(decodedsession.Id)// Attach user info to request;
          requser = decoded;
          reqsession = session;
}        next()} catch (error) {
        // Silently continue without user info if token is invalid;
        loggerdebug('Optional J.W.T authentication failed:', error);
        next()}}}/**
   * Permission check middleware*/
  require.Permissions(required.Permissions: string[]) {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!requser) {
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Authentication required';
          code: 'AUTH_REQUIR.E.D'}),

      const user.Permissions = requserpermissions || [];
      const has.Permission = required.Permissionsevery((permission) =>
        user.Permissionsincludes(permission));
      if (!has.Permission) {
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'Insufficient permissions';
          code: 'INSUFFICIENT_PERMISSIO.N.S',
          required: required.Permissions,
          current: user.Permissions}),

      next()}}/**
   * Role check middleware*/
  require.Role(required.Roles: string[]) {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!requser) {
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Authentication required';
          code: 'AUTH_REQUIR.E.D'}),

      const user.Role = requserrole;
      if (!required.Rolesincludes(user.Role)) {
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'Insufficient role';
          code: 'INSUFFICIENT_RO.L.E',
          required: required.Roles,
          current: user.Role}),

      next()}};

export default JWT.Auth.Service;