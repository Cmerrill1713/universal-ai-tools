import type { Next.Function, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rate.Limit from 'express-rate-limit';
import { Log.Context, logger } from './utils/enhanced-logger';
import { config } from './config/environment';
import { app.Config } from './config/index';
import { securityHardening.Service } from './services/security-hardening';
import { create.Hash } from 'crypto';
export interface Security.Options {
  enable.Cors?: boolean;
  enable.Helmet?: boolean;
  enableRate.Limit?: boolean;
  enableCS.P?: boolean;
  enableCSR.F?: boolean;
  enableIP.Whitelisting?: boolean;
  cors.Origins?: string[];
  rateLimit.Window?: number;
  rateLimit.Max?: number;
  ip.Whitelist?: string[];
  ip.Blacklist?: string[];
  requestSize.Limit?: string;
};

export interface RateLimit.Info {
  ip: string;
  requests: number;
  window.Start: number;
  blocked: boolean;
};

export class Security.Middleware {
  private rateLimit.Map: Map<string, RateLimit.Info> = new Map();
  private blockedI.Ps: Set<string> = new Set();
  private whitelistedI.Ps: Set<string> = new Set();
  private csrf.Tokens: Map<string, { token: string; expires: number }> = new Map();
  private options: Security.Options;
  constructor(options: Security.Options = {}) {
    thisoptions = {
      enable.Cors: true;
      enable.Helmet: true;
      enableRate.Limit: true;
      enableCS.P: true;
      enableCSR.F: true;
      enableIP.Whitelisting: false;
      cors.Origins: configsecuritycors.Origins || [];
      rateLimit.Window: 900000, // 15 minutes;
      rateLimit.Max: 100, // 100 requests per window;
      ip.Whitelist: [];
      ip.Blacklist: [];
      requestSize.Limit: '10mb'.options;
    }// Initialize I.P lists;
    optionsip.Whitelist?for.Each((ip) => thiswhitelistedI.Psadd(ip));
    optionsip.Blacklist?for.Each((ip) => thisblockedI.Psadd(ip))// Cleanup expired CSR.F tokens periodically with errorhandling;
    const cleanup.Interval = set.Interval(() => {
      try {
        thiscleanupCSRF.Tokens()} catch (error) {
        loggererror('Error cleaning up CSR.F tokens', LogContextSECURIT.Y, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})}}, 3600000)// Every hour// Store interval reference for potential cleanup;
    (this as any)cleanup.Interval = cleanup.Interval}/**
   * COR.S middleware configuration*/
  public getCors.Middleware() {
    if (!thisoptionsenable.Cors) {
      return (req: Request, res: Response, next: Next.Function) => next()};

    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests);
        if (!origin) return callback(null, true)// Check if origin is in allowed list;
        if (thisoptionscors.Origins!includes(origin)) {
          return callback(null, true)}// REMOVE.D: Localhost bypass for production security// All origins must be explicitly configured in CORS_ORIGIN.S;

        return callback(new Error('Not allowed by COR.S'))};
      credentials: true;
      optionsSuccess.Status: 200;
      methods: ['GE.T', 'POS.T', 'PU.T', 'DELET.E', 'OPTION.S'];
      allowed.Headers: [
        'Content-Type';
        'Authorization';
        'X-AP.I-Key';
        'X-Requested-With';
        'X-Forwarded-For';
        'User-Agent'];
      exposed.Headers: [
        'X-Rate.Limit-Limit';
        'X-Rate.Limit-Remaining';
        'X-Rate.Limit-Reset';
        'X-Cache';
        'X-Response-Time']})}/**
   * Get Helmet middleware for security headers*/
  public getHelmet.Middleware() {
    if (!thisoptionsenable.Helmet) {
      return (req: Request, res: Response, next: Next.Function) => next()};

    return helmet({
      contentSecurity.Policy: thisoptionsenableCS.P? {
            directives: {
              default.Src: ["'self'"];
              script.Src: [
                "'self'"// In production, use nonces or hashes for inline scripts// During development, we allow unsafe-inline but warn about it.(configserveris.Development ? ["'unsafe-inline'", "'unsafe-eval'"] : [])// Note: Nonces are handled dynamically via reslocalsnonce];
              style.Src: [
                "'self'"// In production, use nonces or hashes for inline styles// During development, we allow unsafe-inline but warn about it.(configserveris.Development ? ["'unsafe-inline'"] : [])// Allow specific trusted CD.Ns;
                'https://fontsgoogleapiscom'// Note: Nonces are handled dynamically via reslocalsnonce];
              img.Src: ["'self'", 'data:', 'https:', 'blob:'];
              font.Src: ["'self'", 'data:', 'https://fontsgstaticcom'];
              connect.Src: [
                "'self'";
                configdatabasesupabase.Url;
                'https://*supabaseco';
                'wss://*supabaseco';
                'https://apiopenaicom';
                'https://apianthropiccom';
                'https://apigroqcom';
                'https://generativelanguagegoogleapiscom'// Only allow local connections in development.(configserveris.Development? [appConfiglocalLL.Mollamaurl, 'ws://localhost:*', 'http://localhost:*']: [])];
              media.Src: ["'self'", 'blob:'];
              object.Src: ["'none'"];
              base.Uri: ["'self'"];
              form.Action: ["'self'"];
              frame.Ancestors: ["'none'"];
              worker.Src: ["'self'", 'blob:'].(configserveris.Production && { upgradeInsecure.Requests: [] })};
            report.Only: false, // Enforce CS.P in production}: false;
      crossOriginEmbedder.Policy: false;
      hsts: {
        max.Age: 31536000;
        includeSub.Domains: true;
        preload: true;
      };
      no.Sniff: true;
      originAgent.Cluster: true;
      permittedCrossDomain.Policies: false;
      referrer.Policy: { policy: 'strict-origin-when-cross-origin' };
      xss.Filter: true})}/**
   * Security headers middleware (legacy, use getHelmet.Middleware instead)* Also adds nonce generation for CS.P*/
  public security.Headers() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Generate nonce for CS.P if in production;
      if (configserveris.Production && thisoptionsenableCS.P) {
        const nonce = create.Hash('sha256');
          update(Date.now() + Mathrandom()to.String());
          digest('base64');
          slice(0, 16);
        reslocalsnonce = nonce}// Apply additional security headers;
      resset.Header('X-Frame-Options', 'DEN.Y');
      resset.Header('X-Content-Type-Options', 'nosniff');
      resset.Header('X-XS.S-Protection', '1; mode=block');
      resset.Header('X-Download-Options', 'noopen');
      resset.Header('X-Permitted-Cross-Domain-Policies', 'none');
      resset.Header('Referrer-Policy', 'strict-origin-when-cross-origin');
      resset.Header(
        'Permissions-Policy';
        'camera=(), microphone=(), geolocation=(), interest-cohort=()')// Apply Helmet middleware;
      const helmet.Middleware = thisgetHelmet.Middleware();
      helmet.Middleware(req, res, next)}}/**
   * Generate Content Security Policy* NOT.E: This method is deprecated. CS.P is now handled by Helmet middleware.
   * @deprecated Use getHelmet.Middleware() instead*/
  private generateCS.P(): string {
    loggerwarn(
      'generateCS.P() is deprecated. Use getHelmet.Middleware() for CS.P configuration';
      LogContextSECURIT.Y);
    const csp.Directives = [
      "default-src 'self'";
      "script-src 'self'", // Removed unsafe-inline and unsafe-eval for security;
      "style-src 'self'", // Removed unsafe-inline for security;
      "img-src 'self' data: https: blob:";
      "font-src 'self' data: https:";
      "connect-src 'self' https://apiopenaicom https://apianthropiccom https://*supabaseco wss://*supabaseco";
      "media-src 'self' blob:";
      "object-src 'none'";
      "base-uri 'self'";
      "form-action 'self'";
      "frame-ancestors 'none'";
      "worker-src 'self' blob:".(configserveris.Production ? ['upgrade-insecure-requests'] : [])];
    return csp.Directivesjoin('; ')}/**
   * Get express-rate-limit middleware*/
  public getExpressRate.Limiter() {
    if (!thisoptionsenableRate.Limit) {
      return (req: Request, res: Response, next: Next.Function) => next()};

    return rate.Limit({
      window.Ms: thisoptionsrateLimit.Window!
      max: thisoptionsrateLimit.Max!
      standard.Headers: true;
      legacy.Headers: false;
      handler: (req, res) => {
        const ip = thisgetClientI.P(req);
        loggerwarn(`Rate limit exceeded for I.P: ${ip}`, LogContextSECURIT.Y, {
          ip;
          endpoint: reqoriginal.Url;
          user.Agent: reqheaders['user-agent']});
        resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'Rate limit exceeded';
          message: 'Too many requests from this I.P';
          retry.After: Mathceil(thisoptionsrateLimit.Window! / 1000)})};
      skip: (req) => {
        const ip = thisgetClientI.P(req);
        return thiswhitelistedI.Pshas(ip)}})}/**
   * Enhanced rate limiting middleware with per-endpoint limits*/
  public getEndpointRate.Limiter(endpoint: string, max = 10, window.Ms = 60000) {
    return rate.Limit({
      window.Ms;
      max;
      key.Generator: (req) => `${thisgetClientI.P(req)}:${endpoint}`;
      standard.Headers: true;
      legacy.Headers: false;
      handler: (req, res) => {
        loggerwarn(`Endpoint rate limit exceeded`, LogContextSECURIT.Y, {
          ip: thisgetClientI.P(req);
          endpoint;
          user.Agent: reqheaders['user-agent']});
        resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'Endpoint rate limit exceeded';
          message: `Too many requests to ${endpoint}`;
          retry.After: Mathceil(window.Ms / 1000)})}})}/**
   * Rate limiting middleware (legacy)*/
  public rate.Limit() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!thisoptionsenableRate.Limit) {
        return next()};

      const ip = thisgetClientI.P(req)// Check if I.P is blocked;
      if (thisblockedI.Pshas(ip)) {
        return resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'I.P blocked';
          message: 'Your I.P has been temporarily blocked due to excessive requests';
          retry.After: 3600, // 1 hour})};

      const now = Date.now();
      const window.Start = now - thisoptionsrateLimit.Window!// Get or create rate limit info for this I.P;
      let rateLimit.Info = thisrateLimit.Mapget(ip);
      if (!rateLimit.Info || rateLimitInfowindow.Start < window.Start) {
        rateLimit.Info = {
          ip;
          requests: 1;
          window.Start: now;
          blocked: false;
        };
        thisrateLimit.Mapset(ip, rateLimit.Info)} else {
        rateLimit.Inforequests++}// Check if limit exceeded;
      if (rateLimit.Inforequests > thisoptionsrateLimit.Max!) {
        rateLimit.Infoblocked = true;
        thisblockedI.Psadd(ip)// Log rate limit violation;
        loggerwarn(`Rate limit exceeded for I.P: ${ip}`, LogContextSECURIT.Y, {
          ip;
          requests: rateLimit.Inforequests;
          limit: thisoptionsrateLimit.Max;
          endpoint: reqoriginal.Url;
          user.Agent: reqheaders['user-agent']});
        return resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'Rate limit exceeded';
          message: 'Too many requests from this I.P';
          retry.After: Mathceil(thisoptionsrateLimit.Window! / 1000);
          limit: thisoptionsrateLimit.Max;
          requests: rateLimit.Inforequests})}// Set rate limit headers;
      const remaining = Math.max(0, thisoptionsrateLimit.Max! - rateLimit.Inforequests);
      const reset.Time = Mathceil(
        (rateLimitInfowindow.Start + thisoptionsrateLimit.Window!) / 1000);
      resset({
        'X-Rate.Limit-Limit': thisoptionsrateLimit.Max!to.String();
        'X-Rate.Limit-Remaining': remainingto.String();
        'X-Rate.Limit-Reset': resetTimeto.String()});
      next()}}/**
   * Get client I.P address*/
  private getClientI.P(req: Request): string {
    return (
      (reqheaders['x-forwarded-for'] as string) ||
      (reqheaders['x-real-ip'] as string) ||
      reqconnectionremote.Address ||
      reqsocketremote.Address ||
      'unknown');
      split(',')[0];
      trim()}/**
   * Input sanitization middleware*/
  public sanitize.Input() {
    return (req: Request, res: Response, next: Next.Function) => {
      try {
        // Sanitize query parameters;
        if (reqquery) {
          reqquery = JSO.N.parse(securityHardeningServicesanitize.Input(JSO.N.stringify(reqquery)))}// Sanitize body;
        if (reqbody) {
          reqbody = JSO.N.parse(securityHardeningServicesanitize.Input(JSO.N.stringify(reqbody)))}// Sanitize parameters;
        if (reqparams) {
          reqparams = JSO.N.parse(
            securityHardeningServicesanitize.Input(JSO.N.stringify(reqparams)))}// Sanitize headers;
        const dangerous.Headers = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
        dangerousHeadersfor.Each((header) => {
          if (reqheaders[header]) {
            delete reqheaders[header]}});
        next()} catch (error) {
        loggererror('Input sanitization error', LogContextSECURIT.Y, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error);
          stack: error instanceof Error ? errorstack : undefined});
        resstatus(400)json({
          error instanceof Error ? errormessage : String(error) 'Invalid input';
          message: 'Request contains invalid or malicious content'})}}}/**
   * Sanitize object recursively*/
  private sanitize.Object(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj};

    if (typeof obj === 'string') {
      return thissanitize.String(obj)};

    if (Array.is.Array(obj)) {
      return objmap((item) => thissanitize.Object(item))};

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Objectentries(obj)) {
        const sanitized.Key = thissanitize.String(key);
        sanitized[sanitized.Key] = thissanitize.Object(value)};
      return sanitized};

    return obj}/**
   * Sanitize string input*/
  private sanitize.String(str: string): string {
    if (typeof str !== 'string') {
      return str}// Remove null bytes;
    str = strreplace(/\0/g, '')// Remove control characters except tab, newline, carriage return;
    str = strreplace(/[\x00-\x08\x0.B\x0.C\x0.E-\x1.F\x7.F]/g, '')// Limit string length;
    if (strlength > 10000) {
      str = strsubstring(0, 10000)};

    return str}/**
   * Request logging middleware*/
  public request.Logger() {
    return (req: Request, res: Response, next: Next.Function) => {
      const start.Time = Date.now();
      const ip = thisgetClientI.P(req)// Log request;
      loggerinfo('Incoming request LogContextHTT.P, {
        method: reqmethod;
        url: reqoriginal.Url;
        ip;
        user.Agent: reqheaders['user-agent'];
        content.Length: reqheaders['content-length'];
        timestamp: new Date()toISO.String()})// Log response;
      const original.Send = ressend;
      ressend = function (data) {
        const duration = Date.now() - start.Time;
        loggerinfo('Request completed', LogContextHTT.P, {
          method: reqmethod;
          url: reqoriginal.Url;
          status.Code: resstatus.Code;
          duration;
          ip;
          response.Size: data ? datalength : 0});
        return original.Sendcall(this, data)};
      next()}}/**
   * Cleanup expired rate limit entries*/
  public cleanupRate.Limits(): void {
    const now = Date.now();
    const cutoff = now - thisoptionsrateLimit.Window!
    for (const [ip, info] of thisrateLimit.Mapentries()) {
      if (infowindow.Start < cutoff) {
        thisrateLimit.Mapdelete(ip);
        thisblockedI.Psdelete(ip)}}}/**
   * Get rate limit statistics*/
  public getRateLimit.Stats(): {
    totalI.Ps: number;
    blockedI.Ps: number;
    active.Windows: number} {
    return {
      totalI.Ps: thisrateLimit.Mapsize;
      blockedI.Ps: thisblockedI.Pssize;
      active.Windows: Arrayfrom(thisrateLimit.Mapvalues())filter(
        (info) => infowindow.Start > Date.now() - thisoptionsrateLimit.Window!)length;
    }}/**
   * Manually block an I.P*/
  public blockI.P(ip: string): void {
    thisblockedI.Psadd(ip);
    loggerwarn(`I.P manually blocked: ${ip}`)}/**
   * Manually unblock an I.P*/
  public unblockI.P(ip: string): void {
    thisblockedI.Psdelete(ip);
    thisrateLimit.Mapdelete(ip);
    loggerinfo(`I.P unblocked: ${ip}`)}/**
   * CSR.F protection middleware*/
  public csrf.Protection() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!thisoptionsenableCSR.F) {
        return next()}// Skip CSR.F for safe methods;
      if (['GE.T', 'HEA.D', 'OPTION.S']includes(reqmethod)) {
        return next()};

      const token = reqheaders['x-csrf-token'] as string;
      const session.Id = (reqheaders['x-session-id'] as string) || thisgetClientI.P(req);
      if (!token) {
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'CSR.F token missing';
          message: 'Request requires CSR.F token'})};

      const stored.Token = thiscsrf.Tokensget(session.Id);
      if (!stored.Token || stored.Tokentoken !== token || stored.Tokenexpires < Date.now()) {
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'Invalid CSR.F token';
          message: 'CSR.F token is invalid or expired'})};

      next()}}/**
   * Generate CSR.F token*/
  public generateCSRF.Token(session.Id: string): string {
    const token = create.Hash('sha256');
      update(session.Id + Date.now() + Mathrandom());
      digest('hex');
    thiscsrf.Tokensset(session.Id, {
      token;
      expires: Date.now() + 3600000, // 1 hour});
    return token}/**
   * I.P-based access control*/
  public ipAccess.Control() {
    return (req: Request, res: Response, next: Next.Function) => {
      const ip = thisgetClientI.P(req)// Check blacklist first;
      if (thisblockedI.Pshas(ip)) {
        loggerwarn(`Blocked I.P attempted access: ${ip}`);
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'Access denied';
          message: 'Your I.P address is blocked'})}// Check whitelist if enabled;
      if (thisoptionsenableIP.Whitelisting && thiswhitelistedI.Pssize > 0) {
        if (!thiswhitelistedI.Pshas(ip)) {
          loggerwarn(`Non-whitelisted I.P attempted access: ${ip}`);
          return resstatus(403)json({
            error instanceof Error ? errormessage : String(error) 'Access denied';
            message: 'Your I.P address is not authorized'})}};

      next()}}/**
   * Request size limiting*/
  public requestSize.Limit() {
    return (req: Request, res: Response, next: Next.Function) => {
      const content.Length = reqheaders['content-length'];
      if (!content.Length) {
        return next()};

      const max.Size = thisparse.Size(thisoptionsrequestSize.Limit!);
      const size = parse.Int(content.Length, 10);
      if (size > max.Size) {
        return resstatus(413)json({
          error instanceof Error ? errormessage : String(error) 'Payload too large';
          message: `Request size ${size} exceeds limit of ${max.Size} bytes`})};

      next()}}/**
   * Parse size string to bytes*/
  private parse.Size(size: string): number {
    const units: { [key: string]: number } = {
      b: 1;
      kb: 1024;
      mb: 1024 * 1024;
      gb: 1024 * 1024 * 1024;
    };
    const match = sizetoLower.Case()match(/^(\d+)([a-z]+)$/);
    if (!match) {
      return parse.Int(size, 10)};

    const [ num, unit] = match;
    return parse.Int(num, 10) * (units[unit] || 1)}/**
   * Cleanup expired CSR.F tokens*/
  private cleanupCSRF.Tokens(): void {
    const now = Date.now();
    for (const [session.Id, token] of thiscsrf.Tokensentries()) {
      if (tokenexpires < now) {
        thiscsrf.Tokensdelete(session.Id)}}}/**
   * Security audit logging*/
  public securityAudit.Logger() {
    return (req: Request, res: Response, next: Next.Function) => {
      const ip = thisgetClientI.P(req);
      const start.Time = Date.now()// Log security-relevant requestdetails;
      const security.Log = {
        timestamp: new Date()toISO.String();
        ip;
        method: reqmethod;
        url: reqoriginal.Url;
        user.Agent: reqheaders['user-agent'];
        referer: reqheaders['referer'];
        content.Type: reqheaders['content-type'];
        authentication: reqheaders['authorization'] ? 'present' : 'none';
        api.Key: reqheaders['x-api-key'] ? 'present' : 'none'}// Log response;
      const original.Send = ressend;
      ressend = function (data) {
        const duration = Date.now() - start.Time// Log security events;
        if (resstatus.Code === 401 || resstatus.Code === 403) {
          loggerwarn('Security event: Authentication/Authorization failure', LogContextSECURIT.Y, {
            .security.Log;
            status.Code: resstatus.Code;
            duration})} else if (resstatus.Code === 429) {
          loggerwarn('Security event: Rate limit exceeded', LogContextSECURIT.Y, {
            .security.Log;
            status.Code: resstatus.Code;
            duration})} else if (resstatus.Code >= 400) {
          loggerinfo('Security event: Client error instanceof Error ? errormessage : String(error)  LogContextSECURIT.Y, {
            .security.Log;
            status.Code: resstatus.Code;
            duration})};

        return original.Sendcall(this, data)};
      next()}}};

