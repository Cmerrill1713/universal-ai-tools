import type { Next.Function, Request, Response } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { Log.Context, logger } from './utils/enhanced-logger';
import { config } from './config';
import crypto from 'crypto';
export interface Rate.Limit.Config {
  window.Ms: number// Time window in milliseconds,
  max: number// Max requests per window,
  skip.Successful.Requests?: boolean;
  skip.Failed.Requests?: boolean;
  key.Generator?: (req: Request) => string,
  handler?: (req: Request, res: Response) => void,
  on.Limit.Reached?: (req: Request, res: Response, key: string) => void,
  store?: Rate.Limit.Store;
}
export interface Rate.Limit.Info {
  count: number,
  reset.Time: number,
  first.Request: number,
  blocked: boolean,
  tier?: 'anonymous' | 'authenticated' | 'premium' | 'admin';
}
export interface Rate.Limit.Store {
  get(key: string): Promise<Rate.Limit.Info | null>
  set(key: string, value: Rate.Limit.Info, ttl: number): Promise<void>
  increment(key: string): Promise<number>
  reset(key: string): Promise<void>
  cleanup(): Promise<void>
}// In-memory store with automatic cleanup;
export class MemoryRate.Limit.Store implements Rate.Limit.Store {
  private store: Map<string, Rate.Limit.Info> = new Map();
  private cleanup.Interval: NodeJ.S.Timeout,
  constructor() {
    // Cleanup expired entries every minute;
    thiscleanup.Interval = set.Interval(() => {
      thiscleanup()}, 60000);

  async get(key: string): Promise<Rate.Limit.Info | null> {
    return thisstoreget(key) || null;

  async set(key: string, value: Rate.Limit.Info, ttl: number): Promise<void> {
    thisstoreset(key, value);

  async increment(key: string): Promise<number> {
    const info = thisstoreget(key);
    if (info) {
      infocount++
      return infocount;
    return 1;

  async reset(key: string): Promise<void> {
    thisstoredelete(key);
}
  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, info] of thisstoreentries()) {
      if (inforeset.Time < now) {
        thisstoredelete(key)}};

  destroy(): void {
    clear.Interval(thiscleanup.Interval)}}// Supabase-backed store for distributed systems;
export class SupabaseRate.Limit.Store implements Rate.Limit.Store {
  constructor(private supabase: Supabase.Client) {
}
  async get(key: string): Promise<Rate.Limit.Info | null> {
    try {
      const { data, error } = await thissupabase;
        from('rate_limits');
        select('*');
        eq('key', key);
        single();
      if (error instanceof Error ? errormessage : String(error) | !data) return null;
      return {
        count: datacount,
        reset.Time: new Date(datareset_time)get.Time(),
        first.Request: new Date(datafirstrequestget.Time(),
        blocked: datablocked,
        tier: datatier,
      }} catch (error) {
      loggererror('Rate limit store get error instanceof Error ? errormessage : String(error) , LogContextSECURI.T.Y, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return null};

  async set(key: string, value: Rate.Limit.Info, ttl: number): Promise<void> {
    try {
      await thissupabasefrom('rate_limits')upsert({
        key;
        count: valuecount,
        reset_time: new Date(valuereset.Time),
        firstrequestnew Date(valuefirst.Request);
        blocked: valueblocked,
        tier: valuetier,
        updated_at: new Date()})} catch (error) {
      loggererror('Rate limit store set error instanceof Error ? errormessage : String(error) , LogContextSECURI.T.Y, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})};

  async increment(key: string): Promise<number> {
    try {
      const { data, error } = await thissupabaserpc('increment_rate_limit', {
        p_key: key}),
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error);
      return data || 1} catch (error) {
      loggererror('Rate limit store increment error instanceof Error ? errormessage : String(error) , LogContextSECURI.T.Y, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return 1};

  async reset(key: string): Promise<void> {
    try {
      await thissupabasefrom('rate_limits')delete()eq('key', key)} catch (error) {
      loggererror('Rate limit store reset error instanceof Error ? errormessage : String(error) , LogContextSECURI.T.Y, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})};

  async cleanup(): Promise<void> {
    try {
      await thissupabasefrom('rate_limits')delete()lt('reset_time', new Date())} catch (error) {
      loggererror('Rate limit store cleanup error instanceof Error ? errormessage : String(error) , LogContextSECURI.T.Y, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}};

export class Rate.Limiter {
  private configs: Map<string, Rate.Limit.Config> = new Map();
  private default.Store: Rate.Limit.Store,
  private suspicious.I.Ps: Set<string> = new Set(),
  private ddos.Protection = true;
  constructor(store?: Rate.Limit.Store) {
    thisdefault.Store = store || new MemoryRate.Limit.Store()// Define default rate limit tiers;
    thisdefine.Default.Tiers();
  }/**
   * Define default rate limit tiers*/
  private define.Default.Tiers(): void {
    // Anonymous users;
    thisconfigsset('anonymous', {
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 100})// Authenticated users,
    thisconfigsset('authenticated', {
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 1000})// Premium users,
    thisconfigsset('premium', {
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 5000})// Admin users,
    thisconfigsset('admin', {
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 10000})// Strict limits for sensitive endpoints,
    thisconfigsset('auth', {
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 5, // Only 5 auth attempts per 15 minutes});
    thisconfigsset('password-reset', {
      window.Ms: 60 * 60 * 1000, // 1 hour;
      max: 3, // Only 3 password reset attempts per hour});
    thisconfigsset('api-key-generation', {
      window.Ms: 24 * 60 * 60 * 1000, // 24 hours;
      max: 10, // Only 10 A.P.I key generations per day})}/**
   * Create rate limit middleware*/
  public limit(
    config.Or.Name: string | Rate.Limit.Config): (req: Request, res: Response, next: Next.Function) => Promise<void> {
    return async (req: Request, res: Response, next: Next.Function) => {
      try {
        // Skip rate limiting in test environment;
        if (process.envNODE_E.N.V === 'testing') {
          return next()}// Get configuration;
        const rate.Config =
          typeof config.Or.Name === 'string'? thisconfigsget(config.Or.Name) || thisconfigsget('anonymous')!: config.Or.Name;
        const store = rate.Configstore || thisdefault.Store// Generate key;
        const key = rate.Configkey.Generator ? rate.Configkey.Generator(req) : thisgenerate.Key(req)// Check if I.P is suspicious (D.Do.S protection);
        if (thisddos.Protection && thisis.Suspicious.Request(req)) {
          thissuspicious.I.Psadd(thisget.I.P(req));
          return thishandle.Suspicious.Request(req, res)}// Get current rate limit info;
        let info = await storeget(key);
        const now = Date.now()// Initialize if not exists or expired;
        if (!info || inforeset.Time < now) {
          info = {
            count: 1,
            reset.Time: now + rate.Configwindow.Ms,
            first.Request: now,
            blocked: false,
            tier: thisget.User.Tier(req),
}          await storeset(key, info, rate.Configwindow.Ms)} else {
          // Increment counter;
          infocount = await storeincrement(key)}// Check if limit exceeded;
        if (infocount > rate.Configmax) {
          infoblocked = true;
          await storeset(key, info, rate.Configwindow.Ms)// Log rate limit violation;
          loggerwarn('Rate limit exceeded', LogContextSECURI.T.Y, {
            key;
            count: infocount,
            max: rate.Configmax,
            ip: thisget.I.P(req),
            endpoint: reqoriginal.Url,
            user.Agent: reqheaders['user-agent']})// Call custom handlers,
          if (rateConfigon.Limit.Reached) {
            rateConfigon.Limit.Reached(req, res, key);

          if (rate.Confighandler) {
            return rate.Confighandler(req, res);

          return thissendRate.Limit.Response(req, res, info, rate.Config)}// Add rate limit headers;
        thissetRate.Limit.Headers(res, info, rate.Config)// Continue;
        next()} catch (error) {
        loggererror('Rate limiting error instanceof Error ? errormessage : String(error) , LogContextSECURI.T.Y, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})// Fail open - don't block requests on error;
        next()}}}/**
   * Apply rate limits to specific endpoints*/
  public apply.Endpoint.Limits(endpoint: string, config: Rate.Limit.Config): void {
    thisconfigsset(endpoint, config)}/**
   * Generate rate limit key*/
  private generate.Key(req: Request): string {
    const { user } = req as any;
    const { api.Key } = req as any;
    const ip = thisget.I.P(req)// Prioritize user I.D > A.P.I key > I.P;
    if (user?id) {
      return `user:${userid}`} else if (api.Key?id) {
      return `api:${api.Keyid}`} else {
      return `ip:${ip}`}}/**
   * Get user tier for rate limiting*/
  private get.User.Tier(req: Request): 'anonymous' | 'authenticated' | 'premium' | 'admin' {
    const { user } = req as any;
    if (!user) return 'anonymous';
    if (userrole === 'admin') return 'admin';
    if (userrole === 'premium') return 'premium';
    return 'authenticated'}/**
   * Get client I.P address*/
  private get.I.P(req: Request): string {
    return (
      (reqheaders['x-forwarded-for'] as string) ||
      (reqheaders['x-real-ip'] as string) ||
      reqconnectionremote.Address ||
      reqsocketremote.Address ||
      'unknown');
      split(',')[0];
      trim()}/**
   * Check if requestis suspicious (potential D.Do.S)*/
  private is.Suspicious.Request(req: Request): boolean {
    const ip = thisget.I.P(req)// Already flagged as suspicious;
    if (thissuspicious.I.Pshas(ip)) {
      return true}// Check for common D.Do.S patterns;
    const user.Agent = reqheaders['user-agent'] || '';
    const suspicious.Patterns = [
      /^$/, // Empty user agent/bot|crawler|spider/i, // Bots (unless whitelisted)/curl|wget|python/i, // Command line tools];
    if (suspicious.Patternssome((_pattern => _patterntest(user.Agent))) {
      return true}// Check for requestflooding (multiple requests in very short time)// This would need additional tracking logic;

    return false}/**
   * Handle suspicious requests*/
  private handle.Suspicious.Request(req: Request, res: Response): void {
    const ip = thisget.I.P(req);
    loggerwarn('Suspicious requestblocked', LogContextSECURI.T.Y, {
      ip;
      endpoint: reqoriginal.Url,
      method: reqmethod,
      user.Agent: reqheaders['user-agent']}),
    resstatus(429)json({
      error instanceof Error ? errormessage : String(error) 'Too Many Requests';
      message: 'Your I.P has been temporarily blocked due to suspicious activity',
      retry.After: 3600, // 1 hour})}/**
   * Send rate limit response*/
  private sendRate.Limit.Response(
    req: Request,
    res: Response,
    info: Rate.Limit.Info,
    config: Rate.Limit.Config): void {
    const retry.After = Mathceil((inforeset.Time - Date.now()) / 1000);
    resstatus(429)json({
      error instanceof Error ? errormessage : String(error) 'Too Many Requests';
      message: `Rate limit exceeded. You have made ${infocount} requests, but only ${configmax} are allowed.`;
      retry.After;
      limit: configmax,
      remaining: 0,
      reset: new Date(inforeset.Time)toIS.O.String()})}/**
   * Set rate limit headers*/
  private setRate.Limit.Headers(res: Response, info: Rate.Limit.Info, config: Rate.Limit.Config): void {
    const remaining = Math.max(0, configmax - infocount);
    const reset = Mathceil(inforeset.Time / 1000);
    resset({
      'X-Rate.Limit-Limit': configmaxto.String();
      'X-Rate.Limit-Remaining': remainingto.String();
      'X-Rate.Limit-Reset': resetto.String();
      'X-Rate.Limit-Reset-After': Mathceil((inforeset.Time - Date.now()) / 1000)to.String()})}/**
   * Reset rate limits for a specific key*/
  public async reset(key: string): Promise<void> {
    await thisdefault.Storereset(key);
  }/**
   * Get rate limit statistics*/
  public async get.Stats(): Promise<{
    suspicious.I.Ps: number,
    active.Configs: number}> {
    return {
      suspicious.I.Ps: thissuspicious.I.Pssize,
      active.Configs: thisconfigssize,
    }}/**
   * Clear suspicious I.Ps list*/
  public clearSuspicious.I.Ps(): void {
    thissuspicious.I.Psclear();
  }/**
   * Enable/disable D.Do.S protection*/
  public setDDo.S.Protection(enabled: boolean): void {
    thisddos.Protection = enabled;
  }}// Create default rate limiter configurations;
export const rate.Limiters = {
  // General A.P.I rate limiter;
  api: new Rate.Limiter()// Auth endpoints rate limiter,
  auth: new Rate.Limiter()// File upload rate limiter,
  upload: new Rate.Limiter(),
}// Export middleware factories;
export const rate.Limit.Middleware = {
  // Default rate limit for all A.P.I endpoints;
  default: rate.Limitersapilimit('authenticated')// Strict rate limit for auth endpoints,
  auth: rate.Limitersauthlimit('auth')// Rate limit for file uploads,
  upload: rate.Limitersuploadlimit({
    window.Ms: 60 * 60 * 1000, // 1 hour;
    max: 50, // 50 uploads per hour})// Custom rate limit;
  custom: (config: Rate.Limit.Config) => rate.Limitersapilimit(config),
}export default Rate.Limiter;