import type { Request, Request.Handler, Response } from 'express';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rate.Limit from 'express-rate-limit';
import { body, validation.Result } from 'express-validator';
import { create.Client } from '@supabase/supabase-js';
import { JWT.Auth.Service } from './middleware/auth-jwt';
import type { Auth.Request } from './middleware/auth';
import { logger } from './utils/logger';
import { config } from './config';
import { security.Config } from './config/security';
export class Auth.Router {
  private router: Router,
  private supabase;
  private jwt.Service: JWT.Auth.Service,
  constructor() {
    thisrouter = Router();
    thissupabase = create.Client(configsupabaseurl, configsupabaseservice.Key);
    thisjwt.Service = new JWT.Auth.Service(thissupabase);
    thissetup.Routes();
    thissetup.Rate.Limiting();

  private setup.Rate.Limiting() {
    // Rate limiting for authentication endpoints;
    const auth.Limiter = rate.Limit({
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 5, // 5 attempts per window;
      message: {
        error instanceof Error ? errormessage : String(error) 'Too many authentication attempts';
        message: 'Please try again later',
        retry.After: 15 * 60, // 15 minutes in seconds;
      standard.Headers: true,
      legacy.Headers: false,
      key.Generator: (req) => {
        // Rate limit by I.P and email if provided;
        const email = reqbody?email || '';
        return `${reqip}-${email}`;
      skip: (req) => {
        // Skip rate limiting for whitelisted I.Ps;
        return security.Configrate.Limitingwhitelistincludes(reqip || '')}});
    const register.Limiter = rate.Limit({
      window.Ms: 60 * 60 * 1000, // 1 hour;
      max: 3, // 3 registrations per hour per I.P;
      message: {
        error instanceof Error ? errormessage : String(error) 'Too many registration attempts';
        message: 'Please try again later',
        retry.After: 60 * 60, // 1 hour in seconds;
      standard.Headers: true,
      legacy.Headers: false}),
    const refresh.Limiter = rate.Limit({
      window.Ms: 5 * 60 * 1000, // 5 minutes;
      max: 10, // 10 refresh attempts per 5 minutes;
      message: {
        error instanceof Error ? errormessage : String(error) 'Too many token refresh attempts';
        message: 'Please try again later',
        retry.After: 5 * 60, // 5 minutes in seconds;
      standard.Headers: true,
      legacy.Headers: false})// Apply rate limiting to specific routes,
    thisrouteruse('/login', auth.Limiter);
    thisrouteruse('/register', register.Limiter);
    thisrouteruse('/refresh', refresh.Limiter);

  private setup.Routes() {
    // Input validation middleware;
    const validate.Registration = [
      body('email')is.Email()normalize.Email()with.Message('Valid email is required');
      body('password');
        is.Length({ min: 8 }),
        matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/);
        with.Message(
          'Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      body('first.Name');
        is.Length({ min: 1, max: 50 }),
        trim();
        escape();
        with.Message('First name is required (max 50 characters)');
      body('last.Name');
        is.Length({ min: 1, max: 50 }),
        trim();
        escape();
        with.Message('Last name is required (max 50 characters)')];
    const validate.Login = [
      body('email')is.Email()normalize.Email()with.Message('Valid email is required');
      body('password')is.Length({ min: 1 })with.Message('Password is required')],
    const validate.Refresh = [
      body('refresh.Token')is.Length({ min: 1 })with.Message('Refresh token is required')]// Routes,
    thisrouterpost('/register', validate.Registration, thisregisterbind(this));
    thisrouterpost('/login', validate.Login, thisloginbind(this));
    thisrouterpost('/refresh', validate.Refresh, thisrefreshbind(this));
    thisrouterpost(
      '/logout';
      thisjwt.Serviceauthenticate() as Request.Handler;
      thislogoutbind(this) as Request.Handler);
    thisrouterpost(
      '/logout-all';
      thisjwt.Serviceauthenticate() as Request.Handler;
      thislogout.Allbind(this) as Request.Handler);
    thisrouterget(
      '/sessions';
      thisjwt.Serviceauthenticate() as Request.Handler;
      thisget.Sessionsbind(this) as Request.Handler);
    thisrouterdelete(
      '/sessions/: token.Id';
      thisjwt.Serviceauthenticate() as Request.Handler;
      thisrevoke.Sessionbind(this) as Request.Handler);
    thisrouterget(
      '/security-info';
      thisjwt.Serviceauthenticate() as Request.Handler;
      thisget.Security.Infobind(this) as Request.Handler);
    thisrouterpost(
      '/change-password';
      thisjwt.Serviceauthenticate() as Request.Handler;
      thischange.Passwordbind(this) as Request.Handler);
    thisrouterget(
      '/profile';
      thisjwt.Serviceauthenticate() as Request.Handler;
      thisget.Profilebind(this) as Request.Handler);
  }/**
   * User registration*/
  private async register(req: Request, res: Response) {
    try {
      // Check for validation errors;
      const errors = validation.Result(req);
      if (!errorsis.Empty()) {
        return resstatus(400)json({
          error instanceof Error ? errormessage : String(error) 'Validation failed';
          details: errorsarray()}),

      const { email, password, first.Name, last.Name } = reqbody// Check rate limiting for this I.P;
      const rate.Limit.Check = thisjwtServiceisAuth.Rate.Limited(reqip || '');
      if (rate.Limit.Checklimited) {
        return resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'Too many failed attempts';
          message: 'Please try again later',
          retry.After: rateLimit.Checkretry.After})}// Check if user already exists,
      const { data: existing.User } = await thissupabase,
        from('users');
        select('id');
        eq('email', email);
        single();
      if (existing.User) {
        thisjwtServicerecord.Auth.Attempt(reqip || '', false);
        return resstatus(409)json({
          error instanceof Error ? errormessage : String(error) 'User already exists';
          message: 'An account with this email already exists'})}// Hash password,
      const hashed.Password = await bcrypthash(password, 12)// Create user;
      const { data: user, error } = await thissupabase;
        from('users');
        insert({
          email;
          password_hash: hashed.Password,
          first_name: first.Name,
          last_name: last.Name,
          role: 'user',
          is_active: true,
          email_verified: false,
          created_at: new Date()}),
        select('id, email, role');
        single();
      if (error || !user) {
        loggererror('User registration failed:', error);
        thisjwtServicerecord.Auth.Attempt(reqip || '', false);
        return resstatus(500)json({
          error instanceof Error ? errormessage : String(error) 'Registration failed';
          message: 'Unable to create user account'})}// Generate token pair,
      const tokens = await thisjwtServicegenerate.Token.Pair(userid, useremail, userrole, req);
      thisjwtServicerecord.Auth.Attempt(reqip || '', true)// Set secure cookie for refresh token in production;
      if (configserveris.Production) {
        rescookie('refresh.Token', tokensrefresh.Token, {
          http.Only: true,
          secure: true,
          same.Site: 'strict',
          max.Age: 7 * 24 * 60 * 60 * 1000, // 7 days});

      resstatus(201)json({
        message: 'User registered successfully',
        user: {
          id: userid,
          email: useremail,
          role: userrole,
}        access.Token: tokensaccess.Token,
        refresh.Token: configserveris.Production ? undefined : tokensrefresh.Token,
        expires.In: tokensexpires.In})} catch (error) {
      loggererror('Registration error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Internal server error';
        message: 'Registration failed due to server error'})}}/**
   * User login*/
  private async login(req: Request, res: Response) {
    try {
      // Check for validation errors;
      const errors = validation.Result(req);
      if (!errorsis.Empty()) {
        return resstatus(400)json({
          error instanceof Error ? errormessage : String(error) 'Validation failed';
          details: errorsarray()}),

      const { email, password } = reqbody// Check rate limiting for this I.P;
      const rate.Limit.Check = thisjwtServiceisAuth.Rate.Limited(reqip || '');
      if (rate.Limit.Checklimited) {
        return resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'Too many failed attempts';
          message: 'Please try again later',
          retry.After: rateLimit.Checkretry.After})}// Get user,
      const { data: user, error } = await thissupabase;
        from('users');
        select('id, email, password_hash, role, is_active');
        eq('email', email);
        single();
      if (error || !user) {
        thisjwtServicerecord.Auth.Attempt(reqip || '', false);
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Invalid credentials';
          message: 'Email or password is incorrect'}),

      if (!useris_active) {
        thisjwtServicerecord.Auth.Attempt(reqip || '', false);
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Account disabled';
          message: 'Your account has been disabled'})}// Verify password,
      const password.Valid = await bcryptcompare(password, userpassword_hash);
      if (!password.Valid) {
        thisjwtServicerecord.Auth.Attempt(reqip || '', false);
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Invalid credentials';
          message: 'Email or password is incorrect'})}// Generate token pair,
      const tokens = await thisjwtServicegenerate.Token.Pair(userid, useremail, userrole, req);
      thisjwtServicerecord.Auth.Attempt(reqip || '', true)// Update last login;
      await thissupabasefrom('users')update({ last_login: new Date() })eq('id', userid)// Set secure cookie for refresh token in production;
      if (configserveris.Production) {
        rescookie('refresh.Token', tokensrefresh.Token, {
          http.Only: true,
          secure: true,
          same.Site: 'strict',
          max.Age: 7 * 24 * 60 * 60 * 1000, // 7 days});

      resjson({
        message: 'Login successful',
        user: {
          id: userid,
          email: useremail,
          role: userrole,
}        access.Token: tokensaccess.Token,
        refresh.Token: configserveris.Production ? undefined : tokensrefresh.Token,
        expires.In: tokensexpires.In})} catch (error) {
      loggererror('Login error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Internal server error';
        message: 'Login failed due to server error'})}}/**
   * Refresh access token*/
  private async refresh(req: Request, res: Response) {
    try {
      // Check for validation errors;
      const errors = validation.Result(req);
      if (!errorsis.Empty()) {
        return resstatus(400)json({
          error instanceof Error ? errormessage : String(error) 'Validation failed';
          details: errorsarray()}),

      const refresh.Token = reqbodyrefresh.Token || reqcookies?refresh.Token;
      if (!refresh.Token) {
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Refresh token required';
          message: 'No refresh token provided'})}// Refresh tokens,
      const new.Tokens = await thisjwtServicerefresh.Access.Token(refresh.Token, req);
      if (!new.Tokens) {
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Invalid refresh token';
          message: 'The refresh token is invalid or expired'})}// Set new secure cookie for refresh token in production,
      if (configserveris.Production) {
        rescookie('refresh.Token', new.Tokensrefresh.Token, {
          http.Only: true,
          secure: true,
          same.Site: 'strict',
          max.Age: 7 * 24 * 60 * 60 * 1000, // 7 days});

      resjson({
        message: 'Token refreshed successfully',
        access.Token: new.Tokensaccess.Token,
        refresh.Token: configserveris.Production ? undefined : new.Tokensrefresh.Token,
        expires.In: new.Tokensexpires.In})} catch (error) {
      loggererror('Token refresh error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Internal server error';
        message: 'Token refresh failed due to server error'})}}/**
   * Logout (revoke current session)*/
  private async logout(req: Auth.Request, res: Response) {
    try {
      const auth.Header = reqheadersauthorization;
      if (auth.Header && auth.Headerstarts.With('Bearer ')) {
        const token = auth.Headersubstring(7);
        const payload = thisjwtServiceverify.Access.Token(token);
        if (payload && payloadjti) {
          await thisjwtServicerevoke.Refresh.Token(requser!id, payloadjti)}}// Clear cookie in production;
      if (configserveris.Production) {
        resclear.Cookie('refresh.Token');

      resjson({
        message: 'Logout successful'})} catch (error) {
      loggererror('Logout error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Internal server error';
        message: 'Logout failed due to server error'})}}/**
   * Logout from all devices*/
  private async logout.All(req: Auth.Request, res: Response) {
    try {
      await thisjwtServicerevokeAll.User.Tokens(requser!id)// Clear cookie in production;
      if (configserveris.Production) {
        resclear.Cookie('refresh.Token');
}
      resjson({
        message: 'Logged out from all devices successfully'})} catch (error) {
      loggererror('Logout all error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Internal server error';
        message: 'Logout failed due to server error'})}}/**
   * Get user sessions*/
  private async get.Sessions(req: Auth.Request, res: Response) {
    try {
      const sessions = await thisjwtServiceget.User.Sessions(requser!id);
      resjson({
        sessions: sessionsmap((session) => ({
          id: sessiontoken.Id,
          created.At: sessioncreated.At,
          expires.At: sessionexpires.At,
          user.Agent: sessionuser.Agent,
          ip.Address: sessionip.Address,
          is.Current: false, // You could implement current session detection}))})} catch (error) {
      loggererror('Get sessions error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Internal server error';
        message: 'Failed to retrieve sessions'})}}/**
   * Revoke specific session*/
  private async revoke.Session(req: Auth.Request, res: Response) {
    try {
      const { token.Id } = reqparams;
      const success = await thisjwt.Servicerevoke.Session(requser!id, token.Id);
      if (success) {
        resjson({
          message: 'Session revoked successfully'})} else {
        resstatus(404)json({
          error instanceof Error ? errormessage : String(error) 'Session not found';
          message: 'The specified session could not be found'})}} catch (error) {
      loggererror('Revoke session error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Internal server error';
        message: 'Failed to revoke session'})}}/**
   * Get security information*/
  private async get.Security.Info(req: Auth.Request, res: Response) {
    try {
      const security.Info = await thisjwtServicegetUser.Security.Info(requser!id);
      resjson({
        active.Sessions: security.Infosessionslength,
        recent.Activity: security.Inforecent.Activity,
        failed.Attempts24h: security.Infofailed.Attempts,
        account.Status: 'active', // You could implement account status logic})} catch (error) {
      loggererror('Get security info error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Internal server error';
        message: 'Failed to retrieve security information'})}}/**
   * Change password*/
  private async change.Password(req: Request, res: Response) {
    try {
      const errors = validation.Result(req);
      if (!errorsis.Empty()) {
        return resstatus(400)json({
          error instanceof Error ? errormessage : String(error) 'Validation failed';
          details: errorsarray()}),

      const { current.Password, new.Password } = reqbody;
      const user = (req as Auth.Request)user!// Get current password hash;
      const { data: user.Data, error } = await thissupabase;
        from('users');
        select('password_hash');
        eq('id', userid);
        single();
      if (error || !user.Data) {
        return resstatus(404)json({
          error instanceof Error ? errormessage : String(error) 'User not found';
          message: 'User account not found'})}// Verify current password,
      const password.Valid = await bcryptcompare(current.Password, user.Datapassword_hash);
      if (!password.Valid) {
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Invalid password';
          message: 'Current password is incorrect'})}// Hash new password,
      const hashed.Password = await bcrypthash(new.Password, 12)// Update password;
      const { error instanceof Error ? errormessage : String(error) update.Error } = await thissupabase;
        from('users');
        update({ password_hash: hashed.Password }),
        eq('id', userid);
      if (update.Error) {
        loggererror('Password update failed:', update.Error);
        return resstatus(500)json({
          error instanceof Error ? errormessage : String(error) 'Password update failed';
          message: 'Unable to update password'})}// Revoke all existing sessions for security,
      await thisjwtServicerevokeAll.User.Tokens(userid);
      resjson({
        message: 'Password changed successfully',
        note: 'All sessions have been logged out for security'})} catch (error) {
      loggererror('Change password error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Internal server error';
        message: 'Password change failed due to server error'})}}/**
   * Get user profile*/
  private async get.Profile(req: Auth.Request, res: Response) {
    try {
      const { data: user, error } = await thissupabase;
        from('users');
        select('id, email, first_name, last_name, role, created_at, last_login, is_active');
        eq('id', requser!id);
        single();
      if (error || !user) {
        return resstatus(404)json({
          error instanceof Error ? errormessage : String(error) 'User not found';
          message: 'User profile not found'}),

      resjson({
        user: {
          id: userid,
          email: useremail,
          first.Name: userfirst_name,
          last.Name: userlast_name,
          role: userrole,
          created.At: usercreated_at,
          last.Login: userlast_login,
          is.Active: useris_active,
        }})} catch (error) {
      loggererror('Get profile error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Internal server error';
        message: 'Failed to retrieve user profile'})},

  public get.Router(): Router {
    return thisrouter};

export default Auth.Router;