export default Security.Middleware/**
 * Pre-configured security middleware instance (lazy initialization)*/
let _security.Middleware: Security.Middleware | null = null;
export function getSecurity.Middleware(): Security.Middleware {
  if (!_security.Middleware) {
    _security.Middleware = new Security.Middleware()};
  return _security.Middleware}// For backward compatibility;
export const security.Middleware = {
  get ipAccess.Control() {
    return getSecurity.Middleware()ipAccess.Controlbind(getSecurity.Middleware())};
  get requestSize.Limit() {
    return getSecurity.Middleware()requestSize.Limitbind(getSecurity.Middleware())};
  get getHelmet.Middleware() {
    return getSecurity.Middleware()getHelmet.Middlewarebind(getSecurity.Middleware())};
  get getCors.Middleware() {
    return getSecurity.Middleware()getCors.Middlewarebind(getSecurity.Middleware())};
  get getExpressRate.Limiter() {
    return getSecurity.Middleware()getExpressRate.Limiterbind(getSecurity.Middleware())};
  get sanitize.Input() {
    return getSecurity.Middleware()sanitize.Inputbind(getSecurity.Middleware())};
  get csrf.Protection() {
    return getSecurity.Middleware()csrf.Protectionbind(getSecurity.Middleware())};
  get securityAudit.Logger() {
    return getSecurity.Middleware()securityAudit.Loggerbind(getSecurity.Middleware())}}/**
 * Convenience function to apply all security middleware*/
export function applySecurity.Middleware(app: any) {
  // Use the lazy-initialized singleton instance;
  const security = getSecurity.Middleware()// Apply in order with timeout protection;
  try {
    appuse(securityipAccess.Control());
    appuse(securityrequestSize.Limit());
    appuse(securitygetHelmet.Middleware());
    appuse(securitygetCors.Middleware());
    appuse(securitygetExpressRate.Limiter());
    appuse(securitysanitize.Input());
    appuse(securitycsrf.Protection());
    appuse(securitysecurityAudit.Logger());
    loggerinfo('Security middleware applied successfully')} catch (error) {
    loggererror('Failed to apply security middleware', LogContextSECURIT.Y, {
      error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
    throw error instanceof Error ? errormessage : String(error)};

  return security};
