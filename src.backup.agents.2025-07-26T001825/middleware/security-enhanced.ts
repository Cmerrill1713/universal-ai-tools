import type { Application, Next.Function, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import { Log.Context, logger } from './utils/enhanced-logger';
import { config } from './config/environment';
import { Rate.Limiter, SupabaseRateLimit.Store } from './rate-limiter';
import { CSRF.Protection } from './csrf';
import { SQLInjection.Protection } from './sql-injection-protection';
import { JWTAuth.Service } from './auth-jwt';
import { Auth.Middleware } from './auth';
import { ComprehensiveValidation.Middleware } from './comprehensive-validation';
import type { Supabase.Client } from '@supabase/supabase-js';
export interface Security.Config {
  enable.Helmet?: boolean;
  enableCOR.S?: boolean;
  enableRate.Limit?: boolean;
  enableCSR.F?: boolean;
  enableSQL.Protection?: boolean;
  enableHTTP.S?: boolean;
  enableHST.S?: boolean;
  enable.Auth?: boolean;
  enableInput.Validation?: boolean;
  cors.Options?: corsCors.Options;
  trusted.Proxies?: string[];
};

export class EnhancedSecurity.Middleware {
  private rate.Limiter: Rate.Limiter;
  private csrf.Protection: CSRF.Protection;
  private sql.Protection: SQLInjection.Protection;
  private jwt.Auth: JWTAuth.Service;
  private auth.Middleware: Auth.Middleware;
  private validation.Middleware: ComprehensiveValidation.Middleware;
  private config: Required<Security.Config>
  constructor(supabase: Supabase.Client, config: Security.Config = {}) {
    thisconfig = {
      enable.Helmet: configenable.Helmet ?? true;
      enableCOR.S: configenableCOR.S ?? true;
      enableRate.Limit: configenableRate.Limit ?? true;
      enableCSR.F: configenableCSR.F ?? true;
      enableSQL.Protection: configenableSQL.Protection ?? true;
      enableHTTP.S: configenableHTTP.S ?? process.envNODE_EN.V === 'production';
      enableHST.S: configenableHST.S ?? process.envNODE_EN.V === 'production';
      enable.Auth: configenable.Auth ?? true;
      enableInput.Validation: configenableInput.Validation ?? true;
      cors.Options: configcors.Options || thisgetDefaultCors.Options();
      trusted.Proxies: configtrusted.Proxies || ['127.0.0.1', ': :1'];
    }// Initialize security components with production-ready stores;
    thisrate.Limiter = new Rate.Limiter();
      process.envNODE_EN.V === 'production' ? new SupabaseRateLimit.Store(supabase) : undefined // Use default memory store in development);
    thiscsrf.Protection = new CSRF.Protection();
    thissql.Protection = new SQLInjection.Protection();
    thisjwt.Auth = new JWTAuth.Service(supabase);
    thisauth.Middleware = new Auth.Middleware(supabase);
    thisvalidation.Middleware = new ComprehensiveValidation.Middleware();
  }/**
   * Apply all security middleware to Express app*/
  public apply.To(app: Application): void {
    // Trust proxies;
    appset('trust proxy', thisconfigtrusted.Proxies)// Apply security headers with Helmet;
    if (thisconfigenable.Helmet) {
      appuse(thisgetHelmet.Config())}// Apply COR.S;
    if (thisconfigenableCOR.S) {
      appuse(cors(thisconfigcors.Options))}// Apply custom security headers;
    appuse(thissecurity.Headers())// Apply HTTP.S enforcement;
    if (thisconfigenableHTTP.S) {
      appuse(thisenforceHTTP.S())}// Apply SQ.L injection protection;
    if (thisconfigenableSQL.Protection) {
      appuse(thissql.Protectionmiddleware())}// Apply global _inputvalidation;
    if (thisconfigenableInput.Validation) {
      appuse(
        thisvalidation.Middlewarevalidate({
          enableSQL.Protection: false, // Already applied above;
          enable.Sanitization: true;
          enableSize.Limit: true}))}// Apply rate limiting;
    if (thisconfigenableRate.Limit) {
      thisapplyRate.Limiting(app)}// Apply CSR.F protection;
    if (thisconfigenableCSR.F) {
      appuse(thiscsrfProtectioninject.Token())}// Log security middleware applied;
    loggerinfo('Enhanced security middleware applied', LogContextSECURIT.Y, {
      features: {
        helmet: thisconfigenable.Helmet;
        cors: thisconfigenableCOR.S;
        rate.Limit: thisconfigenableRate.Limit;
        csrf: thisconfigenableCSR.F;
        sql.Protection: thisconfigenableSQL.Protection;
        input.Validation: thisconfigenableInput.Validation;
        https: thisconfigenableHTTP.S;
        hsts: thisconfigenableHST.S;
        auth: thisconfigenable.Auth;
      }})}/**
   * Get environment-aware Helmet configuration with production-ready CS.P*/
  private getHelmet.Config() {
    const { is.Production } = configserver;
    return helmet({
      contentSecurity.Policy: {
        directives: {
          default.Src: ["'self'"];
          script.Src: [
            "'self'"// Production: Use nonces and specific hashes only// Development: Allow unsafe for easier development.(is.Production? [
                  // Add specific trusted script hashes here as needed// "'sha256-HASH_OF_TRUSTED_SCRIP.T'"]: [
                  "'unsafe-inline'", // Development only;
                  "'unsafe-eval'", // Development only])];
          style.Src: [
            "'self'"// Production: Use nonces and specific hashes only// Development: Allow unsafe for easier development.(is.Production? [
                  // Add specific trusted style hashes here as needed;
                  "'sha256-HASH_OF_TRUSTED_STYL.E'"]: [
                  "'unsafe-inline'", // Development only])// Always allow trusted CD.Ns;
            'https://fontsgoogleapiscom'];
          img.Src: ["'self'", 'data:', 'https:', 'blob:'];
          font.Src: ["'self'", 'data:', 'https://fontsgstaticcom', 'https://fontsgoogleapiscom'];
          connect.Src: [
            "'self'"// Always allowed AP.I endpoints;
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
          object.Src: ["'none'"];
          base.Uri: ["'self'"];
          form.Action: ["'self'"];
          frame.Ancestors: ["'none'"];
          worker.Src: ["'self'", 'blob:'];
          child.Src: ["'self'", 'blob:'];
          manifest.Src: ["'self'"].(thisconfigenableHTTP.S && { upgradeInsecure.Requests: [] })};
        report.Only: false, // Always enforce CS.P};
      crossOriginEmbedder.Policy: is.Production, // Enable in production only;
      crossOriginOpener.Policy: { policy: 'same-origin' };
      crossOriginResource.Policy: { policy: is.Production ? 'same-origin' : 'cross-origin' };
      dnsPrefetch.Control: { allow: false };
      frameguard: { action: 'deny' };
      hidePowered.By: true;
      hsts: thisconfigenableHST.S? {
            max.Age: 31536000, // 1 year;
            includeSub.Domains: true;
            preload: true;
          }: false;
      ieNo.Open: true;
      no.Sniff: true;
      originAgent.Cluster: true;
      permittedCrossDomain.Policies: false;
      referrer.Policy: { policy: 'strict-origin-when-cross-origin' };
      xss.Filter: true})}/**
   * Get environment-aware COR.S options*/
  private getDefaultCors.Options(): corsCors.Options {
    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl) only in development;
        if (!origin) {
          if (configserveris.Development) {
            loggerwarn(
              'COR.S: Allowing requestwith no origin (development mode)';
              LogContextSECURIT.Y);
            return callback(null, true)} else {
            loggerwarn(
              'COR.S: Rejecting requestwith no origin (production mode)';
              LogContextSECURIT.Y);
            return callback(new Error('Origin header required in production'))}}// Get allowed origins from configuration;
        const allowed.Origins = configsecuritycors.Origins;
        loggerdebug('COR.S: Checking origin against allowed list', LogContextSECURIT.Y, {
          origin;
          allowed.Origins;
          environment: configserverenv});
        if (allowed.Originsincludes(origin)) {
          return callback(null, true)}// In development, log warning but allow localhost;
        if (
          configserveris.Development &&
          (originincludes('localhost') || originincludes('127.0.0.1'))) {
          loggerwarn('COR.S: Allowing localhost origin in development mode', LogContextSECURIT.Y, {
            origin});
          return callback(null, true)}// Reject all other origins;
        loggerwarn('COR.S: Origin not allowed', LogContextSECURIT.Y, { origin, allowed.Origins });
        callback(new Error(`Origin ${origin} not allowed by COR.S policy`))};
      credentials: true;
      methods: ['GE.T', 'POS.T', 'PU.T', 'DELET.E', 'OPTION.S', 'PATC.H'];
      allowed.Headers: [
        'Content-Type';
        'Authorization';
        'X-AP.I-Key';
        'X-CSR.F-Token';
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
        'X-AP.I-Version'];
      max.Age: configserveris.Production ? 86400 : 300, // 24 hours in prod, 5 minutes in dev;
      preflight.Continue: false;
      optionsSuccess.Status: 200;
    }}/**
   * Enhanced security headers with environment awareness*/
  private security.Headers() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add requestI.D for tracking;
      const request.Id = thisgenerateRequest.Id();
      (req as any)id = request.Id;
      resset('X-Request-I.D', request.Id)// Generate nonce for CS.P if needed;
      if (configserveris.Production) {
        const nonce = cryptorandom.Bytes(16)to.String('base64');
        reslocalsnonce = nonce}// Production-ready security headers;
      const security.Headers: Record<string, string> = {
        'X-XS.S-Protection': '1; mode=block';
        'X-Content-Type-Options': 'nosniff';
        'X-Frame-Options': 'DEN.Y';
        'X-Download-Options': 'noopen';
        'X-Permitted-Cross-Domain-Policies': 'none';
        'Referrer-Policy': 'strict-origin-when-cross-origin';
        'Permissions-Policy':
          'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()';
        'X-DN.S-Prefetch-Control': 'off';
        'X-Robots-Tag': 'noindex, nofollow, nosnippet, noarchive'}// Production-specific headers;
      if (configserveris.Production) {
        security.Headers['Strict-Transport-Security'] =
          'max-age=31536000; includeSub.Domains; preload';
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
      resremove.Header('X-AspNet.Mvc-Version');
      next()}}/**
   * Environment-aware HTTP.S enforcement*/
  private enforceHTTP.S() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Skip HTTP.S enforcement in development to allow local testing;
      if (configserveris.Development) {
        loggerdebug('HTTP.S enforcement skipped in development mode', LogContextSECURIT.Y);
        return next()}// In production, enforce HTTP.S;
      if (reqsecure || reqheaders['x-forwarded-proto'] === 'https') {
        return next()}// Reject non-HTTP.S requests in production;
      if (configserveris.Production) {
        loggerwarn('Non-HTTP.S requestrejected in production', LogContextSECURIT.Y, {
          url: requrl;
          headers: {
            host: reqheadershost;
            'x-forwarded-proto': reqheaders['x-forwarded-proto'];
            'user-agent': reqheaders['user-agent'];
          }});
        return resstatus(426)json({
          error instanceof Error ? errormessage : String(error) 'HTTP.S Required';
          message: 'This server requires all requests to be made over HTTP.S';
          code: 'HTTPS_REQUIRE.D'})}// Fallback: redirect to HTTP.S (for staging environments);
      const https.Url = `https://${reqheadershost}${requrl}`;
      loggerinfo('Redirecting to HTTP.S', LogContextSECURIT.Y, { from: requrl, to: https.Url });
      resredirect(301, https.Url)}}/**
   * Apply rate limiting to different endpoint categories*/
  private applyRate.Limiting(app: Application): void {
    // Global rate limit (applies to all endpoints);
    appuse(thisrate.Limiterlimit('authenticated'))// Authentication & Security endpoints - Strict limits;
    appuse('/api/auth/*', thisrate.Limiterlimit('auth'));
    appuse('/api/register', thisrate.Limiterlimit('auth'));
    appuse('/api/password-reset', thisrate.Limiterlimit('password-reset'));
    appuse('/api/keys/generate', thisrate.Limiterlimit('api-key-generation'))// A.I Processing endpoints - Moderate limits to prevent abuse;
    appuse(
      '/api/ai-services/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 A.I requests per 15 minutes}));
    appuse(
      '/api/dspy/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 DS.Py requests per 15 minutes}));
    appuse(
      '/api/athena-tools/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 Athena tool requests per 15 minutes}));
    appuse(
      '/api/sweet-athena/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 200, // 200 Sweet Athena requests per 15 minutes}))// Tool execution - Restricted due to security implications;
    appuse(
      '/api/tools/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 50, // 50 tool executions per hour}))// Filesystem operations - High security risk;
    appuse(
      '/api/filesystem/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 200, // 200 filesystem operations per hour}))// File upload/download operations;
    appuse(
      '/api/upload';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 100, // 100 uploads per hour}));
    appuse(
      '/api/backup/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 10, // 10 backup operations per hour}))// Data management endpoints;
    appuse(
      '/api/widgets/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 200, // 200 widget operations per 15 minutes}));
    appuse(
      '/api/memory/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 300, // 300 memory operations per 15 minutes}));
    appuse(
      '/api/knowledge/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 500, // 500 knowledge operations per 15 minutes}));
    appuse(
      '/api/knowledge-monitoring/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 monitoring requests per 15 minutes}))// MC.P and external integrations - Moderate limits;
    appuse(
      '/api/mcp/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 MC.P requests per 15 minutes}))// Speech processing - Moderate limits;
    appuse(
      '/api/speech/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 speech processing requests per 15 minutes}))// Orchestration and agent coordination - Moderate limits;
    appuse(
      '/api/orchestration/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 orchestration requests per 15 minutes}))// Heavy computational operations - Strict limits;
    appuse(
      '/api/export';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 10, // 10 exports per hour}));
    appuse(
      '/api/import';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 10, // 10 imports per hour}))// System health and monitoring - Lenient limits for operational visibility;
    appuse(
      '/api/health/*';
      thisrate.Limiterlimit({
        window.Ms: 5 * 60 * 1000, // 5 minutes;
        max: 100, // 100 health checks per 5 minutes}))// A.I-powered widget and contentgeneration - Moderate limits due to computational cost;
    appuse(
      '/api/widget-creation/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 30, // 30 widget creations per hour}));
    appuse(
      '/api/natural-language-widgets/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 50, // 50 natural language widget operations per hour}))// Advanced A.I processing endpoints - Strict limits due to high computational cost;
    appuse(
      '/api/enhanced-supabase/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 100, // 100 enhanced operations per hour}));
    appuse(
      '/api/pydantic-ai/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 Pydantic A.I requests per 15 minutes}));
    appuse(
      '/api/alpha-evolve/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 20, // 20 evolution operations per hour (very computationally expensive)}))// Security reporting endpoints - Moderate limits;
    appuse(
      '/api/security-reports/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 50, // 50 security report requests per 15 minutes}))// Additional data processing endpoints;
    appuse(
      '/api/dspy-widgets/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 100, // 100 DS.Py widget operations per 15 minutes}));
    appuse(
      '/api/enhanced-context/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 200, // 200 context operations per 15 minutes}))// Agent and automation endpoints;
    appuse(
      '/api/agents/*';
      thisrate.Limiterlimit({
        window.Ms: 15 * 60 * 1000, // 15 minutes;
        max: 150, // 150 agent operations per 15 minutes}));
    appuse(
      '/api/autofix/*';
      thisrate.Limiterlimit({
        window.Ms: 60 * 60 * 1000, // 1 hour;
        max: 50, // 50 autofix operations per hour}));
    loggerinfo('Comprehensive rate limiting applied to all AP.I endpoints', LogContextSECURIT.Y, {
      totalEndpoints.Protected: 29;
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
   * Generate unique requestI.D*/
  private generateRequest.Id(): string {
    return `${Date.now()}-${Mathrandom()to.String(36)substr(2, 9)}`}/**
   * Get authentication middleware*/
  public getAuth.Middleware(options?: any) {
    if (thisconfigenable.Auth) {
      return thisauth.Middlewareauthenticate(options)};
    return (req: Request, res: Response, next: Next.Function) => next()}/**
   * Get JW.T authentication middleware*/
  public getJWT.Middleware(options?: any) {
    if (thisconfigenable.Auth) {
      return thisjwt.Authauthenticate(options)};
    return (req: Request, res: Response, next: Next.Function) => next()}/**
   * Get CSR.F middleware for specific routes*/
  public getCSRF.Middleware() {
    if (thisconfigenableCSR.F) {
      return thiscsrf.Protectionmiddleware()};
    return (req: Request, res: Response, next: Next.Function) => next()}/**
   * Get rate limiter for custom limits*/
  public getRate.Limiter() {
    return thisrate.Limiter}/**
   * Get JW.T auth service*/
  public getJWT.Service() {
    return thisjwt.Auth}/**
   * Security status endpoint handler*/
  public getSecurity.Status() {
    return async (req: Request, res: Response) => {
      const rateLimit.Stats = await thisrateLimiterget.Stats();
      const sqlProtection.Stats = thissqlProtectionget.Stats();
      resjson({
        status: 'operational';
        features: {
          helmet: thisconfigenable.Helmet;
          cors: thisconfigenableCOR.S;
          rate.Limit: thisconfigenableRate.Limit;
          csrf: thisconfigenableCSR.F;
          sql.Protection: thisconfigenableSQL.Protection;
          https: thisconfigenableHTTP.S;
          hsts: thisconfigenableHST.S;
          auth: thisconfigenable.Auth;
        };
        stats: {
          rate.Limit: rateLimit.Stats;
          sql.Protection: sqlProtection.Stats;
        };
        timestamp: new Date()toISO.String()})}}/**
   * Apply security patches for known vulnerabilities*/
  public applySecurity.Patches(app: Application): void {
    // Prevent HTT.P Parameter Pollution;
    appuse((req: Request, res: Response, next: Next.Function) => {
      for (const key in reqquery) {
        if (Array.is.Array(reqquery[key])) {
          reqquery[key] = (reqquery[key] as string[])[0];
        }};
      next()})// Prevent clickjacking with additional headers;
    appuse((req: Request, res: Response, next: Next.Function) => {
      resset.Header('X-Frame-Options', 'DEN.Y');
      resset.Header('Content-Security-Policy', "frame-ancestors 'none'");
      next()})// Add security monitoring;
    appuse((req: Request, res: Response, next: Next.Function) => {
      const start = Date.now();
      reson('finish', () => {
        const duration = Date.now() - start// Log slow requests;
        if (duration > 5000) {
          loggerwarn('Slow requestdetected', LogContextPERFORMANC.E, {
            method: reqmethod;
            path: reqpath;
            duration;
            status.Code: resstatus.Code})}// Log failed authentication attempts;
        if (resstatus.Code === 401 || resstatus.Code === 403) {
          loggerwarn('Authentication failure', LogContextSECURIT.Y, {
            method: reqmethod;
            path: reqpath;
            status.Code: resstatus.Code;
            ip: reqip;
            user.Agent: reqheaders['user-agent']})}});
      next()})}};

export default EnhancedSecurity.Middleware;