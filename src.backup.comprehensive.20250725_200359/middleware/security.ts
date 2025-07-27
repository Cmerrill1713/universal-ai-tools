import type { Next.Function, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rate.Limit from 'express-rate-limit';
import { Log.Context, logger } from './utils/enhanced-logger';
import { config } from './config/environment';
import { app.Config } from './config/index';
import { security.Hardening.Service } from './services/security-hardening';
import { create.Hash } from 'crypto';
export interface Security.Options {
  enable.Cors?: boolean;
  enable.Helmet?: boolean;
  enable.Rate.Limit?: boolean;
  enableC.S.P?: boolean;
  enableCS.R.F?: boolean;
  enableI.P.Whitelisting?: boolean;
  cors.Origins?: string[];
  rate.Limit.Window?: number;
  rate.Limit.Max?: number;
  ip.Whitelist?: string[];
  ip.Blacklist?: string[];
  request.Size.Limit?: string;
}
export interface Rate.Limit.Info {
  ip: string,
  requests: number,
  window.Start: number,
  blocked: boolean,
}
export class Security.Middleware {
  private rate.Limit.Map: Map<string, Rate.Limit.Info> = new Map();
  private blocked.I.Ps: Set<string> = new Set(),
  private whitelisted.I.Ps: Set<string> = new Set(),
  private csrf.Tokens: Map<string, { token: string; expires: number }> = new Map(),
  private options: Security.Options,
  constructor(options: Security.Options = {}) {
    thisoptions = {
      enable.Cors: true,
      enable.Helmet: true,
      enable.Rate.Limit: true,
      enableC.S.P: true,
      enableCS.R.F: true,
      enableI.P.Whitelisting: false,
      cors.Origins: configsecuritycors.Origins || [],
      rate.Limit.Window: 900000, // 15 minutes;
      rate.Limit.Max: 100, // 100 requests per window;
      ip.Whitelist: [],
      ip.Blacklist: [],
      request.Size.Limit: '10mb'.options,
    }// Initialize I.P lists;
    optionsip.Whitelist?for.Each((ip) => thiswhitelisted.I.Psadd(ip));
    optionsip.Blacklist?for.Each((ip) => thisblocked.I.Psadd(ip))// Cleanup expired CS.R.F tokens periodically with errorhandling;
    const cleanup.Interval = set.Interval(() => {
      try {
        thiscleanupCSR.F.Tokens()} catch (error) {
        loggererror('Error cleaning up CS.R.F tokens', LogContextSECURI.T.Y, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})}}, 3600000)// Every hour// Store interval reference for potential cleanup;
    (this as any)cleanup.Interval = cleanup.Interval}/**
   * CO.R.S middleware configuration*/
  public get.Cors.Middleware() {
    if (!thisoptionsenable.Cors) {
      return (req: Request, res: Response, next: Next.Function) => next(),

    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests);
        if (!origin) return callback(null, true)// Check if origin is in allowed list;
        if (thisoptionscors.Origins!includes(origin)) {
          return callback(null, true)}// REMOV.E.D: Localhost bypass for production security// All origins must be explicitly configured in CORS_ORIGI.N.S,

        return callback(new Error('Not allowed by CO.R.S'));
      credentials: true,
      options.Success.Status: 200,
      methods: ['G.E.T', 'PO.S.T', 'P.U.T', 'DELE.T.E', 'OPTIO.N.S'];
      allowed.Headers: [
        'Content-Type';
        'Authorization';
        'X-A.P.I-Key';
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
  public get.Helmet.Middleware() {
    if (!thisoptionsenable.Helmet) {
      return (req: Request, res: Response, next: Next.Function) => next(),

    return helmet({
      content.Security.Policy: thisoptionsenableC.S.P? {
            directives: {
              default.Src: ["'self'"],
              script.Src: [
                "'self'"// In production, use nonces or hashes for inline scripts// During development, we allow unsafe-inline but warn about it.(configserveris.Development ? ["'unsafe-inline'", "'unsafe-eval'"] : [])// Note: Nonces are handled dynamically via reslocalsnonce],
              style.Src: [
                "'self'"// In production, use nonces or hashes for inline styles// During development, we allow unsafe-inline but warn about it.(configserveris.Development ? ["'unsafe-inline'"] : [])// Allow specific trusted C.D.Ns;
                'https://fontsgoogleapiscom'// Note: Nonces are handled dynamically via reslocalsnonce],
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
                'https://generativelanguagegoogleapiscom'// Only allow local connections in development.(configserveris.Development? [appConfiglocalL.L.Mollamaurl, 'ws://localhost:*', 'http://localhost:*']: [])];
              media.Src: ["'self'", 'blob:'];
              object.Src: ["'none'"],
              base.Uri: ["'self'"],
              form.Action: ["'self'"],
              frame.Ancestors: ["'none'"],
              worker.Src: ["'self'", 'blob:'].(configserveris.Production && { upgrade.Insecure.Requests: [] }),
            report.Only: false, // Enforce C.S.P in production}: false;
      crossOrigin.Embedder.Policy: false,
      hsts: {
        max.Age: 31536000,
        include.Sub.Domains: true,
        preload: true,
}      no.Sniff: true,
      origin.Agent.Cluster: true,
      permittedCross.Domain.Policies: false,
      referrer.Policy: { policy: 'strict-origin-when-cross-origin' ,
      xss.Filter: true})}/**
   * Security headers middleware (legacy, use get.Helmet.Middleware instead)* Also adds nonce generation for C.S.P*/
  public security.Headers() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Generate nonce for C.S.P if in production;
      if (configserveris.Production && thisoptionsenableC.S.P) {
        const nonce = create.Hash('sha256');
          update(Date.now() + Mathrandom()to.String());
          digest('base64');
          slice(0, 16);
        reslocalsnonce = nonce}// Apply additional security headers;
      resset.Header('X-Frame-Options', 'DE.N.Y');
      resset.Header('X-Content-Type-Options', 'nosniff');
      resset.Header('X-X.S.S-Protection', '1; mode=block');
      resset.Header('X-Download-Options', 'noopen');
      resset.Header('X-Permitted-Cross-Domain-Policies', 'none');
      resset.Header('Referrer-Policy', 'strict-origin-when-cross-origin');
      resset.Header(
        'Permissions-Policy';
        'camera=(), microphone=(), geolocation=(), interest-cohort=()')// Apply Helmet middleware;
      const helmet.Middleware = thisget.Helmet.Middleware();
      helmet.Middleware(req, res, next)}}/**
   * Generate Content Security Policy* NO.T.E: This method is deprecated. C.S.P is now handled by Helmet middleware.
   * @deprecated Use get.Helmet.Middleware() instead*/
  private generateC.S.P(): string {
    loggerwarn(
      'generateC.S.P() is deprecated. Use get.Helmet.Middleware() for C.S.P configuration';
      LogContextSECURI.T.Y);
    const csp.Directives = [
      "default-src 'self'";
      "script-src 'self'", // Removed unsafe-inline and unsafe-eval for security;
      "style-src 'self'", // Removed unsafe-inline for security;
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https:",
      "connect-src 'self' https://apiopenaicom https://apianthropiccom https://*supabaseco wss://*supabaseco";
      "media-src 'self' blob:";
      "object-src 'none'";
      "base-uri 'self'";
      "form-action 'self'";
      "frame-ancestors 'none'";
      "worker-src 'self' blob:".(configserveris.Production ? ['upgrade-insecure-requests'] : [])];
    return csp.Directivesjoin('; ')}/**
   * Get express-rate-limit middleware*/
  public getExpress.Rate.Limiter() {
    if (!thisoptionsenable.Rate.Limit) {
      return (req: Request, res: Response, next: Next.Function) => next(),

    return rate.Limit({
      window.Ms: thisoptionsrate.Limit.Window!
      max: thisoptionsrate.Limit.Max!
      standard.Headers: true,
      legacy.Headers: false,
      handler: (req, res) => {
        const ip = thisgetClient.I.P(req);
        loggerwarn(`Rate limit exceeded for I.P: ${ip}`, LogContextSECURI.T.Y, {
          ip;
          endpoint: reqoriginal.Url,
          user.Agent: reqheaders['user-agent']}),
        resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'Rate limit exceeded';
          message: 'Too many requests from this I.P',
          retry.After: Mathceil(thisoptionsrate.Limit.Window! / 1000)}),
      skip: (req) => {
        const ip = thisgetClient.I.P(req);
        return thiswhitelisted.I.Pshas(ip)}})}/**
   * Enhanced rate limiting middleware with per-endpoint limits*/
  public getEndpoint.Rate.Limiter(endpoint: string, max = 10, window.Ms = 60000) {
    return rate.Limit({
      window.Ms;
      max;
      key.Generator: (req) => `${thisgetClient.I.P(req)}:${endpoint}`,
      standard.Headers: true,
      legacy.Headers: false,
      handler: (req, res) => {
        loggerwarn(`Endpoint rate limit exceeded`, LogContextSECURI.T.Y, {
          ip: thisgetClient.I.P(req),
          endpoint;
          user.Agent: reqheaders['user-agent']}),
        resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'Endpoint rate limit exceeded';
          message: `Too many requests to ${endpoint}`,
          retry.After: Mathceil(window.Ms / 1000)})}})}/**
   * Rate limiting middleware (legacy)*/
  public rate.Limit() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!thisoptionsenable.Rate.Limit) {
        return next();

      const ip = thisgetClient.I.P(req)// Check if I.P is blocked;
      if (thisblocked.I.Pshas(ip)) {
        return resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'I.P blocked';
          message: 'Your I.P has been temporarily blocked due to excessive requests',
          retry.After: 3600, // 1 hour});

      const now = Date.now();
      const window.Start = now - thisoptionsrate.Limit.Window!// Get or create rate limit info for this I.P;
      let rate.Limit.Info = thisrate.Limit.Mapget(ip);
      if (!rate.Limit.Info || rateLimit.Infowindow.Start < window.Start) {
        rate.Limit.Info = {
          ip;
          requests: 1,
          window.Start: now,
          blocked: false,
}        thisrate.Limit.Mapset(ip, rate.Limit.Info)} else {
        rate.Limit.Inforequests++}// Check if limit exceeded;
      if (rate.Limit.Inforequests > thisoptionsrate.Limit.Max!) {
        rate.Limit.Infoblocked = true;
        thisblocked.I.Psadd(ip)// Log rate limit violation;
        loggerwarn(`Rate limit exceeded for I.P: ${ip}`, LogContextSECURI.T.Y, {
          ip;
          requests: rate.Limit.Inforequests,
          limit: thisoptionsrate.Limit.Max,
          endpoint: reqoriginal.Url,
          user.Agent: reqheaders['user-agent']}),
        return resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'Rate limit exceeded';
          message: 'Too many requests from this I.P',
          retry.After: Mathceil(thisoptionsrate.Limit.Window! / 1000),
          limit: thisoptionsrate.Limit.Max,
          requests: rate.Limit.Inforequests})}// Set rate limit headers,
      const remaining = Math.max(0, thisoptionsrate.Limit.Max! - rate.Limit.Inforequests);
      const reset.Time = Mathceil(
        (rateLimit.Infowindow.Start + thisoptionsrate.Limit.Window!) / 1000);
      resset({
        'X-Rate.Limit-Limit': thisoptionsrate.Limit.Max!to.String();
        'X-Rate.Limit-Remaining': remainingto.String();
        'X-Rate.Limit-Reset': reset.Timeto.String()});
      next()}}/**
   * Get client I.P address*/
  private getClient.I.P(req: Request): string {
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
          reqquery = JS.O.N.parse(securityHardening.Servicesanitize.Input(JS.O.N.stringify(reqquery)))}// Sanitize body;
        if (reqbody) {
          reqbody = JS.O.N.parse(securityHardening.Servicesanitize.Input(JS.O.N.stringify(reqbody)))}// Sanitize parameters;
        if (reqparams) {
          reqparams = JS.O.N.parse(
            securityHardening.Servicesanitize.Input(JS.O.N.stringify(reqparams)))}// Sanitize headers;
        const dangerous.Headers = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
        dangerous.Headersfor.Each((header) => {
          if (reqheaders[header]) {
            delete reqheaders[header]}});
        next()} catch (error) {
        loggererror('Input sanitization error', LogContextSECURI.T.Y, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error);
          stack: error instanceof Error ? errorstack : undefined}),
        resstatus(400)json({
          error instanceof Error ? errormessage : String(error) 'Invalid input';
          message: 'Request contains invalid or malicious content'})}}}/**
   * Sanitize object recursively*/
  private sanitize.Object(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;

    if (typeof obj === 'string') {
      return thissanitize.String(obj);

    if (Array.is.Array(obj)) {
      return objmap((item) => thissanitize.Object(item));

    if (typeof obj === 'object') {
      const sanitized: any = {,
      for (const [key, value] of Objectentries(obj)) {
        const sanitized.Key = thissanitize.String(key);
        sanitized[sanitized.Key] = thissanitize.Object(value);
      return sanitized;

    return obj}/**
   * Sanitize string input*/
  private sanitize.String(str: string): string {
    if (typeof str !== 'string') {
      return str}// Remove null bytes;
    str = strreplace(/\0/g, '')// Remove control characters except tab, newline, carriage return;
    str = strreplace(/[\x00-\x08\x0.B\x0.C\x0.E-\x1.F\x7.F]/g, '')// Limit string length;
    if (strlength > 10000) {
      str = strsubstring(0, 10000);

    return str}/**
   * Request logging middleware*/
  public request.Logger() {
    return (req: Request, res: Response, next: Next.Function) => {
      const start.Time = Date.now();
      const ip = thisgetClient.I.P(req)// Log request;
      loggerinfo('Incoming request LogContextHT.T.P, {
        method: reqmethod,
        url: reqoriginal.Url,
        ip;
        user.Agent: reqheaders['user-agent'],
        content.Length: reqheaders['content-length'],
        timestamp: new Date()toIS.O.String()})// Log response,
      const original.Send = ressend;
      ressend = function (data) {
        const duration = Date.now() - start.Time;
        loggerinfo('Request completed', LogContextHT.T.P, {
          method: reqmethod,
          url: reqoriginal.Url,
          status.Code: resstatus.Code,
          duration;
          ip;
          response.Size: data ? datalength : 0}),
        return original.Sendcall(this, data);
      next()}}/**
   * Cleanup expired rate limit entries*/
  public cleanup.Rate.Limits(): void {
    const now = Date.now();
    const cutoff = now - thisoptionsrate.Limit.Window!
    for (const [ip, info] of thisrate.Limit.Mapentries()) {
      if (infowindow.Start < cutoff) {
        thisrate.Limit.Mapdelete(ip);
        thisblocked.I.Psdelete(ip)}}}/**
   * Get rate limit statistics*/
  public getRate.Limit.Stats(): {
    total.I.Ps: number,
    blocked.I.Ps: number,
    active.Windows: number} {
    return {
      total.I.Ps: thisrate.Limit.Mapsize,
      blocked.I.Ps: thisblocked.I.Pssize,
      active.Windows: Arrayfrom(thisrate.Limit.Mapvalues())filter(
        (info) => infowindow.Start > Date.now() - thisoptionsrate.Limit.Window!)length;
    }}/**
   * Manually block an I.P*/
  public block.I.P(ip: string): void {
    thisblocked.I.Psadd(ip);
    loggerwarn(`I.P manually blocked: ${ip}`)}/**
   * Manually unblock an I.P*/
  public unblock.I.P(ip: string): void {
    thisblocked.I.Psdelete(ip);
    thisrate.Limit.Mapdelete(ip);
    loggerinfo(`I.P unblocked: ${ip}`)}/**
   * CS.R.F protection middleware*/
  public csrf.Protection() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!thisoptionsenableCS.R.F) {
        return next()}// Skip CS.R.F for safe methods;
      if (['G.E.T', 'HE.A.D', 'OPTIO.N.S']includes(reqmethod)) {
        return next();

      const token = reqheaders['x-csrf-token'] as string;
      const session.Id = (reqheaders['x-session-id'] as string) || thisgetClient.I.P(req);
      if (!token) {
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'CS.R.F token missing';
          message: 'Request requires CS.R.F token'}),

      const stored.Token = thiscsrf.Tokensget(session.Id);
      if (!stored.Token || stored.Tokentoken !== token || stored.Tokenexpires < Date.now()) {
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'Invalid CS.R.F token';
          message: 'CS.R.F token is invalid or expired'}),

      next()}}/**
   * Generate CS.R.F token*/
  public generateCSR.F.Token(session.Id: string): string {
    const token = create.Hash('sha256');
      update(session.Id + Date.now() + Mathrandom());
      digest('hex');
    thiscsrf.Tokensset(session.Id, {
      token;
      expires: Date.now() + 3600000, // 1 hour});
    return token}/**
   * I.P-based access control*/
  public ip.Access.Control() {
    return (req: Request, res: Response, next: Next.Function) => {
      const ip = thisgetClient.I.P(req)// Check blacklist first;
      if (thisblocked.I.Pshas(ip)) {
        loggerwarn(`Blocked I.P attempted access: ${ip}`),
        return resstatus(403)json({
          error instanceof Error ? errormessage : String(error) 'Access denied';
          message: 'Your I.P address is blocked'})}// Check whitelist if enabled,
      if (thisoptionsenableI.P.Whitelisting && thiswhitelisted.I.Pssize > 0) {
        if (!thiswhitelisted.I.Pshas(ip)) {
          loggerwarn(`Non-whitelisted I.P attempted access: ${ip}`),
          return resstatus(403)json({
            error instanceof Error ? errormessage : String(error) 'Access denied';
            message: 'Your I.P address is not authorized'})},

      next()}}/**
   * Request size limiting*/
  public request.Size.Limit() {
    return (req: Request, res: Response, next: Next.Function) => {
      const content.Length = reqheaders['content-length'];
      if (!content.Length) {
        return next();

      const max.Size = thisparse.Size(thisoptionsrequest.Size.Limit!);
      const size = parse.Int(content.Length, 10);
      if (size > max.Size) {
        return resstatus(413)json({
          error instanceof Error ? errormessage : String(error) 'Payload too large';
          message: `Request size ${size} exceeds limit of ${max.Size} bytes`}),

      next()}}/**
   * Parse size string to bytes*/
  private parse.Size(size: string): number {
    const units: { [key: string]: number } = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
}    const match = sizeto.Lower.Case()match(/^(\d+)([a-z]+)$/);
    if (!match) {
      return parse.Int(size, 10);

    const [ num, unit] = match;
    return parse.Int(num, 10) * (units[unit] || 1)}/**
   * Cleanup expired CS.R.F tokens*/
  private cleanupCSR.F.Tokens(): void {
    const now = Date.now();
    for (const [session.Id, token] of thiscsrf.Tokensentries()) {
      if (tokenexpires < now) {
        thiscsrf.Tokensdelete(session.Id)}}}/**
   * Security audit logging*/
  public security.Audit.Logger() {
    return (req: Request, res: Response, next: Next.Function) => {
      const ip = thisgetClient.I.P(req);
      const start.Time = Date.now()// Log security-relevant requestdetails;
      const security.Log = {
        timestamp: new Date()toIS.O.String(),
        ip;
        method: reqmethod,
        url: reqoriginal.Url,
        user.Agent: reqheaders['user-agent'],
        referer: reqheaders['referer'],
        content.Type: reqheaders['content-type'],
        authentication: reqheaders['authorization'] ? 'present' : 'none',
        api.Key: reqheaders['x-api-key'] ? 'present' : 'none'}// Log response,
      const original.Send = ressend;
      ressend = function (data) {
        const duration = Date.now() - start.Time// Log security events;
        if (resstatus.Code === 401 || resstatus.Code === 403) {
          loggerwarn('Security event: Authentication/Authorization failure', LogContextSECURI.T.Y, {
            .security.Log;
            status.Code: resstatus.Code,
            duration})} else if (resstatus.Code === 429) {
          loggerwarn('Security event: Rate limit exceeded', LogContextSECURI.T.Y, {
            .security.Log;
            status.Code: resstatus.Code,
            duration})} else if (resstatus.Code >= 400) {
          loggerinfo('Security event: Client error instanceof Error ? errormessage : String(error)  LogContextSECURI.T.Y, {
            .security.Log;
            status.Code: resstatus.Code,
            duration});

        return original.Sendcall(this, data);
      next()}};

export default Security.Middleware/**
 * Pre-configured security middleware instance (lazy initialization)*/
let _security.Middleware: Security.Middleware | null = null,
export function get.Security.Middleware(): Security.Middleware {
  if (!_security.Middleware) {
    _security.Middleware = new Security.Middleware();
  return _security.Middleware}// For backward compatibility;
export const security.Middleware = {
  get ip.Access.Control() {
    return get.Security.Middleware()ip.Access.Controlbind(get.Security.Middleware());
  get request.Size.Limit() {
    return get.Security.Middleware()request.Size.Limitbind(get.Security.Middleware());
  get get.Helmet.Middleware() {
    return get.Security.Middleware()get.Helmet.Middlewarebind(get.Security.Middleware());
  get get.Cors.Middleware() {
    return get.Security.Middleware()get.Cors.Middlewarebind(get.Security.Middleware());
  get getExpress.Rate.Limiter() {
    return get.Security.Middleware()getExpress.Rate.Limiterbind(get.Security.Middleware());
  get sanitize.Input() {
    return get.Security.Middleware()sanitize.Inputbind(get.Security.Middleware());
  get csrf.Protection() {
    return get.Security.Middleware()csrf.Protectionbind(get.Security.Middleware());
  get security.Audit.Logger() {
    return get.Security.Middleware()security.Audit.Loggerbind(get.Security.Middleware())}}/**
 * Convenience function to apply all security middleware*/
export function apply.Security.Middleware(app: any) {
  // Use the lazy-initialized singleton instance;
  const security = get.Security.Middleware()// Apply in order with timeout protection;
  try {
    appuse(securityip.Access.Control());
    appuse(securityrequest.Size.Limit());
    appuse(securityget.Helmet.Middleware());
    appuse(securityget.Cors.Middleware());
    appuse(securitygetExpress.Rate.Limiter());
    appuse(securitysanitize.Input());
    appuse(securitycsrf.Protection());
    appuse(securitysecurity.Audit.Logger());
    loggerinfo('Security middleware applied successfully')} catch (error) {
    loggererror('Failed to apply security middleware', LogContextSECURI.T.Y, {
      error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
    throw error instanceof Error ? errormessage : String(error);

  return security;
