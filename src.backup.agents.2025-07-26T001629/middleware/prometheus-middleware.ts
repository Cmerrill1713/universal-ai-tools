/**
 * Prometheus Middleware for Universal A.I Tools*
 * Integrates Prometheus metrics collection with our enhanced logging system* and provides specialized metrics for Sweet Athena interactions*/
import type { Next.Function, Request, Response } from 'express';
import { metrics.Collector, register } from './utils/prometheus-metrics';
import { Log.Context, logger } from './utils/enhanced-logger'// Extend Express Request type to include Prometheus data;
declare global {
  namespace Express {
    interface Request {
      prometheusStart.Time?: number;
      prometheusTimer.End?: () => void;
    }}};

export class Prometheus.Middleware {
  // Main Prometheus metrics middleware;
  static metrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      const start.Time = Date.now();
      reqprometheusStart.Time = start.Time// Override resend to capture final metrics;
      const original.End = resend;
      resend = function (
        chunk?: any;
        encodingOr.Callback?: Buffer.Encoding | (() => void);
        callback?: () => void) {
        const end.Time = Date.now();
        const duration = end.Time - start.Time// Extract requestdata;
        const { method } = req;
        const route = PrometheusMiddlewareextract.Route(req);
        const { status.Code } = res;
        const ai.Service = (reqheaders['x-ai-service'] as string) || 'unknown';
        const request.Size = PrometheusMiddlewaregetRequest.Size(req);
        const response.Size = PrometheusMiddlewaregetResponse.Size(res)// Record HTT.P metrics;
        metricsCollectorrecordHttp.Request(
          method;
          route;
          status.Code;
          duration;
          request.Size;
          response.Size;
          ai.Service)// Log metrics collection for debugging;
        loggerdebug('Prometheus metrics recorded', LogContextPERFORMANC.E, {
          method;
          route;
          status_code: status.Code;
          duration_ms: duration;
          ai_service: ai.Service;
          request_size: request.Size;
          response_size: response.Size})// Special handling for Sweet Athena metrics;
        if (PrometheusMiddlewareisAthena.Request(req)) {
          PrometheusMiddlewarerecordAthena.Metrics(req, res, duration)}// Call original end method;
        const encoding = typeof encodingOr.Callback === 'string' ? encodingOr.Callback : 'utf8';
        const cb = typeof encodingOr.Callback === 'function' ? encodingOr.Callback : callback;
        return original.Endcall(this, chunk, encoding, cb)};
      next()}}// Sweet Athena specific metrics collection;
  static athenaMetrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (PrometheusMiddlewareisAthena.Request(req)) {
        // Add Athena-specific metric recording to request;
        reqrecordAthena.Interaction = (
          interaction.Type: string;
          personality.Mood: string;
          sweetness.Level: number;
          responseTime.Ms?: number) => {
          const user.Id = (reqheaders['x-user-id'] as string) || 'anonymous';
          const session.Id = (reqheaders['x-session-id'] as string) || reqrequest.Id || 'unknown';
          const model = reqbody?model || 'default';
          const actualResponse.Time =
            responseTime.Ms || Date.now() - (reqprometheusStart.Time || Date.now());
          metricsCollectorrecordAthena.Interaction(
            interaction.Type;
            personality.Mood;
            user.Id;
            session.Id;
            actualResponse.Time;
            sweetness.Level;
            model);
          loggerinfo('Sweet Athena metrics recorded', LogContextATHEN.A, {
            interaction_type: interaction.Type;
            personality_mood: personality.Mood;
            sweetness_level: sweetness.Level;
            response_time_ms: actualResponse.Time;
            user_id: user.Id;
            session_id: session.Id;
            model})}};

      next()}}// Database metrics middleware;
  static databaseMetrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add database metric recording to request;
      reqrecordDatabase.Operation = (
        table: string;
        operation: string;
        duration.Ms: number;
        error instanceof Error ? errormessage : String(error)  string) => {
        metricsCollectorrecordDatabase.Operation(table, operation, duration.Ms, error instanceof Error ? errormessage : String(error);
        loggerdebug('Database metrics recorded', LogContextDATABAS.E, {
          table;
          operation;
          duration_ms: duration.Ms;
          error;
          request_id: reqrequest.Id})};
      next()}}// Memory metrics middleware;
  static memoryMetrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add memory metric recording to request;
      reqrecordMemory.Operation = (
        operation.Type: string;
        memory.Type: string;
        duration.Ms: number;
        accuracy?: number) => {
        const ai.Service = (reqheaders['x-ai-service'] as string) || 'unknown';
        metricsCollectorrecordMemory.Operation(
          operation.Type;
          memory.Type;
          ai.Service;
          duration.Ms;
          accuracy);
        loggerdebug('Memory metrics recorded', LogContextMEMOR.Y, {
          operation_type: operation.Type;
          memory_type: memory.Type;
          duration_ms: duration.Ms;
          accuracy;
          ai_service: ai.Service;
          request_id: reqrequest.Id})};
      next()}}// Security metrics middleware;
  static securityMetrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Add security metric recording to request;
      reqrecordSecurity.Event = (event.Type: string, severity: string) => {
        const source.Ip = reqip || reqconnectionremote.Address || 'unknown';
        metricsCollectorrecordSecurity.Event(event.Type, severity, source.Ip);
        loggerinfo('Security metrics recorded', LogContextSECURIT.Y, {
          event_type: event.Type;
          severity;
          source_ip: source.Ip;
          user_agent: reqget('User-Agent');
          request_id: reqrequest.Id})};
      next()}}// Test metrics middleware (for test environments);
  static testMetrics.Collector() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (process.envNODE_EN.V === 'test' || reqheaders['x-test-environment']) {
        reqrecordTest.Execution = (
          test.Suite: string;
          test.Type: string;
          status: string;
          duration.Ms: number) => {
          metricsCollectorrecordTest.Execution(test.Suite, test.Type, status, duration.Ms);
          loggerdebug('Test metrics recorded', LogContextTES.T, {
            test_suite: test.Suite;
            test_type: test.Type;
            status;
            duration_ms: duration.Ms;
            request_id: reqrequest.Id})}};
