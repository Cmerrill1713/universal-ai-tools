import type { Application, Next.Function, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import { Log.Context, logger } from './utils/enhanced-logger';
import { config } from './config/environment';
import { Rate.Limiter, SupabaseRate.Limit.Store } from './rate-limiter';
import { CSR.F.Protection } from './csrf';
import { SQL.Injection.Protection } from './sql-injection-protection';
import { JWT.Auth.Service } from './auth-jwt';
import { Auth.Middleware } from './auth';
import { Comprehensive.Validation.Middleware } from './comprehensive-validation';
import type { Supabase.Client } from '@supabase/supabase-js';
export interface Security.Config {
  enable.Helmet?: boolean;
  enableCO.R.S?: boolean;
  enable.Rate.Limit?: boolean;
  enableCS.R.F?: boolean;
  enableSQ.L.Protection?: boolean;
  enableHTT.P.S?: boolean;
  enableHS.T.S?: boolean;
  enable.Auth?: boolean;
  enable.Input.Validation?: boolean;
  cors.Options?: cors.Cors.Options;
  trusted.Proxies?: string[];
}
export class Enhanced.Security.Middleware {
  private rate.Limiter: Rate.Limiter,
  private csrf.Protection: CSR.F.Protection,
  private sql.Protection: SQL.Injection.Protection,
  private jwt.Auth: JWT.Auth.Service,
  private auth.Middleware: Auth.Middleware,
  private validation.Middleware: Comprehensive.Validation.Middleware,
  private config: Required<Security.Config>
  constructor(supabase: Supabase.Client, config: Security.Config = {}) {
    thisconfig = {
      enable.Helmet: configenable.Helmet ?? true,
      enableCO.R.S: configenableCO.R.S ?? true,
      enable.Rate.Limit: configenable.Rate.Limit ?? true,
      enableCS.R.F: configenableCS.R.F ?? true,
      enableSQ.L.Protection: configenableSQ.L.Protection ?? true,
      enableHTT.P.S: configenableHTT.P.S ?? process.envNODE_E.N.V === 'production',
      enableHS.T.S: configenableHS.T.S ?? process.envNODE_E.N.V === 'production',
      enable.Auth: configenable.Auth ?? true,
      enable.Input.Validation: configenable.Input.Validation ?? true,
      cors.Options: configcors.Options || thisgetDefault.Cors.Options(),
      trusted.Proxies: configtrusted.Proxies || ['127.0.0.1', ': :1'];
    }// Initialize security components with production-ready stores;
    thisrate.Limiter = new Rate.Limiter();
      process.envNODE_E.N.V === 'production' ? new SupabaseRate.Limit.Store(supabase) : undefined // Use default memory store in development);
    thiscsrf.Protection = new CSR.F.Protection();
    thissql.Protection = new SQL.Injection.Protection();
    thisjwt.Auth = new JWT.Auth.Service(supabase);
    thisauth.Middleware = new Auth.Middleware(supabase);
    thisvalidation.Middleware = new Comprehensive.Validation.Middleware();
  }/**
   * Apply all security middleware to Express app*/
  public apply.To(app: Application): void {
    // Trust proxies;
    appset('trust proxy', thisconfigtrusted.Proxies)// Apply security headers with Helmet;
    if (thisconfigenable.Helmet) {
      app.use(thisget.Helmet.Config())}// Apply CO.R.S;
    if (thisconfigenableCO.R.S) {
      app.use(cors(thisconfigcors.Options))}// Apply custom security headers;
    app.use(thissecurity.Headers())// Apply HTT.P.S.enforcement;
    if (thisconfigenableHTT.P.S) {
      app.use(thisenforceHTT.P.S())}// Apply S.Q.L.injection protection;
    if (thisconfigenableSQ.L.Protection) {
      app.use(thissql.Protectionmiddleware())}// Apply global _inputvalidation;
    if (thisconfigenable.Input.Validation) {
      app.use(
        thisvalidation.Middlewarevalidate({
          enableSQ.L.Protection: false, // Already applied above;
          enable.Sanitization: true,
          enable.Size.Limit: true}))}// Apply rate limiting,
    if (thisconfigenable.Rate.Limit) {
      thisapply.Rate.Limiting(app)}// Apply CS.R.F.protection;
    if (thisconfigenableCS.R.F) {
      app.use(thiscsrf.Protectioninject.Token())}// Log security middleware applied;
    loggerinfo('Enhanced security middleware applied', LogContextSECURI.T.Y, {
      features: {
        helmet: thisconfigenable.Helmet,
        cors: thisconfigenableCO.R.S,
        rate.Limit: thisconfigenable.Rate.Limit,
        csrf: thisconfigenableCS.R.F,
        sql.Protection: thisconfigenableSQ.L.Protection,
        input.Validation: thisconfigenable.Input.Validation,
        https: thisconfigenableHTT.P.S,
        hsts: thisconfigenableHS.T.S,
        auth: thisconfigenable.Auth,
      }})}/**
   * Get environment-aware Helmet configuration with production-ready C.S.P*/
  private get.Helmet.Config() {
    const { is.Production } = configserver;
    return helmet({
      content.Security.Policy: {
        directives: {
          default.Src: ["'self'"],
          script.Src: [
            "'self'"// Production: Use nonces and specific hashes only// Development: Allow unsafe for easier development.(is.Production? [
                  // Add specific trusted script hashes here as needed// "'sha256-HASH_OF_TRUSTED_SCRI.P.T'"]: [
                  "'unsafe-inline'", // Development only;
                  "'unsafe-eval'", // Development only])];
          style.Src: [
            "'self'"// Production: Use nonces and specific hashes only// Development: Allow unsafe for easier development.(is.Production? [
                  // Add specific trusted style hashes here as needed;
                  "'sha256-HASH_OF_TRUSTED_STY.L.E'"]: [
                  "'unsafe-inline'", // Development only])// Always allow trusted C.D.Ns;
            'https://fontsgoogleapiscom'];
          img.Src: ["'self'", 'data:', 'https:', 'blob:'];
          font.Src: ["'self'", 'data:', 'https://fontsgstaticcom', 'https://fontsgoogleapiscom'];
          connect.Src: [
            "'self'"// Always allowed A.P.I.endpoints;
            'https://apiopenaicom';
            'https://apianthropiccom';
            'https://apigroqcom';
            'https://generativelanguagegoogleapiscom';
            'https://*supabaseco';
            'wss://*supabaseco'// Development only endpoints.(is.Production? []: [
                  'http://localhost:*';
                  'ws://localhost:*';
                  'http://127.0.0.1:*';
                  'ws://127.0.0.1:*'])];
          media.Src: ["'self'", 'blob:', 'data:'];
          object.Src: ["'none'"],
          base.Uri: ["'self'"],
          form.Action: ["'self'"],
          frame.Ancestors: ["'none'"],
          worker.Src: ["'self'", 'blob:'];
          child.Src: ["'self'", 'blob:'];
          manifest.Src: ["'self'"].(thisconfigenableHTT.P.S && { upgrade.Insecure.Requests: [] }),
        report.Only: false, // Always enforce C.S.P;
      crossOrigin.Embedder.Policy: is.Production, // Enable in production only;
      crossOrigin.Opener.Policy: { policy: 'same-origin' ,
      crossOrigin.Resource.Policy: { policy: is.Production ? 'same-origin' : 'cross-origin' ,
      dns.Prefetch.Control: { allow: false ,
      frameguard: { action: 'deny' ,
      hide.Powered.By: true,
      hsts: thisconfigenableHS.T.S? {
            max.Age: 31536000, // 1 year;
            include.Sub.Domains: true,
            preload: true,
          }: false;
      ie.No.Open: true,
      no.Sniff: true,
      origin.Agent.Cluster: true,
      permittedCross.Domain.Policies: false,
      referrer.Policy: { policy: 'strict-origin-when-cross-origin' ,
      xss.Filter: true})}/**
   * Get environment-aware CO.R.S.options*/
  private getDefault.Cors.Options(): cors.Cors.Options {
    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl) only in development;
        if (!origin) {
          if (configserveris.Development) {
            loggerwarn(
              'CO.R.S: Allowing requestwith no origin (development mode)',
              LogContextSECURI.T.Y);
            return callback(null, true)} else {
            loggerwarn(
              'CO.R.S: Rejecting requestwith no origin (production mode)',
              LogContextSECURI.T.Y);
            return callback(new Error('Origin header required in production'))}}// Get allowed origins from configuration;
        const allowed.Origins = configsecuritycors.Origins;
        loggerdebug('CO.R.S: Checking origin against allowed list', LogContextSECURI.T.Y, {
          origin;
          allowed.Origins;
          environment: configserverenv}),
        if (allowed.Origins.includes(origin)) {
          return callback(null, true)}// In development, log warning but allow localhost;
        if (
          configserveris.Development &&
          (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
          loggerwarn('CO.R.S: Allowing localhost origin in development mode', LogContextSECURI.T.Y, {
            origin});
          return callback(null, true)}// Reject all other origins;
        loggerwarn('CO.R.S: Origin not allowed', LogContextSECURI.T.Y, { origin, allowed.Origins });
        callback(new Error(`Origin ${origin} not allowed by CO.R.S.policy`));
      credentials: true,
      methods: ['G.E.T', 'PO.S.T', 'P.U.T', 'DELE.T.E', 'OPTIO.N.S', 'PAT.C.H'];
      allowed.Headers: [
        'Content-Type';
        'Authorization';
        'X-A.P.I-Key';
        'X-CS.R.F-Token';
        'X-Requested-With';
        'Accept';
        'Accept-Language';
        'Content-Language';
        'Origin';
        'Referer';
        'User-Agent'];
      exposed.Headers: [
        'X-Rate.Limit-Limit';
        'X-Rate.Limit-Remaining';
        'X-Rate.Limit-Reset';
        'X-Response-Time';
        'X-Request-I.D';
        'X-A.P.I-Version'];
      max.Age: configserveris.Production ? 86400 : 300, // 24 hours in prod, 5 minutes in dev;
      preflight.Continue: false,
      options.Success.Status: 200,
    }}/**
   * Enhanced security headers with environment awareness*/
  private security.Headers() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add request.I.D.for tracking;
      const request.Id = thisgenerate.Request.Id();
      (req as any)id = request.Id;
      resset('X-Request-I.D', request.Id)// Generate nonce for C.S.P.if needed;
      if (configserveris.Production) {
        const nonce = cryptorandom.Bytes(16)to.String('base64');
        reslocalsnonce = nonce}// Production-ready security headers;
      const security.Headers: Record<string, string> = {
        'X-X.S.S-Protection': '1; mode=block';
        'X-Content-Type-Options': 'nosniff';
        'X-Frame-Options': 'DE.N.Y';
        'X-Download-Options': 'noopen';
        'X-Permitted-Cross-Domain-Policies': 'none';
        'Referrer-Policy': 'strict-origin-when-cross-origin';
        'Permissions-Policy':
          'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()';
        'X-D.N.S-Prefetch-Control': 'off';
        'X-Robots-Tag': 'noindex, nofollow, nosnippet, noarchive'}// Production-specific headers;
      if (configserveris.Production) {
        security.Headers['Strict-Transport-Security'] =
          'max-age=31536000; include.Sub.Domains; preload';
        security.Headers['Expect-C.T'] = 'enforce, max-age=86400';
        security.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
        security.Headers['Pragma'] = 'no-cache';
        security.Headers['Expires'] = '0';
        security.Headers['Surrogate-Control'] = 'no-store'} else {
        // Development-specific headers;
        security.Headers['Cache-Control'] = 'no-cache'}// Apply all headers;
      resset(security.Headers)// Remove insecure headers that might reveal server information;
      resremove.Header('X-Powered-By');
      resremove.Header('Server');
      resremove.Header('X-Asp.Net-Version');
      resremove.Header('X-Asp.Net.Mvc-Version');
      next()}}/**
   * Environment-aware HTT.P.S.enforcement*/
  private enforceHTT.P.S() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Skip HTT.P.S.enforcement in development to allow local testing;
      if (configserveris.Development) {
        loggerdebug('HTT.P.S.enforcement skipped in development mode', LogContextSECURI.T.Y);
        return next()}// In production, enforce HTT.P.S;
      if (reqsecure || req.headers['x-forwarded-proto'] === 'https') {
        return next()}// Reject non-HTT.P.S.requests in production;
      if (configserveris.Production) {
        loggerwarn('Non-HTT.P.S.requestrejected in production', LogContextSECURI.T.Y, {
          url: requrl,
          headers: {
            host: req.headershost,
            'x-forwarded-proto': req.headers['x-forwarded-proto'];
            'user-agent': req.headers['user-agent'];
          }});
        return res.status(426)json({
          error instanceof Error ? error.message : String(error) 'HTT.P.S.Required';
          message: 'This server requires all requests to be made over HTT.P.S',
          code: 'HTTPS_REQUIR.E.D'})}// Fallback: redirect to HTT.P.S (for staging environments),
      const https.Url = `https://${req.headershost}${requrl}`;
      loggerinfo('Redirecting to HTT.P.S', LogContextSECURI.T.Y, { from: requrl, to: https.Url }),
      resredirect(301, https.Url)}}/**
   * Apply rate limiting to different endpoint categories*/
  private apply.Rate.Limiting(app: Application): void {
    // Global rate limit (applies to all endpoints);
    app.use(thisrate.Limiterlimit('authenticated'))// Authentication & Security endpoints - Strict limits;
    app.use('/api/auth/*', thisrate.Limiterlimit('auth'));
    app.use('/api/register', thisrate.Limiterlimit('auth'));
    app.use('/api/password-reset', thisrate.Limiterlimit('password-reset'));
    app.use('/api/keys/generate', thisrate.Limiterlimit('api-key-generation'))// A.I.Processing endpoints - Moderate limits to prevent abuse;
    app.use(
      '/api/ai-services/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 A.I.requests per 15 minutes}));
    app.use(
      '/api/dspy/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 D.S.Py.requests per 15 minutes}));
    app.use(
      '/api/athena-tools/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 Athena tool requests per 15 minutes}));
    app.use(
      '/api/sweet-athena/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 200, // 200 Sweet Athena requests per 15 minutes}))// Tool execution - Restricted due to security implications;
    app.use(
      '/api/tools/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 50, // 50 tool executions per hour}))// Filesystem operations - High security risk;
    app.use(
      '/api/filesystem/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 200, // 200 filesystem operations per hour}))// File upload/download operations;
    app.use(
      '/api/upload';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 100, // 100 uploads per hour}));
    app.use(
      '/api/backup/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 10, // 10 backup operations per hour}))// Data management endpoints;
    app.use(
      '/api/widgets/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 200, // 200 widget operations per 15 minutes}));
    app.use(
      '/api/memory/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 300, // 300 memory operations per 15 minutes}));
    app.use(
      '/api/knowledge/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 500, // 500 knowledge operations per 15 minutes}));
    app.use(
      '/api/knowledge-monitoring/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 monitoring requests per 15 minutes}))// M.C.P.and external integrations - Moderate limits;
    app.use(
      '/api/mcp/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 M.C.P.requests per 15 minutes}))// Speech processing - Moderate limits;
    app.use(
      '/api/speech/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 speech processing requests per 15 minutes}))// Orchestration and agent coordination - Moderate limits;
    app.use(
      '/api/orchestration/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 orchestration requests per 15 minutes}))// Heavy computational operations - Strict limits;
    app.use(
      '/api/export';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 10, // 10 exports per hour}));
    app.use(
      '/api/import';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 10, // 10 imports per hour}))// System health and monitoring - Lenient limits for operational visibility;
    app.use(
      '/api/health/*';
      thisrate.Limiterlimit({
        window.Ms: 5 * 60 * 1000, // 5 minutes;
        max: 100, // 100 health checks per 5 minutes}))// A.I-powered widget and contentgeneration - Moderate limits due to computational cost;
    app.use(
      '/api/widget-creation/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 30, // 30 widget creations per hour}));
    app.use(
      '/api/natural-language-widgets/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 50, // 50 natural language widget operations per hour}))// Advanced A.I.processing endpoints - Strict limits due to high computational cost;
    app.use(
      '/api/enhanced-supabase/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 100, // 100 enhanced operations per hour}));
    app.use(
      '/api/pydantic-ai/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 Pydantic A.I.requests per 15 minutes}));
    app.use(
      '/api/alpha-evolve/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 20, // 20 evolution operations per hour (very computationally expensive)}))// Security reporting endpoints - Moderate limits;
    app.use(
      '/api/security-reports/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 security report requests per 15 minutes}))// Additional data processing endpoints;
    app.use(
      '/api/dspy-widgets/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 D.S.Py.widget operations per 15 minutes}));
    app.use(
      '/api/enhanced-context/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 200, // 200 context operations per 15 minutes}))// Agent and automation endpoints;
    app.use(
      '/api/agents/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 150, // 150 agent operations per 15 minutes}));
    app.use(
      '/api/autofix/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 50, // 50 autofix operations per hour}));
    loggerinfo('Comprehensive rate limiting applied to all A.P.I.endpoints', LogContextSECURI.T.Y, {
      total.Endpoints.Protected: 29,
      endpoints.Protected: [
        'auth';
        'ai-services';
        'dspy';
        'athena-tools';
        'sweet-athena';
        'tools';
        'filesystem';
        'widgets';
        'memory';
        'knowledge';
        'knowledge-monitoring';
        'mcp';
        'speech';
        'orchestration';
        'backup';
        'health';
        'upload';
        'export';
        'import';
        'widget-creation';
        'natural-language-widgets';
        'enhanced-supabase';
        'pydantic-ai';
        'alpha-evolve';
        'security-reports';
        'dspy-widgets';
        'enhanced-context';
        'agents';
        'autofix']})}/**
   * Generate unique request.I.D*/
  private generate.Request.Id(): string {
    return `${Date.now()}-${Mathrandom()to.String(36)substr(2, 9)}`}/**
   * Get authentication middleware*/
  public get.Auth.Middleware(options?: any) {
    if (thisconfigenable.Auth) {
      return thisauth.Middlewareauthenticate(options);
    return (req: Request, res: Response, next: Next.Function) => next()}/**
   * Get J.W.T.authentication middleware*/
  public getJW.T.Middleware(options?: any) {
    if (thisconfigenable.Auth) {
      return thisjwt.Authauthenticate(options);
    return (req: Request, res: Response, next: Next.Function) => next()}/**
   * Get CS.R.F.middleware for specific routes*/
  public getCSR.F.Middleware() {
    if (thisconfigenableCS.R.F) {
      return thiscsrf.Protectionmiddleware();
    return (req: Request, res: Response, next: Next.Function) => next()}/**
   * Get rate limiter for custom limits*/
  public get.Rate.Limiter() {
    return thisrate.Limiter}/**
   * Get J.W.T.auth service*/
  public getJW.T.Service() {
    return thisjwt.Auth}/**
   * Security status endpoint handler*/
  public get.Security.Status() {
    return async (req: Request, res: Response) => {
      const rate.Limit.Stats = await thisrate.Limiterget.Stats();
      const sql.Protection.Stats = thissql.Protectionget.Stats();
      res.json({
        status: 'operational',
        features: {
          helmet: thisconfigenable.Helmet,
          cors: thisconfigenableCO.R.S,
          rate.Limit: thisconfigenable.Rate.Limit,
          csrf: thisconfigenableCS.R.F,
          sql.Protection: thisconfigenableSQ.L.Protection,
          https: thisconfigenableHTT.P.S,
          hsts: thisconfigenableHS.T.S,
          auth: thisconfigenable.Auth,
}        stats: {
          rate.Limit: rate.Limit.Stats,
          sql.Protection: sql.Protection.Stats,
}        timestamp: new Date()toIS.O.String()})}}/**
   * Apply security patches for known vulnerabilities*/
  public apply.Security.Patches(app: Application): void {
    // Prevent HT.T.P.Parameter Pollution;
    app.use((req: Request, res: Response, next: Next.Function) => {
      for (const key in req.query) {
        if (Array.is.Array(req.query[key])) {
          req.query[key] = (req.query[key] as string[])[0];
        };
      next()})// Prevent clickjacking with additional headers;
    app.use((req: Request, res: Response, next: Next.Function) => {
      resset.Header('X-Frame-Options', 'DE.N.Y');
      resset.Header('Content-Security-Policy', "frame-ancestors 'none'");
      next()})// Add security monitoring;
    app.use((req: Request, res: Response, next: Next.Function) => {
      const start = Date.now();
      reson('finish', () => {
        const duration = Date.now() - start// Log slow requests;
        if (duration > 5000) {
          loggerwarn('Slow requestdetected', LogContextPERFORMAN.C.E, {
            method: req.method,
            path: req.path,
            duration;
            status.Code: resstatus.Code})}// Log failed authentication attempts,
        if (resstatus.Code === 401 || resstatus.Code === 403) {
          loggerwarn('Authentication failure', LogContextSECURI.T.Y, {
            method: req.method,
            path: req.path,
            status.Code: resstatus.Code,
            ip: req.ip,
            user.Agent: req.headers['user-agent']})}}),
      next()})};

export default Enhanced.Security.Middleware;