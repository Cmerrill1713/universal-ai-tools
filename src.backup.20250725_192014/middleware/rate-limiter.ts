import type { Next.Function, Request, Response } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { Log.Context, logger } from './utils/enhanced-logger';
import { config } from './config';
import crypto from 'crypto';
export interface RateLimit.Config {
  window.Ms: number// Time window in milliseconds;
  max: number// Max requests per window;
  skipSuccessful.Requests?: boolean;
  skipFailed.Requests?: boolean;
  key.Generator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  onLimit.Reached?: (req: Request, res: Response, key: string) => void;
  store?: RateLimit.Store;
};

export interface RateLimit.Info {
  count: number;
  reset.Time: number;
  first.Request: number;
  blocked: boolean;
  tier?: 'anonymous' | 'authenticated' | 'premium' | 'admin';
};

export interface RateLimit.Store {
  get(key: string): Promise<RateLimit.Info | null>
  set(key: string, value: RateLimit.Info, ttl: number): Promise<void>
  increment(key: string): Promise<number>
  reset(key: string): Promise<void>
  cleanup(): Promise<void>
}// In-memory store with automatic cleanup;
export class MemoryRateLimit.Store implements RateLimit.Store {
  private store: Map<string, RateLimit.Info> = new Map();
  private cleanup.Interval: NodeJS.Timeout;
  constructor() {
    // Cleanup expired entries every minute;
    thiscleanup.Interval = set.Interval(() => {
      thiscleanup()}, 60000)};

  async get(key: string): Promise<RateLimit.Info | null> {
    return thisstoreget(key) || null};

  async set(key: string, value: RateLimit.Info, ttl: number): Promise<void> {
    thisstoreset(key, value)};

  async increment(key: string): Promise<number> {
    const info = thisstoreget(key);
    if (info) {
      infocount++
      return infocount};
    return 1};

  async reset(key: string): Promise<void> {
    thisstoredelete(key);
  };

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, info] of thisstoreentries()) {
      if (inforeset.Time < now) {
        thisstoredelete(key)}}};

  destroy(): void {
    clear.Interval(thiscleanup.Interval)}}// Supabase-backed store for distributed systems;
export class SupabaseRateLimit.Store implements RateLimit.Store {
  constructor(private supabase: Supabase.Client) {
};