;
      next()}}// Metrics endpoint middleware;
  static metrics.Endpoint() {
    return async (req: Request, res: Response) => {
      try {
        const metrics = await metricsCollectorget.Metrics();
        resset('Content-Type', registercontent.Type);
        ressend(metrics);
        loggerdebug('Prometheus metrics endpoint accessed', LogContextPERFORMANC.E, {
          request_id: reqrequest.Id;
          ai_service: reqheaders['x-ai-service'];
          source_ip: reqip})} catch (error) {
        loggererror('Failed to generate Prometheus metrics', LogContextPERFORMANC.E, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
          request_id: reqrequest.Id});
        resstatus(500)json({
          error instanceof Error ? errormessage : String(error) 'Failed to generate metrics';
          timestamp: new Date()toISO.String()})}}}// Health check endpoint with Prometheus integration;
  static healthCheck.Endpoint() {
    return async (req: Request, res: Response) => {
      try {
        const health.Data = {
          status: 'healthy';
          timestamp: new Date()toISO.String();
          uptime: processuptime();
          memory: processmemory.Usage();
          metrics_enabled: true;
          prometheus_registry: typeof registermetrics === 'function' ? 'active' : 'inactive'}// Update health metrics;
        metricsCollectorrecordTest.Execution('health_check', 'endpoint', 'pass', 0);
        resjson(health.Data);
        loggerdebug('Health check endpoint accessed', LogContextSYSTE.M, {
          request_id: reqrequest.Id;
          health_status: 'healthy';
          uptime: processuptime()})} catch (error) {
        loggererror('Health check failed', LogContextSYSTE.M, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
          request_id: reqrequest.Id});
        resstatus(500)json({
          status: 'unhealthy';
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
          timestamp: new Date()toISO.String()})}}}// Helper methods;
  private static extract.Route(req: Request): string {
    // Extract meaningful route pattern;
    const path = reqpath || requrl || '/'// Replace I.Ds with patterns for better grouping;
    return path;
      replace(/\/\d+/g, '/:id');
      replace(/\/[a-f0-9-]{36}/g, '/:uuid');
      replace(/\/[a-f0-9]{24}/g, '/: objectid');
  };

  private static getRequest.Size(req: Request): number {
    const content.Length = reqget('Content-Length');
    if (content.Length) {
      return parse.Int(content.Length, 10, 10)}// Estimate size from body if available;
    if (reqbody) {
      try {
        return JSO.N.stringify(reqbody)length} catch {
        return 0}};

    return 0};

  private static getResponse.Size(res: Response): number {
    const content.Length = resget('Content-Length');
    if (content.Length) {
      return parse.Int(content.Length, 10, 10)}// Estimate from response data if available;
    return 0// Would need to capture response body to calculate accurately};

  private static isAthena.Request(req: Request): boolean {
    return (
      reqpathincludes('/athena') ||
      reqpathincludes('/assistant') ||
      reqpathincludes('/conversation') ||
      reqheaders['x-ai-service'] === 'sweet-athena')};

  private static recordAthena.Metrics(req: Request, res: Response, duration: number) {
    try {
      const interaction.Type =
        reqbody?interaction_type ||
        (reqqueryinteraction_type as string) ||
        PrometheusMiddlewareinferInteraction.Type(reqpath);
      const personality.Mood =
        reqbody?personality_mood || (reqquerypersonality_mood as string) || 'sweet';
      const sweetness.Level =
        reqbody?sweetness_level ||
        (reqquerysweetness_level ? Number(reqquerysweetness_level) : 8);
      const user.Id = (reqheaders['x-user-id'] as string) || 'anonymous';
      const session.Id = (reqheaders['x-session-id'] as string) || reqrequest.Id || 'unknown';
      const model = reqbody?model || 'default';
      metricsCollectorrecordAthena.Interaction(
        interaction.Type;
        personality.Mood;
        user.Id;
        session.Id;
        duration;
        sweetness.Level;
        model);
      loggerinfo('Athena interaction metrics recorded automatically', LogContextATHEN.A, {
        interaction_type: interaction.Type;
        personality_mood: personality.Mood;
        sweetness_level: sweetness.Level;
        duration_ms: duration;
        status_code: resstatus.Code})} catch (error) {
      loggererror('Failed to record Athena metrics', LogContextATHEN.A, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
        request_id: reqrequest.Id})}};

  private static inferInteraction.Type(path: string): string {
    if (pathincludes('/chat')) return 'conversation';
    if (pathincludes('/avatar')) return 'avatar_animation';
    if (pathincludes('/teach')) return 'teach_me';
    if (pathincludes('/memory')) return 'memory_access';
    return 'general'}}// Extend Express Request interface;
declare module 'express-serve-static-core' {
  interface Request {
    recordAthena.Interaction?: (
      interaction.Type: string;
      personality.Mood: string;
      sweetness.Level: number;
      responseTime.Ms?: number) => void;
    recordDatabase.Operation?: (
      table: string;
      operation: string;
      duration.Ms: number;
      error instanceof Error ? errormessage : String(error)  string) => void;
    recordMemory.Operation?: (
      operation.Type: string;
      memory.Type: string;
      duration.Ms: number;
      accuracy?: number) => void;
    recordSecurity.Event?: (event.Type: string, severity: string) => void;
    recordTest.Execution?: (
      test.Suite: string;
      test.Type: string;
      status: string;
      duration.Ms: number) => void;
  }};

export default Prometheus.Middleware;