/**
 * Logging Middleware for Universal A.I Tools*
 * Comprehensive requestresponse logging with performance monitoring* error tracking, and specialized Sweet Athena interaction logging*/
import type { Next.Function, Request, Response } from 'express';
import { Log.Context, enhanced.Logger, logger } from './utils/enhanced-logger';
import { v4 as uuidv4 } from 'uuid'// Extend Express Request type to include logging data;
declare global {
  namespace Express {
    interface Request {
      timer.Id?: string;
      logger?: typeof logger;
    }}};

interface Request.Metadata {
  user_agent?: string;
  ip_address?: string;
  user_id?: string;
  session_id?: string;
  api_key?: string;
  ai_service?: string;
  request_size: number;
  response_size?: number;
};

interface SweetAthenaRequest.Data {
  interaction_type?: string;
  personality_mood?: string;
  sweetness_level?: number;
  userinput string;
};

export class Logging.Middleware {
  // Main requestlogging middleware;
  static request.Logger() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Generate unique requestI.D;
      reqrequest.Id = uuidv4();
      reqstart.Time = Date.now();
      reqtimer.Id = loggerstart.Timer(`request_${reqmethod}_${reqpath}`);
      reqlogger = logger// Add requestI.D to response headers for debugging;
      resset.Header('X-Request-I.D', reqrequest.Id)// Extract requestmetadata;
      const metadata: Request.Metadata = {
        user_agent: reqget('User-Agent');
        ip_address: reqip || reqconnectionremote.Address;
        user_id: reqheaders['x-user-id'] as string;
        session_id: reqheaders['x-session-id'] as string;
        api_key: reqheaders['x-api-key'] as string;
        ai_service: reqheaders['x-ai-service'] as string;
        request_size: JSO.N.stringify(reqbody || {})length}// Log incoming request;
      loggerinfo(`Incoming ${reqmethod} ${reqpath}`, LogContextAP.I, {
        request_id: reqrequest.Id;
        method: reqmethod;
        path: reqpath;
        query: reqquery;
        headers: LoggingMiddlewaresanitize.Headers(reqheaders);
        metadata;
        body_preview: LoggingMiddlewaresanitize.Body(reqbody)})// Special handling for Sweet Athena requests;
      if (LoggingMiddlewareisAthena.Request(req)) {
        LoggingMiddlewarelogAthenaRequest.Start(req)}// Override resjson to capture response data;
      const original.Json = resjson;
      resjson = function (body: any) {
        const response.Size = JSO.N.stringify(body)length;
        metadataresponse_size = response.Size// Log response;
        LoggingMiddlewarelog.Response(req, res, body, metadata);
        return original.Jsoncall(this, body)}// Override ressend to capture non-JSO.N responses;
      const original.Send = ressend;
      ressend = function (body: any) {
        const response.Size = typeof body === 'string' ? bodylength : JSO.N.stringify(body)length;
        metadataresponse_size = response.Size;
        LoggingMiddlewarelog.Response(req, res, body, metadata);
        return original.Sendcall(this, body)}// Handle response finish event;
      reson('finish', () => {
        LoggingMiddlewarelogRequest.Completion(req, res, metadata)});
      next()}}// Error logging middleware (should be last);
  static error.Logger() {
    return (err: Error, req: Request, res: Response, next: Next.Function) => {
      const error.Tracking = loggertrack.Error(err, LogContextAP.I, {
        request_id: reqrequest.Id;
        method: reqmethod;
        path: reqpath;
        user_id: reqheaders['x-user-id'];
        session_id: reqheaders['x-session-id'];
        request_body: LoggingMiddlewaresanitize.Body(reqbody)})// Special handling for Sweet Athena errors;
      if (LoggingMiddlewareisAthena.Request(req)) {
        loggererror('Sweet Athena interaction failed', LogContextATHEN.A, {
          error_tracking: error.Tracking;
          interaction_data: LoggingMiddlewareextractAthena.Data(req);
          user_impact: 'high', // Athena errors significantly impact user experience})}// End performance timer for failed requests;
      if (reqtimer.Id) {
        loggerend.Timer(
          reqtimer.Id;
          `request_${reqmethod}_${reqpath}_ERRO.R`;
          LogContextPERFORMANC.E;
          {
            error instanceof Error ? errormessage : String(error) true;
            error_type: errname;
            request_id: reqrequest.Id;
          })};

      next(err)}}// Database operation logging middleware;
  static database.Logger() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add database operation tracking to request;
      if (reqlogger) {
        reqloggerlogDatabase.Operation = (
          operation: string;
          table: string;
          duration: number;
          details?: Record<string, unknown>) => {
          loggerlogDatabase.Operation(operation, table, duration, {
            request_id: reqrequest.Id.details})}};

      next()}}// Memory operation logging middleware;
  static memory.Logger() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add memory operation tracking to request;
      if (reqlogger) {
        reqloggerlogMemory.Operation = (operation: string, details: Record<string, unknown>) => {
          loggerlogMemory.Operation(operation, {
            request_id: reqrequest.Id.details})}};

      next()}}// Sweet Athena conversation logging middleware;
  static athenaConversation.Logger() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (LoggingMiddlewareisAthena.Request(req)) {
        // Add Athena-specific logging methods to request;
        if (reqlogger) {
          reqloggerlogAthena.Interaction = (interaction) => {
            loggerlogAthena.Interaction({
              .interaction;
              session_id: (reqheaders['x-session-id'] as string) || reqrequest.Id || 'unknown'})};
          reqloggerlogConversation.Turn = (
            user.Input: string;
            athena.Response: string;
            session.Id?: string;
            metadata?: Record<string, unknown>) => {
            loggerlogConversation.Turn(
              user.Input;
              athena.Response;
              session.Id || reqrequest.Id || 'unknown';
              {
                request_id: reqrequest.Id.metadata;
              })}}};

      next()}}// Security event logging middleware;
  static security.Logger() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add security logging to requestwithout calling detectSuspicious.Activity to avoid recursion);
      if (reqlogger) {
        reqloggerlogSecurity.Event = (
          event: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          details: Record<string, unknown>) => {
          loggerlogSecurity.Event(event, severity, {
            request_id: reqrequest.Id;
            ip_address: reqip;
            user_agent: reqget('User-Agent');
            path: reqpath;
            method: reqmethod.details})}};

      next()}}// Private helper methods;
  private static log.Response(req: Request, res: Response, body: any, metadata: Request.Metadata) {
    const is.Error = resstatus.Code >= 400;
    const context = is.Error ? LogContextAP.I : LogContextAP.I;
    loggerinfo(`Response ${reqmethod} ${reqpath} - ${resstatus.Code}`, context, {
      request_id: reqrequest.Id;
      status_code: resstatus.Code;
      response_size: metadataresponse_size;
      response_preview: LoggingMiddlewaresanitize.Body(body);
      headers: LoggingMiddlewaresanitize.Headers(resget.Headers());
      metadata})// Log full response in debug mode for Athena requests;
    if (process.envNODE_EN.V !== 'production' && LoggingMiddlewareisAthena.Request(req)) {
      loggerdebug(`Full Athena response`, LogContextATHEN.A, {
        request_id: reqrequest.Id;
        full_response: body})}};

  private static logRequest.Completion(req: Request, res: Response, metadata: Request.Metadata) {
    const duration = Date.now() - (reqstart.Time || Date.now())// End performance timer;
    if (reqtimer.Id) {
      loggerend.Timer(reqtimer.Id, `request_${reqmethod}_${reqpath}`, LogContextPERFORMANC.E, {
        status_code: resstatus.Code;
        request_id: reqrequest.Id.metadata})}// Log AP.I requestwith performance data;
    loggerlogAPI.Request(reqmethod, reqpath, resstatus.Code, duration, {
      request_id: reqrequest.Id.metadata})// Special completion logging for Sweet Athena;
    if (LoggingMiddlewareisAthena.Request(req)) {
      LoggingMiddlewarelogAthenaRequest.Completion(req, res, duration)}};

  private static logAthenaRequest.Start(req: Request) {
    const athena.Data = LoggingMiddlewareextractAthena.Data(req);
    loggerinfo('Sweet Athena interaction started', LogContextATHEN.A, {
      request_id: reqrequest.Id;
      interaction_data: athena.Data;
      endpoint: reqpath;
      user_session: reqheaders['x-session-id']})};

  private static logAthenaRequest.Completion(req: Request, res: Response, duration: number) {
    const athena.Data = LoggingMiddlewareextractAthena.Data(req);
    loggerinfo('Sweet Athena interaction completed', LogContextATHEN.A, {
      request_id: reqrequest.Id;
      duration_ms: duration;
      status_code: resstatus.Code;
      success: resstatus.Code < 400;
      interaction_data: athena.Data;
      performance_category: LoggingMiddlewarecategorize.Perfomance(duration)})};

  private static isAthena.Request(req: Request): boolean {
    return (
      reqpathincludes('/athena') ||
      reqpathincludes('/assistant') ||
      reqpathincludes('/conversation') ||
      reqheaders['x-ai-service'] === 'sweet-athena')};

  private static extractAthena.Data(req: Request): SweetAthenaRequest.Data {
    return {
      interaction_type: reqbody?interaction_type || (reqqueryinteraction_type as string);
      personality_mood: reqbody?personality_mood || (reqquerypersonality_mood as string);
      sweetness_level:
        reqbody?sweetness_level ||
        (reqquerysweetness_level ? Number(reqquerysweetness_level) : undefined);
      user_inputreqbody?message || reqbody?user_input| reqbody?query;
    }};

  private static sanitize.Headers(headers: any): any {
    const sanitized = { .headers }// Remove sensitive headers;
    const sensitive.Headers = [
      'authorization';
      'x-api-key';
      'cookie';
      'x-auth-token';
      'x-secret-key';
      'x-private-key';
      'password'];
    sensitiveHeadersfor.Each((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTE.D]'}});
    return sanitized};

  private static sanitize.Body(body: any): any {
    if (!body || typeof body !== 'object') {
      return body};

    const sanitized = { .body }// Remove sensitive fields;
    const sensitive.Fields = [
      'password';
      'secret';
      'token';
      'key';
      'api.Key';
      'auth.Token';
      'private.Key';
      'secret.Key';
      'access.Token';
      'refresh.Token'];
    sensitiveFieldsfor.Each((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTE.D]'}})// Truncate long strings for preview;
    Objectkeys(sanitized)for.Each((key) => {
      if (typeof sanitized[key] === 'string' && sanitized[key]length > 200) {
        sanitized[key] = `${sanitized[key]substring(0, 200)}. [TRUNCATE.D]`}});
    return sanitized};

  private static detectSuspicious.Activity(req: Request) {
    // Rate limiting checks;
    const user.Agent = reqget('User-Agent');
    const ip = reqip || reqconnectionremote.Address// Check for bot-like behavior;
    if (!user.Agent || user.Agentlength < 10) {
      loggerlogSecurity.Event('Suspicious User Agent', 'medium', {
        ip_address: ip;
        user_agent: user.Agent;
        path: reqpath})}// Check for SQ.L injection attempts;
    const query.String = JSO.N.stringify(reqquery);
    const body.String = JSO.N.stringify(reqbody);
    const sql.Patterns = /'.*union.*select|'.*or.*1=1|'.*drop.*table|'.*insert.*into/i;
    if (sql.Patternstest(query.String) || sql.Patternstest(body.String)) {
      loggerlogSecurity.Event('Potential SQ.L Injection Attempt', 'critical', {
        ip_address: ip;
        user_agent: user.Agent;
        path: reqpath;
        query: reqquery;
        body_preview: LoggingMiddlewaresanitize.Body(reqbody)})}// Check for XS.S attempts;
    const xss.Patterns = /<script|javascript:|on\w+=/i;
    if (xss.Patternstest(query.String) || xss.Patternstest(body.String)) {
      loggerlogSecurity.Event('Potential XS.S Attempt', 'high', {
        ip_address: ip;
        user_agent: user.Agent;
        path: reqpath})}};

  private static categorize.Perfomance(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 500) return 'good';
    if (duration < 1000) return 'acceptable';
    if (duration < 2000) return 'slow';
    return 'very_slow'}};

export default Logging.Middleware;