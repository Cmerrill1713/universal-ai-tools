/**
 * Prometheus Middleware for Universal A.I Tools*
 * Integrates Prometheus metrics collection with our enhanced logging system* and provides specialized metrics for Sweet Athena interactions*/
import type { Next.Function, Request, Response } from 'express';
import { metrics.Collector, register } from './utils/prometheus-metrics';
import { Log.Context, logger } from './utils/enhanced-logger'// Extend Express Request type to include Prometheus data;
declare global {
  namespace Express {
    interface Request {
      prometheus.Start.Time?: number;
      prometheus.Timer.End?: () => void;
    }};

export class Prometheus.Middleware {
  // Main Prometheus metrics middleware;
  static metrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      const start.Time = Date.now();
      reqprometheus.Start.Time = start.Time// Override resend to capture final metrics;
      const original.End = resend;
      resend = function (
        chunk?: any;
        encoding.Or.Callback?: Buffer.Encoding | (() => void);
        callback?: () => void) {
        const end.Time = Date.now();
        const duration = end.Time - start.Time// Extract requestdata;
        const { method } = req;
        const route = Prometheus.Middlewareextract.Route(req);
        const { status.Code } = res;
        const ai.Service = (reqheaders['x-ai-service'] as string) || 'unknown';
        const request.Size = PrometheusMiddlewareget.Request.Size(req);
        const response.Size = PrometheusMiddlewareget.Response.Size(res)// Record HT.T.P metrics;
        metricsCollectorrecord.Http.Request(
          method;
          route;
          status.Code;
          duration;
          request.Size;
          response.Size;
          ai.Service)// Log metrics collection for debugging;
        loggerdebug('Prometheus metrics recorded', LogContextPERFORMAN.C.E, {
          method;
          route;
          status_code: status.Code,
          duration_ms: duration,
          ai_service: ai.Service,
          request_size: request.Size,
          response_size: response.Size})// Special handling for Sweet Athena metrics,
        if (PrometheusMiddlewareis.Athena.Request(req)) {
          PrometheusMiddlewarerecord.Athena.Metrics(req, res, duration)}// Call original end method;
        const encoding = typeof encoding.Or.Callback === 'string' ? encoding.Or.Callback : 'utf8';
        const cb = typeof encoding.Or.Callback === 'function' ? encoding.Or.Callback : callback;
        return original.Endcall(this, chunk, encoding, cb);
      next()}}// Sweet Athena specific metrics collection;
  static athena.Metrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (PrometheusMiddlewareis.Athena.Request(req)) {
        // Add Athena-specific metric recording to request;
        reqrecord.Athena.Interaction = (
          interaction.Type: string,
          personality.Mood: string,
          sweetness.Level: number,
          response.Time.Ms?: number) => {
          const user.Id = (reqheaders['x-user-id'] as string) || 'anonymous';
          const session.Id = (reqheaders['x-session-id'] as string) || reqrequest.Id || 'unknown';
          const model = reqbody?model || 'default';
          const actual.Response.Time =
            response.Time.Ms || Date.now() - (reqprometheus.Start.Time || Date.now());
          metricsCollectorrecord.Athena.Interaction(
            interaction.Type;
            personality.Mood;
            user.Id;
            session.Id;
            actual.Response.Time;
            sweetness.Level;
            model);
          loggerinfo('Sweet Athena metrics recorded', LogContextATHE.N.A, {
            interaction_type: interaction.Type,
            personality_mood: personality.Mood,
            sweetness_level: sweetness.Level,
            response_time_ms: actual.Response.Time,
            user_id: user.Id,
            session_id: session.Id,
            model})};

      next()}}// Database metrics middleware;
  static database.Metrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add database metric recording to request;
      reqrecord.Database.Operation = (
        table: string,
        operation: string,
        duration.Ms: number,
        error instanceof Error ? errormessage : String(error)  string) => {
        metricsCollectorrecord.Database.Operation(table, operation, duration.Ms, error instanceof Error ? errormessage : String(error);
        loggerdebug('Database metrics recorded', LogContextDATABA.S.E, {
          table;
          operation;
          duration_ms: duration.Ms,
          error;
          request_id: reqrequest.Id}),
      next()}}// Memory metrics middleware;
  static memory.Metrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add memory metric recording to request;
      reqrecord.Memory.Operation = (
        operation.Type: string,
        memory.Type: string,
        duration.Ms: number,
        accuracy?: number) => {
        const ai.Service = (reqheaders['x-ai-service'] as string) || 'unknown';
        metricsCollectorrecord.Memory.Operation(
          operation.Type;
          memory.Type;
          ai.Service;
          duration.Ms;
          accuracy);
        loggerdebug('Memory metrics recorded', LogContextMEMO.R.Y, {
          operation_type: operation.Type,
          memory_type: memory.Type,
          duration_ms: duration.Ms,
          accuracy;
          ai_service: ai.Service,
          request_id: reqrequest.Id}),
      next()}}// Security metrics middleware;
  static security.Metrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add security metric recording to request;
      reqrecord.Security.Event = (event.Type: string, severity: string) => {
        const source.Ip = reqip || reqconnectionremote.Address || 'unknown';
        metricsCollectorrecord.Security.Event(event.Type, severity, source.Ip);
        loggerinfo('Security metrics recorded', LogContextSECURI.T.Y, {
          event_type: event.Type,
          severity;
          source_ip: source.Ip,
          user_agent: reqget('User-Agent'),
          request_id: reqrequest.Id}),
      next()}}// Test metrics middleware (for test environments);
  static test.Metrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (process.envNODE_E.N.V === 'test' || reqheaders['x-test-environment']) {
        reqrecord.Test.Execution = (
          test.Suite: string,
          test.Type: string,
          status: string,
          duration.Ms: number) => {
          metricsCollectorrecord.Test.Execution(test.Suite, test.Type, status, duration.Ms);
          loggerdebug('Test metrics recorded', LogContextTE.S.T, {
            test_suite: test.Suite,
            test_type: test.Type,
            status;
            duration_ms: duration.Ms,
            request_id: reqrequest.Id})},
}      next()}}// Metrics endpoint middleware;
  static metrics.Endpoint() {
    return async (req: Request, res: Response) => {
      try {
        const metrics = await metrics.Collectorget.Metrics();
        resset('Content-Type', registercontent.Type);
        ressend(metrics);
        loggerdebug('Prometheus metrics endpoint accessed', LogContextPERFORMAN.C.E, {
          request_id: reqrequest.Id,
          ai_service: reqheaders['x-ai-service'],
          source_ip: reqip})} catch (error) {
        loggererror('Failed to generate Prometheus metrics', LogContextPERFORMAN.C.E, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
          request_id: reqrequest.Id}),
        resstatus(500)json({
          error instanceof Error ? errormessage : String(error) 'Failed to generate metrics';
          timestamp: new Date()toIS.O.String()})}}}// Health check endpoint with Prometheus integration,
  static health.Check.Endpoint() {
    return async (req: Request, res: Response) => {
      try {
        const health.Data = {
          status: 'healthy',
          timestamp: new Date()toIS.O.String(),
          uptime: processuptime(),
          memory: processmemory.Usage(),
          metrics_enabled: true,
          prometheus_registry: typeof registermetrics === 'function' ? 'active' : 'inactive'}// Update health metrics,
        metricsCollectorrecord.Test.Execution('health_check', 'endpoint', 'pass', 0);
        resjson(health.Data);
        loggerdebug('Health check endpoint accessed', LogContextSYST.E.M, {
          request_id: reqrequest.Id,
          health_status: 'healthy',
          uptime: processuptime()})} catch (error) {
        loggererror('Health check failed', LogContextSYST.E.M, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
          request_id: reqrequest.Id}),
        resstatus(500)json({
          status: 'unhealthy',
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
          timestamp: new Date()toIS.O.String()})}}}// Helper methods,
  private static extract.Route(req: Request): string {
    // Extract meaningful route pattern;
    const path = reqpath || requrl || '/'// Replace I.Ds with patterns for better grouping;
    return path;
      replace(/\/\d+/g, '/:id');
      replace(/\/[a-f0-9-]{36}/g, '/:uuid');
      replace(/\/[a-f0-9]{24}/g, '/: objectid');
}
  private static get.Request.Size(req: Request): number {
    const content.Length = reqget('Content-Length');
    if (content.Length) {
      return parse.Int(content.Length, 10, 10)}// Estimate size from body if available;
    if (reqbody) {
      try {
        return JS.O.N.stringify(reqbody)length} catch {
        return 0};

    return 0;

  private static get.Response.Size(res: Response): number {
    const content.Length = resget('Content-Length');
    if (content.Length) {
      return parse.Int(content.Length, 10, 10)}// Estimate from response data if available;
    return 0// Would need to capture response body to calculate accurately;

  private static is.Athena.Request(req: Request): boolean {
    return (
      reqpathincludes('/athena') ||
      reqpathincludes('/assistant') ||
      reqpathincludes('/conversation') ||
      reqheaders['x-ai-service'] === 'sweet-athena');

  private static record.Athena.Metrics(req: Request, res: Response, duration: number) {
    try {
      const interaction.Type =
        reqbody?interaction_type ||
        (reqqueryinteraction_type as string) ||
        PrometheusMiddlewareinfer.Interaction.Type(reqpath);
      const personality.Mood =
        reqbody?personality_mood || (reqquerypersonality_mood as string) || 'sweet';
      const sweetness.Level =
        reqbody?sweetness_level ||
        (reqquerysweetness_level ? Number(reqquerysweetness_level) : 8);
      const user.Id = (reqheaders['x-user-id'] as string) || 'anonymous';
      const session.Id = (reqheaders['x-session-id'] as string) || reqrequest.Id || 'unknown';
      const model = reqbody?model || 'default';
      metricsCollectorrecord.Athena.Interaction(
        interaction.Type;
        personality.Mood;
        user.Id;
        session.Id;
        duration;
        sweetness.Level;
        model);
      loggerinfo('Athena interaction metrics recorded automatically', LogContextATHE.N.A, {
        interaction_type: interaction.Type,
        personality_mood: personality.Mood,
        sweetness_level: sweetness.Level,
        duration_ms: duration,
        status_code: resstatus.Code})} catch (error) {
      loggererror('Failed to record Athena metrics', LogContextATHE.N.A, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
        request_id: reqrequest.Id})},

  private static infer.Interaction.Type(path: string): string {
    if (pathincludes('/chat')) return 'conversation';
    if (pathincludes('/avatar')) return 'avatar_animation';
    if (pathincludes('/teach')) return 'teach_me';
    if (pathincludes('/memory')) return 'memory_access';
    return 'general'}}// Extend Express Request interface;
declare module 'express-serve-static-core' {
  interface Request {
    record.Athena.Interaction?: (
      interaction.Type: string,
      personality.Mood: string,
      sweetness.Level: number,
      response.Time.Ms?: number) => void;
    record.Database.Operation?: (
      table: string,
      operation: string,
      duration.Ms: number,
      error instanceof Error ? errormessage : String(error)  string) => void;
    record.Memory.Operation?: (
      operation.Type: string,
      memory.Type: string,
      duration.Ms: number,
      accuracy?: number) => void;
    record.Security.Event?: (event.Type: string, severity: string) => void,
    record.Test.Execution?: (
      test.Suite: string,
      test.Type: string,
      status: string,
      duration.Ms: number) => void,
  };

export default Prometheus.Middleware;