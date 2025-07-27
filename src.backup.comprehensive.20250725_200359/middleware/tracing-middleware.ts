import type { Next.Function, Request, Response } from 'express';
import {
import { TIME_500.M.S, TIME_1000.M.S, TIME_2000.M.S, TIME_5000.M.S, TIME_10000.M.S, ZERO_POINT_FI.V.E, ZERO_POINT_EIG.H.T, ZERO_POINT_NI.N.E, BATCH_SI.Z.E_10, MAX_ITE.M.S_100, PERCE.N.T_10, PERCE.N.T_20, PERCE.N.T_30, PERCE.N.T_50, PERCE.N.T_80, PERCE.N.T_90, PERCE.N.T_100, HT.T.P_200, HT.T.P_400, HT.T.P_401, HT.T.P_404, HT.T.P_500 } from "./utils/common-constants";
  Span.Context;
  Span.Kind;
  Span.Status.Code;
  context;
  propagation;
  trace} from '@opentelemetry/api';
import { Semantic.Attributes } from '@opentelemetry/semantic-conventions';
import { telemetry.Service } from './services/telemetry-service';
import { Log.Context, logger } from './utils/enhanced-logger';
import { performance } from 'perf_hooks';
import { TIME_500.M.S, TIME_1000.M.S, TIME_2000.M.S, TIME_5000.M.S, TIME_10000.M.S, ZERO_POINT_FI.V.E, ZERO_POINT_EIG.H.T, ZERO_POINT_NI.N.E, BATCH_SI.Z.E_10, MAX_ITE.M.S_100, PERCE.N.T_10, PERCE.N.T_20, PERCE.N.T_30, PERCE.N.T_50, PERCE.N.T_80, PERCE.N.T_90, PERCE.N.T_100, HT.T.P_200, HT.T.P_400, HT.T.P_401, HT.T.P_404, HT.T.P_500 } from "./utils/common-constants";
interface Traced.Request extends Request {
  trace.Id?: string;
  span.Id?: string;
  user.Id?: string;
  ai.Service?: string;
}
interface Tracing.Options {
  record.Request.Body?: boolean;
  record.Response.Body?: boolean;
  ignore.Routes?: string[];
  custom.Attributes.Extractor?: (req: Request) => Record<string, unknown>
  error.Filter?: (error instanceof Error ? errormessage : String(error) Error) => boolean;
}
const default.Options: Tracing.Options = {
  record.Request.Body: false,
  record.Response.Body: false,
  ignore.Routes: ['/health', '/metrics', '/faviconico'];
  error.Filter: () => true,
}export function create.Tracing.Middleware(
  options: Tracing.Options = {
}): (req: Traced.Request, res: Response, next: Next.Function) => void {
  const merged.Options = { .default.Options, .options ;
  return (req: Traced.Request, res: Response, next: Next.Function) => {
    // Check if route should be ignored;
    if (merged.Optionsignore.Routes?some((route) => reqpathstarts.With(route))) {
      return next()}// Extract trace context from headers;
    const extracted.Context = propagationextract(contextactive(), reqheaders)// Start a new span for this request;
    const tracer = telemetry.Serviceget.Tracer();
    const span.Name = `${reqmethod} ${reqroute?path || reqpath}`;
    const span = tracerstart.Span(
      span.Name;
      {
        kind: SpanKindSERV.E.R,
        attributes: {
          [SemanticAttributesHTTP_METH.O.D]: reqmethod;
          [SemanticAttributesHTTP_SCHE.M.E]: reqprotocol;
          [SemanticAttributesHTTP_HO.S.T]: reqget('host') || 'unknown';
          [SemanticAttributesHTTP_TARG.E.T]: reqoriginal.Url;
          [SemanticAttributesHTTP_ROU.T.E]: reqroute?path || reqpath;
          [SemanticAttributesHTTP_USER_AGE.N.T]: reqget('user-agent') || 'unknown';
          [SemanticAttributesHTTP_CLIENT_.I.P]: reqip || reqsocketremote.Address || 'unknown';
          [SemanticAttributesNET_HOST_NA.M.E]: reqhostname;
          [SemanticAttributesNET_HOST_PO.R.T]: reqsocketlocal.Port;
          'httprequest_id': reqget('x-requestid') || `req-${Date.now()}`;
          'appapi_version': reqget('x-api-version') || 'v1';
        };
      extracted.Context)// Store trace information in request;
    const span.Context = spanspan.Context();
    reqtrace.Id = span.Contexttrace.Id;
    reqspan.Id = span.Contextspan.Id;
    reqstart.Time = performancenow()// Add custom attributes if provided;
    if (mergedOptionscustom.Attributes.Extractor) {
      try {
        const custom.Attributes = mergedOptionscustom.Attributes.Extractor(req);
        Objectentries(custom.Attributes)for.Each(([key, value]) => {
          spanset.Attribute(`custom.${key}`, value)})} catch (error) {
        loggererror('Error extracting custom attributes', LogContextSYST.E.M, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}}// Add user information if available;
    if (requser || requser.Id) {
      requser.Id = requser?id || requser.Id;
      spanset.Attribute('userid', requser.Id || 'anonymous');
      spanset.Attribute('userauthenticated', true)}// Add A.I service information if available;
    const ai.Service = reqget('x-ai-service') || reqqueryai.Service;
    if (ai.Service) {
      reqai.Service = ai.Service as string;
      spanset.Attribute('aiservice', String(ai.Service))}// Record requestbody if enabled;
    if (mergedOptionsrecord.Request.Body && reqbody) {
      try {
        const body.Str = JS.O.N.stringify(reqbody);
        spanset.Attribute('httprequestbody', body.Strsubstring(0, 1000))// Limit size;
        spanset.Attribute('httprequestbodysize', body.Strlength)} catch (error) {
        spanset.Attribute('httprequestbodyerror instanceof Error ? errormessage : String(error) 'Failed to serialize requestbody');
      }}// Add baggage for cross-service propagation;
    if (requser.Id) {
      telemetry.Serviceset.Baggage('userid', requser.Id);
    if (reqai.Service) {
      telemetry.Serviceset.Baggage('aiservice', reqai.Service)}// Inject trace context into response headers;
    const response.Headers: Record<string, string> = {;
    propagationinject(contextactive(), response.Headers);
    Objectentries(response.Headers)for.Each(([key, value]) => {
      resset.Header(key, value)})// Add trace I.D to response headers for client correlation;
    resset.Header('X-Trace-Id', span.Contexttrace.Id);
    resset.Header('X-Span-Id', span.Contextspan.Id)// Capture response details;
    const original.Send = ressend;
    const original.Json = resjson;
    const original.End = resend;
    const capture.Response = (body: any) => {
      const duration = performancenow() - (reqstart.Time || 0);
      spanset.Attribute(SemanticAttributesHTTP_STATUS_CO.D.E, resstatus.Code);
      spanset.Attribute('httpresponseduration', duration);
      spanset.Attribute('httpresponsesize', resget('content-length') || 0)// Record response body if enabled;
      if (mergedOptionsrecord.Response.Body && body) {
        try {
          const body.Str = typeof body === 'string' ? body : JS.O.N.stringify(body);
          spanset.Attribute('httpresponsebody', body.Strsubstring(0, 1000))// Limit size} catch (error) {
          spanset.Attribute('httpresponsebodyerror instanceof Error ? errormessage : String(error) 'Failed to serialize response body');
        }}// Set span status based on HT.T.P status code;
      if (resstatus.Code >= 400) {
        spanset.Status({
          code: SpanStatusCodeERR.O.R,
          message: `HT.T.P ${resstatus.Code}`})// Add errordetails if available,
        if (reslocalserror instanceof Error ? errormessage : String(error){
          spanrecord.Exception(reslocalserror instanceof Error ? errormessage : String(error);
          spanset.Attribute('errortype', reslocalserrorname || 'Error');
          spanset.Attribute('errormessage', reslocalserrormessage);
          spanset.Attribute('errorstack', reslocalserrorstack?substring(0, 1000))}} else {
        spanset.Status({ code: SpanStatusCode.O.K })}// Add performance metrics,
      spanset.Attribute('performanceduration_ms', duration);
      spanset.Attribute('performancememory_used', processmemory.Usage()heap.Used)// Log requestcompletion;
      loggerinfo('Request completed', LogContextA.P.I, {
        trace.Id: span.Contexttrace.Id,
        span.Id: span.Contextspan.Id,
        method: reqmethod,
        path: reqpath,
        status.Code: resstatus.Code,
        duration;
        user.Id: requser.Id,
        ai.Service: reqai.Service}),
      spanend()}// Override response methods to capture when response is sent;
    ressend = function (body: any) {
      capture.Response(body);
      return original.Sendcall(this, body);
    resjson = function (body: any) {
      capture.Response(body);
      return original.Jsoncall(this, body);
    resend = function (
      chunk?: any;
      encoding.Or.Callback?: Buffer.Encoding | (() => void);
      callback?: () => void) {
      capture.Response(chunk);
      const encoding = typeof encoding.Or.Callback === 'string' ? encoding.Or.Callback : 'utf8';
      const cb = typeof encoding.Or.Callback === 'function' ? encoding.Or.Callback : callback;
      return original.Endcall(this, chunk, encoding, cb)}// Run the requesthandler with the span context;
    contextwith(traceset.Span(contextactive(), span), () => {
      next()})}}// Error handling middleware that works with tracing;
export function createTracing.Error.Middleware(
  options: Tracing.Options = {
}): (err: Error, req: Traced.Request, res: Response, next: Next.Function) => void {
  return (err: Error, req: Traced.Request, res: Response, next: Next.Function) => {
    const span = traceget.Active.Span();
    if (span && optionserror.Filter?.(err) !== false) {
      spanrecord.Exception(err);
      spanset.Status({
        code: SpanStatusCodeERR.O.R,
        message: errmessage})// Add errorattributes,
      spanset.Attribute('error instanceof Error ? errormessage : String(error)  true);
      spanset.Attribute('errortype', errname || 'Error');
      spanset.Attribute('errormessage', errmessage);
      spanset.Attribute('errorstack', errstack?substring(0, 1000) || 'No stack trace')// Add requestcontext to error;
      if (reqtrace.Id) {
        spanset.Attribute('errortrace_id', reqtrace.Id);
      if (requser.Id) {
        spanset.Attribute('erroruser_id', requser.Id);
      if (reqai.Service) {
        spanset.Attribute('errorai_service', reqai.Service)}}// Store error for response capture;
    reslocalserror instanceof Error ? errormessage : String(error)  err;
    next(err)}}// Middleware to add trace context to all log entries;
export function createLogging.Context.Middleware(): (
  req: Traced.Request,
  res: Response,
  next: Next.Function) => void {
  return (req: Traced.Request, res: Response, next: Next.Function) => {
    const span = traceget.Active.Span();
    if (span) {
      const span.Context = spanspan.Context()// Add trace context to logger for this request;
      const original.Log = loggerinfobind(logger);
      const original.Error = loggererrorbind(logger);
      const original.Warn = loggerwarnbind(logger);
      const original.Debug = loggerdebugbind(logger);
      const add.Trace.Context = (log.Fn: Function) => {
        return (message: string, .args: any[]) => {
          const meta = args[0] || {;
          log.Fn(message, {
            .meta;
            trace.Id: span.Contexttrace.Id,
            span.Id: span.Contextspan.Id,
            user.Id: requser.Id,
            ai.Service: reqai.Service})},
      loggerinfo = add.Trace.Context(original.Log);
      loggererror= add.Trace.Context(original.Error);
      loggerwarn = add.Trace.Context(original.Warn);
      loggerdebug = add.Trace.Context(original.Debug)// Restore original logger after request;
      reson('finish', () => {
        loggerinfo = original.Log;
        loggererror= original.Error;
        loggerwarn = original.Warn;
        loggerdebug = original.Debug});
}    next()}}// Export default middleware with standard configuration;
export const tracing.Middleware = create.Tracing.Middleware();
export const tracing.Error.Middleware = createTracing.Error.Middleware();
export const logging.Context.Middleware = createLogging.Context.Middleware();