  async get(key: string): Promise<RateLimit.Info | null> {
    try {
      const { data, error } = await thissupabase;
        from('rate_limits');
        select('*');
        eq('key', key);
        single();
      if (error instanceof Error ? errormessage : String(error) | !data) return null;
      return {
        count: datacount;
        reset.Time: new Date(datareset_time)get.Time();
        first.Request: new Date(datafirstrequestget.Time();
        blocked: datablocked;
        tier: datatier;
      }} catch (error) {
      loggererror('Rate limit store get error instanceof Error ? errormessage : String(error) , LogContextSECURIT.Y, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return null}};

  async set(key: string, value: RateLimit.Info, ttl: number): Promise<void> {
    try {
      await thissupabasefrom('rate_limits')upsert({
        key;
        count: valuecount;
        reset_time: new Date(valuereset.Time);
        firstrequestnew Date(valuefirst.Request);
        blocked: valueblocked;
        tier: valuetier;
        updated_at: new Date()})} catch (error) {
      loggererror('Rate limit store set error instanceof Error ? errormessage : String(error) , LogContextSECURIT.Y, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}};

  async increment(key: string): Promise<number> {
    try {
      const { data, error } = await thissupabaserpc('increment_rate_limit', {
        p_key: key});
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error);
      return data || 1} catch (error) {
      loggererror('Rate limit store increment error instanceof Error ? errormessage : String(error) , LogContextSECURIT.Y, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return 1}};

  async reset(key: string): Promise<void> {
    try {
      await thissupabasefrom('rate_limits')delete()eq('key', key)} catch (error) {
      loggererror('Rate limit store reset error instanceof Error ? errormessage : String(error) , LogContextSECURIT.Y, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}};

  async cleanup(): Promise<void> {
    try {
      await thissupabasefrom('rate_limits')delete()lt('reset_time', new Date())} catch (error) {
      loggererror('Rate limit store cleanup error instanceof Error ? errormessage : String(error) , LogContextSECURIT.Y, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}}};

export class Rate.Limiter {
  private configs: Map<string, RateLimit.Config> = new Map();
  private default.Store: RateLimit.Store;
  private suspiciousI.Ps: Set<string> = new Set();
  private ddos.Protection = true;
  constructor(store?: RateLimit.Store) {
    thisdefault.Store = store || new MemoryRateLimit.Store()// Define default rate limit tiers;
    thisdefineDefault.Tiers();
  }/**
   * Define default rate limit tiers*/
  private defineDefault.Tiers(): void {
    // Anonymous users;
    thisconfigsset('anonymous', {
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 100})// Authenticated users;
    thisconfigsset('authenticated', {
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 1000})// Premium users;
    thisconfigsset('premium', {
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 5000})// Admin users;
    thisconfigsset('admin', {
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 10000})// Strict limits for sensitive endpoints;
    thisconfigsset('auth', {
      window.Ms: 15 * 60 * 1000, // 15 minutes;
      max: 5, // Only 5 auth attempts per 15 minutes});
    thisconfigsset('password-reset', {
      window.Ms: 60 * 60 * 1000, // 1 hour;
      max: 3, // Only 3 password reset attempts per hour});
    thisconfigsset('api-key-generation', {
      window.Ms: 24 * 60 * 60 * 1000, // 24 hours;
      max: 10, // Only 10 AP.I key generations per day})}/**
   * Create rate limit middleware*/
  public limit(
    configOr.Name: string | RateLimit.Config): (req: Request, res: Response, next: Next.Function) => Promise<void> {
    return async (req: Request, res: Response, next: Next.Function) => {
      try {
        // Skip rate limiting in test environment;
        if (process.envNODE_EN.V === 'testing') {
          return next()}// Get configuration;
        const rate.Config =
          typeof configOr.Name === 'string'? thisconfigsget(configOr.Name) || thisconfigsget('anonymous')!: configOr.Name;
        const store = rate.Configstore || thisdefault.Store// Generate key;
        const key = rateConfigkey.Generator ? rateConfigkey.Generator(req) : thisgenerate.Key(req)// Check if I.P is suspicious (DDo.S protection);
        if (thisddos.Protection && thisisSuspicious.Request(req)) {
          thissuspiciousI.Psadd(thisgetI.P(req));
          return thishandleSuspicious.Request(req, res)}// Get current rate limit info;
        let info = await storeget(key);
        const now = Date.now()// Initialize if not exists or expired;
        if (!info || inforeset.Time < now) {
          info = {
            count: 1;
            reset.Time: now + rateConfigwindow.Ms;
            first.Request: now;
            blocked: false;
            tier: thisgetUser.Tier(req);
          };
          await storeset(key, info, rateConfigwindow.Ms)} else {
          // Increment counter;
          infocount = await storeincrement(key)}// Check if limit exceeded;
        if (infocount > rate.Configmax) {
          infoblocked = true;
          await storeset(key, info, rateConfigwindow.Ms)// Log rate limit violation;
          loggerwarn('Rate limit exceeded', LogContextSECURIT.Y, {
            key;
            count: infocount;
            max: rate.Configmax;
            ip: thisgetI.P(req);
            endpoint: reqoriginal.Url;
            user.Agent: reqheaders['user-agent']})// Call custom handlers;
          if (rateConfigonLimit.Reached) {
            rateConfigonLimit.Reached(req, res, key)};

          if (rate.Confighandler) {
            return rate.Confighandler(req, res)};

          return thissendRateLimit.Response(req, res, info, rate.Config)}// Add rate limit headers;
        thissetRateLimit.Headers(res, info, rate.Config)// Continue;
        next()} catch (error) {
        loggererror('Rate limiting error instanceof Error ? errormessage : String(error) , LogContextSECURIT.Y, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})// Fail open - don't block requests on error;
        next()}}}/**
   * Apply rate limits to specific endpoints*/
  public applyEndpoint.Limits(endpoint: string, config: RateLimit.Config): void {
    thisconfigsset(endpoint, config)}/**
   * Generate rate limit key*/
  private generate.Key(req: Request): string {
    const { user } = req as any;
    const { api.Key } = req as any;
    const ip = thisgetI.P(req)// Prioritize user I.D > AP.I key > I.P;
    if (user?id) {
      return `user:${userid}`} else if (api.Key?id) {
      return `api:${api.Keyid}`} else {
      return `ip:${ip}`}}/**
   * Get user tier for rate limiting*/
  private getUser.Tier(req: Request): 'anonymous' | 'authenticated' | 'premium' | 'admin' {
    const { user } = req as any;
    if (!user) return 'anonymous';
    if (userrole === 'admin') return 'admin';
    if (userrole === 'premium') return 'premium';
    return 'authenticated'}/**
   * Get client I.P address*/
  private getI.P(req: Request): string {
    return (
      (reqheaders['x-forwarded-for'] as string) ||
      (reqheaders['x-real-ip'] as string) ||
      reqconnectionremote.Address ||
      reqsocketremote.Address ||
      'unknown');
      split(',')[0];
      trim()}/**
   * Check if requestis suspicious (potential DDo.S)*/
  private isSuspicious.Request(req: Request): boolean {
    const ip = thisgetI.P(req)// Already flagged as suspicious;
    if (thissuspiciousI.Pshas(ip)) {
      return true}// Check for common DDo.S patterns;
    const user.Agent = reqheaders['user-agent'] || '';
    const suspicious.Patterns = [
      /^$/, // Empty user agent/bot|crawler|spider/i, // Bots (unless whitelisted)/curl|wget|python/i, // Command line tools];
    if (suspicious.Patternssome((_pattern => _patterntest(user.Agent))) {
      return true}// Check for requestflooding (multiple requests in very short time)// This would need additional tracking logic;

    return false}/**
   * Handle suspicious requests*/
  private handleSuspicious.Request(req: Request, res: Response): void {
    const ip = thisgetI.P(req);
    loggerwarn('Suspicious requestblocked', LogContextSECURIT.Y, {
      ip;
      endpoint: reqoriginal.Url;
      method: reqmethod;
      user.Agent: reqheaders['user-agent']});
    resstatus(429)json({
      error instanceof Error ? errormessage : String(error) 'Too Many Requests';
      message: 'Your I.P has been temporarily blocked due to suspicious activity';
      retry.After: 3600, // 1 hour})}/**
   * Send rate limit response*/
  private sendRateLimit.Response(
    req: Request;
    res: Response;
    info: RateLimit.Info;
    config: RateLimit.Config): void {
    const retry.After = Mathceil((inforeset.Time - Date.now()) / 1000);
    resstatus(429)json({
      error instanceof Error ? errormessage : String(error) 'Too Many Requests';
      message: `Rate limit exceeded. You have made ${infocount} requests, but only ${configmax} are allowed.`;
      retry.After;
      limit: configmax;
      remaining: 0;
      reset: new Date(inforeset.Time)toISO.String()})}/**
   * Set rate limit headers*/
  private setRateLimit.Headers(res: Response, info: RateLimit.Info, config: RateLimit.Config): void {
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
    suspiciousI.Ps: number;
    active.Configs: number}> {
    return {
      suspiciousI.Ps: thissuspiciousI.Pssize;
      active.Configs: thisconfigssize;
    }}/**
   * Clear suspicious I.Ps list*/
  public clearSuspiciousI.Ps(): void {
    thissuspiciousI.Psclear();
  }/**
   * Enable/disable DDo.S protection*/
  public setDDoS.Protection(enabled: boolean): void {
    thisddos.Protection = enabled;
  }}// Create default rate limiter configurations;
export const rate.Limiters = {
  // General AP.I rate limiter;
  api: new Rate.Limiter()// Auth endpoints rate limiter;
  auth: new Rate.Limiter()// File upload rate limiter;
  upload: new Rate.Limiter();
}// Export middleware factories;
export const rateLimit.Middleware = {
  // Default rate limit for all AP.I endpoints;
  default: rate.Limitersapilimit('authenticated')// Strict rate limit for auth endpoints;
  auth: rate.Limitersauthlimit('auth')// Rate limit for file uploads;
  upload: rate.Limitersuploadlimit({
    window.Ms: 60 * 60 * 1000, // 1 hour;
    max: 50, // 50 uploads per hour})// Custom rate limit;
  custom: (config: RateLimit.Config) => rate.Limitersapilimit(config);
};
export default Rate.Limiter;